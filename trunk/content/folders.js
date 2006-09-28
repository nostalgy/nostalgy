var restrict_to_current_server = false;
var match_only_folder_name = false;

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

function full_folder_name(folder) {
  var uri = folder.prettyName;
  while (!folder.isServer) {
    folder = folder.parent;
    uri = folder.prettyName + "/" + uri;
  }
  return uri;
}

function short_folder_name(folder) {
  var uri = folder.prettyName;
  if (folder.isServer) { return uri; }
  folder = folder.parent;
  while (!folder.isServer) {
    uri = folder.prettyName + "/" + uri;
    folder = folder.parent;
  }
  return uri;
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
    return (f.prettyName.toLowerCase().match(reg) ||
            folder_name(f).toLowerCase().search(reg) == 0);
  } else {
    return (folder_name(f).toLowerCase().match(reg));
  }
}

function NostalgyAutocomplete() {
 this.xresults = 
  Components.classes[
   "@mozilla.org/autocomplete/results;1"
  ].getService(Components.interfaces.nsIAutoCompleteResults);
}

NostalgyAutocomplete.prototype.onStartLookup = 
function(text, results, listener) {
 var items = this.xresults.items;
 items.Clear();

 IterateMatches(text, function (folder) {
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
  function() { }
NostalgyAutocomplete.prototype.onAutoComplete = 
  function(text, results, listener){ }

NostalgyAutocomplete.prototype.QueryInterface = 
function(iid) {
 if (iid.equals(Components.interfaces.nsIAutoCompleteSession)) return this;
 throw Components.results.NS_NOINTERFACE;
}

function NostalgyFolderSelectionBox(box) {
 box.addSession(new NostalgyAutocomplete());
}

/** Looking up folders by name **/

function NostalgyCompleteUnique(s) {
  var nb = 0;
  var ret = "";

  var rexp = NostalgyMakeRegexp(s.toLowerCase());
  IterateFolders(function (f) {
   var n = folder_name(f).toLowerCase();
   if (n.search(rexp) == 0) { 
     nb++;
     if (nb == 1) { ret = n; } else { ret = LongestCommonPrefix(ret,n); }
   }
  });
  if (ret) { 
    var f = FindFolderExact(ret);
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
  IterateMatches(uri, function(f) { ret = f; throw(0); });
  return ret;
}

function FindFolderExact(uri) {
 var ret = null;
 var u = uri.toLowerCase();
 try {
  IterateFoldersAllServers(function (folder) {
   if (full_folder_name(folder).toLowerCase() == u) { ret = folder; throw(0); }
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
 if (!folder.isServer || !restrict_to_current_server) { f(folder); }
 if (folder.hasSubFolders) {
  var subfolders = folder.GetSubFolders();
  var arr = new Array();
  var done = false;
  while (!done) {
   var subfolder = subfolders.currentItem().
                   QueryInterface(Components.interfaces.nsIMsgFolder);
   arr.push(subfolder);
   try {subfolders.next();}
   catch(e) {done = true;}
  }

  arr.sort(function (a,b) { 
            var an = a.prettyName;
            var bn = b.prettyName;
            if (an < bn) { return (-1); } else { return 1; }
           });
  var i;
  for (i = 0; i < arr.length; i++) { IterateSubfolders(arr[i],f) }
 }
}  

function IterateFoldersCurrentServer(f) {
 var server = gDBView.msgFolder.server;
 IterateSubfolders(server.rootMsgFolder,f);
}

function IterateFolders(f) {
 if (restrict_to_current_server) { IterateFoldersCurrentServer(f); }
 else { IterateFoldersAllServers(f); }
}

function IterateMatches(uri,f) {
  var ret = null;
  var rexp = NostalgyMakeRegexp(uri.toLowerCase());

  try {
   IterateFolders(function (folder) {
    if (NostalgyFolderMatch(folder,rexp)) { f(folder); }
   });
  } catch (ex) { }
}

