function gEBI(s) { return document.getElementById(s); }

var in_message_window = !window.SetFocusFolderPane;

var nostalgy_folderBox = null;
var nostalgy_statusBar = null;
var nostalgy_label = null;
var nostalgy_th_statusBar = null;
var nostalgy_cmdLabel = null;

/** Rules **/

var NostalgyRules =
{

  register: function()
  {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService);
    this._branch = prefService.getBranch("extensions.nostalgy.");
    this._branch2 = 
        this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this._branch2.addObserver("", this, false);
    this.get_rules();
    try {
     restrict_to_current_server = 
         this._branch.getBoolPref("restrict_to_current_server");
    } catch (ex) { }
  },

  unregister: function()
  {
    if(!this._branch2) return;
    this._branch2.removeObserver("", this);
  },

  get_rules: function()
  {
    try {
     var r = eval(this._branch.getCharPref("rules"));
     var i;
     for (i = 0; i < r.length; i++) {
       r[i].contains = r[i].contains.toLowerCase();
     }
     this.rules = r;
    } catch (ex) { }
  },

  observe: function(aSubject, aTopic, aData)
  {
    if(aTopic != "nsPref:changed") return;
    switch (aData) {
      case "rules":
        this.get_rules();
        if (!in_message_window) { NostalgyDefLabel(); }
        break;
      case "restrict_to_current_server":
        restrict_to_current_server = 
           this._branch.getBoolPref("restrict_to_current_server");
        break;
    }
  },

  apply: function(sender,subject)
  {
    var folder = null;
    var rules = this.rules;
    var i = 0;
    for (i = 0; (i < rules.length) && (!folder); i++) {
      var r = rules[i];
      if ((r.field != "subject") && (sender.indexOf(r.contains) >= 0)
          || (r.field != "sender") && (subject.indexOf(r.contains) >= 0)) {
        folder = FindFolderExact(r.folder);
      }
    }
    return folder;
  }
}

NostalgyRules.register();

/** Driver **/

var default_label = "";
var focus_saved = null;
var command = null;
//var last_folder_author = new Array();
//var last_folder_subject = new Array();
var last_folder = null;
var gsuggest_folder = null;

function onNostalgyLoad() {
 nostalgy_folderBox = gEBI("nostalgy-folderbox");
 nostalgy_statusBar = gEBI("nostalgy-statusbar");
 nostalgy_label = gEBI("statusbar-nostalgy-label");
 nostalgy_th_statusBar = gEBI("status-bar");
 nostalgy_cmdLabel = gEBI("nostalgy-command-label");

 NostalgyFolderSelectionBox(nostalgy_folderBox);
 default_label = nostalgy_label.value;


 if (!in_message_window) {
   gEBI("threadTree").addEventListener("select", NostalgyDefLabel, false); 
 }

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
 gsuggest_folder = NostalgySuggest();
 if (gsuggest_folder) {
   nostalgy_label.value = 
       default_label + " [+Shift: ==> " + folder_name(gsuggest_folder) + "]";
 } else {
   nostalgy_label.value = default_label;
 }
}


function NostalgyCollapseFolderPane() {
 var fp = gEBI("folderPaneBox");
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
  var f = NostalgyResolveFolder(nostalgy_folderBox.value);
  if (f) { command(f); }
  else { alert("No folder " + nostalgy_folderBox.value); }
  NostalgyHide();
}

function MailAuthor() {
 return(gDBView.hdrForFirstSelectedMessage.author.toLowerCase());
}

function MailSubject() {
 return(gDBView.hdrForFirstSelectedMessage.subject.toLowerCase());
}

function register_folder(folder) {
// last_folder_author[MailAuthor()] = folder;
// last_folder_subject[MailSubject()] = folder;
  last_folder = folder
}

function NostalgySuggest() {
 var r = null;
 try {
  r = NostalgyRules.apply(MailAuthor(), MailSubject());
  if (r) { return(r); }
 } catch (ex) { }

// r = last_folder_author[MailAuthor()];
// if (r) { return(r); }

// r = last_folder_subject[MailSubject()];
// if (r) { return(r); }

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

function NostalgySuggested(lab,cmd) {
 if (gsuggest_folder) { cmd(gsuggest_folder); }
}



var NostalgyLastEscapeTimeStamp = 0;
var NostalgyEscapeDown = false;

function isThreadPaneFocused() { 
  return (WhichPaneHasFocus() == GetThreadTree()); 
}

function NostalgyScrollMsg(d) {
 var b = gEBI("messagepane").contentDocument.getElementsByTagName("body")[0];
 if (b) { b.scrollTop += d; }
}

function onNostalgyKeyPress(ev) {
  if (ev.keyCode == 27) { 
    if (ev.ctrlKey) { SetFocusFolderPane(); }
    else if (ev.altKey) { SetFocusMessagePane(); }
    else 
    if (ev.timeStamp - NostalgyLastEscapeTimeStamp < 200) 
     { SetFocusThreadPane(); }
     else { NostalgyLastEscapeTimeStamp = ev.timeStamp; }
  } 
  else if (ev.keyCode == 39 && isThreadPaneFocused() && ev.shiftKey)
    { NostalgyScrollMsg(20); }
  else if (ev.keyCode == 37 && isThreadPaneFocused() && ev.shiftKey)
    { NostalgyScrollMsg(-20); }
}



window.addEventListener("load", onNostalgyLoad, false);
if (!in_message_window) {
  window.addEventListener("keypress", onNostalgyKeyPress, false);
}