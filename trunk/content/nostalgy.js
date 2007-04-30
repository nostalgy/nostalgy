function gEBI(s) { return document.getElementById(s); }

var in_message_window = !window.SetFocusFolderPane;

var nostalgy_folderBox = null;
var nostalgy_statusBar = null;
var nostalgy_label = null;
var nostalgy_th_statusBar = null;
var nostalgy_cmdLabel = null;

/** Rules **/

function match_contains(field,contain) {
  var re = /^\/(.*)\/$/;
  if (contain.match(re)) {
   var m = re.exec(contain);
   var re = RegExp(m[1], "");
   return field.match(re);
  }
  return (field.indexOf(contain) >= 0);
}

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
    try {
     sort_folders = 
         this._branch.getBoolPref("sort_folders");
    } catch (ex) { }
    try {
     match_case_sensitive =
         this._branch.getBoolPref("match_case_sensitive");
    } catch (ex) { }
    try {
     tab_shell_completion =
         this._branch.getBoolPref("tab_shell_completion");
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
       var rule = r[i];
       rule.contains = rule.contains.toLowerCase();
       // convert from previous version
       if (rule.field) {
       if (rule.field == "any") { 
        rule.sender = true;
        rule.recipients = true;
        rule.subject = true;
       } else if (rule.field == "sender") rule.sender = true
       else if (rule.field == "subject") rule.subject = true;
       }
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
        restrict_to_current_server = this._branch.getBoolPref(aData);
        if (!in_message_window) { NostalgyDefLabel(); }
        break;
      case "match_only_folder_name":
        match_only_folder_name = this._branch.getBoolPref(aData);
        break;
      case "sort_folders":
        sort_folders = this._branch.getBoolPref(aData);
        break;
      case "match_case_sensitive":
        match_case_sensitive = this._branch.getBoolPref(aData);
        break;
      case "tab_shell_completion":
        tab_shell_completion = this._branch.getBoolPref(aData);
        break;
    }
  },

  apply: function(sender,subject,recipients)
  {
    var folder = null;
    var rules = this.rules;
    var i = 0;
    var current_folder = full_folder_name(gDBView.msgFolder);
    for (i = 0; (i < rules.length) && (!folder); i++) {
      var r = rules[i];
      if (((r.subject && match_contains(subject,r.contains))
        ||(r.sender && match_contains(sender,r.contains))
        ||(r.recipients && match_contains(recipients,r.contains)))
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

function onNostalgyResize() {
  nostalgy_label.parentNode.maxWidth = document.width * 6 / 10;
}

var NostalgyFolderListener = {
 OnItemAdded: function(parentItem, item) { ClearNostalgyCache(); },
 OnItemRemoved: function(parentItem, item) { ClearNostalgyCache(); },
 OnItemPropertyChanged: function(item, property, oldValue, newValue) { },
 OnItemIntPropertyChanged: function(item, property, oldValue, newValue) { },
 OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { },
 OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue){ },
 OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) { },
 OnItemEvent: function(folder, event) { }
}

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
 } else {
   // find a better way to be notified when the displayed message changes
   var old = UpdateStandAloneMessageCounts;
   UpdateStandAloneMessageCounts = function() {
     old();
     NostalgyDefLabel();
   };
 }

 window.addEventListener("mousedown", NostalgyHideIfBlurred, false);
 // Don't know why, but the blur event does not seem to be fired properly...


 var mSession = Components.classes[mailSessionContractID].getService(Components.interfaces.nsIMsgMailSession);
 var nsIFolderListener = Components.interfaces.nsIFolderListener;
 var notifyFlags = nsIFolderListener.added | nsIFolderListener.removed;
 mSession.AddFolderListener(NostalgyFolderListener, notifyFlags);

 // NostalgyKeys();
}

function NostalgyKeys() {
  var nodes = this.document.getElementsByTagName("key");
  for (i = 0, l = nodes.length; i < l; i++) 
   if (nodes[i].getAttribute("nostalgy_key")) {
     alert(nodes[i].getAttribute("nostalgy_key") + " = " +
           nodes[i].getAttribute("key"));
     nodes[i].setAttribute("key","O");
   }
}

function NostalgyHideIfBlurred() {
  setTimeout(function (){
    if ((!nostalgy_statusBar.hidden) && 
        (document.commandDispatcher.focusedElement != nostalgy_folderBox))
    { NostalgyHide(); }
  }, 500);
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
 nostalgy_th_statusBar.hidden = true;
 nostalgy_folderBox.shell_completion = false;
 nostalgy_statusBar.hidden = false;
 nostalgy_folderBox.value = init;

 setTimeout(function() { 
    nostalgy_folderBox.focus();  
    nostalgy_folderBox.processInput(); 
 }, 0);
   // For some unknown reason, doing nostalgyBox.focus immediatly
   // sometimes does not work...
}


function NostalgyRunCommand() {
  var f = NostalgyResolveFolder(nostalgy_folderBox.value);
  if (f) { command(f); }
  else { alert("No folder " + nostalgy_folderBox.value); }
  NostalgyHide();
}

function MailRecipients() {
 var hdr = gDBView.hdrForFirstSelectedMessage;
 return((hdr.recipients + ", " + hdr.ccList).toLowerCase());
}

function MailAuthor() {
 return(gDBView.hdrForFirstSelectedMessage.author.toLowerCase());
}

function MailAuthorName()
{
  var msgHdr = gDBView.hdrForFirstSelectedMessage;
  var headerParser = 
 Components.classes["@mozilla.org/messenger/headerparser;1"].
   getService(Components.interfaces.nsIMsgHeaderParser);
 var emailAddress = headerParser.extractHeaderAddressMailboxes(null, msgHdr.author);
  return emailAddress;
}

function MailRecipName()
{
  var msgHdr = gDBView.hdrForFirstSelectedMessage;
  var headerParser = 
 Components.classes["@mozilla.org/messenger/headerparser;1"].
   getService(Components.interfaces.nsIMsgHeaderParser);
 var emailAddress = headerParser.extractHeaderAddressMailboxes(null, msgHdr.recipients);
  var i = emailAddress.indexOf(" ",0);
  if (i > 0) emailAddress = emailAddress.substr(0,i-1);
  return emailAddress;
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
  r = NostalgyRules.apply(MailAuthor(), MailSubject(), MailRecipients());
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

    if (!msgFolder.parent) { throw 0; }  
	// Folder not reachable in current view

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

function NostalgySelectLastMsg() {
  if (gDBView) {
     if (gDBView.numSelected == 0)
       gDBView.selectMsgByKey(gDBView.getKeyAt(0));
  }
}

function ShowFolder(folder) {
  var folderTree = GetFolderTree();
  var totry = 1;
  var savedFolderView;
  if (window.CycleFolderView) { 
    totry = kNumFolderViews;
    savedFolderView = gCurrentFolderView;
  }
  var input = GetSearchInput();
  var search = input.value;
  if (input.showingSearchCriteria) search = "";
  while (totry > 0) {
    try {
      var idx = NostalgyEnsureFolderIndex(folderTree.builderView, folder);
      ChangeSelection(folderTree, idx);
      setTimeout(function() { SetFocusThreadPane(); 
        var s = GetThreadTree().view.selection;
	if (s.count == 0) { s.select(s.currentIndex); }
      }, 400);
      totry = 0;
    } catch (ex) { totry--; CycleFolderView(true); }
  }
  if (window.CycleFolderView) { loadFolderView(savedFolderView); }
  if (search != "") {
    input.focus();
    input.value = search;
    setTimeout(function(){onEnterInSearchBar(true);}, 200);
  }
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


var NostalgyEscapePressed = 0;

function NostalgyFocusThreadPane() {
  SetFocusThreadPane();
  NostalgySelectLastMsg();
}

function NostalgyEscape(ev) {
  NostalgyEscapePressed++;
  var i = NostalgyEscapePressed;
  setTimeout(
    function(){ if (NostalgyEscapePressed==i) NostalgyEscapePressed = 0; },
    300);
  if (NostalgyEscapePressed == 3) { 
	onClearSearch();
	setTimeout(NostalgyFocusThreadPane,100);
  }
  if (NostalgyEscapePressed == 2) NostalgyFocusThreadPane();
}

function NostalgyFocusMessagePane() {
  // for some reason, advanceFocusIntoSubtree(getebi("messagepane")) does not work

  SetFocusMessagePane();
  var i = 10;
  while (i > 0 && 
         top.document.commandDispatcher.focusedWindow.name != "messagepane") 
  { 
    document.commandDispatcher.advanceFocus(); i--; 
  }
}

function NostalgySearchSender() {
  var recips = gDBView.msgFolder.displayRecipients;
  var key = gDBView.hdrForFirstSelectedMessage.messageKey;
  var input = GetSearchInput();
  input.focus();
  input.searchMode =  1; // sender = kQuickSearchSender
  var name = (recips ? MailRecipName() : MailAuthorName());
  if (input.value == name) input.value = ""; else input.value = name;
  onEnterInSearchBar(true);
  SetFocusThreadPane();
  gDBView.selectMsgByKey(key);
}

function onNostalgyKeyPress(ev) {
  if (NostalgyEscapePressed >= 1) {
    if (ev.charCode == 109) { // M
      NostalgyFocusMessagePane();
      ev.preventDefault();
    } else
    if (ev.charCode == 102) { // F
      SetFocusFolderPane();
      ev.preventDefault();
    } else
    if (ev.charCode == 105) { // I
      GetSearchInput().focus();
      ev.preventDefault();
    }
  } 
  if (!nostalgy_statusBar.hidden &&
      document.commandDispatcher.focusedElement.nodeName != "html:input") {
    // ugly hack: it takes some time for the folderBox to be focused
    if (ev.charCode) {
      nostalgy_folderBox.value =  nostalgy_folderBox.value + 
          String.fromCharCode(ev.charCode);
    }
      ev.preventDefault();
  }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("resize", onNostalgyResize, false);
if (!in_message_window) {
  window.addEventListener("keypress", onNostalgyKeyPress, false);
} 
