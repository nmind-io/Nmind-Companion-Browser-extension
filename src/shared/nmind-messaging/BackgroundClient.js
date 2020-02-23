/*
 * @author Nmind.io <osp@nmind.io>
 */

const { Message } = require("./Message");
const { Endpoint } = require("./Endpoint");
const { Logger, browser } = require('../nmind-core');

//
//
//
class BackgroundClient extends Endpoint {

    //
    //
    //
    constructor() {
        super();
        var self = this;
        this.port = browser.runtime.connect();
        this.port.onMessage.addListener((message) => {
            self.handleMessage(message);
        });
    }

    //
    //
    //
    post(route, params) {
        Logger.debug(`BackgroundClient-post:  ${route}`, params);
        this.port.postMessage(Message.request(route, params));
    }

    //
    //
    //
    request(route, params) {
        Logger.debug(`BackgroundClient-request:  ${route}`, params);
        return browser.runtime.sendMessage(Message.request(route, params));
    }

    //
    //
    //
    handleMessage(request) {
        super.route(request);
    }

}

exports.BackgroundClient = BackgroundClient;