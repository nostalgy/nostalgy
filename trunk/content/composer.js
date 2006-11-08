function gEBI(s) { return document.getElementById(s); }

var nostalgy_old_awRecipientKeyPress = 0;

function nostalgy_awRecipientKeyPress(event, element) {
  if (event.charCode == 32 && element.selectionStart == 2) {
    var id = element.id;
    if (id.match(/addressCol2#/)) {
    var select = gEBI(id.replace(/addressCol2#/,"addressCol1#"));
    var v = element.value;
    var u = v.replace(/ >> .*/, "");
    var f = v.substr(0,2);
    if (f == "to" || f == "cc") {
	select.value = "addr_" + f;
	element.value = "";
	setTimeout(function(){
	  element.value = u.substr(2,u.length - 2);
 	  element.selectionStart = 0; element.selectionEnd = 0;
        }, 0);
	event.preventBubble();
	event.stopPropagation();
	return;
    }
    }
  }
  nostalgy_old_awRecipientKeyPress(event, element);
}

function onNostalgyLoad(){
  var tbox = gEBI("addressingWidget");
  nostalgy_old_awRecipientKeyPress = window.awRecipientKeyPress;
  window.awRecipientKeyPress = nostalgy_awRecipientKeyPress;
}

window.addEventListener("load", onNostalgyLoad, false);
