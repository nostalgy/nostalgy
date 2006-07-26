function gEBI(id) { return (document.getElementById(id)); }
function FolderSelect() { return (gEBI("folderselect")); }
function ContainsSelect() { return (gEBI("contains")); }
function FieldSelect() { return (gEBI("field")); }

var gitem = null;

function onNostalgyLoad() {
 FolderSelect().addSession(new myautocomplete());

 gitem = window.arguments[0];
 if (gitem) {
   FolderSelect().value = gitem.childNodes.item(2).getAttribute("label");
   ContainsSelect().value = gitem.childNodes.item(1).getAttribute("label");
   FieldSelect().selectedItem = 
       gEBI(gitem.childNodes.item(0).getAttribute("value"));
 }
}

function onAcceptChanges() {
 gitem.childNodes.item(2).setAttribute("label", FolderSelect().value);
 gitem.childNodes.item(1).setAttribute("label", ContainsSelect().value);
 gitem.childNodes.item(0).setAttribute("label", 
    FieldSelect().selectedItem.getAttribute("label"));
 gitem.childNodes.item(0).setAttribute("value", 
    FieldSelect().selectedItem.getAttribute("id"));
}

function ChooseFolder() {
  var b = FolderSelect();
  var folder = FindFolder(b.value);
  if (folder) { b.value = folder_name(folder); }
}

window.addEventListener("load", onNostalgyLoad, false);