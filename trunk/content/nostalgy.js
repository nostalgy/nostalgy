var in_message_window = !window.SetFocusThreadPane;

var nostalgy_folderBox = null;
var nostalgy_statusBar = null;
var nostalgy_label = null;
var nostalgy_th_statusBar = null;
var nostalgy_cmdLabel = null;
var nostalgy_extracted_rules = "";
var nostalgy_active_keys = { };
var timeout_regkey = 0;
var nostalgy_on_search_done = null;
var nostalgy_search_focused = false;
var nostalgy_on_move_completed = null;
var nostalgy_selection_saved = null;

function NostalgyIsDefined(s) {
    return (typeof(window[s]) != "undefined");
}

function NostalgySearch() {
    if (window.onEnterInSearchBar) {
        onEnterInSearchBar();
        return;
    }
    var search = gEBI("searchInput");
    search.doSearch();
}

function NostalgyDoSearch(str) {
    var search = gEBI("searchInput");
    search.value = str;
    search.doSearch();
}

function NostalgyCurrentSearchMode() {
    var input = gEBI("searchInput");
    return input.searchMode;
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
    } catch (ex) { }
  },

  observe: function(aSubject, aTopic, aData)
  {
    if(aTopic != "nsPref:changed") return;
    if (aData == "recent_folders") NostalgyInstallRecentFolders();

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
      setTimeout(function() { timeout_regkey = 0; r.register_keys(); }, 150);
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
 OnItemEvent: function(folder, event) {
   var evt = event.toString();
   // NostalgyDebug(evt + " folder:" + folder.prettyName);
   if (evt == "FolderLoaded") setTimeout(NostalgySelectLastMsg,50);
   if (evt == "DeleteOrMoveMsgCompleted" && nostalgy_on_move_completed) {
     nostalgy_on_move_completed();
     nostalgy_on_move_completed = null;
   }
 }
}

function NostalgySelectMessageByNavigationType(type)
{
  var resultId = new Object;
  var resultIndex = new Object;
  var threadIndex = new Object;

  gDBView.viewNavigate(type, resultId, resultIndex, threadIndex, true);

  if ((resultId.value != nsMsgKey_None) &&
      (resultIndex.value != nsMsgKey_None)) {

    gEBI("threadTree").treeBoxObject.ensureRowIsVisible(resultIndex.value);
    gDBView.selection.currentIndex = resultIndex.value;
    //gDBView.selection.timedSelect(resultIndex.value, 500);
    //gDBView.selectMsgByKey(resultId.value);
    return true;
  }
  return false;
}

function NostalgyMailSession() {
 var mSession = Components.classes["@mozilla.org/messenger/services/session;1"].getService();
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
   onSearchKeyPress = function() { };
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

 /*
 var old_OnMsgParsed = OnMsgParsed;
 OnMsgParsed = function (url) {
   NostalgyDebug("OnMsgParsed");
   old_OnMsgParsed(url);
   setTimeout(NostalgyOnMsgParsed,100);
 };
 */

 if (window.gSearchNotificationListener) {
   var old_f0 = gSearchNotificationListener.onSearchDone;
   gSearchNotificationListener.onSearchDone = function(status) {
     if (nostalgy_on_search_done) nostalgy_on_search_done();
     old_f0(status);
   };
 }

 var search_input = gEBI("searchInput");
 search_input.addEventListener("focus",
                               function() {
                                   NostalgyEnterSearch();
                               },
                               false);
 search_input.addEventListener("blur",
                               function() {
                                   NostalgyLeaveSearch();
                               },
                               false);


 NostalgyDebug("window.onSearchInputFocus " + window.onSearchInputFocus);
 if (window.onSearchInputFocus) {
   var old_f1 = onSearchInputFocus;
   onSearchInputFocus = function(ev) {
     old_f1(ev);
     NostalgyEnterSearch();
     if (nostalgy_completion_options.always_show_search_mode) NostalgyShowSearchMode();
   };
   var old_f2 = onSearchInputBlur;
   onSearchInputBlur = function(ev) {
     old_f2(ev);
     NostalgyLeaveSearch();
   };

   var search = NostalgyQuickSearch();
   if (search)
       search.addEventListener
	 ("popuphiding",
	  function() {
	   if (nostalgy_completion_options.always_show_search_mode &&
	       nostalgy_search_focused) setTimeout(NostalgyShowSearchMode,0);
	 },
	  false);
 }
}

function NostalgyOnMsgParsed() {
  if (nostalgy_extracted_rules != "") {
    var button = gEBI("nostalgy_extract_rules_buttons");
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
    var button = gEBI("nostalgy_extract_rules_buttons");
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
 nostalgy_th_statusBar.hidden = false;

 if (focus_saved) {
  if (restore) focus_saved.focus ();
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
 if (window.MsgToggleFolderPane)
   { MsgToggleFolderPane(true); return true; }
 else if (window.MsgToggleSplitter)
   { MsgToggleSplitter("gray_vertical_splitter"); return true; }
 else if (fp)
   { fp.collapsed = !fp.collapsed; return true; }
 return false;
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
            if (confirm("Create new folder [" + name + "]\nunder " + full_folder_name(parent) + "?")) {
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

function MailRecipients() {
 try {
  var hdr = gDBView.hdrForFirstSelectedMessage;
  return((hdr.recipients + ", " + hdr.ccList).toLowerCase());
 } catch (ex) { return ""; }
}

function MailAuthor() {
  try {
   return(gDBView.hdrForFirstSelectedMessage.author.toLowerCase());
  } catch (ex) { return ""; }
}

function MailAuthorName() {
    return NostalgyHeaderParser.get_address(gDBView.hdrForFirstSelectedMessage.author);
}

function MailRecipName() {
    return NostalgyHeaderParser.get_address(gDBView.hdrForFirstSelectedMessage.recipients);
}

function MailSubject() {
 try {
 var s = gDBView.hdrForFirstSelectedMessage.mime2DecodedSubject.toLowerCase();
 var old;

 do { old = s; s = s.replace(/^\[fwd:|^fwd:|^fw:|^re:|^ |^e :|\]$/g, ""); }
 while (s != old);

 // do { old =s; s = s.replace(/^\[.*\]/g,""); } while (s != old);
 return s;
 } catch (ex) { return ""; }
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
 } catch (ex) { NostalgyDebug("ex:" + ex);  }

if ( nostalgy_completion_options.use_statistical_prediction )
{
 try {
  r = NostalgyPredict.predict_folder(1);
  if (r) { return(r); }
 } catch (ex) { NostalgyDebug("ex:" + ex);  }
}
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
  if (!gDBView) return;
  if (nostalgy_selection_saved) {
    NostalgyRestoreSelection(nostalgy_selection_saved);
    nostalgy_selection_saved = null;
  } else
  try { gDBView.viewIndexForFirstSelectedMsg; } catch (ex) {
/*
    if (!NostalgySelectMessageByNavigationType(nsMsgNavigationType.firstUnreadMessage)) {
    NostalgySelectMessageByNavigationType(nsMsgNavigationType.lastMessage);
  }
*/
  }
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
  var search = "";
  var input = gEBI("searchInput");
  if (input && !input.showingSearchCriteria) search = input.value;
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
      }, 400);
  if (search != "") {
    input.focus();
    input.value = search;
    setTimeout(function(){onEnterInSearchBar(true);}, 200);
  }
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
 register_folder(folder);
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
 register_folder(folder);
 var sel = NostalgySaveSelection();
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else {
     NostalgyPredict.update_folder(folder);
     gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages,folder);
 }
 NostalgyShowFolder(folder);
 nostalgy_selection_saved = null;
 nostalgy_on_move_completed = function() { nostalgy_selection_saved = sel; };
 setTimeout(function () {
   if (!nostalgy_selection_saved) nostalgy_on_move_completed = null;
 }, 1000);
 return true;
}

function NostalgyCopyToFolder(folder) {
 register_folder(folder);
 if (folder.tag) NostalgyToggleMessageTag(folder);
 else {
     NostalgyPredict.update_folder(folder);
     gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages,folder);
 }
 return true;
}

function NostalgySuggested(cmd) {
  if (gsuggest_folder) cmd(gsuggest_folder);
  return true;
}



var NostalgyLastEscapeTimeStamp = 0;

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

function NostalgySaveSelection() {
  var o = { };
  gDBView.getIndicesForSelection(o,{ });
  o = o.value;
  var folder = gDBView.msgFolder;
  var msgids = { };
  for (var i = 0; i < o.length; i++) {
    var id = folder.GetMessageHeader(gDBView.getKeyAt(o[i])).messageId;
    msgids[id] = true;
  }
  return msgids;
}

function NostalgyRestoreSelection(msgids) {
  var msgs;
  if (gDBView.msgFolder.getMessages)
    msgs = gDBView.msgFolder.getMessages(msgWindow);
  else if (gDBView.msgFolder.msgDatabase)
    msgs = gDBView.msgFolder.msgDatabase.EnumerateMessages();

  var selection = gDBView.selection;
  selection.clearSelection();
  while (msgs.hasMoreElements()) {
    var m = msgs.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
    if (msgids[m.messageId]) {
      var idx = gDBView.findIndexFromKey(m.messageKey,true);
      if (!selection.isSelected(idx)) selection.toggleSelect(idx);
    }
  }
}

function NostalgyEscape() {
  NostalgyEscapePressed++;
  var i = NostalgyEscapePressed;
  setTimeout(
    function(){ if (NostalgyEscapePressed==i) NostalgyEscapePressed = 0; },
    300);
  if (NostalgyEscapePressed == 3) {
    // var o = NostalgySaveSelection();

    onClearSearch();
    ViewChange(kViewItemAll, "All");  // TODO: localized string
    setTimeout(NostalgyFocusThreadPane,100);

    // setTimeout(function(){ NostalgyRestoreSelection(o); }, 0);
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

var last_cycle_restrict_value = "";
var last_cycle_restrict = 0;
var last_cycle_saved_searchMode = 0;

function NostalgySearchSender() {
  var input = gEBI("searchInput");
  if (!input) { alert("Nostalgy error:\nCannot perform this action when Quick Search is not enabled"); return false; }
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
  if (last_cycle_restrict == 1) {
      last_cycle_saved_searchMode = input.searchMode;
      input.value = name;
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
  else if (last_cycle_restrict == 2) {
      input.value = subj;
      if (NostalgyIsDefined("kQuickSearchSubject"))
          input.searchMode = kQuickSearchSubject;
      else if (window.QuickSearchConstants)
          input.searchMode = QuickSearchConstants.kQuickSearchSubject;
      else
          alert("Nostalgy error: don't know which QuickSearch criterion to use");
  }
  else
  { last_cycle_restrict = 0; input.value = "";
    input.searchMode = last_cycle_saved_searchMode;
  }
  last_cycle_restrict_value = input.value;
  NostalgySearch();
  SetFocusThreadPane();
  gDBView.selectMsgByKey(key);
  } catch (ex) {
      alert(ex);
   input.focus();
   last_cycle_restrict = 0; NostalgyDoSearch("");
   SetFocusThreadPane();
  }
  return true;
}

function NostalgySearchSelectAll(select) {
  if (!nostalgy_search_focused) return false;

  if (!gEBI("searchInput") || gEBI("searchInput").value == ""
      || gEBI("searchInput").showingSearchCriteria) {
    SetFocusThreadPane();
    return true;
  }

  initializeSearchBar();
  nostalgy_on_search_done = function() {
    nostalgy_on_search_done = null;
    if (select) setTimeout(function(){ gDBView.selection.selectAll(); },0);
    else NostalgySelectLastMsg();
    SetFocusThreadPane();
  };
  if (gSearchTimer) {
    clearTimeout(gSearchTimer);
    gSearchTimer = null;
  }
  gSearchTimer = setTimeout("NostalgySearch();", 0);
  return true;
}

function NostalgyShowSearchMode() {
    var o = NostalgyQuickSearch();
    o.showPopup(gEBI("quick-search-button"),-1,-1,"tooltip",
                "bottomleft", "topleft");
}

function NostalgyQuickSearch() {
  var o = gEBI("quick-search-menupopup");
  if (!o)
      o = document.getAnonymousElementByAttribute(gEBI("searchInput"), "anonid", "quick-search-menupopup");
  return o;
}

function NostalgyEnterSearch() {
  if (window.InitQuickSearchPopup)
      InitQuickSearchPopup();
  nostalgy_search_focused = true;
}
function NostalgyLeaveSearch() {
  nostalgy_search_focused = false;
  var o = NostalgyQuickSearch();
  if (!o) return;
  o.hidePopup();
}

function NostalgySearchMode(current,dir) {
    var input = gEBI("searchInput");
  var popup = NostalgyQuickSearch();
  if (!popup) return;
  var oldmode = popup.getElementsByAttribute('value', current)[0];
  if (!oldmode) oldmode = popup.firstChild;
  var newmode = dir > 0 ? oldmode.nextSibling : oldmode.previousSibling;
  if (!newmode || !newmode.value) newmode = oldmode;
  oldmode.setAttribute('checked','false');
  newmode.setAttribute('checked','true');
  input.searchMode = newmode.value;
  popup.setAttribute("value",newmode.value);
  if (window.InitQuickSearchPopup)
      InitQuickSearchPopup();
  NostalgySearch();
}

function onNostalgyKeyPressCapture(ev) {
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
  //NostalgyDebug("nostalgy_search_focused " + nostalgy_search_focused);
  if (nostalgy_search_focused) {
    if (ev.keyCode == KeyEvent.DOM_VK_DOWN) {
      var i = NostalgyCurrentSearchMode();
      setTimeout(function(){NostalgySearchMode(i,1);},0);
      NostalgyStopEvent(ev);
      return;
    }
    if (ev.keyCode == KeyEvent.DOM_VK_UP) {
      var i = NostalgyCurrentSearchMode();
      setTimeout(function(){NostalgySearchMode(i,-1);},0);
      NostalgyStopEvent(ev);
      return;
    }
    if (ev.keyCode == KeyEvent.DOM_VK_ESCAPE) {
        NostalgyDoSearch("");
        setTimeout(SetFocusThreadPane,0);
        NostalgyStopEvent(ev);
        return;
    }
  }
}


function onNostalgyKeyPress(ev) {
  if (!nostalgy_statusBar.hidden) return;

  if (NostalgyEscapePressed >= 1) {
    if (!in_message_window && ev.charCode == 109) { // M
      NostalgyFocusMessagePane();
      NostalgyStopEvent(ev);
    } else
    if (!in_message_window && ev.charCode == 102) { // F
      document.getElementById("folderTree").focus();
      NostalgyStopEvent(ev);
    } else
    if (!in_message_window && ev.charCode == 105) { // I
      var search = GetSearchInput();
      if (search) search.focus();
      NostalgyStopEvent(ev);
    }
    return;
  }

  var kn = RecognizeKey(ev);
  if (ev.charCode && ev.originalTarget.localName.toLowerCase() == "input"
      && !ev.ctrlKey && !ev.altKey)
    return;
  var k = nostalgy_active_keys[kn];
  if (k && ParseCommand(k)) NostalgyStopEvent(ev);
}

function ParseCommand(k) {
  if (k.indexOf("JS:") == 0)
    return eval(k.substr(3,k.length - 3));

  var spl = k.match(/(.*) -> (.*)/);
  var folder = FindFolderExact(spl[2]);
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
  if (!in_message_window)  {
    NostalgyCmd('Go to folder:', NostalgyShowFolder, false);
    return true;
  } else return false;
}
function NostalgyGoSuggestedCommand() {
  if (!in_message_window)  {
    NostalgySuggested(NostalgyShowFolder);
    return true;
  } else return false;
}

function NostalgySaveAndGo() {
  if (in_message_window) return false;
  NostalgyCmd('Move messages and go to:', NostalgyMoveToFolderAndGo, true);
  return true;
}

function NostalgySaveAndGoSuggested() {
  if (in_message_window) return false;
  NostalgySuggested(NostalgyMoveToFolderAndGo);
  return true;
}

function onNostalgyKeyDown(ev) {
    if (nostalgy_search_focused && gEBI("searchInput").showingSearchCriteria)
        gEBI("searchInput").showingSearchCriteria = false;
    if ((ev.keyCode == KeyEvent.DOM_VK_ALT ||
         ev.keyCode == KeyEvent.DOM_VK_CONTROL)
        && nostalgy_search_focused) NostalgyShowSearchMode();
}
function onNostalgyKeyUp(ev) {
    if ((ev.keyCode == KeyEvent.DOM_VK_ALT ||
         ev.keyCode == KeyEvent.DOM_VK_CONTROL)
        && nostalgy_search_focused
        && !nostalgy_completion_options.always_show_search_mode) {
        var o = NostalgyQuickSearch();
        o.hidePopup();
    }
}

window.addEventListener("load", onNostalgyLoad, false);
window.addEventListener("resize", onNostalgyResize, false);
window.addEventListener("unload", onNostalgyUnload, false);
window.addEventListener("keypress", onNostalgyKeyPress, false);
window.addEventListener("keypress", onNostalgyKeyPressCapture, true);
window.addEventListener("keydown", onNostalgyKeyDown, true);
window.addEventListener("keyup", onNostalgyKeyUp, true);
