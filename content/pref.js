var gList = null;

function SetItem(item, rule) {
  var f = item.childNodes.item(0);
  var lab = "";
  if (rule.field == "both") { lab = "Both"; }
  else if (rule.field == "sender") { lab = "Sender"; }
  else if (rule.field == "subject") { lab = "Subject"; }
  else alert("Internal error: unknown field " + rule.field);

  f.setAttribute("value", rule.field);
  f.setAttribute("label", lab);

  item.childNodes.item(1).setAttribute("label", rule.contains);
  item.childNodes.item(2).setAttribute("label", rule.folder);
}

function RuleOfItem(item) {
 return ({ folder: item.childNodes.item(2).getAttribute("label"),
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
   "{field: '"    + rule.field    + "'," +
   " contains: '" + rule.contains + "'," +
   " folder: '"   + rule.folder   + "'}"
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
  window.openDialog("chrome://nostalgy/content/NostalgyEditRule.xul", 
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

function DoClose() {
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);
  prefs.setCharPref("extensions.nostalgy.rules", MkPrefStr());
  window.close();
}

function DoNewRule() {
  EditRule({ field:"both", contains:"", folder:"" }, CreateItem);
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
  gList = document.getElementById("rules");

  var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);
  var rules = eval(prefs.getCharPref("extensions.nostalgy.rules"));
  var i;
  for (i = 0; i < rules.length; i++) { CreateItem(rules[i]); }
}

function onKeyPress(ev) {
  if ((ev.keyCode == 46) || (ev.keyCode == 8)) { DoDelete(); }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("keypress", onKeyPress, false);
