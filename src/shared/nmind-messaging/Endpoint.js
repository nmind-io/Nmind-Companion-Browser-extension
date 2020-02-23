/*
 * @author Nmind.io <osp@nmind.io>
 */
const { Logger } = require('../LoggerWrapper');
const { Message, Response } = require('./Message');


//
//
//
class Endpoint {

    //
    //
    //
    constructor(){
        this.routes = [];
        this.pipes = {
            'plain' : [],
            'regexp' : []
        };
        this.forwarder;
    }

    //
    //
    //
    on (name, handler){
        if(typeof handler === "function"){
            this.routes[name] = handler;
        } else {
            throw `Handler for '${name}' is not a function`;
        }
    }

    //
    //
    //
    off (name){
        if(this.routes[name]){
            delete this.routes[name];
        }
    }

    //
    //
    //
    forward(route, params) {
        Logger.debug(`${this.constructor.name}-Endpoint-forward-request: ${route}`, params);
        
        if(this.forwarder.request){
            return this.forwarder.request(route, params);
        } else if(this.forwarder.post){
            return this.forwarder.post(route, params);
        }
    
    }

    // Pipe transmet au forwarder, cela permet d'automatiser la déclaration de méthode comme
    //  __listener.on('companion.method', function (left, right) {
    //      return this.forward("companion.method", [left, right]);
    //  });
    // Il est possible de passer un tableau de cha^nes ou de RegExp
    // La recherche de la route se fait dans l'ordre
    //      - Les routes déclarées
    //      - Les pipes déclarés en tanqut que chaine
    //      - Les pipes déclarés en tant que RegExp
    pipe(...routes){

        for(let route of routes){
            var type;

            if(typeof route === 'string'){
                type = 'plain';
            } else if(route instanceof RegExp){
                type = 'regexp';
            } else {
                return
            }

            this.pipes[type].push(route);
        }

    }

    //
    //
    //
    unpipe(...routes){

        for(let route of routes){
            var type;

            if(typeof route === 'string'){
                type = 'plain';
            } else if(route instanceof RegExp){
                type = 'regexp';
            } else {
                return;
            }

            if(this.pipes[type].includes(route)){
                delete this.pipes[type][this.pipes[type].indexOf(route)];
            }
        
        }

    }

    //
    //
    //
    join(endpoint){
        this.forwarder = endpoint;
        endpoint.forwarder = this;
    }

    //
    //
    //
    route (request, port) {
        Logger.debug(`${this.constructor.name}-Endpoint-route`, request);

        request.silent = request.silent || false;
        request.async = request.async || false;
        request.delay = request.delay || 0;

        var handler = this._findRoute(request);
        
        if (handler) {

            var args = this._buildArguments(request, port);
            var response = this._routeCall(handler, args, this);

            if(request.silent === false){
                return response;
            }

        } else {
            return Message.unknown(`Unknown route '${request.name}'`);
        }

    }

    //
    //
    //
    _findRoute(request){

        if (this.routes[request.name] !== undefined){
            return this.routes[request.name];

        } else if(this.pipes['plain'].includes(request.name)){
            return this._createPipe(request.name);

        } else {

            for(let regexp of this.pipes['regexp']){
                if(regexp.test(request.name)){
                    return this._createPipe(request.name);
                }
            }

        }

        return null;
    }

    //
    //
    //
    _createPipe(route){
        return function(){
            var params;
            if(arguments.length == 0){
                params = null;
            } else if(arguments.length == 1){
                params = arguments[0];
            } else {
                params = Array.from(arguments);
            }

            return this.forward(route, params);
        };
    }

    //
    //
    //
    _buildArguments(request, port){
        var args;

        if(port){

            if(Array.isArray(request.params)){
                args = [port, ...request.params];
            } else if(typeof request.params === "object"){
                args = [port, request.params];
            } else {
                args = [port, request.params];
            }

        } else {

            if(Array.isArray(request.params)){
                args = request.params;
            } else if(typeof request.params === "object"){
                args = [request.params];
            } else {
                args = [request.params];
            }

        }

        return args;
    }

    //
    //
    //
    _routeCall(route, args, context){

        try {
            var response = route.apply(context, args);

            if (response instanceof Promise) {
                return response;
            } else if (response instanceof Response) {
                return response;
            } else {
                return Message.success(response);
            }

        } catch (err) {
            Logger.error(err);
            return Message.failure(err.message);
        }
    }

    //
    //
    //
    _routeCallDelay(route, args, context, delay, silent){
        var self = this;

        if(silent){
            setTimeout(self._routeCall, delay, route, args, context);
        } else {

            return new Promise((resolve, reject) => {
    
                setTimeout(() => {
                    var response = self._routeCall(route, args, context);

                    if (response instanceof Promise) {
                        resolve(response);
                    } else if (response instanceof Response) {
                        resolve(response);
                    } else {
                        resolve(Message.success(response));
                    }

                }, delay);

            });

        }

    }
}

exports.Endpoint = Endpoint;