function gEBI(id) { return (document.getElementById(id)); }

var gFolderSelect = null;
var gContainsSelect = null;
var gUnderSelect = null;

function onNostalgyLoad() {
 var rule = window.arguments[0];
 if (!rule) { alert("rule=null!"); }

 NostalgyFolderSelectionBoxes();

 gContainsSelect = gEBI("contains");
 gFolderSelect = gEBI("folderselect");
 gUnderSelect = gEBI("underselect");

 gContainsSelect.focus();

 gFolderSelect.value = rule.folder;
 gUnderSelect.value = rule.under;
 gContainsSelect.value = rule.contains;
 gEBI("sender").checked = rule.sender;
 gEBI("recipients").checked = rule.recipients;
 gEBI("subject").checked = rule.subject;
}

function onAcceptChanges() {
/*
 var f = document.commandDispatcher.focusedElement;
 while (f && f.tagName != "textbox") f = f.parentNode;
 if (f && f.hasAttribute("nostalgyfolderbox"))
   eval(f.getAttribute("nostalgyfolderbox"));
*/

 var folder = FindFolderExact(gFolderSelect.value);
 if (!folder) {
   alert("Please choose an existing folder");
   gFolderSelect.focus();
   return false;
 }
 if (gContainsSelect.value == "") {
   alert("Please provide a non-empty string for 'contains'");
   return false;
 }
 var rule = { 
    sender: gEBI("sender").checked,
    recipients: gEBI("recipients").checked,
    subject: gEBI("subject").checked,
    contains: gContainsSelect.value,
    folder: folder_name(folder),
    under: gUnderSelect.value
 };
    
 (window.arguments[1])(rule);
 return true;
}

function ChooseFolder() {
  if (gFolderSelect.value != "") {
    var folder = NostalgyResolveFolder(gFolderSelect.value);
    if (folder) { gFolderSelect.value = folder_name(folder); }
  }
}

function ChooseUnder() {
  if (gUnderSelect.value != "") {
    var under = NostalgyResolveFolder(gUnderSelect.value);
    if (under) { gUnderSelect.value = folder_name(under); }
    setTimeout(function(){gFolderSelect.focus();},30);
  }
}

function OnKeyPressTxt(ev) {
  if (ev.keyCode==KeyEvent.DOM_VK_RETURN) {
   setTimeout(function(){gUnderSelect.focus();},30);
   ev.preventDefault();
   ev.stopPropagation();
  }
}

window.addEventListener("load", onNostalgyLoad, false);