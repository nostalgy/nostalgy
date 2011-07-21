var nostalgy_in_message_window = !window.SetFocusThreadPane;

var nostalgy_folderBox = null;
var nostalgy_statusBar = null;
var nostalgy_label = null;
var nostalgy_th_statusBar = null;
var nostalgy_th_statusBar_orig_hidden = true;
var nostalgy_cmdLabel = null;
var nostalgy_extracted_rules = "";
var nostalgy_active_keys = { };
var nostalgy_timeout_regkey = 0;
var nostalgy_on_move_completed = null;
var nostalgy_selection_saved = null;

function NostalgyIsDefined(s) {
    return (typeof(window[s]) != "undefined");
}

function NostalgyDoSearch(str) {
    var search = NostalgyEBI("searchInput");
    if (search.value != str) {
        search.value = str;
        search.doSearch();
    }
}

/** Rules **/

function NostalgyMatchContains(field,contain) {
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
    this._branch = NostalgyPrefService().getBranch("extensions.nostalgy.");
    this._branch2 =
        this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this._branch2.addObserver("", this, false);
    this.get_rules();

    for (var n in nostalgy_completion_options) {
      try {
        nostalgy_completion_options[n] = this._branch.getBoolPref(n);
      } catch (ex) { }
    }
    try {
        nostalgy_completion_options[n] = this._branch.getBoolPref(n);
    } catch (ex) { }
    try {
        nostalgy_recent_folders_max_size = this._branch.getIntPref("number_of_recent_folders");
    } catch (ex) { }
    NostalgyInstallRecentFolders();
  },

  register_keys: function() {
    nostalgy_active_keys = { };
    for (var i in nostalgy_keys) {
      var k = "";
      try {
	k = this._branch.getCharPref("keys." + nostalgy_keys[i][0]);
      } catch (ex) { k = nostalgy_keys[i][2]; }
      nostalgy_active_keys[k] = nostalgy_keys[i][3];
    }

    var a = this._branch.getChildList("actions.", { });
    var s = "";
    for (var i in a) {
      var id = a[i].substr(8);
      try {
        var key = this._branch.getCharPref("keys." + id);
        var cmd = this._branch.getCharPref("actions." + id);
       nostalgy_active_keys[key] = cmd;
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
     var r = NostalgyJSONEval(this._branch.getCharPref("rules"));
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
    } catch (ex) {
        NostalgyDebug("Cannot get rules: " + ex);
        this.rules = [];
    }
  },

  observe: function(aSubject, aTopic, aData)
  {
    if(aTopic != "nsPref:changed") return;
    if (aData == "recent_folders") NostalgyInstallRecentFolders();

    if (aData == "rules") {
      this.get_rules();
      if (!nostalgy_in_message_window) NostalgyDefLabel();
      return;
    }
    if (aData = "number_of_recent_folders") {
        nostalgy_recent_folders_max_size = this._branch.getIntPref("number_of_recent_folders");
        return;
    }
    if (nostalgy_completion_options[aData] != undefined) {
     nostalgy_completion_options[aData] = this._branch.getBoolPref(aData);
     if (!nostalgy_in_message_window) NostalgyDefLabel();
     return;
    }
    if (aData.match("keys.")) {
      if (nostalgy_timeout_regkey) return;
      nostalgy_timeout_regkey = 1;
      var r = this;
      setTimeout(function() { nostalgy_timeout_regkey = 0; r.register_keys(); }, 150);
    }
  },

  apply: function(sender,subject,recipients,cfolder)
  {
    var folder = null;
    var rules = this.rules;
    var i = 0;
    var current_folder = NostalgyFullFolderName(cfolder);
    for (i = 0; (i < rules.length) && (!folder); i++) {
      var r = rules[i];
      if (((r.subject && NostalgyMatchContains(subject,r.contains))
        ||(r.sender && NostalgyMatchContains(sender,r.contains))
        ||(r.recipients && NostalgyMatchContains(recipients,r.contains)))
         && (current_folder.indexOf(r.under) == 0))
      {
        folder = NostalgyFindFolderExact(r.folder);
      }
    }
    return folder;
  }
}

NostalgyRules.register();

function NostalgyExtractRules() {
  var s = nostalgy_extracted_rules;
  if (s == "") return;
  // remove characters that should have been escaped
  s = s.replace(/([\x00-\x20>])/g,function(a,b){ return "" });
  if (confirm(
"Do you want to install the rules contained in this message?\n"+
"This will overwrite your current set of rules.\n"+
"IMPORTANT: do this only if you trust the sender of this e-mail.\n"
))
    NostalgyRules._branch.setCharPref("rules", s)
}

/** Driver **/

var nostalgy_default_label = "";
var nostalgy_focus_saved = null;
var nostalgy_command = null;
//var nostalgy_last_folder_author = new Array();
//var nostalgy_last_folder_subject = new Array();
var nostalgy_last_folder_server = new Array();
var nostalgy_last_folder = null;
var nostalgy_gsuggest_folder = null;

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
 OnItemEvent: function(folder, event) {
   var evt = event.toString();
   // NostalgyDebug(evt + " folder:" + folder.prettyName);
   if (evt == "DeleteOrMoveMsgCompleted" && nostalgy_on_move_completed) {
     nostalgy_on_move_completed();
     nostalgy_on_move_completed = null;
   }
 }
}

function NostalgyMailSession() {
 var mSession = Components.classes["@mozilla.org/messenger/services/session;1"].getService();
 if (!mSession) return mSessions;
 return mSession.QueryInterface(Components.interfaces.nsIMsgMailSession);
}

function onNostalgyLoad() {
 NostalgyRules.register_keys();

 nostalgy_folderBox = NostalgyEBI("nostalgy-folderbox");
 nostalgy_statusBar = NostalgyEBI("nostalgy-statusbar");
 nostalgy_label = NostalgyEBI("statusbar-nostalgy-label");
 nostalgy_th_statusBar = NostalgyEBI("status-bar");
 nostalgy_cmdLabel = NostalgyEBI("nostalgy-command-label");

 NostalgyFolderSelectionBox(nostalgy_folderBox);
 nostalgy_default_label = nostalgy_label.value;


 if (!nostalgy_in_message_window) {
   NostalgyEBI("threadTree").addEventListener("select", NostalgyDefLabel, false);
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
      nsIFolderListener.added | nsIFolderListener.removed | nsIFolderListener.event);

 Components.classes["@mozilla.org/observer-service;1"].
   getService(Components.interfaces.nsIObserverService).
   addObserver(NostalgyObserver, "MsgMsgDisplayed", false);
}

function NostalgyOnMsgParsed() {
  if (nostalgy_extracted_rules != "") {
    var button = NostalgyEBI("nostalgy_extract_rules_buttons");
    nostalgy_extracted_rules = "";
    button.hidden = true;
  }

  var doc = document.getElementById('messagepane').contentDocument;
  var content = doc.body.textContent;
  var b = "BEGIN RULES\n";
  var i = content.indexOf(b);
  if (i < 0) return;
  i += b.length;
  var j = content.indexOf("END RULES\n", i);
  if (j < 0) return;

  nostalgy_extracted_rules = content.substr(i, j - i);
  if (nostalgy_extracted_rules != "") {
    var button = NostalgyEBI("nostalgy_extract_rules_buttons");
    button.hidden = false;
  }
}

var NostalgyObserver = {
  observe: function (subject, topic, state) {
    if (!state) return;
    // NostalgyDebug("OnMsgParsed");
    subject = subject.QueryInterface(Components.interfaces.nsIMsgHeaderSink);
    if (subject != msgWindow.msgHeaderSink) return; // another window
    NostalgyOnMsgParsed();
  }
};

function onNostalgyUnload() {
 var mSession = NostalgyMailSession();
 if (mSession) mSession.RemoveFolderListener(NostalgyFolderListener);
 NostalgyRules.unregister();

 Components.classes["@mozilla.org/observer-service;1"].
   getService(Components.interfaces.nsIObserverService).
   removeObserver(NostalgyObserver, "MsgMsgDisplayed");
}

function NostalgyHideIfBlurred() {
  setTimeout(function (){
      var focused = document.commandDispatcher.focusedElement;
    if ((!nostalgy_statusBar.hidden) &&
        (focused != nostalgy_folderBox) &&
	(focused != nostalgy_folderBox.inputField))
      { NostalgyHide(false); }
  }, 500);
}

function NostalgyHide(restore) {
 nostalgy_statusBar.hidden = true;
 nostalgy_th_statusBar.hidden = nostalgy_th_statusBar_orig_hidden;

 if (nostalgy_focus_saved) {
  if (restore) nostalgy_focus_saved.focus ();
  nostalgy_focus_saved = null;
 }
 NostalgyDefLabel();
}

function NostalgyDefLabel() {
 nostalgy_gsuggest_folder = NostalgySuggest();
 if (nostalgy_gsuggest_folder) {
   nostalgy_label.value =
       nostalgy_default_label + " [+Shift: ==> " + NostalgyFolderName(nostalgy_gsuggest_folder) + "]";
 } else {
   nostalgy_label.value = nostalgy_default_label;
 }
}


function NostalgyCollapseFolderPane() {
 var fp = NostalgyEBI("folderPaneBox");
 if (window.MsgToggleFolderPane)
   { MsgToggleFolderPane(true); return true; }
 else if (window.MsgToggleSplitter)
   { MsgToggleSplitter("gray_vertical_splitter"); return true; }
 else if (fp)
   { fp.collapsed = !fp.collapsed; return true; }
 return false;
}



function NostalgyCmd(lab,cmd,require_file) {
 nostalgy_focus_saved = document.commandDispatcher.focusedElement;
 if (!nostalgy_focus_saved) { nostalgy_focus_saved = NostalgyEBI("messagepane").contentWindow; }

 nostalgy_search_folder_options.require_file = require_file;
 nostalgy_cmdLabel.value = lab;
 nostalgy_command = cmd;
 nostalgy_th_statusBar_orig_hidden = nostalgy_th_statusBar.hidden;
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
 return true;
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
  NostalgyHide(true);
  var s = nostalgy_folderBox.value;
  var f = NostalgyResolveFolder(s);
  if (f) {
    NostalgyRecordRecentFolder(f);
    nostalgy_command(f);
  }
  else {
    if (s.substr(0,1) == ":") {
        if ((s == ":") || (s == "::")) return
      var name;
      if (s.substr(s.length-1,1) == ":")
         name = s.substr(1,s.length - 2);
      else
         name = s.substr(1,s.length - 1);
      NostalgyCreateTag(name);
    } else {
        nostalgy_search_folder_options.require_file = false;
        var i = s.lastIndexOf("/", s.length);
        var parent = null;
        var name = null;
        if (i <= 0) {
            parent = gDBView.msgFolder.server.rootMsgFolder;
            if (i == 0) name = s.substr(1, s.length - 1); else name = s;
        }
        else {
            parent = NostalgyResolveFolder(s.substr(0, i));
            name = s.substr(i + 1, s.length - i - 1);
        }
        if (parent) {
            if (confirm("Create new folder [" + name + "]\nunder " + NostalgyFullFolderName(parent) + "?")) {
                parent.createSubfolder(name, msgWindow);
                ClearNostalgyCache();
                parent.updateFolder(msgWindow);
                setTimeout(function() {
                        f = NostalgyResolveFolder(s);
                        if (f) {
                            NostalgyRecordRecentFolder(f);
                            nostalgy_command(f);
                            return;
                        }
                        else
                            alert("No folder " + s);
                    }, 200);
            } else
                return;
        } else
            alert("No folder " + s);
    }
  }
}

function NostalgyMailRecipients() {
 try {
  var hdr = gDBView.hdrForFirstSelectedMessage;
  return((hdr.recipients + ", " + hdr.ccList).toLowerCase());
 } catch (ex) { return ""; }
}

function NostalgyMailAuthor() {
  try {
   return(gDBView.hdrForFirstSelectedMessage.author.toLowerCase());
  } catch (ex) { return ""; }
}

function NostalgyMailAuthorName() {
    return NostalgyHeaderParser.get_address(gDBView.hdrForFirstSelectedMessage.author);
}

function NostalgyMailRecipName() {
    return NostalgyHeaderParser.get_address(gDBView.hdrForFirstSelectedMessage.recipients);
}

function NostalgyMailSubject() {
 try {
 var s = gDBView.hdrForFirstSelectedMessage.mime2DecodedSubject.toLowerCase();
 var old;

 do { old = s; s = s.replace(/^\[fwd:|^fwd:|^fw:|^re:|^ |^e :|\]$/g, ""); }
 while (s != old);

 // do { old =s; s = s.replace(/^\[.*\]/g,""); } while (s != old);
 return s;
 } catch (ex) { return ""; }
}

function NostalgyCurrentFolder() {
    try {
        if (!gDBView) return null;
        if (gDBView.msgFolder) return gDBView.msgFolder;
        if (gDBView.hdrForFirstSelectedMessage) return gDBView.hdrForFirstSelectedMessage.folder;
    } catch (ex) { }
    NostalgyDebug("Cannot determine current folder");
    return null;
}

function NostalgyRegisterFolder(folder) {
// nostalgy_last_folder_author[NostalgyMailAuthor()] = folder;
// nostalgy_last_folder_subject[NostalgyMailSubject()] = folder;
    var f = NostalgyCurrentFolder();
    if (f)  nostalgy_last_folder_server[f.server.key] = folder;
    nostalgy_last_folder = folder;
}

function NostalgySuggest() {
 var r = null;
 if (!gDBView) return;
 var folder = NostalgyCurrentFolder();
 try {
     if (folder) r = NostalgyRules.apply(NostalgyMailAuthor(), NostalgyMailSubject(), NostalgyMailRecipients(), folder);
     if (r) { return(r); }
 } catch (ex) { NostalgyDebug("ex1:" + ex);  }

 if ( nostalgy_completion_options.use_statistical_prediction )
     {
         try {
             r = NostalgyPredict.predict_folder(1);
             if (r) { return(r); }
         } catch (ex) { NostalgyDebug("ex2:" + ex);  }
     }
// r = nostalgy_last_folder_author[NostalgyMailAuthor()];
// if (r) { return(r); }

// r = nostalgy_last_folder_subject[NostalgyMailSubject()];
// if (r) { return(r); }

 if (nostalgy_completion_options.restrict_to_current_server) {
     if (folder) return(nostalgy_last_folder_server[folder.server.key]);
 } else {
     return(nostalgy_last_folder);
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

function NostalgyShowFolder(folder) {
  if (folder.tag) {
    ViewChange(kViewTagMarker + folder.key, folder.tag);
    return true;
  }
  var folderTree = document.getElementById("folderTree");
  var totry = 1;
  var savedFolderView;
  if (window.CycleFolderView) {
      totry = kNumFolderViews;
      savedFolderView = gCurrentFolderView;
  } else if (window.gFolderTreeView) {
      try {
        totry = window.gFolderTreeView.modeNames.length;
        savedFolderView = window.gFolderTreeView.modeNames.indexOf(window.gFolderTreeView.mode);
      } catch (ex) {
        totry = window.gFolderTreeView._modeNames.length;
        savedFolderView = window.gFolderTreeView._modeNames.indexOf(window.gFolderTreeView.mode);
      }
  } else if (EnsureFolderIndex.length < 2) {
      // Postbox
      ChangeSelection(folderTree, EnsureFolderIndex(folder));
      return;
  }
  if (window.gFolderTreeView) {
      var saved_mode = window.gFolderTreeView.mode;
      try {
          while (totry > 0)  {
              window.gFolderTreeView.selectFolder(folder);
              if (window.gFolderTreeView.getIndexOfFolder(folder))
                  totry = 0;
              else {
                  totry--;
                  window.gFolderTreeView.cycleMode(true);
              }
          }
      } catch (ex) { NostalgyDebug("Ex: " + ex); }
      window.gFolderTreeView.mode = saved_mode;
  } else {
      while (totry > 0) {
          try {
              var idx = NostalgyEnsureFolderIndex(folderTree.builderView, folder);
              ChangeSelection(folderTree, idx);
              totry = 0;
          } catch (ex) { totry--; CycleFolderView(true); }
      }
      if (window.CycleFolderView) { loadFolderView(savedFolderView); }
  }
  setTimeout(function() {
          SetFocusThreadPane();
          NostalgyDoSearch("");
      }, 400);
  return true;
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
 NostalgyRegisterFolder(folder);
 if (window.SetNextMessageAfterDelete) SetNextMessageAfterDelete();
 else gFolderDisplay.hintAboutToDeleteMessages();
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else {
     NostalgyPredict.update_folder(folder);
     gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,folder);
 }
 return true;
}

function NostalgyMoveToFolderAndGo(folder) {
 NostalgyRegisterFolder(folder);
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else {
     NostalgyPredict.update_folder(folder);
     gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,folder);
 }
 NostalgyShowFolder(folder);
 return true;
}

function NostalgyCopyToFolder(folder) {
 NostalgyRegisterFolder(folder);
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else {
     NostalgyPredict.update_folder(folder);
     gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages,folder);
 }
 return true;
}

function NostalgySuggested(cmd) {
  if (nostalgy_gsuggest_folder) cmd(nostalgy_gsuggest_folder);
  return true;
}



var NostalgyLastEscapeTimeStamp = 0;

function NostalgyIsThreadPaneFocused() {
  return (WhichPaneHasFocus() == GetThreadTree());
}

function NostalgyScrollMsg(d) {
 if (NostalgyIsThreadPaneFocused()) {
  var b = NostalgyEBI("messagepane").contentDocument.getElementsByTagName("body")[0];
  if (b) { b.scrollTop += d; }
 }
}


var NostalgyEscapePressed = 0;

function NostalgyFocusThreadPane() {
  SetFocusThreadPane();
}

function NostalgyEscape() {
  NostalgyEscapePressed++;
  var i = NostalgyEscapePressed;
  setTimeout(
    function(){ if (NostalgyEscapePressed==i) NostalgyEscapePressed = 0; },
    300);
  if (NostalgyEscapePressed == 3) {
      NostalgyDoSearch("");
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

var nostalgy_last_cycle_restrict_value = "";
var nostalgy_last_cycle_restrict = 0;
var nostalgy_last_cycle_saved_searchMode = 0;

function NostalgySearchSenderQuickFilter() {
    // TB 3.1
    var input = NostalgyEBI("qfb-qs-textbox");
    if (!input) return false;

    var sender = NostalgyMailAuthorName();
    var recipient = NostalgyMailRecipName();
    var subject = NostalgyMailSubject();

    var values = { sender: sender, subject: subject, recipients: recipient };
    if (NostalgyCurrentFolder().displayRecipients)
        fields = [ "recipients", "subject" ];
    else
        fields = [ "sender", "subject" ];

    var state = QuickFilterBarMuxer.activeFilterer.filterValues.text;
    var make_state = function(field) {
        var new_state = {text: null, states: { }};
        for (var key in state.states) new_state.states[key] = false;
        if (field != null) {
            new_state.text = values[field];
            new_state.states[field] = true;
        }
        return new_state;
    }

    var current = JSON.stringify(state);

    var found = 0;
    for (var i = 0; i < fields.length; i++)
        if (JSON.stringify(make_state(fields[i])) == current) found = i + 1;
    var new_state = null;
    if (found < fields.length) new_state = make_state(fields[found]);
    else new_state = make_state(null);
    QuickFilterBarMuxer.activeFilterer.filterValues.text = new_state;
    if (QuickFilterBarMuxer.onActiveAllMessagesLoaded)
        QuickFilterBarMuxer.onActiveAllMessagesLoaded(gFolderDisplay); // TB 3
    if (QuickFilterBarMuxer.onActiveMessagesLoaded)
        QuickFilterBarMuxer.onActiveMessagesLoaded(gFolderDisplay); // TB 5
    QuickFilterBarMuxer._showFilterBar(new_state.text != null);
    QuickFilterBarMuxer.updateSearch();
    return true;
}

function NostalgySearchSender() {
    if (NostalgySearchSenderQuickFilter()) return;

  var input = NostalgyEBI("searchInput");
  if (!input) { alert("Nostalgy error:\nCannot perform this action when Quick Search is not enabled"); return false; }
  try {
  var recips = NostalgyCurrentFolder().displayRecipients;
  var key = "";
  try {
      key = gDBView.hdrForFirstSelectedMessage.messageKey;
  } catch (ex) { }

  input.focus();
  input.showingSearchCriteria = false;
  input.clearButtonHidden = false;
  var name = "";
  var subj = "";
  try {
      name = (recips ? NostalgyMailRecipName() : NostalgyMailAuthorName());
      subj = NostalgyMailSubject();
  } catch (ex) { }
  if (input.value != nostalgy_last_cycle_restrict_value) nostalgy_last_cycle_restrict = 0;
  nostalgy_last_cycle_restrict++;
  var to_search = "";
  if (name != "" && nostalgy_last_cycle_restrict == 1) {
      nostalgy_last_cycle_saved_searchMode = input.searchMode;
      to_search = name;
      if (recips && window.kQuickSearchRecipient)
          input.searchMode = kQuickSearchRecipient;
      else if (window.kQuickSearchSender)
          input.searchMode = kQuickSearchSender;
      else if (window.kQuickSearchFrom)
          input.searchMode = kQuickSearchFrom;
      else if (window.QuickSearchConstants)
          input.searchMode = QuickSearchConstants.kQuickSearchFrom;
      else
          alert("Nostalgy error: don't know which QuickSearch criterion to use");
  }
  else if (subj != "" && nostalgy_last_cycle_restrict == 2) {
      to_search = subj;
      if (NostalgyIsDefined("kQuickSearchSubject"))
          input.searchMode = kQuickSearchSubject;
      else if (window.QuickSearchConstants)
          input.searchMode = QuickSearchConstants.kQuickSearchSubject;
      else
          alert("Nostalgy error: don't know which QuickSearch criterion to use");
  }
  else
  { nostalgy_last_cycle_restrict = 0; to_search = "";
    input.searchMode = nostalgy_last_cycle_saved_searchMode;
  }
  nostalgy_last_cycle_restrict_value = to_search;
  NostalgyDoSearch(to_search);
  SetFocusThreadPane();
  if (key != "") gDBView.selectMsgByKey(key);
  } catch (ex) {
      alert(ex);
   input.focus();
   nostalgy_last_cycle_restrict = 0; NostalgyDoSearch("");
   SetFocusThreadPane();
  }
  return true;
}

function onNostalgyKeyPressCapture(ev) {
    if (ev.keyCode == KeyEvent.DOM_VK_ESCAPE)
        NostalgyEscape();

  var focused = "";
  try { focused = document.commandDispatcher.focusedElement.nodeName; }
  catch (ex) { }
  if (!nostalgy_statusBar.hidden && focused != "html:input")
    {
    // ugly hack: it takes some time for the folderBox to be focused
    if (ev.charCode) {
      nostalgy_folderBox.value =  nostalgy_folderBox.value +
          String.fromCharCode(ev.charCode);
    }
    NostalgyStopEvent(ev);
    return;
  }
}


function onNostalgyKeyPress(ev) {
  if (!nostalgy_statusBar.hidden) return;

  if (NostalgyEscapePressed >= 1) {
    if (!nostalgy_in_message_window && ev.charCode == 109) { // M
      NostalgyFocusMessagePane();
      NostalgyStopEvent(ev);
    } else
    if (!nostalgy_in_message_window && ev.charCode == 102) { // F
      document.getElementById("folderTree").focus();
      NostalgyStopEvent(ev);
    }
    return;
  }

  var kn = NostalgyRecognizeKey(ev);
  if (ev.charCode && ev.originalTarget.localName.toLowerCase() == "input"
      && !ev.ctrlKey && !ev.altKey)
    return;
  var k = nostalgy_active_keys[kn];
  if (k && NostalgyParseCommand(k)) NostalgyStopEvent(ev);
}

function NostalgyParseCommand(k) {
  if (k.indexOf("JS:") == 0)
    return eval(k.substr(3,k.length - 3));

  var spl = k.match(/(.*) -> (.*)/);
  var folder = NostalgyFindFolderExact(spl[2]);
  if (!folder) { alert("Cannot find folder " + spl[2]); return; }
  switch (spl[1]) {
  case "Go": return NostalgyShowFolder(folder);
  case "Save": return NostalgyMoveToFolder(folder);
  case "Copy": return NostalgyCopyToFolder(folder);
  case "SaveGo": return NostalgyMoveToFolderAndGo(folder);
  default: alert("Unknown command " + spl[1]); return;
  }
}

function NostalgyGoCommand() {
  if (!nostalgy_in_message_window)  {
    NostalgyCmd('Go to folder:', NostalgyShowFolder, false);
    return true;
  } else return false;
}
function NostalgyGoSuggestedCommand() {
  if (!nostalgy_in_message_window)  {
    NostalgySuggested(NostalgyShowFolder);
    return true;
  } else return false;
}

function NostalgySaveAndGo() {
  if (nostalgy_in_message_window) return false;
  NostalgyCmd('Move messages and go to:', NostalgyMoveToFolderAndGo, true);
  return true;
}

function NostalgySaveAndGoSuggested() {
  if (nostalgy_in_message_window) return false;
  NostalgySuggested(NostalgyMoveToFolderAndGo);
  return true;
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("resize", onNostalgyResize, false);
window.addEventListener("unload", onNostalgyUnload, false);
window.addEventListener("keypress", onNostalgyKeyPress, false);
window.addEventListener("keypress", onNostalgyKeyPressCapture, true);
