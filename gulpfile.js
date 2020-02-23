//---------------------------------------------------------------------------
//#region Libraries
//

const EventEmitter = require('events');

const $ = {

  node: {
    path: require('path'),
    fs: require("fs"),
    process: require('process'),
    glob: require("glob")
  },

  utils: {
    log: require('fancy-log'),
    replaceExt: require('replace-ext'),
    readline: require('readline')
  },

  gulp: require("gulp"),

  gs: Object.assign(require('gulp-load-plugins')(), {
    merge: require('merge-stream'),
    _if: require("gulp-if"),
    runner: require('web-ext').default
  }),

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
var __context = createContext();

var __paths = {
  src: './src',
  config: './config',
  target: `./build/${__context.target}`,
  release: `./build/${__context.target}`,
  dist: `./dist/`
};
importPaths();

var __options = {};
importOptions();

const __watcher = {
  workers: [],
  taskCallback: null,
  runnerCallback: null,
  runner : null,
  options: {
    delay: 250
  }
}

const __bundlers = [];

const __appEvent = new EventEmitter();

function reviveImport(key, value) {

  if (typeof value !== "string") {
    return value;
  }

  var regex = RegExp('\\${(.+)}', 'g');
  var result = regex.exec(value);

  if (result != null && result.length == 2) {
    var whole = result[0];
    var searched = result[1];
    var parts = searched.split('.');
    var varia = null;

    try {

      parts.reduce((count, currentValue) => {

        // Search main object
        if (count == 0) {

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

          if(varia[currentValue] == undefined){
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

function parseSpecs(path){
  var environment = $.node.process.env.NODE_ENV || "development";
  var target = $.node.process.env.TARGET || "firefox";

  var whole = JSON.parse($.node.fs.readFileSync(path));
  var specs = whole[target];

  delete whole.firefox;
  delete whole.chrome;

  return {
    whole,
    specs
  }
}

function createContext() {
  var environment = $.node.process.env.NODE_ENV || "development";
  var target = $.node.process.env.TARGET || "firefox";

  var {whole, specs} = parseSpecs(`./config/${environment}.json`);

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
    .pipe($.gs.cleanDest(_out))
    .pipe($.gs.tap(function (file, t) {
      var filePath = $.node.path.resolve(process.cwd(), _out, file.relative);
      log(`Deploy ${file.relative}`);
    }))
    .pipe($.gulp.dest(_out));
}

function sync(_in, _out) {

  _in = `${__paths.src}${_in}`
  _out = `${__paths.target}${_out}`;

  var options = {
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
}

function log(message) {
  $.utils.log(message);
}

function merge() {
  var dst = {},
      src,
      p,
      args = [].splice.call(arguments, 0)
      ;

  while (args.length > 0) {
      src = args.splice(0, 1)[0];
      if (toString.call(src) == '[object Object]') {
          for (p in src) {
              if (src.hasOwnProperty(p)) {
                  if (toString.call(src[p]) == '[object Object]') {
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
  path = path || __paths.target;
  return $.gulp.src(path, { read: false, allowEmpty: true }).pipe($.gs.clean());
}

function doDeployManifest() {
  var manifest = JSON.parse($.node.fs.readFileSync(`${__paths.config}/manifest_${__context.target}.json`));

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
  var _out = __paths.styles.target;
  var _sources = __paths.styles.source;

  return $.gulp.src(_sources, { sourcemaps: true })
    .pipe($.gs.plumber())
    .pipe($.gs.changed(_out, { extension: '.css' }))
    .pipe($.gs.tap(function (file, t) {
      var filePath = $.node.path.resolve(process.cwd(), _out, file.relative);
      log(`Style ${file.relative}`);
    }))
    .pipe($.gs._if('*.scss', $.gs.sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    })))
    .on("error", handleBuildStreamError)
    .pipe($.gs._if('*.less', $.gs.less({

    })))
    .on("error", handleBuildStreamError)
    .pipe($.gs._if(__context.isDevelopment, $.gs.sourcemaps.write('.')))
    .pipe($.gulp.dest(_out));
}

function doBuildScripts() {
  var _out = __paths.scripts.target;
  var _sources = __paths.scripts.source;

  return $.gulp.src(_sources, { sourcemaps: true })
    .pipe($.gs.plumber())
    .pipe($.gs.changed(_out))
    .pipe($.gs.tap(function (file, t) {
      var filePath = $.node.path.resolve(process.cwd(), _out, file.relative);
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
    .pipe($.gs._if(__context.isProduction, $.gs.uglify({
      "mangle": true,
      "output": {
        "ascii_only": true
      }
    })))
    .pipe($.gs._if(__context.isDevelopment, $.gs.sourcemaps.write('.')))
    .pipe($.gulp.dest(_out));
}

function doBuildBundle(bundleName) {

  var files = [];
  var sources = __paths.bundles[bundleName].source;
  if (!(sources instanceof Array)) {
    sources = [sources];
  }

  sources.map(source => {
    files = files.concat($.node.glob.sync(source, { nodir: true }));
  });

  var bundler = $.build.browserify(files, __options.browserify);
  __bundlers.push(bundler);

  bundler.transform("babelify", __options.babelify);

  if (__context.isProduction) {
    bundler.transform("uglifyify", __options.uglifyify);
  }

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
      .pipe($.build.source(__paths.bundles[bundleName].bundle))
      .pipe($.build.buffer())
      .pipe($.gulp.dest(__paths.bundles[bundleName].target));
  }

  if (__context.watchMode) {
    bundler.plugin($.build.watchify);
    bundler.on("update", build);
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
  var options = Object.assign({}, __watcher.options, { events: ['change'] });
  var _sources = [
    `${__paths.src}/manifest.json`,
    `${__paths.config}/manifest_${__context.target}.json`
  ];

  watcher = $.gulp.watch(_sources, options, doDeployManifest)
    .on("all", watchEventLog);

  __watcher.workers.push(watcher);
}

function doWatchWebext(resolver) {

  if (!__context.runner.enable) {
    log("Extension Runner is disable");
    resolver();
    return;
  }

  __watcher.runnerCallback = resolver;

  var sourceDir = $.node.path.resolve(__paths.target)
  var params = Object.assign(
    __options.runner,
    {
      sourceDir: sourceDir
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
        if(key.ctrl === false && key.name == 'r'){
          log('Signal received : R, reloading all extensions ...');
          __watcher.runner.reloadAllExtensions();
        }
      });

      log("The extension will reload if any source file changes");
      log("Press R to reload (and Ctrl-C to quit)");

    }).catch(error => {
      log(error.message);
      __watcher.runnerCallback = null;
      resolver();
    });

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

  var watcher = $.gulp.watch(__paths.styles.source, __watcher.options)
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

  var watcher = $.gulp.watch(__paths.scripts.source, __watcher.options)
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
          break;
      }
    });

  __watcher.workers.push(watcher);
}

function doWatchBundle(name) {
  doBuildBundle(name, true);
}

function doWatchDeploy(_in, _out, _handler) {

  if (!_handler) {
    _handler = function (event, path) {
      watchEventLog(event, path);

      switch (event) {
        case "add":
        case "change":
        case "addDir":
        case "unlinkDir":
          deploy(_in, _out);
          break;
        case 'unlink':
          doClean(resolveInTarget(path));
          break;
      }

    };
  }

  var watcher = $.gulp.watch(`${__paths.src}${_in}`, __watcher.options)
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

  var watcher = $.gulp.watch(`${__paths.src}${_source}`, __watcher.options)
    .on("all", function (event, path) {
      watchEventLog(event, path);

      switch (event) {
        case "add":
        case "change":
        case "unlink":
        case "addDir":
        case "unlinkDir":
          sync(_in, _out);
          break;
      }

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
  return $.gs.merge(
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

//@TODO List bundles from config
function _Tbundles() {
  return $.gs.merge(
    doBuildBundle("background"),
    doBuildBundle("content"),
    doBuildBundle("public"),
    doBuildBundle("popup"),
    doBuildBundle("settings")
  );
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
  var manifest = JSON.parse($.node.fs.readFileSync(`${__paths.target}/manifest.json`));
  var extension = __context.isFirefox ? "xpi" : "zip";
  var filename = `package-${manifest.name}-${manifest.version}.${extension}`
  return $.gulp.src(`${__paths.target}/**/*`, { read: true, allowEmpty: true })
    .pipe($.gs.zip(filename))
    .pipe($.gulp.dest(__paths.dist));
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