'use strict';

/**
 * =============================================================================
 * ONBOARDING GUIDE – Nmind Companion Browser Extension
 * =============================================================================
 *
 * This repository ships a WebExtension (Chrome + Firefox).
 * This gulpfile is the single source of truth for the developer workflow
 * and release packaging.
 *
 * It provides a complete pipeline:
 *
 *   clean
 *     -> prepare
 *       -> build (scripts / styles / assets / locales / html / staticLib)
 *         -> bundle (Browserify)
 *           -> package
 *             -> run / watch
 *
 * -----------------------------------------------------------------------------
 * 1) Glossary (core globals)
 * -----------------------------------------------------------------------------
 *
 * - __context
 *     Immutable-ish build context computed once at startup.
 *     It contains:
 *       - cwd
 *       - TARGET (chrome | firefox)
 *       - environment flags (isDevelopment / isProduction)
 *       - watchMode
 *
 *     Treat __context as the single source of truth for conditional behavior
 *     (dev vs prod, watch vs release).
 *
 * - __paths
 *     Resolved path map loaded from config/paths.json (with ${...} interpolation).
 *     It defines:
 *       - source and target roots
 *       - logical groups (scripts, styles, assets, locales, html, staticLib)
 *       - bundle definitions (entry, watch globs, output file, output target)
 *
 * - __options
 *     Toolchain options loaded from config/options.json (also interpolated).
 *     Holds configuration for:
 *       - browserify
 *       - babelify / babel
 *       - terser
 *       - web-ext runner
 *
 * - __bundles
 *     Validated bundle registry derived from __paths.bundles.
 *     Keys are bundle names:
 *       background / content / popup / settings / public / shared
 *
 * - __watcher
 *     Runtime registry for anything that must be closed explicitly:
 *       - chokidar file watchers
 *       - spawned runner process (web-ext run)
 *       - callbacks used to unblock gulp tasks on exit
 *
 * -----------------------------------------------------------------------------
 * 2) How TARGET works (Chrome vs Firefox)
 * -----------------------------------------------------------------------------
 *
 * The environment variable TARGET selects both:
 *   - the output build directory
 *   - the manifest variant
 *
 *   TARGET=chrome   -> build/chrome
 *   TARGET=firefox  -> build/firefox
 *
 * TARGET is validated early. Any other value is a hard error to prevent writing
 * files into unexpected locations or packaging invalid artifacts.
 *
 * -----------------------------------------------------------------------------
 * 3) Build outputs (where things go)
 * -----------------------------------------------------------------------------
 *
 * The output root is:
 *
 *   __paths.target  -> build/<target>   (e.g. build/firefox)
 *
 * Under that root:
 *   - bundles/*      Browserify bundles (background/content/...)
 *   - css/*          Compiled styles (scss / less)
 *   - assets/*       Copied static assets
 *   - locales/*      i18n resources
 *   - manifest.json  Generated from manifest_<target>.json
 *
 * -----------------------------------------------------------------------------
 * 4) Bundle model (entry vs watch globs)
 * -----------------------------------------------------------------------------
 *
 * Each bundle is defined in paths.json:
 *   - entry
 *       A SINGLE file (no globs) used by Browserify to build the dependency graph.
 *
 *   - watch
 *       Optional glob(s) used only in watch mode to trigger rebuilds.
 *
 *   - bundle
 *       Output path relative to the target root
 *       (e.g. "bundles/background.js").
 *
 *   - target
 *       Usually "${__paths.target}".
 *
 * IMPORTANT:
 *   - entry must be unique, explicit, and stable.
 *   - watch globs may be broad.
 *
 * -----------------------------------------------------------------------------
 * 5) Reliability notes (important design decisions)
 * -----------------------------------------------------------------------------
 *
 * - Browserify / Watchify caches
 *   Browserify maintains incremental caches. Sharing cache/packageCache objects
 *   across multiple bundlers leads to cross-talk and non-deterministic builds.
 *   Each bundle therefore gets its own cache and packageCache instances.
 *
 * - Waiting for bundle completion
 *   Browserify bundles go through several adapters
 *   (vinyl-source-stream -> vinyl-buffer -> dest).
 *   When bundling multiple bundles in parallel, gulp may otherwise consider the
 *   task finished before the last file is fully written.
 *   `_Tbundles()` explicitly awaits stream finish/end events.
 *
 * - Windows runner shutdown
 *   On Windows, `web-ext run` may spawn Firefox in a detached way.
 *   Shutting down cleanly often requires killing a full process tree
 *   using `taskkill /T /F`.
 *
 * -----------------------------------------------------------------------------
 * 6) Watch mode overview
 * -----------------------------------------------------------------------------
 *
 * `gulp watch`:
 *   - enables __context.watchMode
 *   - runs an initial full build (ensuring build/<target> is complete)
 *   - starts file watchers for incremental rebuilds and copies
 *   - optionally spawns `web-ext run` for live reload testing
 *
 * On exit:
 *   - all file watchers are closed
 *   - the runner process is stopped
 *   - on Windows, the Firefox process tree is force-terminated if needed
 *
 * -----------------------------------------------------------------------------
 * 7) Common commands
 * -----------------------------------------------------------------------------
 *
 * - Build only:
 *     cross-env TARGET=firefox gulp build
 *     cross-env TARGET=chrome  gulp build
 *
 * - Watch + run in Firefox:
 *     cross-env TARGET=firefox gulp watch
 *
 * - Package release artifact:
 *     cross-env TARGET=firefox gulp package
 *
 * -----------------------------------------------------------------------------
 * 8) Debug tips
 * -----------------------------------------------------------------------------
 *
 * - Missing bundles:
 *     Check bundle registry logs at startup and verify paths.json entries.
 *     Ensure `_Tbundles()` is awaited.
 *
 * - Slow watch rebuilds:
 *     Ensure minification and sourcemaps are disabled in watch mode.
 *
 * - Firefox not closing on exit (Windows):
 *     Ensure taskkill is used instead of relying on SIGTERM alone.
 *
 * =============================================================================
 */

//---------------------------------------------------------------------------
//#region Libraries
//

const EventEmitter = require('events');

const $ = {

  node: {
    path: require('path'),
    fs: require("fs"),
    process: require('process'),
    glob: require("glob"),
    spawn : require('node:child_process').spawn
  },

  del: require('del').deleteAsync,

  utils: {
    log: require('fancy-log'),
    replaceExt: require('replace-ext'),
    readline: require('readline')
  },

  gulp: require("gulp"),

  gs: {
      autoprefixer : require('autoprefixer'),
      babel        : require('gulp-babel'),
      changed      : require('gulp-changed').default ?? require('gulp-changed'),
      cleanDest    : require('gulp-clean-dest'),
      debug        : require('gulp-debug'),
      eslintNew    : require('gulp-eslint-new'),
      fileSync     : require('gulp-file-sync'),
      less         : require('gulp-less'),
      mergeJson    : require('gulp-merge-json'),
      rename       : require('gulp-rename'),
      runner       : require('web-ext').default ?? require('web-ext'),
      postcss      : require('gulp-postcss'),
      plumber      : require('gulp-plumber'),
      sass         : require('gulp-sass')(require('sass')),
      sourcemaps   : require('gulp-sourcemaps'),
      tap          : require('gulp-tap'),
      terser       : require('gulp-terser'),
      zip          : require('gulp-zip').default ?? require('gulp-zip'),
      _if          : require('gulp-if'),
  },

  build: {
    browserify: require("browserify"),
    watchify: require("watchify"),
    buffer: require("vinyl-buffer"),
    source: require('vinyl-source-stream')
  }

}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Configuration & context
//

/**
 * Resolves template placeholders inside JSON configuration values.
 * This is used as the `reviver` argument of `JSON.parse()` when loading `config/paths.json`
 * and `config/options.json`.
 *
 * It supports placeholders like `${__paths.target}` / `${__context.isDevelopment}` / `${__options.*}`.
 * Only string values are processed; non-strings are returned unchanged.
 *
 * If a placeholder cannot be resolved, the function logs an error and returns the original value
 * (unresolved), so downstream validations should catch missing/invalid config.
 *
 * @param {any} key Parameter (see description above / inline comments).
 * @param {any} value Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function reviveImport(key, value) {

  if (typeof value !== "string") {
    return value;
  }

  const regex = RegExp('\\${(.+)}', 'g');
  const result = regex.exec(value);

  if (result !== null && result.length === 2) {
    const whole = result[0];
    const searched = result[1];
    const parts = searched.split('.');
    let varia = null;

    try {

      parts.reduce((count, currentValue) => {

        // Search main object
        if (count === 0) {

          switch (currentValue) {

            case "__paths":
              varia = __paths;
              break;

            case "__context":
              varia = __context;
              break;

            case "__options":
              varia = __options;
              break;

            default:
              throw "Unknown part " + currentValue + " in " + searched;
          }

        } else { // search for value

          if(varia[currentValue] === undefined){
            throw "Unknown part " + currentValue + " in " + searched;
          } else {
            varia = varia[currentValue];
          }

        }

      }, 0);

      value = value.replace(whole, varia);

    } catch (e) {
      log(e);
    }

  }

  return value;
}

/**
 * Loads an environment JSON file (e.g. `config/development.json`) and returns:
 * - `whole`: the base object with per-target sections removed
 * - `specs`: the object section for the requested target (`chrome` or `firefox`)
 *
 * This lets `createContext()` merge common settings with target-specific overrides.
 *
 * @param {any} path Parameter (see description above / inline comments).
 * @param {any} target Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function parseSpecs(path, target) {
  const whole = JSON.parse($.node.fs.readFileSync(path));
  const specs = whole[target];

  delete whole.firefox;
  delete whole.chrome;

  return { whole, specs };
}

/**
 * Builds the immutable build context (`__context`) for the current gulp run.
 *
 * Responsibilities:
 * - read and validate `NODE_ENV` and `TARGET`
 * - load the matching env config file (`config/<NODE_ENV>.json`) and merge target overrides
 * - expose convenience booleans (`isDevelopment`, `isProduction`, `isChrome`, `isFirefox`)
 * - expose runtime info used throughout the pipeline (cwd, watchMode flag)
 *
 * This function is intentionally called once at module load so all tasks share a single source of truth.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function createContext() {
  const environment = $.node.process.env.NODE_ENV || 'development';
  const target = ($.node.process.env.TARGET ?? 'firefox').toString().trim().toLowerCase();

  if (!ALLOWED_TARGETS.has(target)) {
    throw new Error(
      `Invalid TARGET "${target}". Expected one of: chrome, firefox.`
    );
  }
  const {whole, specs} = parseSpecs(`./config/${environment}.json`, target);

  return merge(
    whole,
    specs,
    {
      target: target,
      isDevelopment: environment === "development",
      isProduction: environment === "production",
      isChrome: target === "chrome",
      isFirefox: target === "firefox",
      cwd: $.node.process.cwd(),
      watchMode: false
    }
  );
}

/**
 * Loads `config/paths.json` into `__paths` and expands `${...}` placeholders via `reviveImport`.
 * The resulting object becomes the canonical path map used by build, watch and package steps.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function importPaths() {
  __paths = merge(
    __paths, 
    JSON.parse($.node.fs.readFileSync(`./config/paths.json`), reviveImport)
  );
}

/**
 * Loads `config/options.json` into `__options` and expands `${...}` placeholders via `reviveImport`.
 * Options include browserify/babelify/terser settings and web-ext runner settings.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function importOptions() {
  __options = merge(
    __options, 
    JSON.parse($.node.fs.readFileSync(`./config/options.json`), reviveImport)
  );
}

/**
 * Validates and materializes the bundle configuration defined in `paths.json` (`__paths.bundles`).
 *
 * Validation goals:
 * - every bundle must have a single `entry` file (no globbing)
 * - optional `watch` globs must be present to support extra triggers beyond watchify
 * - `bundle` (output path relative to target) and `target` (output root) must be defined
 *
 * On success, assigns `__bundles` used by `doBuildBundle()` and `_Tbundles()`.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function importBundles() {

  const names = Object.keys(__paths.bundles || {}).sort();
  if (!names.length) {
    throw new Error('[build] No bundles defined in paths.json.');
  }

  for (const name of names) {
    const cfg = __paths.bundles[name];

    if (!cfg.entry || typeof cfg.entry !== 'string') {
      throw new Error(`[build] Bundle "${name}" is missing "entry" in paths.json or is not a string`);
    }
    if (/[?*[\]{}!]/.test(cfg.entry)) {
      throw new Error(
        `[build] Bundle "${name}" has an invalid entry (glob pattern detected): ${cfg.entry}\n` +
        `Fix: set a single file path as "entry" and move patterns to "watch".`
      );
    }
    if (!cfg.watch) {
      throw new Error(`[build] Bundle "${name}" is missing "watch" in paths.json`);
    }
    if (!cfg.bundle || typeof cfg.bundle !== 'string') {
      throw new Error(`[build] Bundle "${name}" is missing "bundle" in paths.json or is not a string`);
    }
    if (!cfg.target || typeof cfg.target !== 'string') {
      throw new Error(`[build] Bundle "${name}" is missing "target" in paths.json or is not a string`);
    }

    log(`Bundle found ${name} : ${cfg.bundle}`);
  }

  __bundles = __paths.bundles;

}

/**
 * -----------------------------------------------------------------------------
 * GLOBAL RUNTIME STATE (module-level)
 * -----------------------------------------------------------------------------
 * This gulpfile runs as a Node.js module: everything at the top-level executes
 * once when Gulp loads the file.
 *
 * We keep a small amount of global state to coordinate:
 * - Build context (`__context`): target (chrome|firefox), env (dev|prod), watchMode�
 * - Resolved paths/options (`__paths`, `__options`): loaded from config/*.json with ${...} interpolation
 * - Bundle registry (`__bundles`): derived from paths.json and validated at startup
 * - Watch/runtime handles (`__watcher`, `__bundlers`): used to close watchers and child processes cleanly
 *
 * Onboarding note:
 * - If something �happens too early�, it is often because it runs at module load time.
 * - Prefer explicit task sequencing (gulp.series / promises) for anything asynchronous.
 * -----------------------------------------------------------------------------
 */
const ALLOWED_TARGETS = new Set(['chrome', 'firefox']);
const __bundlers = [];
const __appEvent = new EventEmitter();
const __watcher = {
  // Chokidar/Gulp watchers created during `watch` (closed on exit)
  workers: [],
  // Gulp task completion callback for the watch task (used to unblock gulp.series on exit)
  taskCallback: null,
  // Child process (spawn) for `web-ext run` (or legacy runner) when watch mode starts a browser
  runner : null,
  // Shared chokidar options for all watchers (debounce events)
  options: {
    delay: 250
  }
}

const __context = createContext();

let __paths = {
  src: './src',
  config: './config',
  target: `./build/${__context.target}`,
  release: `./build/${__context.target}`,
  dist: `./dist/`
};
importPaths();

let __options = {};
importOptions();

let __bundles = {};
importBundles();

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Helpers
//

/**
 * Maps a source file path under `__paths.src` to the corresponding path under `__paths.target`.
 *
 * Used mainly by watch handlers to delete the generated output file when a source file is removed.
 * Normalizes path separators to forward slashes so glob/watch paths behave consistently on Windows.
 *
 * @param {any} path Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function resolveInTarget(path) {
  path = $.node.path.normalize(path).replace(/\\/g, '/');

  if (!path.startsWith('./')) {
    path = './' + path
  }

  return path.replace(__paths.src, __paths.target);
}

/**
 * Copies files from the source tree to the build tree.
 *
 * This is a *copy-only* step (no transforms): it takes an input glob (relative to `src/`)
 * and writes the matched files to the corresponding folder under `build/<target>/`.
 *
 * Typical uses: assets, locales, static HTML, vendor libs, etc.
 *
 * Returns a gulp stream so it can be composed in `gulp.series/parallel`.
 *
 * @param {any} _in Parameter (see description above / inline comments).
 * @param {any} _out Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function deploy(_in, _out) {
  _in = `${__paths.src}${_in}`
  _out = `${__paths.target}${_out}`;

  log(`Deploy ${_in} ${_out}`);
  return $.gulp
    .src(_in, { read: true, allowEmpty: true })
    .pipe($.gs.tap(function (file) {
      log(`Deploy ${file.relative}`);
    }))
    .pipe($.gulp.dest(_out));
}

/**
 * Creates an event handler for chokidar/gulp watch events that keeps a folder in `build/<target>` in sync
 * with its counterpart in `src/`.
 *
 * Design:
 * - on `add` / `change`: copy only the touched file (incremental, fast)
 * - on `unlink` / `unlinkDir`: delete the corresponding output path using `del`
 *
 * This avoids expensive `cleanDest` runs on every change and keeps watch-mode responsive.
 *
 * @param {any} _in Parameter (see description above / inline comments).
 * @param {any} _out Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function sync(_in, _out) {
  const srcRoot = $.node.path.resolve($.node.process.cwd(), `${__paths.src}${_in}`);
  const outRoot = $.node.path.resolve($.node.process.cwd(), `${__paths.target}${_out}`);

  return function (event, filepath) {
    // event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
    const absFile = $.node.path.isAbsolute(filepath)
      ? filepath
      : $.node.path.resolve($.node.process.cwd(), filepath);

    const rel = $.node.path.relative(srcRoot, absFile);
    const targetPath = $.node.path.resolve(outRoot, rel);

    if (event === 'unlink' || event === 'unlinkDir') {
      return $.del([targetPath], { force: true });
    }

    if (event === 'add' || event === 'change') {
      return $.gulp
        .src(absFile, { base: srcRoot, allowEmpty: true })
        .pipe($.gulp.dest(outRoot));
    }

    return Promise.resolve();
  };

/*
  _in = `${__paths.src}${_in}`
  _out = `${__paths.target}${_out}`;

  const options = {
    recursive: true,
    addFileCallback: function (fullPathSrc, fullPathDest) {
      log('Synced ' + fullPathDest);
    },
    updateFileCallback: function (fullPathSrc, fullPathDest) {
      log('Synced ' + fullPathDest);
    },
    deleteFileCallback: function (fullPathSrc, fullPathDest) {
      log('Synced ' + fullPathDest);
    }
  }

  $.gs.fileSync(_in, _out, options);
*/
}

/**
 * Thin wrapper around `fancy-log` so the entire gulpfile uses a single logging function.
 * This makes it easy to later add prefixes (target/env), timestamps, or log levels in one place.
 *
 * @param {any} message Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function log(message) {
  $.utils.log(message);
}

/**
 * Deep-merges plain objects into a new destination object.
 *
 * Used to combine:
 * - base config + target overrides
 * - default `__paths` with `paths.json`
 * - default `__options` with `options.json`
 *
 * This helper is intentionally small and dependency-free to keep the build toolchain stable.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function merge() {

  const dst = {}, args = [].splice.call(arguments, 0);
  let src = null;

  while (args.length > 0) {
      src = args.splice(0, 1)[0];
      if (toString.call(src) === '[object Object]') {
          for (const p in src) {
              if (src.hasOwnProperty(p)) {
                  if (Object.prototype.toString.call(src[p]) === '[object Object]') {
                      dst[p] = merge(dst[p] || {}, src[p]);
                  } else {
                      dst[p] = src[p];
                  }
              }
          }
      }
  }

  return dst;
}

/**
 * Fail-fast guard used before reading required files from disk.
 *
 * Primary use: validate `config/manifest_<target>.json` exists before attempting to merge it into
 * `src/manifest.json`.
 *
 * Throws an Error with an actionable message when a file is missing.
 *
 * @param {any} filePath Parameter (see description above / inline comments).
 * @param {any} description Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function assertFileExists(filePath, description) {
  if (!$.node.fs.existsSync(filePath)) {
    throw new Error(
      `[build] Missing ${description} file: ${filePath}\n` +
      `Expected: config/manifest_<target>.json (e.g. config/manifest_chrome.json, config/manifest_firefox.json)\n` +
      `Current TARGET: ${__context?.target ?? '(unknown)'}\n` +
      `Fix: create the missing file or set TARGET=chrome|firefox`
    );
  }
}

/**
 * Converts an arbitrary string (extension name/version) into a filesystem-safe slug.
 *
 * Used when generating package artifact names to avoid:
 * - spaces / unicode / accents
 * - Windows-reserved characters (`<>:"/\|?*`)
 * - leading/trailing punctuation
 *
 * Guarantees a non-empty, bounded-length result.
 *
 * @param {any} input Parameter (see description above / inline comments).
 * @param {any} maxLen = 80 Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function sanitizeFilenamePart(input, maxLen = 80) {
  const s = String(input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  const safe = s.length ? s : 'extension';
  return safe.slice(0, maxLen);
}

/**
 * Converts a gulp/vinyl stream into a Promise that resolves when writing has completed.
 *
 * Why this exists:
 * Browserify bundles go through several adapters (vinyl-source-stream -> vinyl-buffer -> dest).
 * In practice, gulp can consider a task 'done' too early when you merge multiple bundle streams.
 * By awaiting `finish`/`end` we guarantee that files are fully written before the task completes.
 *
 * @param {any} stream Parameter (see description above / inline comments).
 * @param {any} name Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function streamToPromise(stream, name) {
  return new Promise((resolve, reject) => {
    if (!stream || typeof stream.on !== 'function') {
      reject(new Error(`[build] ${name} did not return a stream`));
      return;
    }
    stream.on('finish', resolve);
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region System
//

$.utils.readline.emitKeypressEvents($.node.process.stdin);
if ($.node.process.stdin.isTTY) {
  $.node.process.stdin.setRawMode(true);
}

__appEvent.on('app.requestExit', (from) => {

    log(`Exit request from ${from}`);

    if(__watcher.runner){

      log(`kill ${__watcher.runner.pid} ${$.node.process.platform}`);

      if ($.node.process.platform === 'win32') {
        $.node.spawn('taskkill', ['/pid', String(__watcher.runner.pid), '/T', '/F'], {
          stdio: 'ignore'
        });
      } else {
        __watcher.runner.kill('SIGTERM');
      }
    }

    watchersCloseAll();

    if (__watcher.taskCallback) {
      __watcher.taskCallback();
    }

    log('Bye bye');
    $.node.process.exit();
});

$.node.process.on('SIGINT', function () {
  log('Signal received : SIGINT, now exiting ...');
  __appEvent.emit('app.requestExit', 'Signal watcher : SIGINT');
});

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Build and deploy
//
/**
 * Deletes build output folders/files using `del`.
 *
 * Default behavior: remove the entire build target directory (`build/<target>`).
 * Called at the start of `build` and also by watch handlers when files are deleted.
 *
 * @param {any} path Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doClean(path) {
    const targetPath = path || __paths.target;
    return $.del([targetPath], { force: true });
}

/**
 * Builds the final `manifest.json` for the current TARGET.
 *
 * Process:
 * 1) validate `config/manifest_<target>.json` exists
 * 2) read that file and merge it into the base `src/manifest.json`
 * 3) write the merged manifest into `build/<target>/manifest.json`
 *
 * This keeps shared manifest fields in one place while allowing per-browser differences.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployManifest() {

  const targetManifestPath = `${__paths.config}/manifest_${__context.target}.json`;
  assertFileExists(targetManifestPath, `target manifest (${__context.target})`);

  const manifest = JSON.parse($.node.fs.readFileSync(targetManifestPath, 'utf8'));

  return $.gulp.src(`${__paths.src}/manifest.json`)
    .pipe($.gs.mergeJson({
      fileName: "manifest.json",
      jsonSpace: " ".repeat(4),
      endObj: manifest
    }))
    .pipe($.gulp.dest(__paths.target));
}

/**
 * doDeployAssets is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} _asset Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployAssets(_asset) {
  return deploy(`/assets/${_asset}/**/*`, `/assets/${_asset}`);
}
/**
 * doDeployStaticStyles is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployStaticStyles() {
  return deploy(__paths.staticStyles.source, __paths.staticStyles.target);
}

/**
 * doDeployLocales is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployLocales() {
  return deploy(__paths.locales.source, __paths.locales.target);
}

/**
 * doDeployPublic is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployPublic() {
  return deploy(__paths.publicFile.source, __paths.publicFile.target);
}

/**
 * doDeployHtml is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployHtml() {
  return deploy(__paths.staticHtml.source, __paths.staticHtml.target);
}

/**
 * doDeployStaticLib is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doDeployStaticLib() {
  return deploy(__paths.staticLib.source, __paths.staticLib.target);
}

/**
 * handleBuildStreamError is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} error Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function handleBuildStreamError(error) {
  log(`Build error: ${error && (error.stack || error.message || error)}`);
}

/**
 * Compiles stylesheet sources (SCSS and LESS) into CSS under the build directory.
 *
 * Key behaviors:
 * - uses `gulp-changed` with `.css` extension to avoid unnecessary recompiles
 * - generates sourcemaps only in development
 * - runs autoprefixer via PostCSS in production (and skips it in watch mode if configured)
 * - writes output to `__paths.styles.target` in `build/<target>`
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doBuildStyles() {
  const _out = __paths.styles.target;
  const _sources = __paths.styles.source;

  return $.gulp.src(_sources, { sourcemaps: __context.isDevelopment })
    .pipe($.gs.plumber())
    .pipe($.gs.changed(_out, { extension: '.css' }))
    .pipe($.gs.tap(function (file) {
      log(`Style ${file.relative}`);
    }))

    // SCSS
    .pipe($.gs._if('*.scss', $.gs.sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    })))
    .on("error", handleBuildStreamError)

    // LESS
    .pipe($.gs._if('*.less', $.gs.less({

    })))
    .on("error", handleBuildStreamError)

    .pipe($.gs._if(__context.isProduction && !__context.watchMode, $.gs.postcss([$.gs.autoprefixer()])))
    .pipe($.gs._if(__context.isDevelopment, $.gs.sourcemaps.write('.')))
    .pipe($.gulp.dest(_out));
}

/**
 * Transpiles source scripts (JS/JSX/TS/TSX) into the build directory.
 *
 * Key behaviors:
 * - uses `gulp-babel` with `__options.babel` (NOT `babelify`) because gulp-babel uses Babel core options
 * - normalizes output extensions: `.jsx/.ts/.tsx` => `.js` to match manifest/HTML references
 * - uses terser only for production builds outside watch mode
 * - writes sourcemaps only in development
 * - uses `gulp-changed` with `.js` extension so incremental builds work despite renaming
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doBuildScripts() {
  const _out = __paths.scripts.target;
  const _sources = __paths.scripts.source;

  return $.gulp.src(_sources, { sourcemaps: __context.isDevelopment })
    .pipe($.gs.plumber({
      errorHandler: function (err) {
        handleBuildStreamError(err);
        this.emit('end');
      }
    }))
    .pipe($.gs.changed(_out, { extension: '.js' }))
    .pipe($.gs.tap(function (file) {
      log(`Script ${file.relative}`);
    }))
    .pipe($.gs.babel(__options.babel))

    // Minify
    .pipe($.gs.rename((p) => {
      if (p.extname === '.jsx' || p.extname === '.ts' || p.extname === '.tsx'){ p.extname = '.js'; }
    }))
    .pipe($.gs._if(__context.isProduction && !__context.watchMode, $.gs.terser(__options.terser)))
    .pipe($.gs._if(__context.isDevelopment, $.gs.sourcemaps.write('.')))
    .pipe($.gulp.dest(_out));
}

/**
 * Builds a single Browserify bundle for the given bundle key.
 *
 * Pipeline:
 * - Browserify is configured with per-bundle `cache/packageCache` to prevent cross-bundle interference
 * - Babelify transforms the dependency graph (supports JS/JSX/TS/TSX via options.json)
 * - In production non-watch builds, the resulting bundle is minified with terser
 * - Output is written under `build/<target>/` (typically `build/<target>/bundles/*.js`)
 *
 * Watch mode:
 * - Watchify plugin is enabled for fast incremental rebundles when dependencies change
 * - Additional glob watchers (`bundleConfig.watch`) can trigger rebuilds for non-imported resources
 *
 * @param {any} bundleName Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doBuildBundle(bundleName) {

  const bundleConfig = __bundles[bundleName];

  if (!bundleConfig) {
    throw new Error(`[build] Unknown bundle "${bundleName}"`);
  }

  const bundler = $.build.browserify(bundleConfig.entry, Object.assign({}, __options.browserify, {
    cache: {},
    packageCache: {},
  }));

  __bundlers.push(bundler);

  bundler.transform("babelify", __options.babelify);

  bundler
    .on('dep', (dep) => {
      log(`Bundle '${bundleName}' pipe > ` + dep.file.replace(__context.cwd, "."));
    })
    .on('log', (msg) => {
      log(`Bundle '${bundleName}' log > ` + msg);
    });

  function build() {
    const bundleOutFile = $.node.path.basename(bundleConfig.bundle);
    const bundleOutDir  = $.node.path.dirname(bundleConfig.bundle);

    return bundler.bundle()
      .on("error", function (error) {
        log(`Bundle '${bundleName}' error:\n${error && (error.stack || error.message || error)}`);
        this.emit('end');
      })
      .pipe($.build.source(bundleOutFile))
      .pipe($.build.buffer())
      .pipe($.gs._if(__context.isProduction && !__context.watchMode, $.gs.terser(__options.terser)))
      .pipe($.gulp.dest($.node.path.join(bundleConfig.target, bundleOutDir)))
      .on('finish', () => log(`Bundle '${bundleName}' finished writing`));
  }

  if (__context.watchMode) {
    bundler.plugin($.build.watchify);

    if (bundleConfig.watch) {
      const watchGlobs = Array.isArray(bundleConfig.watch) ? bundleConfig.watch : [bundleConfig.watch];
      const watcher = $.gulp.watch(watchGlobs, __watcher.options, build).on('all', watchEventLog);
      __watcher.workers.push(watcher);
    }

    bundler.on('update', build);
  }

  return build();

}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Watch and sync
//

/**
 * doWatchKeypress is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchKeypress(){

  $.node.process.stdin.on('keypress', (str, key) => {

    if (key.ctrl && key.name === 'c') {
      log('Signal received : CTRL+C, now exiting ...');
      __appEvent.emit('app.requestExit', 'Signal watcher : CTRL+C');
    } else {
      __appEvent.emit('cli.keypress', key);
    }

  });

}

/**
 * doWatchManifest is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchManifest() {
  // Prevent deletion
  const options = Object.assign({}, __watcher.options, { events: ['change'] });
  const _sources = [
    `${__paths.src}/manifest.json`,
    `${__paths.config}/manifest_${__context.target}.json`
  ];

  const watcher = $.gulp.watch(_sources, options, doDeployManifest)
    .on("all", watchEventLog);

  __watcher.workers.push(watcher);
}

/**
 * Starts the Firefox development runner using `web-ext run` via `npx` (spawned child process).
 *
 * This approach is used instead of the web-ext JS API because the CLI is more resilient on Windows
 * (retries debugger port, stable stdout/stderr).
 *
 * The spawned ChildProcess is stored in `__watcher.runnerProcess` so it can be terminated during cleanup.
 *
 * @param {any} resolver Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchWebext(resolver) {

  if (!__context.runner.enable) {
    log(`Extension Runner is disable for ${__context.target}`);
    resolver();
    __appEvent.emit('app.requestExit', 'No signal : Webext is disable');
    return;
  }

  const args = [
    'web-ext',
    'run',
    '--target', __context.target === 'firefox' ? 'firefox-desktop' : 'chromium',
    '--verbose', // Show verbose output
    '--no-input', // Disable all features that require standard input 
    '--reload', // Reload the extension when source files change
    '--source-dir', $.node.path.resolve(__paths.target)
  ];

  if (Array.isArray(__options.runner.startUrl)) {
    __options.runner.startUrl.forEach((url) => {
      if (typeof url === 'string' && url.trim()) {
        args.push('--start-url', url);
      }
    });
  }

  const spawned = $.node.spawn('npx', args, {
    stdio: 'pipe',
    shell: false
  });

  if(spawned.stdout){
    spawned.stdout.on('data', (data) => {
      log(`Spawned web-ext : ${data}`);
    });
  }

  spawned.on('close', (code) => {
    log(`Spawned web-ext exited with code ${code}`);
    __watcher.runner = null;
  });

  __watcher.runner = spawned;
  
  resolver();
}

/**
 * doWatchAssets is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} _asset Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchAssets(_asset) {
  doWatchSync(`/assets/${_asset}/**/*`, `/assets/${_asset}`);
}

/**
 * doWatchStaticStyles is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchStaticStyles() {
  doWatchDeploy(__paths.staticStyles.source, __paths.staticStyles.target);
}

/**
 * doWatchLocales is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchLocales() {
  doWatchSync(__paths.locales.source, __paths.locales.target);
}

/**
 * doWatchPublic is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchPublic() {
  doWatchSync(__paths.publicFile.source, __paths.publicFile.target);
}

/**
 * doWatchHtml is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchHtml() {
  doWatchDeploy(__paths.staticHtml.source, __paths.staticHtml.target);
}

/**
 * doWatchStaticLib is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchStaticLib() {
  doWatchSync(__paths.staticLib.source, __paths.staticLib.target);
}

/**
 * doWatchStyles is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchStyles() {

  const options = Object.assign({}, __watcher.options, { events: ['add', 'change', 'unlink'] });
  const watcher = $.gulp.watch(__paths.styles.source, options)
    .on("all", function (event, path) {
      watchEventLog(event, path);

      switch (event) {
        case 'add':
        case 'change':
          doBuildStyles();
          break;

        case 'unlink':
          path = resolveInTarget(path);
          doClean($.utils.replaceExt(path, '.css'));
          doClean($.utils.replaceExt(path, '.css.map'));
          break;
      }
    });

  __watcher.workers.push(watcher);

}

/**
 * doWatchScripts is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchScripts() {

  const watcher = $.gulp.watch(__paths.scripts.source, __watcher.options)
    .on("all", function (event, path) {
      watchEventLog(event, path);

      switch (event) {
        case 'add':
        case 'change':
          doBuildScripts();
          break;

        case 'unlink':
          path = resolveInTarget(path);
          doClean($.utils.replaceExt(path, '.js'));
          doClean($.utils.replaceExt(path, '.js.map'));
          doClean($.utils.replaceExt(path, '.jsx'));
          doClean($.utils.replaceExt(path, '.jsx.map'));
          break;
      }
    });

  __watcher.workers.push(watcher);
}

/**
 * doWatchDeploy is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} _in Parameter (see description above / inline comments).
 * @param {any} _out Parameter (see description above / inline comments).
 * @param {any} _handler Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchDeploy(_in, _out, _handler) {

  if (!_handler) {
    _handler = function (event, path) {
      watchEventLog(event, path);

      switch (event) {
        case 'add':
        case 'change':
        case 'addDir':
          // recopier
          return deploy(_in, _out);

        case 'unlink':
        case 'unlinkDir':
          return doClean(resolveInTarget(path));
      }

    };
  }

  const options = Object.assign({}, __watcher.options, { events: ['add', 'change', 'unlink', 'unlinkDir'] });
  const watcher = $.gulp.watch(`${__paths.src}${_in}`, options)
    .on("all", _handler)
    .on('error', error => {
      // https://github.com/paulmillr/chokidar/issues/566#issuecomment-468574563
      // Ignore EPERM errors in windows, which happen if you delete watched folders...
      if (error.code === 'EPERM' && require('os').platform() === 'win32') {
        return;
      }
    });

  __watcher.workers.push(watcher);
}

/**
 * doWatchSync is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} _source Parameter (see description above / inline comments).
 * @param {any} _in Parameter (see description above / inline comments).
 * @param {any} _out Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function doWatchSync(_source, _in, _out) {
  _out = _out || _in;
  const handler = sync(_in, _out);

  const options = Object.assign({}, __watcher.options, { events: ['add', 'change', 'unlink', 'unlinkDir'] });
  const watcher = $.gulp.watch(`${__paths.src}${_source}`, options)
    .on("all", function (event, path) {
      watchEventLog(event, path);
      return handler(event, path);
    }).on('error', error => {
      // https://github.com/paulmillr/chokidar/issues/566#issuecomment-468574563
      // Ignore EPERM errors in windows, which happen if you delete watched folders...
      if (error.code === 'EPERM' && require('os').platform() === 'win32') {
        return;
      }
    });

  __watcher.workers.push(watcher);
}

/**
 * watchEventLog is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} event Parameter (see description above / inline comments).
 * @param {any} path Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function watchEventLog(event, path) {
  path = $.node.path.normalize(path).replace(/\\/g, '/');
  log(`Watch ${event} '${path}'`);
}

/**
 * watchersCloseAll is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
async function watchersCloseAll() {
  await Promise.all(__watcher.workers.map(w => w.close()));
}
//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Task : Build and deploy
//
/**
 * _Tclean is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tclean() {
  return doClean();
}

/**
 * _TprepareBuild is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} resolve Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _TprepareBuild(resolve) {
  resolve();
}

/**
 * _Tmanifest is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tmanifest() {
  return doDeployManifest();
}

/**
 * _Tassets is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
async function _Tassets() {

  const names = ['icons', 'images', 'public'];
  const streams = names.map((n) => doDeployAssets(n));

  await Promise.all(streams.map((s, i) => streamToPromise(s, `bundle:${names[i]}`)));
}

/**
 * _Tlocales is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tlocales() {
  return doDeployLocales();
}

/**
 * _Tpublic is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tpublic() {
  return doDeployPublic();
}

/**
 * _Thtml is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Thtml() {
  return doDeployHtml();
}

/**
 * _Tstyles is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tstyles() {
  return doBuildStyles();
}

/**
 * _TstaticStyles is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _TstaticStyles() {
  return doDeployStaticStyles();
}

/**
 * _Tscripts is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tscripts() {
  return doBuildScripts();
}

/**
 * Gulp task that builds all bundles defined in `paths.json`.
 *
 * Uses `streamToPromise` + `Promise.all` to ensure gulp waits until every bundle stream has fully written
 * its output files before marking the task as complete.
 *
 * @returns {Promise<void>} Return value (gulp stream / Promise / void depending on usage).
 */
async function _Tbundles() {
  const names = Object.keys(__bundles);
  const streams = names.map((n) => doBuildBundle(n));

  await Promise.all(streams.map((s, i) => streamToPromise(s, `bundle:${names[i]}`)));
}

/**
 * _TstaticLib is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _TstaticLib() {
  return doDeployStaticLib();
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Task : Watch
//
/**
 * _ThandleKeypress is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} resolve Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _ThandleKeypress(resolve){
  doWatchKeypress();
  resolve();
}

/**
 * _Twebext is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} resolve Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Twebext(resolve) {
  doWatchWebext(resolve);
}

/**
 * _Twatch is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} resolve Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Twatch(resolve) {
  __watcher.taskCallback = resolve;

  doWatchAssets('icons');
  doWatchAssets('images');
  doWatchAssets('public');
  doWatchLocales();
  doWatchManifest();
  doWatchStaticStyles();
  doWatchPublic();
  doWatchHtml();
  doWatchStaticLib();
  doWatchStyles();
  doWatchScripts();
  // Bundles already started in watchMode by _TprepareWatch and _Tbundles
}

/**
 * _TprepareWatch is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @param {any} resolve Parameter (see description above / inline comments).
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _TprepareWatch(resolve) {
  __context.watchMode = true;
  resolve();
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Task : Package
//
/**
 * Creates a distributable archive from `build/<target>`:
 * - generates a sanitized filename from manifest name/version
 * - excludes common junk files and, in production, sourcemaps
 * - produces `.xpi` for Firefox and `.zip` for Chrome by default
 * - writes artifacts under `dist/<target>/`
 *
 * @returns {any} Return value (gulp stream / Promise / void depending on usage).
 */
function _Tpackage() {
  const manifest = JSON.parse($.node.fs.readFileSync(`${__paths.target}/manifest.json`, 'utf8'));
  const extension = __context.isFirefox ? "xpi" : "zip";
  const safeName = sanitizeFilenamePart(manifest.name);
  const safeVersion = sanitizeFilenamePart(manifest.version, 32);
  const filename = `package-${safeName}-${safeVersion}.${extension}`

  const target = [
    `${__paths.target}/**/*`,

    `!${__paths.target}/**/.DS_Store`,
    `!${__paths.target}/**/Thumbs.db`,
    `!${__paths.target}/**/*.log`,
    `!${__paths.target}/**/*.tmp`,
    `!${__paths.target}/**/.cache/**`,
    `!${__paths.target}/**/.eslintcache`,

    ...(__context.isProduction ? [`!${__paths.target}/**/*.map`] : []),
  ];

  return $.gulp.src(target, { read: true, allowEmpty: true })
    .pipe($.gs.zip(filename))
    .pipe($.gulp.dest(`${__paths.dist}/${__context.target}`));
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Series
//
/**
 * Main build pipeline:
 * 1) clean build directory
 * 2) prepare build (context already initialized)
 * 3) copy static assets + manifest + locales + html + libs (in parallel)
 * 4) transpile non-bundled scripts
 * 5) build browserify bundles
 *
 * Designed so the `build/<target>` folder is self-contained and ready for packaging or running.
 *
 * @returns {Function} Return value (gulp stream / Promise / void depending on usage).
 */
function _Sbuild() {
  return $.gulp.series(
    _Tclean,
    _TprepareBuild,
    $.gulp.parallel(
      _Tmanifest,
      _Tstyles,
      _TstaticStyles,
      _Tassets,
      _Tlocales,
      _Tpublic,
      _Thtml,
      _TstaticLib,
    ),
    _Tscripts,
    _Tbundles
  );
}

/**
 * Main watch pipeline:
 * - enables watchMode
 * - runs a full build once
 * - starts file watchers for incremental updates
 * - starts the web-ext runner (Firefox) to load the extension from `build/<target>`
 *
 * On exit (Ctrl+C), the pipeline attempts to close all watchers and terminate the runner cleanly.
 *
 * @returns {Function} Return value (gulp stream / Promise / void depending on usage).
 */
function _Swatch() {
  return $.gulp.series(
    _TprepareWatch,
    _Sbuild(),
    _ThandleKeypress,
    $.gulp.parallel(
      _Twatch,
      _Twebext
    )
  );
}

/**
 * _Spackage is part of the gulp build system.
 *
 * This function is documented to help onboarding. Read the implementation for the exact behavior.
 * Key things to check when modifying: side effects (FS/process/watchers), whether it returns a stream/Promise, and how errors are handled.
 *
 * @returns {Function} Return value (gulp stream / Promise / void depending on usage).
 */
function _Spackage() {
  return $.gulp.series(
    _Sbuild(),
    _Tpackage
  );
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Exports
//

exports.clean = _Tclean;
exports.watch = _Swatch();
exports.build = _Sbuild();
exports.package = _Spackage();
exports.default = _Tclean;

//#endregion ----------------------------------------------------------------