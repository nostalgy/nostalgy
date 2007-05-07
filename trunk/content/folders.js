var restrict_to_current_server = false;
var match_only_folder_name = false;
var sort_folders = false;
var match_case_sensitive = false;
var tab_shell_completion = false;

function NostalgyDebug(aText)
{
  var csClass = Components.classes['@mozilla.org/consoleservice;1'];
  var cs = csClass.getService(Components.interfaces.nsIConsoleService);
  cs.logStringMessage(aText);
}

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

function mayLowerCase(s) {
  if (!match_case_sensitive) { return (s.toLowerCase()); } else { return s; }
}

function full_folder_name(folder) {
  if (folder.tag) return (":" + folder.tag);
  var uri = folder.prettyName;
  while (!folder.isServer) {
    folder = folder.parent;
    uri = folder.prettyName + "/" + uri;
  }
  return uri;
}

function short_folder_name(folder) {
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

function nostalgy_prettyName(folder) {
 if (folder.tag) return (":" + folder.tag);
 return folder.prettyName;
}

function folder_name(folder) {
  if (restrict_to_current_server) {
    return(short_folder_name(folder));
  } else {
    return(full_folder_name(folder));
  }
}

function LongestCommonPrefix(s1,s2) {
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
  if (match_only_folder_name) {
    return (mayLowerCase(nostalgy_prettyName(f)).match(reg) ||
            mayLowerCase(folder_name(f)).search(reg) == 0);
  } else {
    return (mayLowerCase(folder_name(f)).match(reg));
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
 items.Clear();

 IterateMatches(text, this.box.shell_completion, function (folder) {
  var newitem = 
   Components.classes[
    "@mozilla.org/autocomplete/item;1"
   ].createInstance(Components.interfaces.nsIAutoCompleteItem);
  newitem.value = NostalgyCrop(folder_name(folder));

  items.AppendElement(newitem);
 });
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
     if (tab_shell_completion) {
       this.shell_completion = true;
       this.value = NostalgyCompleteUnique(this.value); 
       this.processInput();
       killEvent = true;
     }
     else {
       this.clearTimer();
       killEvent = this.keyNavigation(aEvent);
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
  if (killEvent) {
    aEvent.preventDefault();
    aEvent.stopPropagation();
  }
  return true;
}

function NostalgyFolderSelectionBox(box) {
 box.shell_completion = false;
 box.addSession(new NostalgyAutocomplete(box));
 box.processInput = NostalgyProcessInput;  
 box.processKeyPress = NostalgyProcessKeyPress; 
}

/** Looking up folders by name **/

function NostalgyCompleteUnique(s) {
  var nb = 0;
  var ret = "";

  var rexp = NostalgyMakeRegexp(mayLowerCase(s));
  IterateFolders(function (f) {
   var n = mayLowerCase(folder_name(f));
   if (n.search(rexp) == 0) { 
     nb++;
     if (nb == 1) { ret = n; } else { ret = LongestCommonPrefix(ret,n); }
   }
  });
  if (ret) { 
    var f = FindFolderCompleted(ret);
    if (f) {
     if (f.hasSubFolders) { return (folder_name(f) + "/"); }
     else return (folder_name(f)); 
    }
    else { return(ret); }
  } else { return s;  }
}

// Resolve a string coming from a completion box
// 1. check whether uri comes from the completion list (cropped exact uri)
// 2. if not, assume the uri has been typed in by the user
//    and take the first matching folder

function NostalgyResolveFolder(uri) {
  var ret = FindFolderCropped(uri);
  if (ret) { return ret; } else { return (FirstCompletion(uri)); }
}

function FirstCompletion(uri) {
  var ret = null;
  IterateMatches(uri, false, function(f) { ret = f; throw(0); });
  return ret;
}

function FindFolderExact(uri) {
 var ret = null;
 var u = mayLowerCase(uri);
 try {
  IterateFoldersAllServers(function (folder) {
   if (mayLowerCase(full_folder_name(folder)) == u) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

function FindFolderCompleted(uri) {
 var ret = null;
 var u = mayLowerCase(uri);
 try {
  IterateFoldersAllServers(function (folder) {
   if (mayLowerCase(folder_name(folder)) == u) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

function FindFolderCropped(uri) {
 var ret = null;
 try {
  IterateFolders(function (folder) {
   if (NostalgyCrop(folder_name(folder)) == uri) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

/** Folder traversal **/

function IterateFoldersAllServers(f) {
 IterateTags(f);

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

function CompareFolderNames(a,b) { 
  var an = a.prettyName;
  var bn = b.prettyName;
  return ((an < bn) ? -1 : ((an > bn) ? 1 : 0));
}

var sorted_subfolders = new Array();

// ugly: should be passed as argument to IterateFolders-like functions
var nostalgy_search_folder_options = {
   require_file: true  // do we want only folder to which we can copy/move
                       // messages to? (excludes saved search folder)
     
};

function ClearNostalgyCache() {
  sorted_subfolders = new Array();
}

function IterateSubfolders(folder,f) {
 if ((!folder.isServer || !restrict_to_current_server)
     && (folder.canFileMessages || 
         !nostalgy_search_folder_options.require_file))
 { 
  try { f(folder); }
  catch (ex) { if (ex == 1) { return; } else { throw ex; } }
 }
 var arr;
 if (folder.hasSubFolders) {
  if (sort_folders) {
    arr = sorted_subfolders[full_folder_name(folder)];
    if (arr) { for (var n in arr) { IterateSubfolders(arr[n],f); }
                return; }
  }

  var subfolders = folder.GetSubFolders();
  var arr = new Array();
  var done = false;
  while (!done) {
   var subfolder = subfolders.currentItem().
                   QueryInterface(Components.interfaces.nsIMsgFolder);
   if (sort_folders) { arr.push(subfolder); } 
   else { IterateSubfolders(subfolder,f); }
   try {subfolders.next();}
   catch(e) {done = true;}
  }
  if (sort_folders) {
    arr.sort(CompareFolderNames);
    sorted_subfolders[full_folder_name(folder)] = arr;
    for (var n in arr) { IterateSubfolders(arr[n],f); }
  }
 }
}  

function IterateFoldersCurrentServer(f) {
 IterateTags(f);
 var server = gDBView.msgFolder.server;
 IterateSubfolders(server.rootMsgFolder,f);
}

function IterateTags(f) {
 try {
 var tagService = 
  Components.classes["@mozilla.org/messenger/tagservice;1"]
            .getService(Components.interfaces.nsIMsgTagService);
 var tagArray = tagService.getAllTags({});
 } catch (ex) { NostalgyDebug(ex); return; }
 for (var i = 0; i < tagArray.length; i++) f(tagArray[i]);
}

function IterateFolders(f) {
 if (restrict_to_current_server) { IterateFoldersCurrentServer(f); }
 else { IterateFoldersAllServers(f); }
}

function IterateMatches(uri,shell,f) {
  var rexp = NostalgyMakeRegexp(mayLowerCase(uri));

  if (shell) {
    IterateFolders(function (folder) {
     var n = mayLowerCase(folder_name(folder));
     if (n.search(rexp) == 0) { f(folder); throw(1); }
    });
  } else {
    try {
     IterateFolders(function (folder) {
      if (NostalgyFolderMatch(folder,rexp)) { f(folder); }
     });
    } catch (ex) { }
  }
}

