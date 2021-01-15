/**
 * @param {string} s
 * @returns {Element}
 */
function NostalgyEBI(s) { return document.getElementById(s); }

/**
 * Holds the previous handler for keyboard input into the composer's recipient fields.
 *
 * @type {function|null}
 */
var nostalgy_old_awRecipientKeyPress = null;

/**
 * Reacts to keyboard input into the composer's recipient fields.
 *
 * Allows typing "to ", "cc " or "bcc " to change the current recipient's type.
 *
 * @param {KeyboardEvent} event
 * @param {Element} element
 * @returns {void}
 */
function nostalgy_awRecipientKeyPress(event, element) {
  var id = element.id;
  if (id.match(/addressCol2#/)) {
  var select = NostalgyEBI(id.replace(/addressCol2#/,"addressCol1#"));
  var v = element.value;
  var u = v.replace(/ >> .*/, "");
  var i = element.selectionStart;
  var f = v.substr(0,i);
  // charCode 32 = Space
  if (event.charCode == 32 && (f == "to" || f == "cc" || f == "bcc")) {
    select.value = "addr_" + f;
    element.value = "";
    setTimeout(function(){
      element.value = u.substr(i,u.length - i);
      element.selectionStart = 0; element.selectionEnd = 0;
    }, 0);
    NostalgyStopEvent(event);
    return;
  }
  }
  nostalgy_old_awRecipientKeyPress(event, element);
}

/**
 * @type {number}
 */
var NostalgyEscapePressed = 0;

/**
 * @returns {void}
 */
function NostalgyEscape() {
  NostalgyEscapePressed++;
  var i = NostalgyEscapePressed;
  setTimeout(
    function(){ if (NostalgyEscapePressed==i) NostalgyEscapePressed = 0; },
    300);
  if (NostalgyEscapePressed == 2) setTimeout(SetMsgBodyFrameFocus,0);
}

/**
 * Reacts to global keyboard events.
 *
 * Provides the shortcut <kbd>ESC</kbd> + <kbd>A</kbd> to add an attachment.
 *
 * @param {KeyboardEvent} ev
 * @returns {void}
 */
function NostalgyKeyPress(ev) {
  if (ev.keyCode == KeyEvent.DOM_VK_ESCAPE) { NostalgyEscape(); }
  else if (NostalgyEscapePressed >= 1) {
    if (ev.charCode == 97) { // A
      goDoCommand('cmd_attachFile');
      NostalgyStopEvent(ev);
    }
  }
}


/**
 * @returns {void}
 */
function onNostalgyLoadComp(){
  nostalgy_old_awRecipientKeyPress = window.awRecipientKeyPress;
  window.awRecipientKeyPress = nostalgy_awRecipientKeyPress;
  window.addEventListener("keypress", NostalgyKeyPress, false);
}

window.addEventListener("load", onNostalgyLoadComp, false);
