/*
 * @author Nmind.io <osp@nmind.io>
 */
const { Logger } = require('../LoggerWrapper');

//
//
//
class PrinterService {

    //
    //
    //
    constructor() {
        this.dirPrinters = null;
        this.hostClient = null;
        this.jobs = {};
        var self = this;
    }

    //
    //
    //
    configure(dirPrinters, hostClient){
        this.dirPrinters = dirPrinters;
        this.hostClient = hostClient;
    }

    //
    // Construit une nouvelle tâche visant à imprimer un fichier
    //
    createJob(port, job) {
        if (!job.printerName) {
            return;
        }
        
        Logger.debug(
            `New printjob ${id} created`
            + ` for ${job.filename}`
            + ` to ${job.printerName}`
            + ` by ${port.contextId}`
        );

        var id = job.filename;
        var onFinish = job.onFinish;
        delete job.onFinish;

        this.jobs[id] = job;

        this.hostClient.request('companion.document.print', {
            printerName: job.printerName,
            path: job.filename
        }).then(response => {

            this.jobs[id].success = true;
            onFinish(port, this.jobs[id]);
            delete this.jobs[id];

        }).catch(error => {

            this.jobs[id].success = false;
            this.jobs[id].reason = error;
            onFinish(port, this.jobs[id]);
            delete this.jobs[id];

        });

    }
}

exports.printerService = new PrinterService();