/*
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */
const { BackgroundClient } = require("../shared/nmind-messaging");
const __client = new BackgroundClient();

jQuery.noConflict();
jQuery(function($){
    $(document).ready(function(){

        $('#trigger-help').on('click', function(e){
            browser.tabs.create({
                url: URL_SETTINGS
            });
            window.close();
        });

        $('.sync-trigger').on('change', function(e){
            syncOptions();
        });

        $('#window-trigger-close').on('click', function(e){
            window.close();
        });

        $('#window-trigger-refresh').on('click', function(e){
            loadData();
        });

        loadData();

    });

    function loadData(){

        Promise.all([
            browser.storage.local.get(), 
        ]).then(function(values) {
            __options = Object.assign(__options, values[0]);
            hydrateForm();
        });

    }

    function hydrateForm(){

    }

    function syncOptions(){

        browser.storage.local.set(__options)
            .then(function(){

            }, onError);

    }

    function onError(error) {
        Logger.error(error)
    }

});