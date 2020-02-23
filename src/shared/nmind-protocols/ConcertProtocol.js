/*
 * @author Nmind.io <osp@nmind.io>
 */

class Message {
    
    /// <summary>
    /// Message start
    /// </summary>
    static STX = 0x2;

    /// <summary>
    /// Message end
    /// </summary>
    static ETX = 0x3;

    /// <summary>
    /// Session start
    /// </summary>
    static EOT = 0x4;

    /// <summary>
    /// Ask for open session
    /// </summary>
    static ENQ = 0x5;

    /// <summary>
    /// Positive aknowledgement
    /// </summary>
    static ACK = 0x6;

    /// <summary>
    /// Negative aknowledgement
    /// </summary>
    static NAK = 0xD;

    /// <summary>
    /// Euro
    /// </summary>
    static CURRENCY_EURO = 978;

    /// <summary>
    /// 
    /// </summary>
    static TRANSACTION_TYPE_PURCHASE = 0;

    /// <summary>
    /// 
    /// </summary>
    static TRANSACTION_TYPE_REFUND = 1;

    /// <summary>
    /// 
    /// </summary>
    static TRANSACTION_TYPE_CANCEL = 2;

    /// <summary>
    /// 
    /// </summary>
    static MODE_CARD = "1";

    /// <summary>
    /// 
    /// </summary>
    static IND_RESPONSE = "1";

    /// <summary>
    /// 
    /// </summary>
    LRC (str) {
        var bytes = [];
        var lrc = 0;
        for (var i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }

        for (var i = 0; i < str.length; i++) {
            lrc ^= bytes[i];
        }

        return String.fromCharCode(lrc);
    }

}

/// 
/// 
/// 
class PaymentMessage extends Message {

    /// 
    /// 
    /// 
    constructor () {
        this._pos = 0;
        this._amount = 0;
        this._ind = Message.IND_RESPONSE;
        this._mode = Message.MODE_CARD;
        this._type = Message.TRANSACTION_TYPE_PURCHASE;
        this._currency = Message.CURRENCY_EURO;
        this._data =  "";
    }

    /// 
    /// 
    /// 
    set POS (POS){
        if(POS instanceof Number){
            this._pos = POS;
        }
    }

    /// 
    /// 
    /// 
    get POS (){
        return this._pos;
    }

    /// 
    /// 
    /// 
    set data (data){
        if(data instanceof String){
            this._data = data.substring(0, 10);
        }
    }

    /// 
    /// 
    /// 
    get data (){
        return this._data;
    }

    /// 
    /// 
    /// 
    set amount (amount){
        if(amount instanceof Number){
            this._amount = amount *100;
        }
    }

    /// 
    /// 
    /// 
    get amount (){
        return this._amount;
    }

}

/// 
/// 
/// 
class RequestPaymentE extends PaymentMessage {

    /// 
    /// 
    /// 
    constructor () {
        super();
    }
    
    /// 
    /// 
    /// 
    compose(){
        var message = "";
        message += sprintf("02d", this._pos);
        message += sprintf("08d", this._amount);
        message += this._ind;
        message += this._mode;
        message += sprintf("1d", this._type);
        message += sprintf("03d", this._currency);
        message += this._data;
        return message;
    }

}

/// 
/// 
/// 
class ResponseE extends Message {

    /// 
    /// 
    /// 
    constructor () {
        super();
    }

}

/// 
/// 
/// 
class PaymentTerminal {

    /// 
    /// 
    /// 
    constructor (port) {
        this.port = port;
    }

    /// 
    /// 
    ///
    test(){

    }

    /// 
    /// 
    ///
    request(message){

    }
}

/// 
/// 
/// 
class SerialPort {

    /// 
    /// 
    /// 
    constructor (nativeClient, portName) {
        this.client = nativeClient
        this.port = {
            name : portName || "",
            baudRate : 9600,
            parity : 1,
            dataBits : 7,
            stopBits : 0,
            handShake : 1,
            readTimeout : 500,
            writeTimeout : 500
        };
    }

    /// 
    /// 
    ///
    test(){

    }

    /// 
    /// 
    ///
    request(message){
        if(this.client.isConnected()){

        } else {
            throw "NativeHostClient not connected"
        }
    }

}

/// 
/// 
/// 
class NetworkPort {

    /// 
    /// 
    /// 
    constructor (url) {
        this.port = {
            url : url || "",
            port : 8888,
            readTimeout : 500,
            writeTimeout : 500
        };
    }

    /// 
    /// 
    ///
    test(){

    }

    /// 
    /// 
    ///
    request(message){

    }

}

exports.PaymentTerminal = PaymentTerminal;