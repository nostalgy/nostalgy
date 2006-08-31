function gEBI(id) { return (document.getElementById(id)); }

var gFolderSelect = null;
var gContainsSelect = null;
var gFieldSelect = null;
var gUnderSelect = null;

function onNostalgyLoad() {
 var rule = window.arguments[0];
 if (!rule) { alert("rule=null!"); }

 gContainsSelect = gEBI("contains");
 gFieldSelect = gEBI("field");
 gFolderSelect = gEBI("folderselect");
 NostalgyFolderSelectionBox(gFolderSelect);
 gUnderSelect = gEBI("underselect");
 NostalgyFolderSelectionBox(gUnderSelect);

 gContainsSelect.focus();

 gFolderSelect.value = rule.folder;
 gUnderSelect.value = rule.under;
 gContainsSelect.value = rule.contains;
 gFieldSelect.selectedItem = gEBI(rule.field);
}

function onAcceptChanges() {
 var folder = FindFolderExact(gFolderSelect.value);
 if (!folder) {
   alert("Please choose an existing folder");
   return false;
 }
 if (gContainsSelect.value == "") {
   alert("Please provide a non-empty string for 'contains'");
   return false;
 }
 var rule = { 
    field: gFieldSelect.selectedItem.getAttribute("id"),
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
  }
}

window.addEventListener("load", onNostalgyLoad, false);