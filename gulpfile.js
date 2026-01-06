'use strict';

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
      gulpIf       : require('gulp-if'),
      less         : require('gulp-less'),
      mergeStream  : require('merge-stream'),
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

function getBuildTarget() {
  const raw = ($.node.process.env.TARGET ?? 'firefox').toString().trim().toLowerCase();

  if (!ALLOWED_TARGETS.has(raw)) {
    throw new Error(
      `Invalid TARGET "${raw}". Expected one of: chrome, firefox.`
    );
  }

  return raw;
}

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

function parseSpecs(path, target) {
  const whole = JSON.parse($.node.fs.readFileSync(path));
  const specs = whole[target];

  delete whole.firefox;
  delete whole.chrome;

  return { whole, specs };
}

function createContext() {
  const environment = $.node.process.env.NODE_ENV || 'development';
  const target = ($.node.process.env.TARGET ?? 'firefox').toString().trim().toLowerCase();

  if (!ALLOWED_TARGETS.has(target)) {
    throw new Error(
      `Invalid TARGET "${target}". Expected one of: chrome, firefox.`
    );
  }
  const {whole, specs} = parseSpecs(`./config/${environment}.json`);

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

function importPaths() {
  __paths = merge(
    __paths, 
    JSON.parse($.node.fs.readFileSync(`./config/paths.json`), reviveImport)
  );
}

function importOptions() {
  __options = merge(
    __options, 
    JSON.parse($.node.fs.readFileSync(`./config/options.json`), reviveImport)
  );
}

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
        `[build] Bundle "${bundleName}" has an invalid entry (glob pattern detected): ${cfg.entry}\n` +
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

const ALLOWED_TARGETS = new Set(['chrome', 'firefox']);
const __bundlers = [];
const __appEvent = new EventEmitter();
const __watcher = {
  workers: [],
  taskCallback: null,
  runnerCallback: null,
  runner : null,
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

function resolveInTarget(path) {
  path = $.node.path.normalize(path).replace(/\\/g, '/');

  if (!path.startsWith('./')) {
    path = './' + path
  }

  return path.replace(__paths.src, __paths.target);
}

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

function sync(_in, _out) {
  // _in et _out sont relatifs à src/target (ex: "/assets/x")
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

function log(message) {
  $.utils.log(message);
}

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

function sanitizeFilenamePart(input, maxLen = 80) {
  const s = String(input ?? '')
    .normalize('NFKD')                 // sépare accents
    .replace(/[\u0300-\u036f]/g, '')   // supprime accents
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')             // retire quotes
    .replace(/[^a-z0-9._-]+/g, '-')    // tout le reste -> -
    .replace(/-+/g, '-')              // compresse
    .replace(/^[-.]+|[-.]+$/g, '');   // pas de - ou . en bord

  // éviter les noms vides + limiter la longueur
  const safe = s.length ? s : 'extension';
  return safe.slice(0, maxLen);
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region System
//

$.utils.readline.emitKeypressEvents($.node.process.stdin);
$.node.process.stdin.setRawMode(true);

__appEvent.on('app.requestExit', (from) => {

    log(`Exit request from ${from}`);
    watchersCloseAll();

    if (__watcher.taskCallback) {
      __watcher.taskCallback();
    }
  
    if (__watcher.runnerCallback) {
      __watcher.runnerCallback();
    }
  
    if(__watcher.runner){
      __watcher.runner.exit().then(() => {
        log('Now runner is closed');
        $.node.process.exit();
      });
    } else {
      log('Bye bye');
      $.node.process.exit();
    }

});

$.node.process.on('SIGINT', function () {
  log('Signal received : SIGINT, now exiting ...');
  __appEvent.emit('app.requestExit', 'Signal watcher : SIGINT');
});

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Build and deploy
//
function doClean(path) {
    const targetPath = path || __paths.target;
    console.log($.del)
    return $.del([targetPath], { force: true });
}

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

function doDeployAssets(_asset) {
  return deploy(`/assets/${_asset}/**/*`, `/assets/${_asset}`);
}

function doDeployStaticStyles() {
  return deploy(__paths.staticStyles.source, __paths.staticStyles.target);
}

function doDeployLocales() {
  return deploy(__paths.locales.source, __paths.locales.target);
}

function doDeployPublic() {
  return deploy(__paths.publicFile.source, __paths.publicFile.target);
}

function doDeployHtml() {
  return deploy(__paths.staticHtml.source, __paths.staticHtml.target);
}

function doDeployStaticLib() {
  return deploy(__paths.staticLib.source, __paths.staticLib.target);
}

function handleBuildStreamError(error) {
  log("Build error : " + error)
  this.emit("end");
}

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

    .pipe($.gs._if(__context.isProduction && !__context.watchMod, $.gs.postcss([$.gs.autoprefixer()])))
    .pipe($.gs._if(__context.isDevelopment, $.gs.sourcemaps.write('.')))
    .pipe($.gulp.dest(_out));
}

function doBuildScripts() {
  const _out = __paths.scripts.target;
  const _sources = __paths.scripts.source;

  return $.gulp.src(_sources, { sourcemaps: __context.isDevelopment })
    .pipe($.gs.plumber())
    .pipe($.gs.changed(_out))
    .pipe($.gs.tap(function (file) {
      log(`Script ${file.relative}`);
    }))

    // Javascript
    .pipe($.gs._if('*.js', $.gs.babel()))
    .on("error", handleBuildStreamError)

    // React
    .pipe($.gs._if('*.jsx', $.gs.babel({
      presets: ['@babel/react'],
      compact: false
    })))
    .on("error", handleBuildStreamError)

    // Minify
    .pipe($.gs.rename((p) => {
      if (p.extname === '.jsx' || p.extname === '.ts' || p.extname === '.tsx'){ p.extname = '.js'; }
    }))
    .pipe($.gs._if(__context.isProduction && !__context.watchMode, $.gs.terser(__options.terser)))
    .pipe($.gs._if(__context.isDevelopment, $.gs.sourcemaps.write('.')))
    .pipe($.gulp.dest(_out));
}

function doBuildBundle(bundleName) {

  const bundleConfig = __bundles[bundleName];

  if (!bundleConfig) {
    throw new Error(`[build] Unknown bundle "${bundleName}"`);
  }

  const bundler = $.build.browserify(bundleConfig.entry, __options.browserify);
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
    return bundler.bundle()
      .on("error", (error) => {
        log(`Bundle '${bundleName}' error > ` + error);
      })
      .pipe($.build.source(__bundles[bundleName].bundle))
      .pipe($.build.buffer())
      .pipe($.gs._if(__context.isProduction && !__context.watchMode, $.gs.terser(__options.terser)))
      .pipe($.gulp.dest(__bundles[bundleName].target));
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

function doWatchKeypress(){

  $.node.process.stdin.on('keypress', (str, key) => {

    if (key.ctrl && key.name === 'c') {
      log('Signal received : CTRL+C, now exit ...');
      __appEvent.emit('app.requestExit', 'Signal watcher : CTRL+C');
    } else {
      __appEvent.emit('cli.keypress', key);
    }

  });

}

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

//@todo revoir le fonctionement du runner pour avoir les options en config
// et terminer proprement la tâche
function doWatchWebext(resolver) {

  if (!__context.runner.enable) {
    log("Extension Runner is disable");
    return Promise.resolve(); //resolver();
    return;
  }

  const sourceDir = $.node.path.resolve(__paths.target)
    const args = [
    'web-ext',
    'run',
    '--source-dir',
    sourceDir,
    '--verbose',
  ];

  const child = $.node.spawn('npx', args, {
    stdio: 'inherit',
    shell: true, // important sur Windows pour résoudre npx correctement
  });

  child.on('close', (code) => {
    log(`web-ext exited with code ${code}`);
    __watcher.runnerProcess = null;
  });

  __watcher.runnerProcess = child;
  
  resolver();

/*
  __watcher.runnerCallback = resolver;

  const params = Object.assign(
    {},
    __options.runner,
    {
      sourceDir: sourceDir,
      verbose: true,
      devtools: true
    }
  );

  $.gs.runner.cmd.run(params,
    {
      // These are non CLI related options for each function.
      // You need to specify this one so that your NodeJS application
      // can continue running after web-ext is finished.
      shouldExitProgram: false,

    }).then((extensionRunner) => {
      __watcher.runner = extensionRunner;
      __watcher.runner.registerCleanup(() => {
        log("Runner will close, now cleanup and exit ...");
        __appEvent.emit('app.requestExit', 'Extension runner');
      });

      __appEvent.on('cli.keypress', (key) => {
        if(key.ctrl === false && key.name === 'r'){
          log('Signal received : R, reloading all extensions ...');
          __watcher.runner.reloadAllExtensions();
        }
      });

      log("The extension will reload if any source file changes");
      log("Press R to reload (and Ctrl-C to quit)");

    }).catch(error => {
      log(error.stack || error);
      __watcher.runnerCallback = null;
      resolver();
    });
*/
}

function doWatchAssets(_asset) {
  doWatchSync(`/assets/${_asset}/**/*`, `/assets/${_asset}`);
}

function doWatchStaticStyles() {
  doWatchDeploy(__paths.staticStyles.source, __paths.staticStyles.target);
}

function doWatchLocales() {
  doWatchSync(__paths.locales.source, __paths.locales.target);
}

function doWatchPublic() {
  doWatchSync(__paths.publicFile.source, __paths.publicFile.target);
}

function doWatchHtml() {
  doWatchDeploy(__paths.staticHtml.source, __paths.staticHtml.target);
}

function doWatchStaticLib() {
  doWatchSync(__paths.staticLib.source, __paths.staticLib.target);
}

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
          // supprimer côté build
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

function watchEventLog(event, path) {
  path = $.node.path.normalize(path).replace(/\\/g, '/');
  log(`Watch ${event} '${path}'`);
}

function watchersCloseAll() {
  __watcher.workers.forEach(async watcher => {
    await watcher.close();
  });
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Task : Build and deploy
//
function _Tclean() {
  return doClean();
}

function _TprepareBuild(resolve) {
  resolve();
}

function _Tmanifest() {
  return doDeployManifest();
}

function _Tassets() {
  return $.gs.mergeStream(
    doDeployAssets('icons'),
    doDeployAssets('images'),
    doDeployAssets('public'),
    doDeployStaticStyles()
  );
}

function _Tlocales() {
  return doDeployLocales();
}

function _Tpublic() {
  return doDeployPublic();
}

function _Thtml() {
  return doDeployHtml();
}

function _Tstyles() {
  return doBuildStyles();
}

function _Tscripts() {
  return doBuildScripts();
}

function _Tbundles() {
  const names = Object.keys(__bundles);
  return $.gs.mergeStream(...names.map(doBuildBundle));
}

function _TstaticLib() {
  return doDeployStaticLib();
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Task : Watch
//
function _ThandleKeypress(resolve){
  doWatchKeypress();
  resolve();
}

function _Twebext(resolve) {
  doWatchWebext(resolve);
}

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

function _TprepareWatch(resolve) {
  __context.watchMode = true;
  resolve();
}

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Task : Package
//
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
function _Sbuild() {
  return $.gulp.series(
    _Tclean,
    _TprepareBuild,
    $.gulp.parallel(
      _Tmanifest,
      _Tstyles,
      _Tassets,
      _Tlocales,
      _Tpublic,
      _Thtml,
      _TstaticLib
    ),
    _Tscripts,
    _Tbundles
  );
}

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