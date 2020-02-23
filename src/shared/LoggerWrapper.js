/*
 * @author Nmind.io <osp@nmind.io>
 */
const { varDump } = require('../shared/nmind-misc');

class LoggerWrapper {

    constructor(debug){
        this.isDebugMode = debug;
        this.browserType = "";

        if (typeof browser == "undefined" && typeof chrome !== "undefined" && chrome.runtime) {
            if (/\bOPR\//.test(navigator.userAgent)) {
                this.browserType = "opera";
            }
            else {
                this.browserType = "chrome";
            }
        } else if (/\bEdge\//.test(navigator.userAgent)) {
            this.browserType = "edge";
        }
        else {
            this.browserType = "firefox";
        }

    }

    info(message, ...rest){
        this.consoleIf(message, console.info, rest);
    }

    debug(message, ...rest){
        this.consoleIf(message, console.debug, rest);
    }

    trace(message, ...rest){
        this.consoleIf(message, console.trace, rest);
    }
    
    consoleIf(message, handler, groups){
        if (!this.isDebugMode) {
            return;
        }

        let strings = [];
        if(groups && typeof groups === "object"){
            for(let key in groups){
                strings.push(varDump(groups[key]));
            }
        }

        if(strings.length > 0){
            console.groupCollapsed(message);
            for(let key in strings){
                handler(strings[key]);
            }
            console.groupEnd();

        } else {
            handler(message);
        }
        
    }

    error (err) {

        if(typeof err === "string"){
            this.consoleIf(err, console.error);
        } else {
            this.consoleIf(err.message, console.error, err.stack);
        }

    }
    
    isBrowser (...args) {
        for (var i = 0; i < args.length; i++) {
            if (args[i] == this.browserType) {
                return true;
            }
        }
        return false;
    }

}

exports.Logger = new LoggerWrapper(false);
