function gEBI(s) { return document.getElementById(s); }

var gList = null;
var gRestrict = null;

(function () {
   var m = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        };
   String.prototype.quote = function () {
     var x = this;
     if (/["\\\x00-\x1f]/.test(this)) {
      x = this.replace(/([\x00-\x1f\\"])/g, function(a, b) {
      var c = m[b];
      if (c) { return c; }
      c = b.charCodeAt();
      return '\\u00' + Math.floor(c / 16).toString(16) + (c % 16).toString(16);
      });
     }
     return '"' + x + '"';
   };
})();

function SetItem(item, rule) {
  var f = item.childNodes.item(0);
  var lab = "";
  if (rule.field == "any") { lab = "Any"; }
  else if (rule.field == "sender") { lab = "Sender"; }
  else if (rule.field == "subject") { lab = "Subject"; }
  else alert("Internal error: unknown field " + rule.field);

  f.setAttribute("value", rule.field);
  f.setAttribute("label", lab);

  item.childNodes.item(1).setAttribute("label", rule.contains);
  item.childNodes.item(2).setAttribute("value", rule.folder);
  item.childNodes.item(2).setAttribute("label", NostalgyCrop(rule.folder));
}

function RuleOfItem(item) {
 return ({ folder: item.childNodes.item(2).getAttribute("value"),
	   contains: item.childNodes.item(1).getAttribute("label"),
	   field: item.childNodes.item(0).getAttribute("value") });
}

function CreateItem(rule) {
  var item = document.createElement("listitem");
  item.appendChild(document.createElement("listcell"));
  item.appendChild(document.createElement("listcell"));
  item.appendChild(document.createElement("listcell"));
  SetItem(item,rule);
  gList.appendChild(item);
  gList.selectedItem = item;
}


function StrOfRule(rule) {
  return (
   "{field: '"    + rule.field            + "'," +
   " contains:  " + rule.contains.quote() + "," +
   " folder:  "   + rule.folder.quote()   + "}"
  );
}

function MkPrefStr() {
  var i;
  var cnt = gList.getRowCount();
  var res = "";
  for (i = 0; i < cnt; i++) {
    if (i > 0) res = res + ", ";
    res = res + StrOfRule(RuleOfItem(gList.getItemAtIndex(i)));
  }
  return ("[" + res + "]");
}


function EditRule(rule, accept) {
  window.openDialog("chrome://nostalgy/content/edit_rule.xul", 
                     "_blank", 
	             "dialog,chrome,modal,titlebar,resizable=yes",
	             rule,accept);
}

function DoEdit() {
  var item = gList.selectedItem;
  if (item) { 
    EditRule(RuleOfItem(item), function(rule) { SetItem(item,rule); });
  }
}

function onAcceptChanges() {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);
  prefs.setCharPref("extensions.nostalgy.rules", MkPrefStr());
  prefs.setBoolPref("extensions.nostalgy.restrict_to_current_server", 
	gRestrict.checked);
  window.close();
}

function DoNewRule() {
  EditRule({ field:"any", contains:"", folder:"" }, CreateItem);
}

function DoDelete() {
  var idx = gList.selectedIndex;
  if (idx >= 0) { 
    gList.removeItemAt(idx); 
    if (gList.getRowCount() <= idx) { idx = gList.getRowCount() - 1; }  
    gList.selectedIndex = idx;
  }
}

function onNostalgyLoad() {
  gList = gEBI("rules");
  gRestrict = gEBI("restrict_to_current_server");

  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);

  var r = eval(prefs.getCharPref("extensions.nostalgy.rules"));
  var i;
  for (i = 0; i < r.length; i++) { 
    r[i].folder = r[i].folder;
    r[i].contains = r[i].contains;
    CreateItem(r[i]); 
  }

 var b = false;
 try { b=prefs.getBoolPref("extensions.nostalgy.restrict_to_current_server"); }
 catch (ex) { }
 gRestrict.checked = b;
}

function onKeyPress(ev) {
  if ((ev.keyCode == 46) || (ev.keyCode == 8)) { DoDelete(); }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("keypress", onKeyPress, false);
