/*
 * @author Nmind.io <osp@nmind.io>
 */
const { Logger, browser } = require('../nmind-core');
const { DownloadJobResponse } = require('./DownloadJobResponse');
//
//
//
class DownloadService {

    //
    //
    //
    constructor() {
        this.dirDownloads = null;
        this.jobs = {};
        var self = this;

        browser.downloads.onCreated.addListener((item) => {
            self._onCreatedListener(item);
        });

        browser.downloads.onChanged.addListener((item) => {
            self._onChangedListener(item);
        });
    }

    //
    //
    //
    configure(dirDownloads){
        this.dirDownloads = dirDownloads;
    }

    //
    // Construit une nouvelle tâche visant à télécharger un fichier
    //
    createJob(port, job) {
        job.filename = this.dirDownloads + job.filename;
        var response = this._createReponse(job);
        var onFinish = job.onFinish;

        this._sanitizeJobProperties(job);

        var self = this;
        return new Promise(function (resolve, reject){

            browser.downloads.download(job).then(
                function (id) {
                    Logger.debug(`Download job  ${id} started from ${port.contextId}`);

                    if (self.jobs[id]) {
                        self.jobs[id].response = response;
                        self.jobs[id].port = port;
                        self.jobs[id].id = id;
                        self.jobs[id].onFinish = onFinish;
                    } else {
                        self.jobs[id] = {
                            port: port,
                            response: response,
                            onFinish,
                            id: id,
                            filename: '',
                            fileSize: 0,
                            totalBytes: 0
                        }
                    }

                    response.downloading  = true;
                    resolve(response);
                },
                function (error) {
                    Logger.error("Download-failed ", error);
                    response.downloading  = false;
                    response.success  = false;
                    response.reason = error;
                    reject(response);
                }
            );

        });

    }

    //
    //
    //
    _sanitizeJobProperties(job){
        var allowed = [
            'body',
            'conflictAction',
            'filename',
            'headers',
            'incognito',
            'method',
            'saveAs',
            'url'
        ];

        for(let key in job){
            if(!allowed.includes(key)){
                delete job[key];
            }
        }
    }

    //
    //
    //
    _createReponse(job){
        var response = new DownloadJobResponse();
        response.id = job.id;
        response.name = job.name;
        return response;
    }

    //
    //
    //
    _onCreatedListener(item){
        Logger.debug(`New Download job  ${item.id} created : ${item.filename}`);

        if (this.jobs[item.id]) {
            this.jobs[item.id].filename = item.filename;
            this.jobs[item.id].fileSize = item.fileSize;
            this.jobs[item.id].totalBytes = item.totalBytes;
            this.jobs[item.id].response.destination = item.filename;
        } else {
            this.jobs[item.id] = {
                port: null,
                response: null,
                onFinish : null,
                id: item.id,
                filename: item.filename,
                fileSize: item.fileSize,
                totalBytes: item.totalBytes
            }
        }
    }

    //
    //
    //
    _onChangedListener(delta){

        if(this.jobs[delta.id] == undefined){
            return;
        }

        if (delta.error) {
            Logger.debug(`Download job ${delta.id} has error`, delta.error);
            this._notifyDownloadJob(delta.id, false, delta.error.current);
            this._cleanupJob(delta.id, true);
        }
    
        if (delta.filename) {
            this.jobs[delta.id].filename = delta.filename.current;
            this.jobs[delta.id].response.destination = delta.filename.current;
        }
    
        if (delta.fileSize) {
            this.jobs[delta.id].fileSize = delta.fileSize.current;
        }
    
        if (delta.totalBytes) {
            this.jobs[delta.id].totalBytes = delta.totalBytes.current;
        }
    
        if (delta.exists) {
            this.jobs[delta.id].exists = delta.exists.current;
        }
    
        if (delta.state) {
    
            switch (delta.state.current) {
                case "complete":
    
                    // si la taille du fichier est à 0, c'est une erreur
                    // une taille de -1 signifie une taille indéterminée.
                    if (this.jobs[delta.id].fileSize == 0) {
                        this._notifyDownloadJob(delta.id, false, "Empty content");
                        this._cleanupJob(delta.id, true);
                    } else {
                        this._notifyDownloadJob(delta.id, true);
                        this._cleanupJob(delta.id, false);
                    }
    
                    break;
    
                case "interrupted":
    
                    break;
    
            }
    
        }

    }

    //
    // Informe la page que le téléchargement est terminé
    //
    _notifyDownloadJob(id, success, reason) {
        
        if (success) {
            Logger.debug(`DownloadJob ${id} has been completed in ${this.jobs[id].filename}`);
        } else {
            Logger.debug(`DownloadJob ${id} has error : ${reason}`);
        }

        if (this.jobs[id].response && this.jobs[id].onFinish) {
            this.jobs[id].response.downloading = false;
            this.jobs[id].response.success = success;
            this.jobs[id].response.reason = reason || "";
            this.jobs[id].response.destination = this.jobs[id].filename
            this.jobs[id].onFinish(this.jobs[id].port, this.jobs[id].response);
            return true;
        } else {
            return false;
        }
    }

    //
    //
    //
    _cleanupJob(id, removeFile) {
        delete this.jobs[id];
        if (removeFile === true) {
            browser.downloads.removeFile(id);
            browser.downloads.erase({ id: id });
        }
    }

}

exports.downloadService = new DownloadService();