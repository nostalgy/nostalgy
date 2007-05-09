function gEBI(s) { return document.getElementById(s); }

var gList = null;

var wait_key = null;
var wait_key_old = "";

var keys = [
 ["save","Save message","S"],
 ["save_suggest","Save as suggested","shift S"],
 ["copy","Copy message","C"],
 ["copy_suggest","Copy as suggested","shift C"],
 ["go","Go to folder","G"],
 ["hide_folders","Hide folder pane","L"],
 ["search_sender","Show messages from same sender","`"]
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

  for (var n in nostalgy_completion_options)
    prefs.setBoolPref("extensions.nostalgy."+n,	gEBI(n).checked);
 
  if (wait_key) { wait_key.value = wait_key_old; wait_key = null; }
  for (var i in keys)
    prefs.setCharPref("extensions.nostalgy.keys."+keys[i][0],
                      gEBI("key_" + keys[i][0]).value);

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

function createElem(tag,attrs,children) {
 var x = document.createElement(tag);
 for (var a in attrs) x.setAttribute(a,attrs[a]);
 if (children) for (var i in children) x.appendChild(children[i]);
 return x;
}

function createKeyRow(id,txt,v) {
  return createElem("row",{ }, [
    createElem("label", { value:txt+":" }),
    createElem("label", { id:"key_" + id, class:"text-link", 
                          value:v, 
                          onclick:"WaitKey(this);",
                          onblur:"Cancel(this);" }),
    createElem("label", { class:"text-link", value:"disable",
                   onclick:"this.previousSibling.value = '(disabled)';"} )
  ]);
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

 for (var n in nostalgy_completion_options)
   gEBI(n).checked = getBoolPref(prefs, n);

 for (var i in keys) {
  var v = keys[i][2];
  try {
    v = prefs.getCharPref("extensions.nostalgy.keys." + keys[i][0]);
  } catch (ex) { }
  gEBI("key_rows").appendChild(createKeyRow(keys[i][0],keys[i][1],v));
 }
}

function onKeyPress(ev) {
  if (!wait_key && ((ev.keyCode == 46) || (ev.keyCode == 8))) DoDelete();
  // should only to that in the relevant tab

  else if (wait_key && ev.keyCode == KeyEvent.DOM_VK_ESCAPE) {
    ev.preventDefault();
    ev.stopPropagation();
    wait_key.value = wait_key_old;
    wait_key = null;
  } else if (wait_key && ev.keyCode != 13) {
    Recognize(ev,wait_key);
    wait_key = null;
  }
}


function Recognize(ev, tgt) {
 ev.preventDefault();
 ev.stopPropagation();

 var gVKNames = [];

 for (var property in KeyEvent) {
  gVKNames[KeyEvent[property]] = property.replace("DOM_VK_","");
 }

 var comps = [];
 if(ev.altKey) comps.push("alt");
 if(ev.ctrlKey) comps.push("control");
 if(ev.metaKey) comps.push("meta");
 if(ev.shiftKey) comps.push("shift");


 var k = "";
 if(ev.charCode == 32) k = "SPACE";
 else if(ev.charCode) k = String.fromCharCode(ev.charCode).toUpperCase();
 else k = gVKNames[ev.keyCode];

 if (!k) return;
 comps.push(k);

 tgt.value = comps.join(" ");
}

function WaitKey(tgt) {
  if (wait_key) wait_key.value = wait_key_old;
  wait_key_old = tgt.value;
  tgt.value = "key?";
  wait_key = tgt;
}

function Cancel(tgt) {
  if (tgt == wait_key) { wait_key.value = wait_key_old; wait_key = null; }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("keypress", onKeyPress, false);
