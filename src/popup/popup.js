/*
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */
const { Logger, browser } = require('../shared/nmind-core');
const { BackgroundClient } = require("../shared/nmind-messaging");
const {
    URL_SETTINGS,
    DEFAULT_OPTIONS
} = require('../shared/constants');

const __client = new BackgroundClient();
var __options = DEFAULT_OPTIONS;
var __printersList = [];
var __serialPortsList = [];
var __devicesList = [];
var __protocolsList = [];

jQuery.noConflict();

jQuery(function($){
    $(document).ready(function(){

        $('#trigger-help').on('click', function(e){
            browser.tabs.create({
                url: URL_SETTINGS
            });
            window.close();
        });

        $('#options-printer-activate').on('change', function(e){
            var disabled = !$(this).is(':checked');
            $('#options-printer-default').prop('disabled', disabled);
            $('#options-printer-trigger-test').prop('disabled', disabled);
        });
        
        $('#options-pos-activate').on('change', function(e){
            var disabled = !$(this).is(':checked');
            $('#options-pos-device').prop('disabled', disabled);
            $('#options-pos-port').prop('disabled', disabled);
            $('#options-pos-protocol').prop('disabled', disabled);
            $('#options-pos-ethip').prop('disabled', disabled);
            $('#options-pos-trigger-ping').prop('disabled', disabled);
        });

        $('#options-printer-activate').prop('checked', false);
        $('#options-printer-activate').change();

        $('#options-pos-activate').prop('checked', false);
        $('#options-pos-activate').change();
        
        $('.sync-trigger').on('change', function(e){
            syncOptions();
        });

        $('#options-printer-trigger-test').on('click', function(e){
            var $this = $(this);
            $this.children('.spinner-border').show();
            $this.prop('disabled', true);

            var params = {
                printerName : $('#options-printer-default').val(),
            };

            __client.request('companion.printers.test', params)
                .then(function(response){
                    Swal.fire({ 
                        icon: 'success', 
                        title : 'Test réussi', 
                        html  : "Une page de test est encours d'impression sur <br/>" 
                        + "<i>" + $('#options-printer-default').val() + "</i>", 
                        timer : 3000, 
                        timerProgressBar : true 
                    });
                }).catch(function(err){
                    Swal.fire({ 
                        icon: 'error', 
                        title : err.message, 
                        timer : 3000, 
                        timerProgressBar : true
                    });
                }).finally(function(){
                    $this.children('.spinner-border').hide();
                    $this.prop('disabled', false);
                });
        });

        $('#options-pos-trigger-ping').on('click', function(e){
            var $this = $(this);
            $this.children('.spinner-border').show();
            $this.prop('disabled', true);

            var params = {
                port : $('#options-pos-port').val(),
                device : $('#options-pos-device').val(),
                protocol : $('#options-pos-protocol').val()
            };

            __client.request('companion.epayment.ping', params)
                .then(function(response){
                    Swal.fire({
                        icon: 'success', 
                        title : 'Test réussi !',
                        html : "Le terminal affiche <i>fonction impossible</i>, cela est normal",
                        timer : 3000, 
                        timerProgressBar : true 
                    });
                }).catch(function(err){
                    Swal.fire({ 
                        icon: 'error', 
                        title : err.message, 
                        html : "Vérifiez le modèle du device, le port, le branchement, ...", 
                        timer : 3000, 
                        timerProgressBar : true
                    });
                }).finally(function(){
                    $this.children('.spinner-border').hide();
                    $this.prop('disabled', false);
                });
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
            __client.request('companion.printers.list'), 
            __client.request('companion.serialPorts.list'),
            __client.request('companion.epayment.supportedDevices'),
            __client.request('companion.epayment.supportedProtocols')
        ]).then(function(values) {
            __options = Object.assign(__options, values[0]);
            __printersList = values[1].content;
            __serialPortsList = values[2].content;
            __devicesList = values[3].content;
            __protocolsList = values[4].content;
            hydrateForm();
        });

    }

    function hydrateForm(){

        $('#options-printer-default').find('option').remove();
        __printersList.forEach(name => {
            $('#options-printer-default').append(new Option(name, name));
        });

        $('#options-pos-port').find('option').remove();
        __serialPortsList.forEach(name => {
            $('#options-pos-port').append(new Option(name, name));
        });

        $('#options-pos-protocol').find('option').remove();
        for(var property in __protocolsList){
            $('#options-pos-protocol').append(new Option(__protocolsList[property], property));
        }

        $('#options-pos-device').find('option').remove();
        for(var property in __devicesList){
            $('#options-pos-device').append(new Option(__devicesList[property], property));
        }

        $('#options-console-activate').prop('checked', __options.console);

        $('#options-printer-activate').prop('checked', __options.printer.activate);
        $('#options-printer-default').val(__options.printer.default);

        $('#options-pos-activate').prop('checked', __options.pos.activate);
        $('#options-pos-device').val(__options.pos.device);
        $('#options-pos-port').val(__options.pos.port);
        $('#options-pos-protocol').val(__options.pos.protocol);
        $('#options-pos-ethip').val(__options.pos.ethip);

        $('#options-printer-activate').change();
        $('#options-pos-activate').change();

    }

    function syncOptions(){
        __options.console = $('#options-console-activate').is(':checked');
        Logger.isDebugMode = __options.console;

        __options.printer.activate = $('#options-printer-activate').is(':checked');
        if(__options.printer.activate){
            __options.printer.default = $('#options-printer-default').val();
        } else {
            __options.printer.default = "";
        }

        __options.pos.activate = $('#options-pos-activate').is(':checked');
        if(__options.pos.activate){
            __options.pos.device = $('#options-pos-device').val();
            __options.pos.port = $('#options-pos-port').val();
            __options.pos.protocol = $('#options-pos-protocol').val();
            __options.pos.ethip = $('#options-pos-ethip').val();

        } else {
            __options.pos.device = "";
            __options.pos.port = "";
            __options.pos.protocol = "";
            __options.pos.ethip = "";
        }

        browser.storage.local.set(__options)
            .then(function(){

            }, onError);

    }

    function onError(error) {
        Logger.error(error)
    }

});
