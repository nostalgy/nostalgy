function NostalgyCrop(s,len) {
  var l = s.length;
  if (l < len) return s;
  var l1 = len / 3;
  return (s.substr(0,l1) + ".." + s.substr(l - 2 * l1, l));
}

function NostalgyMakeRegexp(s) {
  return (new RegExp(s.replace(/\.\./g, ".*"), ""));
}


function folder_name(folder) {
  var uri = folder.prettyName;
  while (!folder.isServer) {
    folder = folder.parent;
    uri = folder.prettyName + "/" + uri;
  }
  return uri;
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

function myautocomplete() {
 this.xresults = 
  Components.classes[
   "@mozilla.org/autocomplete/results;1"
  ].getService(Components.interfaces.nsIAutoCompleteResults);
}

myautocomplete.prototype.onStartLookup = function(text, results, listener) {
 var items = this.xresults.items;
 items.Clear();
 var ltext = NostalgyMakeRegexp(text.toLowerCase());

 var addItem = function (folder) {
  var fname = folder_name(folder);
  if (! fname.toLowerCase().match(ltext)) { return; }
  var newitem = 
   Components.classes[
    "@mozilla.org/autocomplete/item;1"
   ].createInstance(Components.interfaces.nsIAutoCompleteItem);
  newitem.value = NostalgyCrop(fname,120);

  items.AppendElement(newitem);
 };
 IterateFolders(addItem);
 this.xresults.searchString = text;
 this.xresults.defaultItemIndex = 0;
 listener.onAutoComplete(this.xresults, 1);
}

myautocomplete.prototype.onStopLookup = function() { }
myautocomplete.prototype.onAutoComplete = function(text, results, listener){ }

myautocomplete.prototype.QueryInterface = function(iid) {
 if (iid.equals(Components.interfaces.nsIAutoCompleteSession)) return this;
 throw Components.results.NS_NOINTERFACE;
}

/**  Folder traversal **/

// If the completion is unique, return it. Otherwise, set
// the value of the inputbox to the longest common prefix for all
// the completions, and return null.

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
  if (ret) { return ret; } else { return s; }
}

function FirstCompletion(uri) {
  var nb = 0;
  var ret = null;

  var rexp = NostalgyMakeRegexp(uri.toLowerCase());
  IterateFolders(function (f) {
   if (folder_name(f).toLowerCase().match(rexp)) { 
     nb++;
     if (nb == 1) { ret = f; }
   }
  });
  return ret;
}

function NostalgyComplete(uri,box)
{
 return (FirstCompletion(uri));
}

function FindFolder(uri)
{
 var ret = null;
 uri = uri.toLowerCase();
 try {
  IterateFolders(function (folder) {
   if (folder_name(folder).toLowerCase() == uri) { ret = folder; throw(0); }
  });
  IterateFolders(function (folder) {
   if (folder_name(folder).toLowerCase().indexOf(uri) >= 0) { ret = folder; throw(0); }
  });
 } catch (ex) { }
 return ret;
}

function IterateFolders(f) {
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
 if (!folder.isServer) { f(folder); }
 if (folder.hasSubFolders) {
  var subfolders = folder.GetSubFolders();
  var done = false;
  while (!done) {
   var subfolder = subfolders.currentItem().
                   QueryInterface(Components.interfaces.nsIMsgFolder);
   IterateSubfolders(subfolder,f);
   try {subfolders.next();}
   catch(e) {done = true;}
  }
 }
}  

