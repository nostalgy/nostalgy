function RuleOfItem(item) {
 return ({ folder_name: item.childNodes.item(2).getAttribute("label"),
	   contains: item.childNodes.item(1).getAttribute("label"),
	   field: item.childNodes.item(0).getAttribute("value") });
}

function StrOfRule(rule) {
  return ("{ folder_name: '" + rule.folder_name + 
          "', contains: '" + rule.contains + 
          "', field: '" + rule.field + "' }");
}



function DoEdit() {
  var list = document.getElementById("rules");
  var item = list.selectedItem;
  if (item) {
   window.openDialog("chrome://nostalgy/content/NostalgyEditRule.xul", 
                     "", "centerscreen,chrome,modal,titlebar,resizable=yes",
	             item);
  }
}

function onNostalgyLoad() {
  var o = {x : 1, y : 2};
  alert(o.toString())
}

window.addEventListener("load", onNostalgyLoad, false);