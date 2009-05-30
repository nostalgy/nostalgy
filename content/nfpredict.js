//some variables :
//assuming db file is in user's profile directory:
var myDBFile = 'nfpredict.sqlite';

var myCreateTablesQuery1 = 'CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT, count INTEGER)';
var myCreateTablesQuery2 = 'CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, folder TEXT)';
var myCreateTablesQuery3 = 'CREATE TABLE IF NOT EXISTS probabilities (id INTEGER PRIMARY KEY AUTOINCREMENT, address_id INTEGER, folder_id INTEGER, probability REAL, count INTEGER)';

var myPredictQueryA = 'SELECT avg(probabilities.count*100/addresses.count) as prob,folder FROM addresses,folders,probabilities '+
    'WHERE probabilities.address_id=addresses.id AND  probabilities.folder_id=folders.id AND addresses.address in (';
var myPredictQueryB = ') group by folder order by prob desc limit ';

var myFolderQuery = 'SELECT * FROM folders where folder = ?1';
var myFolderInsert = 'INSERT INTO folders(folder) VALUES(?1);';

var myAddressQuery = 'SELECT * FROM addresses where address = ?1';
var myAddressInsert = 'INSERT INTO addresses(address,count) VALUES(?1,0);';
var myGetAddressCount = 'SELECT count FROM addresses where id = ?1';
var myUpdateAddressCount = 'UPDATE addresses SET count=?2 WHERE id=?1;';

var myProbabilityInsert = 'INSERT INTO probabilities(address_id , folder_id , probability , count) VALUES(?1,?2,?3,?4);';
var myUpdateProbabilityCount = 'UPDATE probabilities SET count=?2, probability=?3 WHERE id=?1;';

var myCountsQuery = 'SELECT distinct addresses.id as address_id, addresses.count as address_count, probabilities.id as probability_id, probabilities.count as probability_count '+
    'FROM addresses, folders, probabilities WHERE addresses.id=probabilities.address_id AND probabilities.folder_id=?1 AND addresses.address=?2;';

var myCountsQueryAll = 'SELECT distinct addresses.id as address_id, addresses.count as address_count, probabilities.id as probability_id, probabilities.count as probability_count FROM addresses, folders, probabilities WHERE addresses.id=probabilities.address_id;';

var myGetMaintValues = 'select probabilities.*,addresses.count as addr_count from probabilities, addresses where probabilities.address_id=addresses.id;';

// For anything other than SELECT statement, use $sqlite.cmd() :

var NostalgyPredict =
{
    inited: false,

    emails: {},

    init: function() {
        this.inited = true;

        var prefs = (Components.classes["@mozilla.org/preferences-service;1"].
                     getService(Components.interfaces.nsIPrefService));

        for (var i = 1; i <= 20; i++) {
            try {
                this.emails[prefs.getCharPref("mail.identity.id" + i + ".useremail")] = 1;
            } catch (ex) { }
        }

        this.createDB(); // Its safe to ask to create the db even if its already set up

        //this.update_probabilites();
    },

    getDBFile: function() {
        return myDBFile;
    },

    createDB: function() {
    // creating a DB:
        $sqlite.cmd(this.getDBFile(),myCreateTablesQuery1);
        $sqlite.cmd(this.getDBFile(),myCreateTablesQuery2);
        $sqlite.cmd(this.getDBFile(),myCreateTablesQuery3);
    },

    dbExists: function() {
        // get profile directory
        var file = (Components.classes["@mozilla.org/file/directory_service;1"].
                    getService(Components.interfaces.nsIProperties).
                    get("ProfD", Components.interfaces.nsIFile));
        file.append(myDBFile);

        return file.exists();
    },

    keep_email: function(s) {
        if (this.emails[s]) return false; else return true;
    },

    predict_folder: function (numPredictions) {
        try {
            if ( this.inited==false )
                this.init();

            if (gDBView!=null) {
                var hdr = gDBView.hdrForFirstSelectedMessage;
                var addresses = (hdr.author + ", " + hdr.recipients + ", " + hdr.ccList).toLowerCase();

                var addrs = "";

                email_re = /(([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+)/;
                var aAdresses = addresses.split(email_re);
                for (var i=0; i < aAdresses.length; i++) {
                    if (aAdresses[i].match(email_re) && this.keep_email(aAdresses[i]) ) {
                        if ( addrs.length != 0 )
                            addrs = addrs + ", ";
                        addrs = addrs + "\'" + aAdresses[i] +  "\'";
                    }
                }
                NostalgyDebug("addrs = " + addrs);
                try {
                    /*
                    var myArray1 = $sqlite.select(this.getDBFile(),myCountsQueryAll);
                    NostalgyDebug("length: "+myArray1.length);
                    for(var i = 0; i < myArray1.length; i++ ) {
                        NostalgyDebug("i = " + i);
                        for (var k in myArray1[i]) {
                            NostalgyDebug("row[" + k + "] = " + myArray1[i][k]);
                        }
                    }
                    */

                    var myArray1 = $sqlite.select(this.getDBFile(),myPredictQueryA+addrs+myPredictQueryB+numPredictions+';');
                    NostalgyDebug(myPredictQueryA+addrs+myPredictQueryB);
                    NostalgyDebug("myArray1.length: "+myArray1.length);
                    if ( myArray1.length > 0 ) {
                        //NostalgyDebug(myArray1[0]['folder'] +": "+myArray1[0]['prob']);
                        for( i = 0; i < myArray1.length; i++ ) {
                            NostalgyDebug(myArray1[i]['folder'] +": "+myArray1[i]['prob']);
                            if ( parseFloat(myArray1[i]['prob']) > 0.5 ) {
                                var uri = myArray1[i]['folder'];

                                var ret = null;
                                var save_req = nostalgy_search_folder_options.require_file;
                                nostalgy_search_folder_options.require_file = false;
                                try {
                                    IterateFoldersAllServers(function (folder) {
                                            //NostalgyDebug(folder.URI);
                                            if (folder.URI == uri) { ret = folder; throw(0); }
                                        });
                                } catch (ex) { }
                                nostalgy_search_folder_options.require_file = save_req;
                                myArray1[i] = ret;
                            }
                            else
                                myArray1[i] = null;
                        }

                        if( numPredictions == 1 ) return myArray1[0];
                        else return myArray1;
                    }
                }
                catch(ex) {
                    NostalgyDebug( ex.toString() );
                }
            }
            else { }
        }
        catch (ex) {
            // gDBView.hdrForFirstSelectedMessage was called without a select message
            //NostalgyDebug( ex.toString() );
        }
        return null;
    },

    find_generic_id: function (value,insertQ,selectQ) {
        while ( true ) {
            var myArray1 = $sqlite.select(this.getDBFile(),selectQ,value);
            if ( myArray1.length >= 1 )
                return myArray1[0]['id'];
            else
                $sqlite.cmd(this.getDBFile(),insertQ,value);
        }
    },

    find_folder_id: function find_folder_id(folder) {
        return this.find_generic_id(folder,myFolderInsert,myFolderQuery);
    },

    find_address_id: function (address) {
        return this.find_generic_id(address,myAddressInsert,myAddressQuery);
    },

    update_probabilites : function() {
        var myArray1 = $sqlite.select(this.getDBFile(),myCountsQueryAll);
        for(var j=0;j<myArray1.length;j++) {
            var addr_count = parseInt(myArray1[j]["address_count"]);
            var prob_count = parseInt(myArray1[j]["probability_count"]);
            var prob = parseFloat(prob_count)/parseFloat(addr_count);

            //NostalgyDebug(myUpdateProbabilityCount+" "+myArray1[j]["probability_id"]+" "+prob_count+" "+prob);
            $sqlite.cmd(this.getDBFile(),myUpdateProbabilityCount,myArray1[j]["probability_id"],prob_count,prob);
        }
    },

    update_folder: function (nsiFolder) {
        if ( this.inited==false )
            this.init();

        var folder = nsiFolder.URI;

        var hdr = gDBView.hdrForFirstSelectedMessage;
        var addresses = (hdr.author + " " + hdr.recipients + " " + hdr.ccList).toLowerCase();


        var folder_id=this.find_folder_id(folder);

        email_re = /(([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+)/;
        var aAdresses = addresses.split(email_re);
        for (var i=0; i < aAdresses.length; i++) {
            //NostalgyDebug(aAdresses[i]);
            if (aAdresses[i].match(email_re) && this.keep_email(aAdresses[i]) ) {
                //NostalgyDebug(myCountsQuery+" "+folder_id+" "+aAdresses[i]);
                var myArray1 = $sqlite.select(this.getDBFile(),myCountsQuery,folder_id,aAdresses[i]);
                if (myArray1.length==0) {
                    // Add address if necessary
                    address_id=this.find_address_id(aAdresses[i]);

                    var myArray2 = $sqlite.select(this.getDBFile(),myGetAddressCount,address_id);
                    if (myArray2.length!=0) { // This should never fail
                        var addr_count = 1+parseInt(myArray2[0]["count"]);
                        var prob_count = 1;
                        var prob = parseFloat(prob_count)/parseFloat(addr_count);

                        //NostalgyDebug(myUpdateAddressCount+" "+address_id+" "+addr_count);
                        $sqlite.cmd(this.getDBFile(),myUpdateAddressCount,address_id,addr_count);

                        $sqlite.cmd(this.getDBFile(),myProbabilityInsert,address_id,folder_id,prob,prob_count);
                    }
                }
                else {
                    //NostalgyDebug(myArray1.length);
                    for(var j=0;j<myArray1.length;j++) {
                        var addr_count = 1+parseInt(myArray1[j]["address_count"]);
                        var prob_count = 1+parseInt(myArray1[j]["probability_count"]);
                        var prob = parseFloat(prob_count)/parseFloat(addr_count);

                        //NostalgyDebug(myUpdateAddressCount+" "+myArray1[j]["address_id"]+" "+addr_count);
                        $sqlite.cmd(this.getDBFile(),myUpdateAddressCount,myArray1[j]["address_id"],addr_count);

                        //NostalgyDebug(myUpdateProbabilityCount,myArray1[j]["probability_id"]+" "+prob_count+" "+prob);
                        $sqlite.cmd(this.getDBFile(),myUpdateProbabilityCount,myArray1[j]["probability_id"],prob_count,prob);
                    }
                }
            }
        }
    }
}
