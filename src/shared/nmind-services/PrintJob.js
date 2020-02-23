/*
 * @author Nmind.io <osp@nmind.io>
 */

//
//
//
class PrintJob {

    //
    //
    //
    constructor(response) {
        this.id = 0;
        this.name = '';
		this.filename = '';
        this.reason = '';
        this.success = false;
        this.printing = false;
        this.printerName = '';

        if(response){
            this.fromDownloadJobResponse(response);
        }
    }

    fromDownloadJobResponse(response){
        this.id = response.id;
        this.name = response.name;
		this.filename = response.destination;
        this.reason = '';
        this.success = false;
        this.printing = false;
    }
}

exports.PrintJob = PrintJob;