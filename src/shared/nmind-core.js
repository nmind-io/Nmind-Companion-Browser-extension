/*
 * @author Nmind.io <osp@nmind.io>
 */

exports.browser = require('webextension-polyfill');
exports.Logger = require('./LoggerWrapper').Logger;
exports.Storage = require('./Storage').Storage;
exports.Eventemitter = require('./Eventemitter').Eventemitter;

//#endregion ----------------------------------------------------------------