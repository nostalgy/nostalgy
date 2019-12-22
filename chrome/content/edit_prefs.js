var nostalgy_gList = null;

var nostalgy_wait_key = null;
var nostalgy_wait_key_old = "";
var nostalgy_key_rows = null;
var nostalgy_folder_select = null;
var nostalgy_kKeysPrefs = "extensions.nostalgy.keys.";
var nostalgy_kCustomActionsPrefs = "extensions.nostalgy.actions.";
var nostalgy_max_custom = (-1);

var nostalgy_js_quote = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"' : '\\"',
  '\\': '\\\\'
};

function NostalgyQuote(x) {
  if (/["\x00-\x20\\"]/.test(x)) {
    x = x.replace(/(["\x00-\x20\\>"])/g, function(a, b) {
      var c = nostalgy_js_quote[b];
      if (c) { return c; }
      c = b.charCodeAt();
      return '\\u00' +
	Math.floor(c / 16).toString(16) + (c % 16).toString(16);
    });
  }
  return '"' + x + '"';
};

function NostalgyExportRules() {
    var rules = NostalgyMkPrefStr();
    alert(rules);
};

function NostalgyImportRules() {
    var rules = NostalgyMkPrefStr();
    var s = prompt("You can paste here a set of rules created with the 'Export Rules' button.", rules);
    if (!s) return;

    s = s.replace(/([\x00-\x20>])/g,function(a,b){ return "" });
    if (confirm(
        "Do you want to install these rules?\n"+
            "This will overwrite your current set of rules.\n"
    )) {
        var r = NostalgyJSONEval(s);
        while (nostalgy_gList.getRowCount() > 0)
            nostalgy_gList.removeItemAt(0);
        var i;
        for (i = 0; i < r.length; i++) { NostalgyCreateItem(r[i]); }
    }
}

function NostalgySetItem(item, rule) {
  var f = item.childNodes.item(0);
  var lab = "";
  if (rule.sender) lab = lab + "F";
  if (rule.recipients) lab = lab + "R";
  if (rule.subject) lab = lab + "S";

  f.setAttribute("value", lab);
  f.setAttribute("label", lab);
  f.setAttribute("align", "center");
  item.childNodes.item(1).setAttribute("label", rule.contains);
  item.childNodes.item(1).setAttribute("value", rule.contains);

  var u = "";
  if (rule.under) { u = rule.under; }
  item.childNodes.item(2).setAttribute("value", u);
  item.childNodes.item(2).setAttribute("label", NostalgyCrop(u));

  item.childNodes.item(3).setAttribute("value", rule.folder);
  item.childNodes.item(3).setAttribute("label", NostalgyCrop(rule.folder));
}

function NostalgyRuleOfItem(item) {
 var fields = item.childNodes.item(0).getAttribute("value");
 return ({ folder: item.childNodes.item(3).getAttribute("value"),
           under: item.childNodes.item(2).getAttribute("value"),
	   contains: item.childNodes.item(1).getAttribute("label"),
           sender: fields.indexOf("F") >= 0,
           recipients: fields.indexOf("R") >= 0,
           subject: fields.indexOf("S") >= 0 });
}

function NostalgyCreateItem(rule) {
/*
*/
  var item = document.createXULElement("richlistitem");

  item.addEventListener("dblclick", function() { NostalgyDoEditItem(item); }, false);
  item.appendChild(document.createXULElement("label"));
  item.appendChild(document.createXULElement("label"));
  item.appendChild(document.createXULElement("label"));
  item.appendChild(document.createXULElement("label"));

  // convert from previous version
  if (rule.field == "any") {
   rule.sender = true;
   rule.recipients = true;
   rule.subject = true;
  } else if (rule.field == "sender") rule.sender = true
  else if (rule.field == "subject") rule.subject = true;

  NostalgySetItem(item,rule);
  nostalgy_gList.appendChild(item);

}


function NostalyStrOfRule(rule) {
    return (
        "{sender:"   + rule.sender           + "," +
        "recipients:"+ rule.recipients       + "," +
        "subject:"   + rule.subject          + "," +
        "contains:"  + NostalgyQuote(rule.contains) + "," +
        "under:"     + NostalgyQuote(rule.under)    + "," +
        "folder:"    + NostalgyQuote(rule.folder)   + "}"
    );
}

function NostalgyMkPrefStr() {
  var i;
  var cnt = nostalgy_gList.getRowCount();
  var res = "";
  for (i = 0; i < cnt; i++) {
    if (i > 0) res = res + ", ";
    res = res + NostalyStrOfRule(NostalgyRuleOfItem(nostalgy_gList.getItemAtIndex(i)));
  }
  return ("[" + res + "]");
}


function NostalgyEditRule(rule, accept) {
  window.openDialog("chrome://nostalgy/content/edit_rule.xul",
                     "_blank",
	             "dialog,chrome,modal,titlebar,resizable=yes",
	             rule,accept);
}

function NostalgyDoEditItem(item) {
  if (item) {
    NostalgyEditRule(NostalgyRuleOfItem(item), function(rule) { NostalgySetItem(item,rule); });
  }
}

function NostalgyDoEdit() {
  NostalgyDoEditItem(nostalgy_gList.selectedItem);
}

function NostalgySwapItems(idx1,idx2) {
  var item1 = nostalgy_gList.getItemAtIndex(idx1);
  var item2 = nostalgy_gList.getItemAtIndex(idx2);
  var rule1 = NostalgyRuleOfItem(item1);
  var rule2 = NostalgyRuleOfItem(item2);
  NostalgySetItem(item1,rule2);
  NostalgySetItem(item2,rule1);
  nostalgy_gList.selectedIndex = idx2;
  nostalgy_gList.ensureIndexIsVisible(idx2);
}

function NostalgyDoMoveUp(idx1,idx2) {
  var idx = nostalgy_gList.selectedIndex;
  if (idx == 0) return;
  NostalgySwapItems(idx,idx-1);
}

function NostalgyDoMoveDown(idx1,idx2) {
  var idx = nostalgy_gList.selectedIndex;
  if (idx == nostalgy_gList.getRowCount() - 1) return;
  NostalgySwapItems(idx,idx+1);
}

function onNostalgyAcceptChanges() {
  var prefs = NostalgyPrefBranch();;
  let sCopy="c";
  let sSave="s";
  let sGo="g";
  prefs.setCharPref("extensions.nostalgy.rules", NostalgyMkPrefStr());
  try {
      prefs.setIntPref("extensions.nostalgy.number_of_recent_folders", 0 + NostalgyEBI("number_of_recent_folders").value);
  } catch (exn) {
      NostalgyDebug(exn);
  }
  try {
      prefs.setIntPref("extensions.nostalgy.predict_max_addresses_to_update", 0 + NostalgyEBI("predict_max_addresses_to_update").value);
  } catch (exn) {
      NostalgyDebug(exn);
  }

  for (var n in nostalgy_completion_options)
    prefs.setBoolPref("extensions.nostalgy."+n,	NostalgyEBI(n).checked);

  if (nostalgy_wait_key) { nostalgy_wait_key.value = nostalgy_wait_key_old; nostalgy_wait_key = null; }
  for (var i in nostalgy_keys)  {
    let sKey= nostalgy_keys[i][0];
  	let sValue= NostalgyEBI("key_" + nostalgy_keys[i][0]).value;
    if (sKey=="save") sSave=sValue;
    if (sKey=="go") sGo=sValue;
    if (sKey=="copy") sCopy=sValue;
    prefs.setCharPref(nostalgy_kKeysPrefs+nostalgy_keys[i][0],
    NostalgyEBI("key_" + nostalgy_keys[i][0]).value);
	}
  let DefaultString = "save ("+sSave+") copy (" + sCopy + ") go ("+sGo+")"; 
  nostalgy_default_label= DefaultString ;

  var a = prefs.getChildList(nostalgy_kKeysPrefs, { });
  for (var i in a) {
    var id = a[i].substr(nostalgy_kKeysPrefs.length);
    if (id.substr(0,1) == "_") {
      try {
       prefs.clearUserPref(nostalgy_kKeysPrefs+id);
       prefs.clearUserPref(nostalgy_kCustomActionsPrefs+id);
      } catch (ex) { }
    }
  }

  var e = document.getElementsByTagName("label");
  for (var i = 0; i < e.length; i++)
   if (e[i].id.substr(0,5) == "key__") {
      var id = e[i].id.substr(4);
      prefs.setCharPref(nostalgy_kKeysPrefs+id,e[i].value);
      prefs.setCharPref(nostalgy_kCustomActionsPrefs+id,e[i].previousSibling.value);
   }

  window.close();
}

function NostalgyDoNewRule() {
  NostalgyEditRule({ sender:true, recipients:true, subject:true,
             contains:"", folder:"", under:"" }, NostalgyCreateItem);
}

function NostalgyDoDelete() {
  var idx = nostalgy_gList.selectedIndex;
  if (idx >= 0) {
    nostalgy_gList.getItemAtIndex(idx).remove();
    if (nostalgy_gList.getRowCount() <= idx) { idx = nostalgy_gList.getRowCount() - 1; }
    nostalgy_gList.selectedIndex = idx;
  }
}

function NostalgyGetBoolPref(prefs,s) {
 var b = false;
 try {
  b=prefs.getBoolPref("extensions.nostalgy." + s); }
 catch (ex) { }
 return b;
}

function NostalgyGetIntPref(prefs,s,def) {
 var b = def;
 try {
     b=prefs.getIntPref("extensions.nostalgy." + s);
 }
 catch (ex) {
 }
 return b;
}

function NostalgyCreateElem(tag,attrs,children) {
 var x = document.createElement(tag);
 for (var a in attrs) x.setAttribute(a,attrs[a]);
 if (children) for (var i in children) x.appendChild(children[i]);
 return x;
}

function NostalgyCreateKeyRow(id,txt,v) {
  var is_custom = id.substr(0,1) == "_";
  var buttons = [ ];
  if (!is_custom)
   buttons.push(NostalgyCreateElem("label", { class:"text-link", value:"disable",
          onclick:"this.parentNode.previousSibling.value = '(disabled)';"}));
  else
   buttons.push(NostalgyCreateElem("label", { class:"text-link", value:"delete",
          onclick:"NostalgyRemoveRow(this.parentNode.parentNode);" }));

  return NostalgyCreateElem("row",{ }, [
    NostalgyCreateElem("label", { value:txt }),
    NostalgyCreateElem("label", { id:"key_" + id, class:"text-link",
                          value:v,
                          onclick:"NostalgyWaitKey(this);",
                          onblur:"NostalgyCancel(this);" }),
    NostalgyCreateElem("hbox", { }, buttons)
  ]);
}

function NostalgyRemoveRow(r) {
  r.parentNode.removeChild(r);
}

function onNostalgyLoad() {
 document.addEventListener("dialogaccept", (event) => { onNostalgyAcceptChanges(); });
  NostalgyFolderSelectionBoxes();
 document.addEventListener("dialogextra2", (event) => { openDialog('chrome://nostalgy/content/about.xul', 'about_nostalgy', 'resizable'); });

  nostalgy_gList = NostalgyEBI("nrules");
  nostalgy_folder_select = NostalgyEBI("folderselect");

  var prefs = NostalgyPrefBranch();
  try {
   var r = NostalgyJSONEval(prefs.getCharPref("extensions.nostalgy.rules"));
   var i;
   for (i = 0; i < r.length; i++) { NostalgyCreateItem(r[i]); }
  } catch (ex) { }

 for (var n in nostalgy_completion_options)
   NostalgyEBI(n).checked = NostalgyGetBoolPref(prefs, n);

 NostalgyEBI("number_of_recent_folders").value = NostalgyGetIntPref(prefs, "number_of_recent_folders", 5);
 NostalgyEBI("predict_max_addresses_to_update").value = NostalgyGetIntPref(prefs, "predict_max_addresses_to_update", 100);

 nostalgy_key_rows = NostalgyEBI("nostalgy_key_rows");
 for (var i = 0; i < nostalgy_keys.length; i++) {
  var v = nostalgy_keys[i][2];
  try {
    v = prefs.getCharPref(nostalgy_kKeysPrefs + nostalgy_keys[i][0]);
  } catch (ex) { }
  nostalgy_key_rows.appendChild(NostalgyCreateKeyRow(nostalgy_keys[i][0],nostalgy_keys[i][1],v));
 }

 var a = prefs.getChildList(nostalgy_kKeysPrefs, { });
 for (var i in a) {
   var id = a[i].substr(nostalgy_kKeysPrefs.length);
   if (id.substr(0,1) == "_") {
     var n = parseInt(id.substr(1));
     try {
       if (n > nostalgy_max_custom) nostalgy_max_custom = n;
       var cmd = prefs.getCharPref(nostalgy_kCustomActionsPrefs + id);
       nostalgy_key_rows.appendChild(NostalgyCreateKeyRow(id,cmd,prefs.getCharPref(a[i])));
     } catch (ex) { }
   }
 }
}

function onNostalgyKeyPress(ev) {
  // We don't want to act on Meta.  Necessary from thunderbird 18 on.
  if (ev.keyCode == KeyEvent.DOM_VK_META) return; 

  if (!nostalgy_wait_key && ((ev.keyCode == 46) || (ev.keyCode == 8))) NostalgyDoDelete();
  // should only to that in the relevant tab

  else if (nostalgy_wait_key && ev.keyCode == KeyEvent.DOM_VK_ESCAPE) {
    NostalgyStopEvent(ev);
    nostalgy_wait_key.value = nostalgy_wait_key_old;
    nostalgy_wait_key = null;
  } else if (nostalgy_wait_key) /* && (ev.keyCode != 13 || ev.ctrlKey || ev.altKey)) */ {
    NostalgyRecognize(ev,nostalgy_wait_key);
    nostalgy_wait_key = null;
  } else if (ev.keyCode == KeyEvent.DOM_VK_ESCAPE) {
    if
      (!confirm
       ("Do you really want to cancel all your changes to the preferences?"))
      NostalgyStopEvent(ev);
  }
}


function NostalgyRecognize(ev, tgt) {
  NostalgyStopEvent(ev);
  var k = NostalgyRecognizeKey(ev);
  if (k) tgt.value = k;
}

function NostalgyWaitKey(tgt) {
  if (nostalgy_wait_key) nostalgy_wait_key.value = nostalgy_wait_key_old;
  nostalgy_wait_key_old = tgt.value;
  tgt.value = "key?";
  nostalgy_wait_key = tgt;
}

function NostalgyCancel(tgt) {
  if (tgt == nostalgy_wait_key) {
   var old = nostalgy_wait_key_old;
   setTimeout(function() {
      if (document.commandDispatcher.focusedElement != tgt) {
        tgt.value = old;
        if (tgt == nostalgy_wait_key) nostalgy_wait_key = null;
      }
   },500);
  }
}

function NostalgySelectFolder() {
  if (nostalgy_folder_select.value != "") {
    var folder = NostalgyResolveFolder(nostalgy_folder_select.value);
    if (folder) {
      var name = NostalgyFolderName(folder);
      nostalgy_max_custom++;
      var cmd = NostalgyEBI("cmdkind").selectedItem.value;
      nostalgy_key_rows.appendChild(NostalgyCreateKeyRow("_" + nostalgy_max_custom,cmd + " -> " + name,
                           "(disabled)"));
      nostalgy_folder_select.value = "";
      var e = NostalgyEBI("key__" + nostalgy_max_custom);
      e.focus();
      NostalgyWaitKey(e);
    }
  }
}




function NostalgyDoRestart() {

//borrowed from restart-application-1.2.1 
var boot=Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup); 
boot.quit(Components.interfaces.nsIAppStartup.eForceQuit|Components.interfaces.nsIAppStartup.eRestart);  let {BrowserUtils} = ChromeUtils.import ("resource://gre/modules/BrowserUtils.jsm", {});

}






window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("keypress", onNostalgyKeyPress, true);
