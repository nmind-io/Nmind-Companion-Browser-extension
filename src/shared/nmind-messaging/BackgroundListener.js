/*
 * @author Nmind.io <osp@nmind.io>
 */

const { Message } = require("./Message");
const { Endpoint } = require("./Endpoint");
const { Logger, browser } = require('../nmind-core');

//
//
//
class BackgroundListener extends Endpoint {

    //
    //
    //
    constructor() {
        super();
        this.ports = [];

        var self = this;

        browser.runtime.onConnect.addListener((port, message) => {
            return self.handleConnect(port, message);
        });
    
        browser.runtime.onMessage.addListener((message, sender) => {
            return self.handleRequest(message, sender);
        });
    }

    //
    //
    //
    post(port, message) {
        Logger.debug("BackgroundListener-postMessage: ", message);
        if(this.ports[port.contextId]){
            this.ports[port.contextId].postMessage(message);
        }
    }

    //
    //
    //
    handleConnect (port) {
        Logger.debug("BackgroundListener-connected : " + port.sender.contextId);
    
        this.ports[port.sender.contextId] = port;
  
        var self = this;
        port.onMessage.addListener((message, __port) => {
            self.handleMessage(message, __port);
        });

        port.onDisconnect.addListener((__port) => {
            self.handleDisconnect(__port);
        });

    }

    //
    //
    //
    handleDisconnect(port) {
        Logger.debug("BackgroundListener-handleDisconnect: ", port.sender.contextId);
        if(this.ports[port.sender.contextId]){
            delete this.ports[port.sender.contextId];
        }
    }

    //
    //
    //
    handleMessage(message, port) {
        Logger.debug("BackgroundListener-handleMessage: ", message);
        super.route(message, port);
    }

    //
    //
    //
    handleRequest (message, port) {
        Logger.debug("BackgroundListener-handleRequest: ", message);
    
        var response = super.route(message, port);
        Logger.debug("BackgroundListener-response: ", response);
    
        if(response instanceof Promise){
            return response;
        } else {

            return new Promise((resolve, reject) => {
            
                if(response.code == 200){
                    resolve(response);
                } else {
                    reject(Message.error(response.message, response.type));
                }
            });
    
        }
        
    }

    //
    //
    //
    _createPipe(route){
        return function(port){

            var params;
            if(arguments.length == 1){
                params = null;
            } else if(arguments.length == 2){
                params = arguments[1];
            } else {
                params = Array.from(arguments);
                params.shift();
            }

            return this.forward(route, params);
        };
    }
}

exports.BackgroundListener = BackgroundListener;
