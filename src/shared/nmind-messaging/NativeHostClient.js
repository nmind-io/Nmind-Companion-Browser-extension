/*
 * @author Nmind.io <osp@nmind.io>
 */

const { Message } = require("./Message");
const { Endpoint } = require("./Endpoint");
const { Logger, browser } = require('../nmind-core');
const { COMPANION_HOST } = require("../constants");

//
//
//
class NativeHostClient extends Endpoint {

    //
    //
    //
    constructor() {
        super();
        this.port = null;
    }

    //
    //
    //
    connect(){

        if(!this.isConnected()){

            var self = this;

            this.port = browser.runtime.connectNative(COMPANION_HOST);
    
            this.port.onMessage.addListener((message) => {
                self.handleMessage(message);
            });
    
            this.port.onDisconnect.addListener((port) => {
                self.handleDisconnect(port);
            });

        }

        return this.isConnected();

    }

    //
    //
    //
    isConnected(){
        return this.port != null;
    }

    //
    //
    //
    disconnect(){
        if(this.isConnected()){
            Logger.debug('NativeHostClient-disconnect:', this.port);
            this.port.disconnect();
            this.port = null;
        }

        return !this.isConnected();
    }

    //
    //
    //
    post(route, params, async) {
        Logger.debug(`NativeHostClient-postMessage:  ${route}`, params);
        let request = Message.request(route, params);
        request.async = async || false;
        this.port.postMessage(request);
    }

    //
    //
    //
    handleMessage(message) {
        Logger.debug('NativeHostClient-handleMessage:', message);
        this.route(message);
    }

    //
    //
    //
    handleDisconnect(port) {
        Logger.debug('NativeHostClient-handleDisconnect: ', port);
        this.port = null;
    }

    //
    //
    //
    request(route, params, async) {

        let request = Message.request(route, params);
        request.async = async || false;

        Logger.debug(
            `NativeHostClient-request:  ${route}`, 
            request,
            JSON.stringify(request)
        );

        return new Promise((resolve, reject) => {

            browser.runtime.sendNativeMessage(COMPANION_HOST, request).then(
                response => {
    
                    Logger.debug("NativeHostClient-response: ", response);

                    if(response.code == 200){
                        resolve(response);
                    } else {
                        reject(Message.error(response.message, response.type));
                    }
                
                },
                error => {
                    Logger.error("NativeHostClient-error: ", error);
                    reject(Message.error(error));
             });
        });
    
    }
}

exports.NativeHostClient = NativeHostClient;