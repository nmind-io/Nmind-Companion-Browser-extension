/*
 * @author Nmind.io <osp@nmind.io>
 */

const { Message, Request } = require("./Message");
const { Logger } = require('../LoggerWrapper');

// Client pour communiquer avec l'extension
// Version simplifiée des Endpoint adaptée à cet usage
//
// L'objectif du client est de pouvoir envoyer un message au TabListener et d'obtenir en retour une Promise
// La solution est de :
//      1 - créer un TextNode dans document.head en serializant la requête afin de pouvoir 
//          transmettre des données entre les deux espaces
//      2 - Ajouter un écouteur d'évènement 'io.nmind.response' sur ce TextNode
//      3 - Déclencher un évènement 'io.nmind.request' à partir de ce TextNode 
//          qui va être propagé au niveau de window
//      4 - TabListener écoute toutes les évènements 'io.nmind.request' au niveau de window.
//          Il est alors en mesure d'obtenir la source TextNode. Il peut dès lors traiter 
//          la requête
//      5 - Tablistener serialize la réponse dans le TextNode et déclenche un évènement 
//          'io.nmind.response'
//          au niveau du TextNode
//      6 - L'écouteur d'évènement ajouté à l'étape 2 peut alors supprimer le TextNode 
//          et obtenir la réponse
//
// Ainsi, la requête/réponse peut se traiter à l'aide d'une Promise sans interférer 
// avec d'autres requêtes ou d'autres éléments de la page
//
// Il reste cependant possible d'envoyer des requêtes async qui ne retourne pas de promise
// Dans ce système, les requête async provoqueront ou pas un message ultérieur
class ExtensionClient {

    // Le constructeur ajoute un écouteur sur les évènements io.nmind.message
    // issus des messages 
    // afin de prévenir les écouteurs de route
    //
    constructor(){
        this.routes = [];
        var self = this;

        window.document.addEventListener('io.nmind.message', function (e) {
            var request = JSON.parse(e.detail);

            if (self.routes[request.name] != undefined) {
                try {
                    var args;
    
                    if(Array.isArray(request.params)){
                        args = request.params;
                    } else if(typeof request.params === "object"){
                        args = [request.params];
                    } else {
                        args = [request.params];
                    }
    
                    self.routes[request.name].apply(null, args);
    
                } catch (err) {
                    console.error(err);
                }
    
            }
        }, false);
    }

    //
    //
    //
    create(route, params){
        return Message.request(route, params);
    }

    //
    //++
    //
    on (name, handler){
        if(typeof handler === "function"){
            this.routes[name] = handler;
        } else {
            throw `Handler for '${name}' is not a function`;
        }
    }

    //
    //++
    //
    off (name){
        if(this.routes[name]){
            delete this.routes[name];
        }
    }

    //++
    // Méthode qui permet aux pages de détecter la présence de l'extension. 
    // si window.supportClient n'existe pas, l'extension n'est pas chargée
    // Il est possible d'ajouter une fonctionnalité d'identification
    // si par hasard deux extensions publient cette fonction
    // en utilisant window.supportClient.version("Support Companion")
    version(name) {

        if(name !== undefined){
            return name === "Support Companion";
        }
    
        return this.send('extension.version');
    
    }
    
    //
    //
    // 
    send (__name, __params) {

        var request;
        if(__name instanceof Request){
            request = __name;
        } else {

            if (arguments.length > 2) {
                __params = Array.prototype.slice.call(arguments, 1);
            } else {
                __params = __params || {};
            }
        
            request = Message.request(__name, __params);

        }

        request.check();

        if(request.async){
            this._sendAsyncRequest(request);
        } else {
            return this._sendPromiseRequest(request);
        }
    
    }

    //
    //
    //
    _sendRequest(request, handler){
        var jsnode = document.createTextNode(JSON.stringify(request));

        jsnode.addEventListener("io.nmind.response", function (event) {
            Logger.debug("ExtensionClient-Received response", jsnode.nodeValue);
            event.cancelBubble = true;
            jsnode.parentNode.removeChild(jsnode);
            if(handler){
                handler(JSON.parse(jsnode.nodeValue));
            }
        });

        document.head.appendChild(jsnode);
        jsnode.dispatchEvent(new Event("io.nmind.request", { "bubbles": true, "cancelable": false }));
    }

    //
    //
    //
    _sendPromiseRequest(request){
        var self = this;
        return new Promise(function (resolve, reject) {
            var handler = (response) => {
                response.code == 200 ? resolve(response) : reject(response);
            };

            var runnable = () => {
                request.delay = 0;
                self._sendRequest(request, handler);
            }

            if(request.delay > 0){
                setTimeout(runnable, request.delay);
            } else {
                runnable();
            }
            
        });
    }

    //
    //
    //
    _sendAsyncRequest(request){
        var self = this;
        var runnable = () => {
            request.delay = 0;
            self._sendRequest(request, (response) => {
                Logger.debug("ExtensionClient-AsyncRequest received response", response);
            });
        }

        if(request.delay > 0){
            setTimeout(runnable, request.delay);
        } else {
            runnable();
        }
    }

}

//
//
//
function configureWindow(window) {

    window.supportClient = new ExtensionClient();

    // Déclenche un évènement pour que cela soit compatibla evace tous les navigateurs
    // Sur Firefox ce n'est pas obligatoire window.supportClient existe immédiatement
    // ce qui ne semble pas être le cas avec Chrome
    window.document.dispatchEvent(new Event("supportClient.ready", { 
        "bubbles": true, 
        "cancelable": false
    }));
    
}

exports.ExtensionClient = ExtensionClient;
exports.configureWindow = configureWindow;