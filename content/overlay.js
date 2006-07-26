function gEBI(s) { return document.getElementById(s); }

var nostalgy_folderBox = null;
var nostalgy_statusBar = null;
var nostalgy_label = null;
var nostalgy_th_statusBar = null;
var nostalgy_cmdLabel = null;

/** Driver **/

var default_label = "";
var focus_saved = null;
var command = null;
var last_folder_author = new Array();
var last_folder_subject = new Array();
var last_folder = null;
var glast_folder = null;

function onNostalgyLoad() {
 nostalgy_folderBox = gEBI("nostalgy-folderbox");
 nostalgy_statusBar = gEBI("nostalgy-statusbar");
 nostalgy_label = gEBI("statusbar-nostalgy-label");
 nostalgy_th_statusBar = gEBI("status-bar");
 nostalgy_cmdLabel = gEBI("nostalgy-command-label");

 nostalgy_folderBox.addSession(new myautocomplete());
 default_label = nostalgy_label.value;


 gEBI("threadTree").addEventListener("select", NostalgyDefLabel, false); 

 var saved_str = "";
 nostalgy_folderBox.addEventListener("keydown", 
  function(ev){ 
   if (ev.keyCode == 9) { saved_str = nostalgy_folderBox.value; } 
 }, false);
 nostalgy_folderBox.addEventListener("keypress", 
  function(ev){ 
   if (ev.keyCode == 9) { nostalgy_folderBox.value = 
				NostalgyCompleteUnique(saved_str); } 
 }, true);
}

function NostalgyHide() {
 nostalgy_statusBar.hidden = true;
 nostalgy_th_statusBar.hidden = false;

 if (focus_saved) {
  focus_saved.focus ();
  focus_saved = null;
 }
 NostalgyDefLabel();
}



function NostalgyDefLabel() { 
 glast_folder = get_last_folder();
 if (glast_folder) {
   nostalgy_label.value = 
       default_label + " [+Shift: ==> " + folder_name(glast_folder) + "]";
 } else {
   nostalgy_label.value = default_label;
 }
}


function NostalgyCollapseFolderPane() {
 var fp = document.getElementById("folderPaneBox");
 fp.collapsed = !fp.collapsed;
}


function NostalgyCmd(lab,cmd,init) {
 focus_saved = document.commandDispatcher.focusedElement;
 if (!focus_saved) { focus_saved = gEBI("messagepane").contentWindow; }

 nostalgy_cmdLabel.value = lab;
 command = cmd;
 nostalgy_statusBar.hidden = false;
 nostalgy_th_statusBar.hidden = true;
 nostalgy_folderBox.value = init;

 setTimeout(function() { nostalgy_folderBox.focus(); }, 50);
   // For some unknown reason, doing nostalgyBox.focus immediatly
   // sometimes does not work...
}


function NostalgyRunCommand() {
  var f= NostalgyComplete(nostalgy_folderBox.value, nostalgy_folderBox);
  if (f) { command(f); NostalgyHide(); }

//  var folder = FindFolder(nostalgy_folderBox.value);
//  if (folder) { command(folder); } 
//  else { alert("No folder found"); }
//  NostalgyHide();
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
 if (glast_folder) {
   cmd(glast_folder);
 }
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
if (SetFocusFolderPane) {
  window.addEventListener("keypress", onNostalgyKeyPress, false);
}