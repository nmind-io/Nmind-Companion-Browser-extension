/*
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */

//---------------------------------------------------------------------------
//#region Constants
//---------------------------------------

exports.NOTIFICATION_HIDE_DELAY = 3000;
exports.NOTIFICATION_ID = "nmind-notification-id";
exports.URL_EXTENSION = "https://nmind.io/companion";
exports.URL_AFTER_INSTALL = "https://nmind.io/companion.html";
exports.URL_SETTINGS= "https://nmind.io/companion/#nmind-companion-settings";
exports.COMPANION_HOST = "nmindcompanionhost";
exports.DIR_PRINT_JOBS = 'nmind/printjobs/';
exports.DIR_DOWNLOAD_JOBS = 'nmind/downloads/';
exports.DEFAULT_OPTIONS = {
    console : false,
    printer : {
        activate : false,
        default : ""
    },
    pos : {
        activate : false,
        device : "",
        port : "",
        protocol : "",
        ethip : ""
    }
}

//#endregion