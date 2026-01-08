/*
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */

const core = require('../shared/nmind-core');
const Logger = core.Logger;
const browser = core.browser;
const Storage = core.Storage;

const { TabListener, BackgroundClient } = require("../shared/nmind-messaging");

if(Logger.isDebugMode) {
    Logger.info(`Temporary installation on ${Logger.browserType}. Debug mode on.`);
}

//---------------------------------------------------------------------------
//#region Content-script :  Storage
//---------------------------------------

//
//
//
Storage.onChange(() => {
    Logger.isDebugMode = Storage.options.console;
    Logger.debug(`Content-script : Fetch options`, Storage.options);
})

Storage.synchronize();

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Exported functions
//---------------------------------------

var script = document.createElement('script');
script.src = chrome.runtime.getURL('bundles/public.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Endpoints
//---------------------------------------

const __client = new BackgroundClient();

__client.pipe(
    /companion\.document\.(print|download)\.response/
);

const __listener = new TabListener(document);
__listener.join(__client);

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Default handlers
//---------------------------------------

__listener.pipe(
    /background\..+/,
    /companion\..+/
);

// Ping
__listener.on('content.ping', () => {
    return "content-pong";
});

// Version
__listener.on('extension.version', function(){
    return browser.runtime.getManifest().version
});

// Echo 
__listener.on('content.echo', function (message) {
    return message;
});


//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region TabListener : Test handlers
//---------------------------------------

__listener.on('content.addition', (left, right) => {
    return left + right;
});

__listener.on('content.multiplication', (left, right) => {
    return left * right;
});

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region TabListener : 
//---------------------------------------

//#endregion ----------------------------------------------------------------
