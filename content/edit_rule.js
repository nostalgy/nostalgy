function gEBI(id) { return (document.getElementById(id)); }

var gFolderSelect = null;
var gContainsSelect = null;
var gFieldSelect = null;

function onNostalgyLoad() {
 var rule = window.arguments[0];
 if (!rule) { alert("rule=null!"); }

 gFolderSelect = gEBI("folderselect");
 gContainsSelect = gEBI("contains");
 gFieldSelect = gEBI("field");
 gFolderSelect.addSession(new myautocomplete());

 gContainsSelect.focus();

 gFolderSelect.value = rule.folder;
 gContainsSelect.value = rule.contains;
 gFieldSelect.selectedItem = gEBI(rule.field);
}

function onAcceptChanges() {
 if (!FindFolderExact(gFolderSelect.value)) {
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
    folder: gFolderSelect.value 
 };
    
 (window.arguments[1])(rule);
 return true;
}

function ChooseFolder() {
  var folder = FindFolder(gFolderSelect.value);
  if (folder) { gFolderSelect.value = folder_name(folder); }
}

window.addEventListener("load", onNostalgyLoad, false);