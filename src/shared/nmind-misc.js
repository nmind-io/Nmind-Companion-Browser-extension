/*
 * @author Nmind.io <osp@nmind.io>
 */
//
//
//
function ensureType(target, property, expected, value){
    if(typeof target === 'object' && typeof target[property] !== expected){
        target[property] = value;
    }
}

//
//
//
function typeOfString(target, property, value){
    ensureType(target, property, 'string', value);
}

//
//
//
function typeOfNumber(target, property, value){
    ensureType(target, property, 'number', value);
}

//
//
//
function typeOfBoolean(target, property, value){
    ensureType(target, property, 'boolean', value);
}

/**
 * Dumps information about variable
 *
 */
function varDump() {

    var __dump = function (mVar) {
        var sOut = new String('(');
        sOut = sOut.concat(typeof mVar);
        sOut = sOut.concat(') ');

        if (typeof mVar == 'object') {

            sOut = sOut.concat('{ ');

            for (var mKey in mVar) {
                sOut = sOut.concat(mKey + ': ' + varDump(mVar[mKey]) + ', ');
            }
            
            sOut = sOut.substring(0, sOut.length - 2);
            sOut = sOut.concat(' }');

        } else if (typeof mVar == 'string') {
            sOut = sOut.concat('"');
            sOut = sOut.concat(mVar);
            sOut = sOut.concat('"');
        } else {
            sOut = sOut.concat(new String(mVar));
        }

        return sOut;

    }

    var result = [];

    for (var i = 0; i < arguments.length; i++) {
        result[i] = __dump(arguments[i]);
    }

    return result.join("\n")
}

exports.varDump = varDump;
exports.ensureType = ensureType;
exports.typeOfString = typeOfString;
exports.typeOfNumber = typeOfNumber;
exports.typeOfBoolean = typeOfBoolean;