const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
	var ChromeUtils = require("ChromeUtils.jsm");
var {XPCOMUtils} = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");


const CLASS_ID = Components.ID('0368fb30-62f8-11e3-949a-0800200c9a66');
const CLASS_NAME = "Nostalgy Folder Autocomplete";
const CONTRACT_ID = '@mozilla.org/autocomplete/search;1?name=nostalgy-autocomplete';


// nsIAutoCompleteResult implementation

function NostalgyDebug(aText)
{
  var csClass = Components.classes['@mozilla.org/consoleservice;1'];
  var cs = csClass.getService(Components.interfaces.nsIConsoleService);
  cs.logStringMessage(aText);
}

function NostalgyAutoCompleteResult(searchString, results) {
  const ACR = Ci.nsIAutoCompleteResult;
  this._searchResult = results.length > 0 ? ACR.RESULT_SUCCESS : ACR.NOMATCH;
  this._searchString = searchString;
  this._results = results;
}

NostalgyAutoCompleteResult.prototype = {
  _searchString: "",
  _searchResult: 0,
  _results: [],

  get searchString() { return this._searchString; },
  get searchResult() { return this._searchResult; },
  get defaultIndex() { return 0; },
  get errorDescription() { return ""; },
  get matchCount() { return this._results.length; },
  getValueAt: function(index) { return this._results[index]; },
  getCommentAt: function(index) { return ""; },
  getStyleAt: function(index) { return null; },
  getImageAt : function (index) { return ""; },
  removeValueAt: function(index, removeFromDb) { this._results.splice(index, 1); },
  getLabelAt: function(index) { return this._results[index]; },
  QueryInterface: ChromeUtils.generateQI([ Ci.nsIAutoCompleteResult ]),
};


// nsIAutoCompleteSearch implementation

function NostalgyAutoCompleteSearch() {
  this.wrappedJSObject = this;
}

NostalgyAutoCompleteSearch.prototype = {
  classID: CLASS_ID,
  classDescription : CLASS_NAME,
  contractID : CONTRACT_ID,
  _f: {},
  _id: 0,

  attachGetValuesFunction: function(f) { this._id++; this._f[this._id] = f; return this._id; },

  startSearch: function(searchString, searchParam, previousResult, listener) {
    var searchResults = this._f[searchParam](searchString);
    var result = new NostalgyAutoCompleteResult(searchString, searchResults);
    listener.onSearchResult(this, result);
  },

  stopSearch: function() {},

  QueryInterface: ChromeUtils.generateQI([ Ci.nsIAutoCompleteSearch ]) ,
};


// XPCOM component creation

const NSGetFactory = XPCOMUtils.generateNSGetFactory([ NostalgyAutoCompleteSearch ]);
