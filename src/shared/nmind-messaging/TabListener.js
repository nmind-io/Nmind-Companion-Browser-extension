/*
 * @author Nmind.io <osp@nmind.io>
 */

const { Message } = require("./Message");
const { Endpoint } = require("./Endpoint");
const { Logger, browser } = require('../nmind-core');

//
//
//
class TabListener extends Endpoint {

    //
    //
    //
    constructor(ownerDocument) {
        super();
        this.document = ownerDocument;

        var self = this;
        this.document.addEventListener("io.nmind.request", (event) => {
            self.handleRequest(event);
        });
    }

    //
    //
    //
    post(route, params) {
        let request = Message.request(route, params);

        Logger.debug( `TabListener-postMessage:  ${route}`, request );

        var event = new CustomEvent("io.nmind.message", 
            { 
                "bubbles": true, 
                "cancelable": false, 
                "detail" : JSON.stringify(request)
            }
        );

        this.document.dispatchEvent(event);
    }

    //
    //
    //
    sendResponse(node, response) {
        var event = new Event("io.nmind.response", { "bubbles": true, "cancelable": false });
        node.nodeValue = JSON.stringify(response);
        node.dispatchEvent(event);
    }

    //
    //
    //
    handleRequest(event) {
        var node = event.target;
        var self = this;

        if (!node || node.nodeType != Node.TEXT_NODE) {
            return;
        }

        var response = super.route(JSON.parse(node.nodeValue));

        if (response instanceof Promise) {
            response.then(response => {
                Logger.debug("TabListener-promise-resolve: ", response);
                self.sendResponse(node, response);
            }).catch(error => {
                Logger.debug("TabListener-promise-reject: ", error);
                self.sendResponse(node, Message.error(error));
            });
        } else {
            Logger.debug("TabListener-response: ", response);
            this.sendResponse(node, response);
        }

        return true;
    }

}

exports.TabListener = TabListener;