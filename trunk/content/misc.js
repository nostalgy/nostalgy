function NostalgyEBI(id) { return document.getElementById(id); }

function NostalgyPrefService() {
  return Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefService);
}

function NostalgyPrefBranch() {
  return Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);
}

function NostalgyDebug(aText)
{
  var csClass = Components.classes['@mozilla.org/consoleservice;1'];
  var cs = csClass.getService(Components.interfaces.nsIConsoleService);
  cs.logStringMessage(aText);
}

function NostalgyStopEvent(ev) {
  ev.preventDefault();
  // ev.stopPropagation();
}

function NostalgyJSONEval(s) {
  if (/^("(\\.|[^"\\\n\r"])*?"|[a-z]+:|[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t])+?$/.test(s)) {
    try {
      return eval('(' + s + ')');
    } catch (e) {
      NostalgyDebug("parseJSON 1: " + s);
      return null;
    }
  } else {
    NostalgyDebug("parseJSON 2:" + s);
    return null;
  }
}

