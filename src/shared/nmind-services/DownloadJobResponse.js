/*
 * @author Nmind.io <osp@nmind.io>
 */

//
//
//
class DownloadJobResponse {

    //
    //
    //
    constructor() {
        this.id = 0,
        this.name = '',
		this.destination = '',
        this.reason = '',
        this.success = false,
        this.downloading = false
    }

}

exports.DownloadJobResponse = DownloadJobResponse;