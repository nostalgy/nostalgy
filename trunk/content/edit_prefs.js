var gList = null;

var wait_key = null;
var wait_key_old = "";
var key_rows = null;
var folder_select = null;
var kKeysPrefs = "extensions.nostalgy.keys.";
var kCustomActionsPrefs = "extensions.nostalgy.actions.";
var max_custom = (-1);

var nost_js_quote = {
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
  if (/["\x00-\x20\\"]/.test(this)) {
    x = this.replace(/(["\x00-\x20\\>"])/g, function(a, b) {
      var c = nost_js_quote[b];
      if (c) { return c; }
      c = b.charCodeAt();
      return '\\u00' +
	Math.floor(c / 16).toString(16) + (c % 16).toString(16);
    });
  }
  return '"' + x + '"';
};

function NostalgySendRules() {
  var sAccountManager =
    Components.classes["@mozilla.org/messenger/account-manager;1"].
    getService(Components.interfaces.nsIMsgAccountManager);

  var identity =
    sAccountManager.allIdentities.GetElementAt(0).
    QueryInterface(Components.interfaces.nsIMsgIdentity);

  var to = prompt("Do you want to send a mail to yourself (or someone else)\n"
+ "with your current set of Nostalgy's rules?  If yes, choose the address.", identity.email);
  if (!to) return;

  var gMsgCompose =
    Components.classes["@mozilla.org/messengercompose/compose;1"].
    createInstance(Components.interfaces.nsIMsgCompose);

  var params =
    Components.classes["@mozilla.org/messengercompose/composeparams;1"].
    createInstance(Components.interfaces.nsIMsgComposeParams);

  var compfields =
    Components.classes["@mozilla.org/messengercompose/composefields;1"].
    createInstance(Components.interfaces.nsIMsgCompFields);

  var progress =
    Components.classes["@mozilla.org/messenger/progress;1"].
    createInstance(Components.interfaces.nsIMsgProgress);

  var account = sAccountManager.defaultAccount;

  compfields.to = to;
  compfields.subject = "Nostalgy Rules from " + identity.fullName;
  var rules = MkPrefStr();
  compfields.body = "This e-mail was automatically generated by Nostalgy (Thunderbird Extension). It stores a set of Nostalgy rules.\nIf you read this message under Thunderbird, with Nostalgy installed, you can import these rules by clicking on the 'Extract Nostalgy rules' button that should appear above.\n\nFor more information about Nostalgy: http://alain.frisch.fr/soft_mozilla.html\n\nBEGIN RULES\n" + rules + "\nEND RULES\n\n";

  params.identity = identity;
  params.composeFields = compfields;
  params.format = 2;  // PlainText

  var tmp_win =
    window.open("chrome://nostalgy/content/dummy_window.xul", "_blank",
		"chrome,dialog='no',width=0,height=0,centerscreen,alwaysLowered");
  setTimeout(function(){ tmp_win.minimize(); },2000);

  gMsgCompose.Initialize(tmp_win, params );

  gMsgCompose.SendMsg(Components.interfaces.nsIMsgCompDeliverMode.Now,
		      identity, account.key, null, progress);
}



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

  item.addEventListener("dblclick", function() { DoEditItem(item); }, false);
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
}


function StrOfRule(rule) {
  return (
   "{sender:"   + rule.sender           + "," +
   "recipients:"+ rule.recipients       + "," +
   "subject:" + rule.subject          + "," +
   "contains:" + rule.contains.quote() + "," +
   "under:"    + rule.under.quote()    + "," +
   "folder:"   + rule.folder.quote()   + "}"
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

function DoEditItem(item) {
  if (item) {
    EditRule(RuleOfItem(item), function(rule) { SetItem(item,rule); });
  }
}

function DoEdit() {
  DoEditItem(gList.selectedItem);
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
  var prefs = NostalgyPrefBranch();
  prefs.setCharPref("extensions.nostalgy.rules", MkPrefStr());

  for (var n in nostalgy_completion_options)
    prefs.setBoolPref("extensions.nostalgy."+n,	gEBI(n).checked);

  if (wait_key) { wait_key.value = wait_key_old; wait_key = null; }
  for (var i in nostalgy_keys)
    prefs.setCharPref(kKeysPrefs+nostalgy_keys[i][0],
    gEBI("key_" + nostalgy_keys[i][0]).value);


  var a = prefs.getChildList(kKeysPrefs, { });
  for (var i in a) {
    var id = a[i].substr(kKeysPrefs.length);
    if (id.substr(0,1) == "_") {
      try {
       prefs.clearUserPref(kKeysPrefs+id);
       prefs.clearUserPref(kCustomActionsPrefs+id);
      } catch (ex) { }
    }
  }

  var e = document.getElementsByTagName("label");
  for (var i = 0; i < e.length; i++)
   if (e[i].id.substr(0,5) == "key__") {
      var id = e[i].id.substr(4);
      prefs.setCharPref(kKeysPrefs+id,e[i].value);
      prefs.setCharPref(kCustomActionsPrefs+id,e[i].previousSibling.value);
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

function createElem(tag,attrs,children) {
 var x = document.createElement(tag);
 for (var a in attrs) x.setAttribute(a,attrs[a]);
 if (children) for (var i in children) x.appendChild(children[i]);
 return x;
}

function createKeyRow(id,txt,v) {
  var is_custom = id.substr(0,1) == "_";
  var buttons = [ ];
  if (!is_custom)
   buttons.push(createElem("label", { class:"text-link", value:"disable",
          onclick:"this.parentNode.previousSibling.value = '(disabled)';"}));
  else
   buttons.push(createElem("label", { class:"text-link", value:"delete",
          onclick:"RemoveRow(this.parentNode.parentNode);" }));

  return createElem("row",{ }, [
    createElem("label", { value:txt }),
    createElem("label", { id:"key_" + id, class:"text-link",
                          value:v,
                          onclick:"WaitKey(this);",
                          onblur:"Cancel(this);" }),
    createElem("hbox", { }, buttons)
  ]);
}

function RemoveRow(r) {
  r.parentNode.removeChild(r);
}

function onNostalgyLoad() {
  NostalgyFolderSelectionBoxes();

  gList = gEBI("rules");
  folder_select = gEBI("folderselect");

  var prefs = NostalgyPrefBranch();
  try {
   var r = NostalgyJSONEval(prefs.getCharPref("extensions.nostalgy.rules"));
   var i;
   for (i = 0; i < r.length; i++) { CreateItem(r[i]); }
  } catch (ex) { }

 for (var n in nostalgy_completion_options)
   gEBI(n).checked = getBoolPref(prefs, n);

 key_rows = gEBI("key_rows");
 for (var i = 0; i < nostalgy_keys.length; i++) {
  var v = nostalgy_keys[i][2];
  try {
    v = prefs.getCharPref(kKeysPrefs + nostalgy_keys[i][0]);
  } catch (ex) { }
  key_rows.appendChild(createKeyRow(nostalgy_keys[i][0],nostalgy_keys[i][1],v));
 }

 var a = prefs.getChildList(kKeysPrefs, { });
 for (var i in a) {
   var id = a[i].substr(kKeysPrefs.length);
   if (id.substr(0,1) == "_") {
     var n = parseInt(id.substr(1));
     try {
       if (n > max_custom) max_custom = n;
       var cmd = prefs.getCharPref(kCustomActionsPrefs + id);
       key_rows.appendChild(createKeyRow(id,cmd,prefs.getCharPref(a[i])));
     } catch (ex) { }
   }
 }
}

function onKeyPress(ev) {
  if (!wait_key && ((ev.keyCode == 46) || (ev.keyCode == 8))) DoDelete();
  // should only to that in the relevant tab

  else if (wait_key && ev.keyCode == KeyEvent.DOM_VK_ESCAPE) {
    NostalgyStopEvent(ev);
    wait_key.value = wait_key_old;
    wait_key = null;
  } else if (wait_key) /* && (ev.keyCode != 13 || ev.ctrlKey || ev.altKey)) */ {
    Recognize(ev,wait_key);
    wait_key = null;
  } else if (ev.keyCode == KeyEvent.DOM_VK_ESCAPE) {
    if
      (!confirm
       ("Do you really want to cancel all your changes to the preferences?"))
      NostalgyStopEvent(ev);
  }
}


function Recognize(ev, tgt) {
  NostalgyStopEvent(ev);
  var k = RecognizeKey(ev);
  if (k) tgt.value = k;
}

function WaitKey(tgt) {
  if (wait_key) wait_key.value = wait_key_old;
  wait_key_old = tgt.value;
  tgt.value = "key?";
  wait_key = tgt;
}

function Cancel(tgt) {
  if (tgt == wait_key) {
   var old = wait_key_old;
   setTimeout(function() {
      if (document.commandDispatcher.focusedElement != tgt) {
        tgt.value = old;
        if (tgt == wait_key) wait_key = null;
      }
   },500);
  }
}

function SelectFolder() {
  if (folder_select.value != "") {
    var folder = NostalgyResolveFolder(folder_select.value);
    if (folder) {
      var name = folder_name(folder);
      max_custom++;
      var cmd = gEBI("cmdkind").selectedItem.value;
      key_rows.appendChild(createKeyRow("_" + max_custom,cmd + " -> " + name,
                           "(disabled)"));
      folder_select.value = "";
      var e = gEBI("key__" + max_custom);
      e.focus();
      WaitKey(e);
    }
  }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("keypress", onKeyPress, true);
