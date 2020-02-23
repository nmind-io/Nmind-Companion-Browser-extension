/*
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */
const { Logger, browser } = require('../shared/nmind-core');

//---------------------------------------------------------------------------
//#region Notifications
//
function notify(message, title, body = [], link = null) {

    browser.notifications.create(NOTIFICATION_ID, {
        "type": "basic",
        "iconUrl": browser.extension.getURL("assets/icons/addon-48x48.png"),
        "title": title,
        "message": message
    }).then(function (id) {
        setTimeout(() => {
            browser.notifications.clear(id)
        }, NOTIFICATION_HIDE_DELAY);
    });

}

//#endregion ----------------------------------------------------------------
