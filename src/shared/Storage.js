/*
 * @author Nmind.io <osp@nmind.io>
 */
const { browser } = require('../shared/nmind-core');
const {
    DEFAULT_OPTIONS
} = require('../shared/constants');

//
//
//
class StorageWrapper {

    //
    //
    //
    constructor(__options) {
        this.options = __options;
        this.listener = null;
        var self = this;
        browser.storage.onChanged.addListener(function(changes, area){
            if(area == 'local'){
                self.synchronize();
            }
        });

    }

    //
    //
    //
    synchronize(){
        var self = this;

        browser.storage.local.get()
            .then(function(values){
                self.options = Object.assign(self.options, values);
                if(self.listener){
                    self.listener();
                }
            })
            .catch(function(error){
                console.log(error);
            });
    }

    //
    //
    //
    onChange(listener){
        this.listener = listener;
    }
}

exports.Storage = new StorageWrapper(DEFAULT_OPTIONS);