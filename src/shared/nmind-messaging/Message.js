/*
 * @author Nmind.io <osp@nmind.io>
 */
const { typeOfString, typeOfBoolean, typeOfNumber } = require('../nmind-misc');

//---------------------------------------------------------------------------
//#region Message
//---------------------------------------

class Message {

    static success(data, name) {
		return new Success(data, name);
    }

    static failure(message, type, name) {
		return new Failure(message, type, name);
    }

    static error(err, type, name) {
		return new ScriptError(err, type, name);
    }

    static unknown(message, name) {
		return new Unknown(message, name);
    }

    static request(name, params) {
		return new Request(name, params);
    }
}

class Request {
	
	constructor(name, params){
		this.name = name;
		this.params = params;
		this.id = '-1';
		this.delay = 0;
		this.async = false;
		this.silent = false;
	}
	
	check(){

		typeOfNumber(this, 'delay', 0);
		typeOfBoolean(this, 'async', false);
		typeOfBoolean(this, 'silent', false);
		typeOfString(this, 'id', '-1');
		
	}
}

class Response {

	constructor(code){
		this.code = code;
	}

}

class Success extends Response{
	
	constructor(data, name){
		super(200);
		this.name = name;
		this.refid = undefined;
		this.content = data;
	}
	
}

class Failure extends Response{
	
	constructor(message, type, name){
		super(403);
		this.name = name;
		this.type = type || null;
		this.message = message;
	}
	
}

class Unknown extends Response{
	
	constructor(message, name){
		super(404);
		this.name = name;
		this.message = message;
	}
	
}

class ScriptError extends Response{
	
	constructor(err, type, name){
		super(500);
		
        if(typeof err === "object" && err.message){

            if(err.message){
                err = err.message
            }

            if(err.type){
                type = err.type
            }

        }
		
		this.name = name;
		this.type = type || null;
		this.message = err;
	}
	
}

//#endregion ----------------------------------------------------------------

exports.Message = Message;
exports.Request = Request;
exports.Response = Response;
exports.Success = Success;
exports.Failure = Failure;
exports.Unknown = Unknown;
exports.ScriptError = ScriptError;