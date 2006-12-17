function gEBI(s) { return document.getElementById(s); }

var gList = null;

var boolPrefs = [ 
 "restrict_to_current_server",
 "match_only_folder_name",
 "sort_folders",
 "match_case_sensitive",
 "tab_shell_completion"
];

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
  if (rule.sender) lab = lab + "F";
  if (rule.recipients) lab = lab + "R";
  if (rule.subject) lab = lab + "S";

  f.setAttribute("value", lab);
  f.setAttribute("label", lab);

  item.childNodes.item(1).setAttribute("label", rule.contains);

  var u = "";
  if (rule.under) { u = rule.under; }
  item.childNodes.item(2).setAttribute("value", u);
  item.childNodes.item(2).setAttribute("label", NostalgyCrop(u));

  item.childNodes.item(3).setAttribute("value", rule.folder);
  item.childNodes.item(3).setAttribute("label", NostalgyCrop(rule.folder));
}

function RuleOfItem(item) {
 var fields = item.childNodes.item(0).getAttribute("value");
 return ({ folder: item.childNodes.item(3).getAttribute("value"),
           under: item.childNodes.item(2).getAttribute("value"),
	   contains: item.childNodes.item(1).getAttribute("label"),
           sender: fields.indexOf("F") >= 0,
           recipients: fields.indexOf("R") >= 0,
           subject: fields.indexOf("S") >= 0 });
}

function CreateItem(rule) {
  var item = document.createElement("listitem");
  item.appendChild(document.createElement("listcell"));
  item.appendChild(document.createElement("listcell"));
  item.appendChild(document.createElement("listcell"));
  item.appendChild(document.createElement("listcell"));
 
  // convert from previous version
  if (rule.field == "any") { 
   rule.sender = true;
   rule.recipients = true;
   rule.subject = true;
  } else if (rule.field == "sender") rule.sender = true
  else if (rule.field == "subject") rule.subject = true;

  SetItem(item,rule);
  gList.appendChild(item);
  gList.selectedItem = item;
}


function StrOfRule(rule) {
  return (
   "{sender:  "   + rule.sender           + "," +
   " recipients: "+ rule.recipients       + "," +
   " subject:   " + rule.subject          + "," +
   " contains:  " + rule.contains.quote() + "," +
   " under:  "    + rule.under.quote()    + "," +
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

function SwapItems(idx1,idx2) {
  var item1 = gList.getItemAtIndex(idx1);
  var item2 = gList.getItemAtIndex(idx2);
  var rule1 = RuleOfItem(item1);
  var rule2 = RuleOfItem(item2);
  SetItem(item1,rule2);
  SetItem(item2,rule1);
  gList.selectedIndex = idx2;
  gList.ensureIndexIsVisible(idx2);
}

function DoMoveUp(idx1,idx2) {
  var idx = gList.selectedIndex;
  if (idx == 0) return;
  SwapItems(idx,idx-1);
}

function DoMoveDown(idx1,idx2) {
  var idx = gList.selectedIndex;
  if (idx == gList.getRowCount() - 1) return;
  SwapItems(idx,idx+1);
}

function onAcceptChanges() {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);
  prefs.setCharPref("extensions.nostalgy.rules", MkPrefStr());

  for (var i in boolPrefs) {
    var n = boolPrefs[i];
    prefs.setBoolPref("extensions.nostalgy."+n,	gEBI(n).checked);
  }
  window.close();
}

function DoNewRule() {
  EditRule({ sender:true, recipients:true, subject:true, 
             contains:"", folder:"", under:"" }, CreateItem);
}

function DoDelete() {
  var idx = gList.selectedIndex;
  if (idx >= 0) { 
    gList.removeItemAt(idx); 
    if (gList.getRowCount() <= idx) { idx = gList.getRowCount() - 1; }  
    gList.selectedIndex = idx;
  }
}

function getBoolPref(prefs,s) {
 var b = false;
 try { 
  b=prefs.getBoolPref("extensions.nostalgy." + s); }
 catch (ex) { }
 return b;
}

function onNostalgyLoad() {
  gList = gEBI("rules");

  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);

  try {
   var r = eval(prefs.getCharPref("extensions.nostalgy.rules"));
   var i;
   for (i = 0; i < r.length; i++) { CreateItem(r[i]); }
  } catch (ex) { }

 for (var i in boolPrefs) {
   var n = boolPrefs[i];
   gEBI(n).checked = getBoolPref(prefs, n);
 }
}

function onKeyPress(ev) {
  if ((ev.keyCode == 46) || (ev.keyCode == 8)) { DoDelete(); }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("keypress", onKeyPress, false);
