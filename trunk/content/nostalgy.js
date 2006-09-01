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
    try {
     match_only_folder_name = 
         this._branch.getBoolPref("match_only_folder_name");
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
        if (!in_message_window) { NostalgyDefLabel(); }
        break;
      case "match_only_folder_name":
        match_only_folder_name = 
           this._branch.getBoolPref("match_only_folder_name");
        break;
    }
  },

  apply: function(sender,subject)
  {
    var folder = null;
    var rules = this.rules;
    var i = 0;
    var current_folder = folder_name(gDBView.msgFolder);
    for (i = 0; (i < rules.length) && (!folder); i++) {
      var r = rules[i];
      if (((r.field != "subject") && (sender.indexOf(r.contains) >= 0)
          || (r.field != "sender") && (subject.indexOf(r.contains) >= 0))
         && (current_folder.indexOf(r.under) == 0))
      {
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
var last_folder_server = new Array();
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
   if (ev.keyCode == 9) { 
	saved_str = nostalgy_folderBox.value; 
	ev.preventDefault(); 
	ev.stopPropagation(); } 
 }, false);

 nostalgy_folderBox.addEventListener("keypress", 
  function(ev){ 
   if (ev.keyCode == 9) { 
    nostalgy_folderBox.value = NostalgyCompleteUnique(saved_str); 
    ev.preventDefault(); 
    ev.stopPropagation();
   } 
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

 setTimeout(function() { nostalgy_folderBox.focus(); }, 0);
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
  last_folder_server[gDBView.msgFolder.server.key] = folder;
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

 if (restrict_to_current_server) { 
   return(last_folder_server[gDBView.msgFolder.server.key]); 
 } else { 
   return(last_folder); 
 }
}

/**  Commands **/

// NOTE. Thunderbird's SelectFolder is buggy. Here is a situation
// where it breaks. Assume we want to select folder A/B/C, and that:
//  (i) folder A is closed, (ii) folder B is open
// TB would correctly open A but it would also incorrectly close B.
// Here's the reason. SelectFolder calls EnsureFolderIndex to ensure that
// folder C is visible, that is: all its ancestors are open.
// The algorithm of TB's EnsureFolderIndex is:
//   (i) is the folder is visible, ok
//   (ii) otherwise, make the parent visible, and then *toggle* the state
//        of the parent
// This is wrong because the parent could already be open and the folder
// could still be invisible if another ancestor is closed. In this
// case, one must make the parent visible, and then check again
// if the folder has become visible before toggling the parent's state


function NostalgyEnsureFolderIndex(builder, msgFolder)
{
  // try to get the index of the folder in the tree
  var index = builder.getIndexOfResource(msgFolder);
  if (index == -1) {
    // if we couldn't find the folder, make all its ancestors visible
    parent_idx = NostalgyEnsureFolderIndex(builder, msgFolder.parent);
    // maybe the folder is now visible
    index = builder.getIndexOfResource(msgFolder);
    // no: this means that the parent is closed, so open it.
    if (index == -1) { 
      builder.toggleOpenState(parent_idx); 
      index = builder.getIndexOfResource(msgFolder);
    }
  }
  return index;
}

function ShowFolder(folder) {
  var folderTree = GetFolderTree();
  var idx = NostalgyEnsureFolderIndex(folderTree.builderView, folder);
  ChangeSelection(folderTree, idx);
  setTimeout(function() { SetFocusThreadPane(); }, 0);
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
 if (isThreadPaneFocused()) {
  var b = gEBI("messagepane").contentDocument.getElementsByTagName("body")[0];
  if (b) { b.scrollTop += d; }
 }
}

function NostalgyEscape(ev) {
  if (ev.timeStamp - NostalgyLastEscapeTimeStamp < 300) SetFocusThreadPane()
  else NostalgyLastEscapeTimeStamp = ev.timeStamp;
}

function NostalgySelectFolderPane(ev) {
  if (ev.timeStamp - NostalgyLastEscapeTimeStamp < 300) SetFocusFolderPane();
}

function NostalgySelectMessagePane(ev) {
  if (ev.timeStamp - NostalgyLastEscapeTimeStamp < 300) SetFocusMessagePane();
}

function NostalgySelectSearch(ev) {
  if (ev.timeStamp - NostalgyLastEscapeTimeStamp < 300) {
    GetSearchInput().focus();
  }
}

window.addEventListener("load", onNostalgyLoad, false);
/* if (!in_message_window) {
  window.addEventListener("keypress", onNostalgyKeyPress, false);
} */

