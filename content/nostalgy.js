function gEBI(s) { return document.getElementById(s); }

var in_message_window = !window.SetFocusFolderPane;

var nostalgy_folderBox = null;
var nostalgy_statusBar = null;
var nostalgy_label = null;
var nostalgy_th_statusBar = null;
var nostalgy_cmdLabel = null;
var custom_keys = { };
var timeout_regkey = 0;

/** Keys **/

function NostalgySetKey(s,k) {
  k.removeAttribute("modifiers");
  k.removeAttribute("key");
  k.removeAttribute("keycode");
  k.removeAttribute("charcode");

  if (s == "(disabled)") { k.setAttribute("keycode","VK_SHIFT"); return; }

  var comps = s.split(/ /);
  var mods = comps.slice(0,comps.length - 1).join(" ");
  s = comps[comps.length-1];
  
  if (mods) k.setAttribute("modifiers",mods);
  if (s.length == 1) k.setAttribute("key",s);
  else k.setAttribute("keycode","VK_" + s);
}

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

    for (var n in nostalgy_completion_options) {
      try {
        nostalgy_completion_options[n] = this._branch.getBoolPref(n);
      } catch (ex) { }
    }
  },

  register_keys: function() {
    var keys = document.getElementsByTagName("key");
    for (var i in keys) {
      if (keys[i].id) {
       var f = keys[i].id.match(/nostalgy_key_(.+)/);
       if (f)
       try {
         var v = this._branch.getCharPref("keys." + f[1]);
         NostalgySetKey(v,keys[i]);
       } catch (ex) { }
      }
    }
    var a = this._branch.getChildList("actions.", { });
    custom_keys = { };
    var s = "";
    for (var i in a) {
      var id = a[i].substr(8);
      try {
        var key = this._branch.getCharPref("keys." + id);
        var cmd = this._branch.getCharPref("actions." + id);
       custom_keys[key] = cmd;
      } catch (ex) { }
    }
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
    if (aData == "rules") {
      this.get_rules();
      if (!in_message_window) NostalgyDefLabel();
      return;
    }
    if (nostalgy_completion_options[aData] != undefined) {
     nostalgy_completion_options[aData] = this._branch.getBoolPref(aData);
     if (!in_message_window) NostalgyDefLabel();
     return;
    }
    if (aData.match("keys.")) {
      if (timeout_regkey) return;
      timeout_regkey = 1;
      var r = this;
      setTimeout(function() { timeout_regkey = 0; r.register_keys(); }, 1000);
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
var nostalgy_command = null;
//var last_folder_author = new Array();
//var last_folder_subject = new Array();
var last_folder_server = new Array();
var last_folder = null;
var gsuggest_folder = null;

function onNostalgyResize() {
  if (nostalgy_label)
    nostalgy_label.parentNode.maxWidth = document.width * 6 / 10;
}

var NostalgyFolderListener = {
 OnItemAdded: function(parentItem, item) { 
   try { var i = item.QueryInterface(Components.interfaces.nsIMsgFolder);
   ClearNostalgyCache(); 
 } catch (ex) { } },
 OnItemRemoved: function(parentItem, item) { 
   try { var i = item.QueryInterface(Components.interfaces.nsIMsgFolder);
   ClearNostalgyCache(); 
 } catch (ex) { } },

 OnItemPropertyChanged: function(item, property, oldValue, newValue) { },
 OnItemIntPropertyChanged: function(item, property, oldValue, newValue) { },
 OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { },
 OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue){ },
 OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) { },
 OnItemEvent: function(folder, event) { }
}

function NostalgyMailSession() {
 var mSession = Components.classes[mailSessionContractID].getService();
 if (!mSession) return mSessions;
 return mSession.QueryInterface(Components.interfaces.nsIMsgMailSession);
}

function onNostalgyLoad() {
 NostalgyRules.register_keys();

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


 var mSession = NostalgyMailSession();
 var nsIFolderListener = Components.interfaces.nsIFolderListener;
 if (mSession) 
   mSession.AddFolderListener(NostalgyFolderListener, 
      nsIFolderListener.added | nsIFolderListener.removed);
}

function onNostalgyUnload() {
 var mSession = NostalgyMailSession();
 if (mSession) mSession.RemoveFolderListener(NostalgyFolderListener);
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



function NostalgyCmd(lab,cmd,require_file) {
 focus_saved = document.commandDispatcher.focusedElement;
 if (!focus_saved) { focus_saved = gEBI("messagepane").contentWindow; }

 nostalgy_search_folder_options.require_file = require_file;
 nostalgy_cmdLabel.value = lab;
 nostalgy_command = cmd;
 nostalgy_th_statusBar.hidden = true;
 nostalgy_folderBox.shell_completion = false;
 nostalgy_statusBar.hidden = false;
 nostalgy_folderBox.value = "";

 setTimeout(function() { 
    nostalgy_folderBox.focus();  
    nostalgy_folderBox.processInput(); 
 }, 0);
   // For some unknown reason, doing nostalgyBox.focus immediatly
   // sometimes does not work...
}


function NostalgyCreateTag(name) {
 var tagService = 
    Components.classes["@mozilla.org/messenger/tagservice;1"]
              .getService(Components.interfaces.nsIMsgTagService);
 tagService.addTag(name, '', '');
 var key = tagService.getKeyForTag(name);
 var ok = false;
 var args = {result: "", keyToEdit: key, 
             okCallback: function(){ ok = true; } };
 var dialog = window.openDialog(
                              "chrome://messenger/content/newTagDialog.xul",
                              "",
                              "chrome,titlebar,modal",
                              args);    
  if (ok) nostalgy_command({ tag:name,key:key });   
  else tagService.deleteKey(key);
}

function NostalgyRunCommand() {
  NostalgyHide();
  var s = nostalgy_folderBox.value;
  var f = NostalgyResolveFolder(s);
  if (f) nostalgy_command(f);
  else { 
    if (s.substr(0,1) == ":" && s != ":") {
      var name;
      if (s.substr(s.length-1,1) == ":") 
         name = s.substr(1,s.length - 2);
      else 
         name = s.substr(1,s.length - 1);
      NostalgyCreateTag(name);
    } else
      alert("No folder " + s);
  }
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
 var s = gDBView.hdrForFirstSelectedMessage.mime2DecodedSubject.toLowerCase();
 var old;

 do { old = s; s = s.replace(/^\[fwd:|^fwd:|^fw:|^re:|^ |^e :|\]$/g, ""); } 
 while (s != old);

 // do { old =s; s = s.replace(/^\[.*\]/g,""); } while (s != old);

 return s;  
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

 if (nostalgy_completion_options.restrict_to_current_server) { 
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

function NostalgyShowFolder(folder) {
  if (folder.tag) {
    ViewChange(kViewTagMarker + folder.key, folder.tag);
    return;
  }

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

function NostalgyToggleMessageTag(tag) {
  if (GetNumSelectedMessages() < 1) return;

  var msgHdr = gDBView.hdrForFirstSelectedMessage;
  var curKeys = msgHdr.getStringProperty("keywords");
  if (msgHdr.label) curKeys += " $label" + msgHdr.label;
  var addKey  = (" " + curKeys + " ").indexOf(" " + tag.key + " ") < 0;

  ToggleMessageTag(tag.key,addKey);
}

function NostalgyMoveToFolder(folder) {
 register_folder(folder);
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,folder);
 SetNextMessageAfterDelete();
}

function NostalgyCopyToFolder(folder) {
 register_folder(folder);
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages,folder);
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
    ViewChange(kViewItemAll, "All");  // TODO: localized string
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

var last_cycle_restrict_value = null;
var last_cycle_restrict = 0;

function NostalgySearchSender() {
  var input = GetSearchInput();
  try {
  var recips = gDBView.msgFolder.displayRecipients;
  var key = gDBView.hdrForFirstSelectedMessage.messageKey;
  input.focus();
  input.showingSearchCriteria = false;
  input.clearButtonHidden = false;
  var name = (recips ? MailRecipName() : MailAuthorName());
  var subj = MailSubject();
  if (input.value != last_cycle_restrict_value) last_cycle_restrict = 0;
  last_cycle_restrict++;
  if (last_cycle_restrict == 1)
  { input.value = name; input.searchMode = kQuickSearchSender; }
  else if (last_cycle_restrict == 2)
  { input.value = subj; input.searchMode = kQuickSearchSubject; }
  else
  { last_cycle_restrict = 0; input.value = ""; }
  last_cycle_restrict_value = input.value;
  onEnterInSearchBar();
  SetFocusThreadPane();
  gDBView.selectMsgByKey(key);
  } catch (ex) { 
   input.focus();
   last_cycle_restrict = 0; input.value = "";  onEnterInSearchBar();
   SetFocusThreadPane();
  }
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
    if (ev.charCode == 120) { // X
      var gMsgCompose = 
	Components.classes["@mozilla.org/messengercompose/compose;1"].
	createInstance(Components.interfaces.nsIMsgCompose);
      var sAccountManager = 
	Components.classes["@mozilla.org/messenger/account-manager;1"].
	getService(Components.interfaces.nsIMsgAccountManager);

      var identity = 
	sAccountManager.allIdentities.GetElementAt(0).
	QueryInterface(Components.interfaces.nsIMsgIdentity);
      alert(identity.fullName);
      var account = 
	sAccountManager.defaultAccount;
      alert(account);
      var deliverMode = Components.interfaces.nsIMsgCompDeliverMode;
      alert(msgWindow);
      var progress = 
	Components.classes["@mozilla.org/messenger/progress;1"].
	createInstance(Components.interfaces.nsIMsgProgress);
      var gTempEditorWindow = 
	window.open("chrome://nostalgy/content/QREditor.xul", "_blank", "chrome,extrachrome,dialog='no',width=80,height=80,centerscreen,alwaysRaised");
      var params = 
	Components.classes["@mozilla.org/messengercompose/composeparams;1"].
	createInstance(Components.interfaces.nsIMsgComposeParams);

      var compfields = 
	Components.classes["@mozilla.org/messengercompose/composefields;1"].
	createInstance(Components.interfaces.nsIMsgCompFields);
      
      compfields.to = "alain.frisch@inria.fr";
      compfields.subject = "Coucou !";
      compfields.body = "this is the body\n:-)\n";

      params.identity = identity;
      params.composeFields = compfields;
      params.format = 2;  // PlainText

      gMsgCompose.Initialize(gTempEditorWindow, params );
      msgWindow.SetDOMWindow(window);
      gMsgCompose.SendMsg(deliverMode.Now, identity, account.key, 
			  msgWindow, progress);
    }
    return;
  } 
  if (!nostalgy_statusBar.hidden &&
      document.commandDispatcher.focusedElement.nodeName != "html:input") {
    // ugly hack: it takes some time for the folderBox to be focused
    if (ev.charCode) {
      nostalgy_folderBox.value =  nostalgy_folderBox.value + 
          String.fromCharCode(ev.charCode);
    }
    ev.preventDefault();
    return;
  }
  if (ev.originalTarget.localName == "input") return;
  var k = custom_keys[RecognizeKey(ev)];
  if (k) { ParseCommand(k); ev.preventDefault(); }
}

function ParseCommand(k) {
  var spl = k.match(/(.*) -> (.*)/);
  var folder = FindFolderExact(spl[2]);
  if (!folder) { alert("Cannot find folder " + spl[2]); return; }
  switch (spl[1]) {
   case "Go": NostalgyShowFolder(folder); break;
   case "Save": NostalgyMoveToFolder(folder); break;
   case "Copy": NostalgyCopyToFolder(folder); break;
   default: alert("Unknown command " + spl[1]); return;
  }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("resize", onNostalgyResize, false);
window.addEventListener("unload", onNostalgyUnload, false);

if (!in_message_window)
  window.addEventListener("keypress", onNostalgyKeyPress, false);


