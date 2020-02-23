/*
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */

const { Logger, browser, Storage } = require('../shared/nmind-core');
const { Message, NativeHostClient, BackgroundListener } = require("../shared/nmind-messaging");
const { downloadService, printerService, PrintJob } = require("../shared/nmind-services");
const {
    URL_AFTER_INSTALL,
    DIR_PRINT_JOBS,
    DIR_DOWNLOAD_JOBS
} = require('../shared/constants');


//---------------------------------------------------------------------------
//#region Background-script : Extension events
//---------------------------------------

//
//
//
browser.runtime.onInstalled.addListener((details) => {

    if (details.temporary) {
        Logger.debug('Temporary installation. Debug mode on.');
    }

    if (typeof URL_AFTER_INSTALL === 'string' && URL_AFTER_INSTALL.length > 0) {
        browser.tabs.create({
            url: URL_AFTER_INSTALL
        });
    }

});

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Background-script :  Storage
//---------------------------------------

//
//
//
Storage.onChange(() => {
    Logger.isDebugMode = Storage.options.console;
    Logger.debug(`Background-script : Fetch options`, Storage.options);
})

Storage.synchronize();


//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region Endpoints
//---------------------------------------

const __hostClient = new NativeHostClient();
const __listener = new BackgroundListener();

__listener.join(__hostClient);

__listener.pipe(
    /companion\..+/
);

//---------------------------------------------------------------------------
//#region Services
//---------------------------------------

downloadService.configure(DIR_DOWNLOAD_JOBS);
printerService.configure(DIR_PRINT_JOBS, __hostClient);

//#endregion ----------------------------------------------------------------


//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region NativeHostClient : Default handlers
//---------------------------------------

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region BackgroundListener : Default handlers
//---------------------------------------

//
// 
//
__listener.on('background.ping', function(port, message) {
    return "background-pong";
});

//
// 
//
__listener.on('background.version', function (port, message) {
    return browser.runtime.getManifest().version
});

//
// 
// 
__listener.on('background.echo', function (port, message) {
    return message;
});

//
// 
//
__listener.on('companion.capabilities', function (port, message) {

    return new Promise(function(resolve, reject){
        var capabilities = [];

        if(Storage.options.printer.activate){
            capabilities.push('printer');
        }
    
        if(Storage.options.pos.activate){
            capabilities.push('pos');
        }
    
        __hostClient.request('companion.ping')
            .then(function(){
                capabilities.push('companion');
            })
            .finally(function(){
                resolve(Message.success(capabilities));
            });
    });

});

//
// 
//
__listener.on('companion.isConnected', function (port, message) {
    return __hostClient.isConnected();
});

//
// 
//
__listener.on('companion.connect', function (port, message) {
    return __hostClient.connect();
});

//
// 
//
__listener.on('companion.disconnect', function (port, message) {
    return __hostClient.disconnect();
});

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region BackgroundListener : Test handlers
//---------------------------------------


__listener.on('background.addition', (port, left, right) => {
    return left + right;
});

__listener.on('background.multiplication', (port, left, right) => {
    return left * right;
});

//#endregion ----------------------------------------------------------------

//---------------------------------------------------------------------------
//#region BackgroundListener : handlers
//---------------------------------------

// 
// Download a file
//
// var job = {
//     url : 'https://the.urlto.use',
//     body : '',
//     conflictAction : 'uniquify',
//     filename : 'dlfile.pdf',
//     headers : [
//         {
//             name : 'Accept',
//             value : 'application/json, text/plain, */*'
//         },
//         {
//             name : 'Content-Type',
//             value : 'application/json'
//         }
//     ],
//     method : 'POST',
//     saveAs : false,
//     id : 5,
//     name : 'The document you wanted to download'
// }
//
// var response = {
//     id : 5,
//     name : 'The document you wanted to download',
//     success : true,
//     downloading : false,
//     reason : ""
// }
//
__listener.on('companion.document.download', function (port, job) {
    Logger.debug('Background-script : companion.document.download', job);

    job.onFinish = (port, response) => {
        __listener.post(port,
            Message.request("companion.document.download.response", response)
        );
    }
    
    return new Promise(function (resolve, reject){
        downloadService.createJob(port, job)
            .then((response) => {
                resolve(Message.success(response));
            })
            .catch((response) => {
                reject(Message.error(response));
            });
    });

});

// 
// Download and print a file
//
// var job = {
//     url : 'https://the.urlto.use',
//     body : '',
//     conflictAction : 'uniquify',
//     filename : 'dlfile.pdf',
//     headers : [
//         {
//             name : 'Accept',
//             value : 'application/json, text/plain, */*'
//         },
//         {
//             name : 'Content-Type',
//             value : 'application/json'
//         }
//     ],
//     method : 'POST',
//     saveAs : false,
//     printerName : 'Microsoft Print To Pdf',
//     id : 5,
//     name : 'The document you wanted to print'
// }
//
// var response = {
//     printerName : 'Microsoft Print To Pdf',
//     id : 5,
//     name : 'The document you wanted to print',
//     success : true,
//     reason : ""
// }
//
__listener.on('companion.document.print', function (port, dljob) {
    Logger.debug('Background-script : companion.document.print', dljob);

    if(!Storage.options.printer.activate){
        return Message.error('Printers support has been disabled')
    }

    var printerName = dljob.printerName || Storage.options.printer.default;

    if(!printerName){
        return Message.error('Printer not defined');
    }

    dljob.onFinish = (port, response) => {
        let prjob = new PrintJob(response);
        prjob.printerName = printerName;
        prjob.onFinish = (port, response) => {
            __listener.post(
                port,
                Message.request('companion.document.print.response', response)
            )
        };
        printerService.createJob(port, prjob);
    }

    return new Promise(function (resolve, reject){
        downloadService.createJob(port, dljob)
            .then((response) => {
                resolve(Message.success(response));
            })
            .catch((response) => {
                reject(Message.error(response));
            });
    });

});

//
//
//
__listener.on('companion.location.open.download', function (port) {
    browser.downloads.showDefaultFolder();
    return true;
});

//
//
//
__listener.on('companion.pos.ping', function (port) {
    Logger.debug('Background-script : companion.pos-payment.ping');

    if(!Storage.options.pos.activate){
        return Message.error('POS terminal support has been disabled')
    }

    var params = {
        port : Storage.options.pos.port,
        device : Storage.options.pos.device,
        protocol : Storage.options.pos.protocol
    };

    return __hostClient.request('companion.epayment.ping', params);

});

//
//
//
__listener.on('companion.pos.process', function (port, amount) {

    if(!Storage.options.pos.activate){
        return Message.error('POS terminal support has been disabled')
    }

    if(isNaN(amount) || amount <= 0){
        return Message.error(amount + ' bad value');
    }

    var params = {
        amount : amount,
        port : Storage.options.pos.port,
        device : Storage.options.pos.device,
        protocol : Storage.options.pos.protocol
    };

    Logger.debug('Background-script : companion.pos.process', params);

    return new Promise(function (resolve, reject){
        __hostClient.request('companion.epayment.process', params)
            .then((response) => {
                resolve(Message.success(response));
            })
            .catch((response) => {
                reject(Message.error(response));
            });
    });

});

//#endregion ----------------------------------------------------------------

