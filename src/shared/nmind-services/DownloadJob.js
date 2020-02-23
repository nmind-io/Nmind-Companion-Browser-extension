/*
 * @author Nmind.io <osp@nmind.io>
 */
const { DownloadJobResponse } = require('./DownloadJobResponse');

//
//
//
class DownloadJob {

    //
    //
    //
    constructor() {
        this.id = 0,
        this.name = '',
		this.url = '',
		this.conflictAction = 'uniquify',
		this.filename = '',
		this.headers = [
            { name : 'Accept', value : 'application/json, text/plain, */*'}
        ],
        this.method = 'GET',
        this.saveAs = false
    }

}

exports.DownloadJob = DownloadJob;