var nostalgy_completion_options = {
  restrict_to_current_server : false,
  match_only_folder_name : false,
  match_only_prefix : false,
  sort_folders : false,
  match_case_sensitive : false,
  tab_shell_completion : false,
  always_include_tags  : false,
  use_statistical_prediction: false
};



/** The set of "recent folder" for Nostalgy **/

var nostalgy_recent_folders = [ ];
var nostalgy_recent_folders_max_size = 5;

function NostalgySaveRecentFolder(recent) {
  NostalgyPrefBranch().
    setCharPref("extensions.nostalgy.recent_folders",
		recent.toSource());
}

function NostalgyInstallRecentFolders() {
  var s = "";
  try { s = NostalgyPrefBranch().
	  getCharPref("extensions.nostalgy.recent_folders"); }
  catch (ex) { return; }
  var a = NostalgyJSONEval(s);
  if (a) nostalgy_recent_folders = a;
  else nostalgy_recent_folders = [ ];
}

function NostalgyRecordRecentFolder(folder) {
  var recent = nostalgy_recent_folders;
  var fname = NostalgyFolderName(folder);
  if (recent.indexOf(fname) >= 0)
    recent = recent.filter(function (elt,idx,arr) {
      return (elt != fname);
    });

  recent.push(fname);
  while (recent.length >  nostalgy_recent_folders_max_size)  recent.shift();
  NostalgySaveRecentFolder(recent);
}


/****/


function NostalgyCrop(s) {
  var len = 120;
  var l = s.length;
  if (l < len) return s;
  var l1 = len / 3;
  return (s.substr(0,l1) + ".." + s.substr(l - 2 * l1, l));
}

function NostalgyMakeRegexp(s) {
  return (new RegExp(s.replace(/\.\./g, ".*"), ""));
}

function NostalgyMayLowerCase(s) {
  if (!nostalgy_completion_options.match_case_sensitive)
    return (s.toLowerCase());
  else
    return s;
}

function NostalgyMayMatchOnlyPrefix(s, reg) {
     if (nostalgy_completion_options.match_only_prefix)
          return NostalgyMayLowerCase(s).search(reg) == 0;
     else
          return NostalgyMayLowerCase(s).match(reg);
}

function NostalgyFullFolderName(folder) {
  if (folder.tag) return (":" + folder.tag);
  var uri = folder.prettyName;
  while (!folder.isServer) {
    folder = folder.parent;
    uri = folder.prettyName + "/" + uri;
  }
  return uri;
}

function NostalgyShortFolderName(folder) {
  if (folder.tag) return (":" + folder.tag);
  var uri = folder.prettyName;
  if (folder.isServer) { return uri; }
  folder = folder.parent;
  while (!folder.isServer) {
    uri = folder.prettyName + "/" + uri;
    folder = folder.parent;
  }
  return uri;
}

function NostalgyPrettyName(folder) {
 if (folder.tag) return (":" + folder.tag);
 return folder.prettyName;
}

function NostalgyFolderName(folder) {
  if (nostalgy_completion_options.restrict_to_current_server) {
    return(NostalgyShortFolderName(folder));
  } else {
    return(NostalgyFullFolderName(folder));
  }
}

function NostalgyLongestCommonPrefix(s1,s2) {
  var i = 0;
  var l = s1.length;
  if (s2.length < l) { l = s2.length; }
  for (i = 0; i < l; i++) {
    if (s1.charAt(i) != s2.charAt(i)) { break; }
  }
  return (s1.substr(0,i));
}

/** Autocompletion of folders **/

function NostalgyFolderMatch(f,reg) {
  if (nostalgy_completion_options.match_only_folder_name) {
    return (NostalgyMayMatchOnlyPrefix(NostalgyPrettyName(f), reg) ||
            NostalgyMayLowerCase(NostalgyFolderName(f)).search(reg) == 0);
  } else {
    return NostalgyMayMatchOnlyPrefix(NostalgyFolderName(f), reg);
  }
}

function NostalgyAutocomplete(box) {
 this.box = box;
 this.xresults =
  Components.classes[
   "@mozilla.org/autocomplete/results;1"
  ].getService(Components.interfaces.nsIAutoCompleteResults);
}

NostalgyAutocomplete.prototype.onStartLookup =
function(text, results, listener) {
 var items = this.xresults.items;
 var nb = 0;
 items.Clear();

 var add_folder = function (fname) {
  var newitem =
   Components.classes[
    "@mozilla.org/autocomplete/item;1"
   ].createInstance(Components.interfaces.nsIAutoCompleteItem);
  newitem.value = NostalgyCrop(fname);

  items.AppendElement(newitem);
  nb++;
 };

 var f = function (folder) { add_folder(NostalgyFolderName(folder)); };
 
 if (text == "") {
	 var added_count=0;
	if ( nostalgy_completion_options.use_statistical_prediction )
	{
		var predictedFolders = null;
		try { predictedFolders = NostalgyPredict.predict_folder(nostalgy_recent_folders_max_size); }
		catch (ex) { }
		if( predictedFolders != null && predictedFolders.length > 0 )
			for( var j = 0; j < predictedFolders.length; j++ )
				if ( added_count < nostalgy_recent_folders_max_size )
				{
					f(predictedFolders[j]);
					added_count++;
				}
	}
	for ( j = 0; j < nostalgy_recent_folders.length; j++)
	{
		var found=0;
		if ( nostalgy_completion_options.use_statistical_prediction && predictedFolders != null && predictedFolders.length > 0)
			for( var i=0; i < predictedFolders.length; i++ )
				if (NostalgyFolderName(predictedFolders[i]) == nostalgy_recent_folders[j] )
					found=1;
		if ( found==0 && added_count < nostalgy_recent_folders_max_size )
		{
			add_folder(nostalgy_recent_folders[j]);
			added_count++;
		}
	}
 } else {
   nostalgy_search_folder_options.do_tags =
     nostalgy_completion_options.always_include_tags ||
     (text.substr(0,1) == ":");
   NostalgyIterateMatches(text, this.box.shell_completion, f);
   if (nb == 0 && !nostalgy_search_folder_options.do_tags) {
     nostalgy_search_folder_options.do_tags = true;
     NostalgyIterateMatches(text, this.box.shell_completion, f);
   }
 }

 this.xresults.searchString = text;
 this.xresults.defaultItemIndex = 0;
 listener.onAutoComplete(this.xresults, 1);
}

NostalgyAutocomplete.prototype.onStopLookup =
  function() {  }
NostalgyAutocomplete.prototype.onAutoComplete =
  function(text, results, listener){ }

NostalgyAutocomplete.prototype.QueryInterface =
function(iid) {
 if (iid.equals(Components.interfaces.nsIAutoCompleteSession)) return this;
 throw Components.results.NS_NOINTERFACE;
}

function NostalgyStartLookup() {
    // Copy from autocomplete.xml, but does not exit early if box is empty
    var str = this.currentSearchString;
    try{

    this.isSearching = true;
    this.mFirstReturn = true;
    this.mSessionReturns = this.sessionCount;
    this.mFailureCount = 0; // For TB 2.0
    this.mFailureItems = 0;
    this.mDefaultMatchFilled = false; // clear out our prefill state.
    this.removeAttribute("noMatchesFound"); // For TB 2.0

    // tell each session to start searching...
    for (var name in this.mSessions)
        try {
            this.mSessions[name].onStartLookup(str, this.mLastResults[name], this.mListeners[name]);
        } catch (e) {
            --this.mSessionReturns;
            this.searchFailed();
        }
    } catch (e) { NostalgyDebug("ERR" + e); }
}

function NostalgyProcessResults(aSessionName, aResults, aStatus) {
 this.clearResults(false); // clear results, but don't repaint yet
 this.mLastResults[aSessionName] = aResults;
 this.autoFillInput(aSessionName, aResults, false);
 this.addResultElements(aSessionName, aResults);
 this.openResultPopup();
}

function NostalgyProcessInput() {
 if (this.ignoreInputEvent)
   return;

 this.userAction = "typing";
 this.mNeedToFinish = true;
 this.mTransientValue = false;
 this.mNeedToComplete = true;
 this.currentSearchString = this.value;
 this.resultsPopup.selectedIndex = null;
 this.removeAttribute("noMatchesFound");

 this.mAutoCompleteTimer =
   setTimeout(this.callListener, this.timeout, this, "startLookup");
}

function NostalgyProcessKeyPress(aEvent) {
  this.mLastKeyCode = aEvent.keyCode;
  var killEvent = false;
  switch (aEvent.keyCode) {
   case KeyEvent.DOM_VK_TAB:
     if (this.getAttribute("normaltab") != "true") {
      if (nostalgy_completion_options.tab_shell_completion) {
       this.shell_completion = true;
       this.value = NostalgyCompleteUnique(this.value);
       this.processInput();
       killEvent = true;
      }
      else {
       this.clearTimer();
       killEvent = this.keyNavigation(aEvent);
      }
     }
     break;

   case KeyEvent.DOM_VK_RETURN:
     killEvent = this.mMenuOpen;
     this.finishAutoComplete(true, true, aEvent);
     this.closeResultPopup();
     break;

   case KeyEvent.DOM_VK_ESCAPE:
     this.clearTimer();
     killEvent = this.mMenuOpen;
     this.undoAutoComplete();
     this.closeResultPopup();
     break;

   case KeyEvent.DOM_VK_PAGE_UP:
   case KeyEvent.DOM_VK_DOWN:
   case KeyEvent.DOM_VK_PAGE_DOWN:
   case KeyEvent.DOM_VK_UP:
     if (!aEvent.ctrlKey && !aEvent.metaKey) {
       this.clearTimer();
       killEvent = this.keyNavigation(aEvent);
     }
     break;
  }
  if (killEvent) NostalgyStopEvent(aEvent);
  return true;
}

function NostalgyFolderSelectionBox(box) {
 var cmd = box.getAttribute("nostalgyfolderbox");
 if (cmd) {
  box.setAttribute("ontextentered",cmd);
  box.setAttribute("ontextcommand",cmd);
  box.setAttribute("maxrows","15");
  box.setAttribute("crop","end");
  box.setAttribute("flex","3");
  box.setAttribute("tabScrolling","false");
 }

 box.shell_completion = false;
 box.addSession(new NostalgyAutocomplete(box));
 box.processInput = NostalgyProcessInput;
 box.processKeyPress = NostalgyProcessKeyPress;
 box.startLookup = NostalgyStartLookup;
}

function NostalgyFolderSelectionBoxes() {
 var e = document.getElementsByTagName("textbox");
 for (var i = 0; i < e.length; i++)
  if (e[i].hasAttribute("nostalgyfolderbox"))
    NostalgyFolderSelectionBox(e[i]);
}

/** Looking up folders by name **/

function NostalgyCompleteUnique(s) {
  var nb = 0;
  var ret = "";

  var rexp = NostalgyMakeRegexp(NostalgyMayLowerCase(s));
  NostalgyIterateFolders(function (f) {
   var n = NostalgyMayLowerCase(NostalgyFolderName(f));
   if (n.search(rexp) == 0) {
     nb++;
     if (nb == 1) { ret = n; } else { ret = NostalgyLongestCommonPrefix(ret,n); }
   }
  });
  if (ret) {
    var f = NostalgyFindFolderCompleted(ret);
    if (f) {
     if (f.hasSubFolders) { return (NostalgyFolderName(f) + "/"); }
     else return (NostalgyFolderName(f));
    }
    else { return(ret); }
  } else { return s;  }
}

// Resolve a string coming from a completion box
// 1. check whether uri comes from the completion list (cropped exact uri)
// 2. if not, assume the uri has been typed in by the user
//    and take the first matching folder

function NostalgyResolveFolder(uri) {
  var ret = NostalgyFindFolderCropped(uri);
  if (ret) { return ret; } else { return (NostalgyFirstCompletion(uri)); }
}

function NostalgyFirstCompletion(uri) {
  var ret = null;
  NostalgyIterateMatches(uri, false, function(f) { ret = f; throw(0); });
  return ret;
}

function NostalgyFindFolderExact(uri) {
    nostalgy_search_folder_options.do_tags = true;
 var ret = null;
 var u = NostalgyMayLowerCase(uri);
 var save_req = nostalgy_search_folder_options.require_file;
 nostalgy_search_folder_options.require_file = false;
 try {
  NostalgyIterateFoldersAllServers(function (folder) {
   if (NostalgyMayLowerCase(NostalgyFullFolderName(folder)) == u) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 nostalgy_search_folder_options.require_file = save_req;
 return ret;
}

function NostalgyFindFolderCompleted(uri) {
 var ret = null;
 var u = NostalgyMayLowerCase(uri);
 try {
  NostalgyIterateFoldersAllServers(function (folder) {
   if (NostalgyMayLowerCase(NostalgyFolderName(folder)) == u) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

function NostalgyFindFolderCropped(uri) {
 var ret = null;
 try {
  NostalgyIterateFolders(function (folder) {
   if (NostalgyCrop(NostalgyFolderName(folder)) == uri) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

/** Folder traversal **/

function NostalgyIterateFoldersAllServers(f) {
 NostalgyIterateTags(f);

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
    NostalgyIterateSubfolders(root,f);
  }
 }
}

function NostalgyCompareFolderNames(a,b) {
  var an = a.prettyName;
  var bn = b.prettyName;
  return ((an < bn) ? -1 : ((an > bn) ? 1 : 0));
}

var nostalgy_sorted_subfolders = new Array();

// ugly: should be passed as argument to NostalgyIterateFolders-like functions
var nostalgy_search_folder_options = {
   require_file: false, // do we want only folder to which we can copy/move
                        // messages to? (excludes saved search folder)
   do_tags: false
};

function ClearNostalgyCache() {
  nostalgy_sorted_subfolders = new Array();
}

function NostalgyIterateSubfolders(folder,f) {
 if ((!folder.isServer ||
      !nostalgy_completion_options.restrict_to_current_server)
     && (folder.canFileMessages ||
         !nostalgy_search_folder_options.require_file))
 {
  try { f(folder); }
  catch (ex) { if (ex == 1) { return; } else { throw ex; } }
 }
 if (!folder.hasSubFolders) return;

 var arr;
 if (nostalgy_completion_options.sort_folders) {
   arr = nostalgy_sorted_subfolders[NostalgyFullFolderName(folder)];
   if (arr) {
       for (var n in arr) NostalgyIterateSubfolders(arr[n],f);
       return;
   }
 }

 if (folder.subFolders) {
     // TB >= 3.0
     var subfolders = folder.subFolders;
     arr = new Array();
     while (subfolders.hasMoreElements()) {
         var subfolder = subfolders.getNext().
             QueryInterface(Components.interfaces.nsIMsgFolder);
         if (nostalgy_completion_options.sort_folders) { arr.push(subfolder); }
         else { NostalgyIterateSubfolders(subfolder,f); }
     }
 } else {
     // TB < 3.0
     var subfolders = folder.GetSubFolders();
     arr = new Array();
     var done = false;
     while (!done) {
         var subfolder = subfolders.currentItem().
             QueryInterface(Components.interfaces.nsIMsgFolder);
         if (nostalgy_completion_options.sort_folders) { arr.push(subfolder); }
         else { NostalgyIterateSubfolders(subfolder,f); }
         try {subfolders.next();}
         catch(e) {done = true;}
     }
 }
 if (nostalgy_completion_options.sort_folders) {
     arr.sort(NostalgyCompareFolderNames);
     nostalgy_sorted_subfolders[NostalgyFullFolderName(folder)] = arr;
     for (var n in arr) NostalgyIterateSubfolders(arr[n],f);
 }
}

function NostalgyIterateFoldersCurrentServer(f) {
 NostalgyIterateTags(f);
 var server = gDBView.msgFolder.server;
 NostalgyIterateSubfolders(server.rootMsgFolder,f);
}

function NostalgyIterateTags(f) {
 if (!nostalgy_search_folder_options.do_tags) return;
 try {
 var tagService =
  Components.classes["@mozilla.org/messenger/tagservice;1"]
            .getService(Components.interfaces.nsIMsgTagService);
 var tagArray = tagService.getAllTags({});
 } catch (ex) { NostalgyDebug(ex); return; }
 for (var i = 0; i < tagArray.length; i++) f(tagArray[i]);
}

function NostalgyIterateFolders(f) {
 if (nostalgy_completion_options.restrict_to_current_server)
   NostalgyIterateFoldersCurrentServer(f);
 else NostalgyIterateFoldersAllServers(f);
}

function NostalgyIterateMatches(uri,shell,f) {
  var rexp = NostalgyMakeRegexp(NostalgyMayLowerCase(uri));

  if (shell) {
    NostalgyIterateFolders(function (folder) {
     var n = NostalgyMayLowerCase(NostalgyFolderName(folder));
     if (n.search(rexp) == 0) { f(folder); throw(1); }
    });
  } else {
    try {
     NostalgyIterateFolders(function (folder) {
      if (NostalgyFolderMatch(folder,rexp)) { f(folder); }
     });
    } catch (ex) { }
  }
}


var nostalgy_gVKNames = null;

function NostalgyRecognizeKey(ev) {
 if (nostalgy_gVKNames == null) {
  nostalgy_gVKNames = [];
  for (var property in KeyEvent)
    nostalgy_gVKNames[KeyEvent[property]] = property.replace("DOM_VK_","");
 }

 var comps = [];
 if(ev.altKey) comps.push("alt");
 if(ev.ctrlKey) comps.push("control");
 if(ev.metaKey) comps.push("meta");
 if(ev.shiftKey) comps.push("shift");

 var k = "";
 if(ev.charCode == 32) k = "SPACE";
 else if(ev.charCode) k = String.fromCharCode(ev.charCode).toUpperCase();
 else k = nostalgy_gVKNames[ev.keyCode];

 if (!k) return "";
 comps.push(k);
 return comps.join(" ");
}

