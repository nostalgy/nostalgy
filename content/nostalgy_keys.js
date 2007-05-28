var nostalgy_keys = [
  ["save","Save message","S", 
   "JS:NostalgyCmd('Move messages to:', NostalgyMoveToFolder, true);"],
  ["save_suggest","Save as suggested","shift S", 
   "JS:NostalgySuggested(NostalgyMoveToFolder);"],
  ["copy","Copy message","C",
   "JS:NostalgyCmd('Copy messages to:', NostalgyCopyToFolder, true);"],
  ["copy_suggest","Copy as suggested","shift C",
   "JS:NostalgySuggested(NostalgyCopyToFolder);"],
  ["go","Go to folder","G",
   "JS:NostalgyGoCommand();"],
  ["go_suggest","Go as suggested","shift G",
   "JS:NostalgyGoSuggestedCommand();"],
  ["hide_folders","Hide folder pane","L",
   "JS:NostalgyCollapseFolderPane();"],
  ["search_sender","Show messages with same sender/same subject","`",
   "JS:NostalgySearchSender();"]
];

