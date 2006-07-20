function folder_name(folder) {
  var uri = folder.prettyName;
  while (!folder.isServer) {
    folder = folder.parent;
    uri = folder.prettyName + "/" + uri;
  }
  return (uri);
}

/** Autocompletion of folders **/

function myautocomplete() {
 this.xresults = 
  Components.classes[
   "@mozilla.org/autocomplete/results;1"
  ].getService(Components.interfaces.nsIAutoCompleteResults);
}

myautocomplete.prototype.onStartLookup = function(text, results, listener) {
 var items = this.xresults.items;
 items.Clear();
 var ltext = text.toLowerCase();

 var addItem = function (folder) {
  var fname = folder_name(folder);
  if (fname.toLowerCase().indexOf(ltext) < 0) { return; }
  var newitem = 
   Components.classes[
    "@mozilla.org/autocomplete/item;1"
   ].createInstance(Components.interfaces.nsIAutoCompleteItem);
  newitem.value = fname;
  items.AppendElement(newitem);
 };
 IterateFolders(addItem);
 this.xresults.searchString = text;
 this.xresults.defaultItemIndex = 0;
 listener.onAutoComplete(this.xresults, 1);
}

myautocomplete.prototype.onStopLookup = function() { }
myautocomplete.prototype.onAutoComplete = function(text, results, listener){ }

myautocomplete.prototype.QueryInterface = function(iid) {
 if (iid.equals(Components.interfaces.nsIAutoCompleteSession)) return this;
 throw Components.results.NS_NOINTERFACE;
}

/** Driver **/

var default_label = "";
var focus_saved = null;
var command = null;
var last_folder_author = new Array();
var last_folder_subject = new Array();
var last_folder = null;

function onNostalgyLoad() {
 var nostalgyBox = document.getElementById("statusbar-nostalgy");
 nostalgyBox.addSession(new myautocomplete());
 var label = document.getElementById("statusbar-nostalgy-label");
 default_label = label.value;
 NostalgyHide();
}

function NostalgyCollapseFolderPane() {
 var fp = document.getElementById("folderPaneBox");
 fp.collapsed = !fp.collapsed;
}

function NostalgyCmd(lab,cmd,init) {
 var nostalgyBox = document.getElementById("statusbar-nostalgy");
 focus_saved = document.commandDispatcher.focusedElement;
 if (!focus_saved) {
  focus_saved = document.getElementById("messagepane").contentWindow;
 }
 nostalgyBox.hidden = false;
 nostalgyBox.value = init;
 setTimeout(function() { nostalgyBox.focus(); }, 50);
   // For some unknown reason, doing nostalgyBox.focus immediatly
   // sometimes does not work...

 var label = document.getElementById("statusbar-nostalgy-label");
 label.value = lab;
 command = cmd;
}

function NostalgyHide() {
 var nostalgyBox = document.getElementById("statusbar-nostalgy");
 nostalgyBox.hidden = true;
 if (focus_saved) {
  focus_saved.focus ();
  focus_saved = null;
 }
 var label = document.getElementById("statusbar-nostalgy-label");
 label.value = default_label;
}

function NostalgyRunCommand() {
  var nostalgyBox = document.getElementById("statusbar-nostalgy");
  var folder = FindFolder(nostalgyBox.value);
  if (folder) {
   command(folder);
  } else {
   alert("No folder found");
  }
  NostalgyHide();
}

/**  Folder traversal **/

function FindFolder(uri)
{
 var ret = null;
 uri = uri.toLowerCase();
 try {
  IterateFolders(function (folder) {
   if (folder_name(folder).toLowerCase() == uri) { ret = folder; throw(0); }
  });
  IterateFolders(function (folder) {
   if (folder_name(folder).toLowerCase().indexOf(uri) >= 0) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

function IterateFolders(f) {
 var amService = 
    Components.classes["@mozilla.org/messenger/account-manager;1"]
              .getService(Components.interfaces.nsIMsgAccountManager);

 var servers= amService.allServers;
 var seen = { };
 var i;
 for (i = 0; i < servers.Count(); i++) {
  var server = servers.GetElementAt(i).
               QueryInterface(Components.interfaces.nsIMsgIncomingServer);
  var root = server.rootMsgFolder;
  var n = root.prettyName;
  if (seen[n]) {
    // Prevent duplicate folders in case of locally stored POP3 accounts
  } else {
    seen[n] = true;
    IterateSubfolders(root,f);
  }
 }
}

function IterateSubfolders(folder,f) {
 if (!folder.isServer) { f(folder); }
 if (folder.hasSubFolders) {
  var subfolders = folder.GetSubFolders();
  var done = false;
  while (!done) {
   var subfolder = subfolders.currentItem().
                   QueryInterface(Components.interfaces.nsIMsgFolder);
   IterateSubfolders(subfolder,f);
   try {subfolders.next();}
   catch(e) {done = true;}
  }
 }
}  

function MailAuthor() {
 return(gDBView.hdrForFirstSelectedMessage.author);
}

function MailSubject() {
 return(gDBView.hdrForFirstSelectedMessage.subject);
}

function register_folder(folder) {
 last_folder_author[MailAuthor()] = folder;
 last_folder_subject[MailSubject()] = folder;
 last_folder = folder
}

function get_last_folder() {
 var r = last_folder_author[MailAuthor()];
 if (r) { return(r); }
 r = last_folder_subject[MailSubject()];
 if (r) { return(r); }
 return(last_folder);
}

/**  Commands **/

function ShowFolder(folder) {	
 SelectFolder(folder.URI);
}

function MoveToFolder(folder) {
 register_folder(folder);
 gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,folder);
 SetNextMessageAfterDelete();
}

function CopyToFolder(folder) {
 register_folder(folder);
 gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages,folder);
}

function NostalgyAgain(lab,cmd) {
 var f = get_last_folder();
 if (f) {
   var nostalgyBox = document.getElementById("statusbar-nostalgy");
   NostalgyCmd(lab, cmd, folder_name(f));
 }
}


/** Marking **/

function NostalgyMark() {
 var tree = window.parent.GetThreadTree();			  
// var dbview = tree.builderView;
// alert("Focus = " + tree.currentIndex);
 var sel = tree.view.selection;
 //alert("Sel = " + sel);
 // sel.toggleSelect(1);
// var i = sel.currentIndex;
// sel.rangedSelect(i,i,true);
 sel.currentIndex++;
// var i = sel.currentIndex;
// sel.rangedSelect(i,i,true);
 tree.treeBoxObject.ensureRowIsVisible(sel.currentIndex);
 treeView.selectionChanged();
}


var NostalgyLastEscapeTimeStamp = 0;

function onNostalgyKeyPress(ev) {
  if (ev.keyCode == 27) { 
    if (ev.ctrlKey) { SetFocusFolderPane(); }
    else if (ev.altKey) { SetFocusMessagePane(); }
    else 
    if (ev.timeStamp - NostalgyLastEscapeTimeStamp < 200) 
     { SetFocusThreadPane(); }
     else { NostalgyLastEscapeTimeStamp = ev.timeStamp; }
  }
}

window.addEventListener("load", onNostalgyLoad, false);
if (SetFocusFolderPane) window.addEventListener("keypress", onNostalgyKeyPress, false);