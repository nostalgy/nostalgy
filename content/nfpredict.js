//some variables :
//assuming db file is in user's profile directory:
var nostalgy_DBFile = 'nfpredict.sqlite';

var nostalgy_CreateTablesQuery1 = 'CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT, count INTEGER)';
var nostalgy_CreateTablesQuery2 = 'CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, folder TEXT)';
var nostalgy_CreateTablesQuery3 = 'CREATE TABLE IF NOT EXISTS probabilities (id INTEGER PRIMARY KEY AUTOINCREMENT, address_id INTEGER, folder_id INTEGER, probability REAL, count INTEGER)';
var nostalgy_CreateIndexesQuery1 = 'CREATE INDEX IF NOT EXISTS address_index on addresses(address)';
var nostalgy_CreateIndexesQuery2 = 'CREATE INDEX IF NOT EXISTS folder_index on folders(folder)';
var nostalgy_CreateIndexesQuery3 = 'CREATE INDEX IF NOT EXISTS probabilities_index on probabilities(address_id,folder_id)';

var nostalgy_PredictQueryA = 'SELECT avg(probabilities.count*100/addresses.count) as prob,folder FROM addresses,folders,probabilities '+
    'WHERE probabilities.address_id=addresses.id AND  probabilities.folder_id=folders.id AND addresses.address in (';
var nostalgy_PredictQueryB = ') group by folder order by prob desc limit ';

var nostalgy_FolderQuery = 'SELECT * FROM folders where folder = ?1';
var nostalgy_FolderInsert = 'INSERT INTO folders(folder) VALUES(?1);';

var nostalgy_AddressQuery = 'SELECT * FROM addresses where address = ?1';
var nostalgy_AddressInsert = 'INSERT INTO addresses(address,count) VALUES(?1,0);';
var nostalgy_GetAddressCount = 'SELECT count FROM addresses where id = ?1';
var nostalgy_UpdateAddressCount = 'UPDATE addresses SET count=?2 WHERE id=?1;';

var nostalgy_ProbabilityInsert = 'INSERT INTO probabilities(address_id , folder_id , probability , count) VALUES(?1,?2,?3,?4);';
var nostalgy_UpdateProbabilityCount = 'UPDATE probabilities SET count=?2, probability=?3 WHERE id=?1;';

var nostalgy_CountsQuery = 'SELECT distinct addresses.id as address_id, addresses.count as address_count, probabilities.id as probability_id, probabilities.count as probability_count '+
    'FROM addresses, probabilities WHERE addresses.id=probabilities.address_id AND probabilities.folder_id=?1 AND addresses.address=?2;';

var nostalgy_CountsQueryAll = 'SELECT distinct addresses.id as address_id, addresses.count as address_count, probabilities.id as probability_id, probabilities.count as probability_count FROM addresses, probabilities WHERE addresses.id=probabilities.address_id;';

// For anything other than SELECT statement, use nostalgy_sqlite.cmd() :

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
        return nostalgy_DBFile;
    },

    createDB: function() {
    // creating a DB:
        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_CreateTablesQuery1);
        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_CreateTablesQuery2);
        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_CreateTablesQuery3);
        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_CreateIndexesQuery1);
        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_CreateIndexesQuery2);
        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_CreateIndexesQuery3);
    },

    dbExists: function() {
        // get profile directory
        var file = (Components.classes["@mozilla.org/file/directory_service;1"].
                    getService(Components.interfaces.nsIProperties).
                    get("ProfD", Components.interfaces.nsIFile));
        file.append(nostalgy_DBFile);

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
                //                NostalgyDebug("addrs = " + addrs);
                try {
                    var nostalgy_Array1 = nostalgy_sqlite.select(this.getDBFile(),nostalgy_PredictQueryA+addrs+nostalgy_PredictQueryB+numPredictions+';');
                    //                    NostalgyDebug(nostalgy_PredictQueryA+addrs+nostalgy_PredictQueryB);
                    //                    NostalgyDebug("nostalgy_Array1.length: "+nostalgy_Array1.length);
                    if ( nostalgy_Array1.length > 0 ) {
                        for( i = 0; i < nostalgy_Array1.length; i++ ) {
                            // NostalgyDebug(nostalgy_Array1[i]['folder'] +": "+nostalgy_Array1[i]['prob']);
                            if ( parseFloat(nostalgy_Array1[i]['prob']) > 0.5 ) {
                                var uri = nostalgy_Array1[i]['folder'];

                                var ret = null;
                                var save_req = nostalgy_search_folder_options.require_file;
                                nostalgy_search_folder_options.require_file = false;
                                try {
                                    NostalgyIterateFoldersAllServers(function (folder) {
                                            //NostalgyDebug(folder.URI);
                                            if (folder.URI == uri) { ret = folder; throw(0); }
                                        });
                                } catch (ex) { }
                                nostalgy_search_folder_options.require_file = save_req;
                                nostalgy_Array1[i] = ret;
                            }
                            else
                                nostalgy_Array1[i] = null;
                        }

                        if( numPredictions == 1 ) return nostalgy_Array1[0];
                        else return nostalgy_Array1;
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
        var nostalgy_Array1 = nostalgy_sqlite.select(this.getDBFile(),selectQ,value);
        if ( nostalgy_Array1.length >= 1 ) return nostalgy_Array1[0]['id'];
        nostalgy_sqlite.cmd(this.getDBFile(),insertQ,value);
        nostalgy_Array1 = nostalgy_sqlite.select(this.getDBFile(),selectQ,value);
        if ( nostalgy_Array1.length >= 1 ) return nostalgy_Array1[0]['id'];
        throw "find_generic_id: failure";
    },

    find_folder_id: function find_folder_id(folder) {
        return this.find_generic_id(folder,nostalgy_FolderInsert,nostalgy_FolderQuery);
    },

    find_address_id: function (address) {
        return this.find_generic_id(address,nostalgy_AddressInsert,nostalgy_AddressQuery);
    },

    update_probabilites : function() {
        var nostalgy_Array1 = nostalgy_sqlite.select(this.getDBFile(),nostalgy_CountsQueryAll);
        for(var j=0;j<nostalgy_Array1.length;j++) {
            var addr_count = parseInt(nostalgy_Array1[j]["address_count"]);
            var prob_count = parseInt(nostalgy_Array1[j]["probability_count"]);
            var prob = parseFloat(prob_count)/parseFloat(addr_count);

            //NostalgyDebug(nostalgy_UpdateProbabilityCount+" "+nostalgy_Array1[j]["probability_id"]+" "+prob_count+" "+prob);
            nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_UpdateProbabilityCount,nostalgy_Array1[j]["probability_id"],prob_count,prob);
        }
    },

    update_folder: function (nsiFolder) {
        if (nostalgy_completion_options.use_statistical_prediction==false)
            return;

        if ( this.inited==false )
            this.init();

        var folder = nsiFolder.URI;

        var hdr;
        try {
            hdr = gDBView.hdrForFirstSelectedMessage;
        } catch (ex) { NostalgyDebug("Cannot get header for first message:" + ex); return; }

        var addresses = (hdr.author + " " + hdr.recipients + " " + hdr.ccList).toLowerCase();

        var folder_id=this.find_folder_id(folder);

        email_re = /(([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+)/;
        var aAdresses = addresses.split(email_re);
        //  limit number of addresses to be updated (avoids excessive processing time for large address lists)
        var maxAddresses = 100;
        try {
            maxAddresses = NostalgyGetIntPref("predict_max_addresses_to_update",maxAdresses);
        } catch (ex) { }
        for (var i=0; i < aAdresses.length; i++) {
            //NostalgyDebug(aAdresses[i]);
            if (aAdresses[i].match(email_re) && this.keep_email(aAdresses[i]) && maxAddresses>0 ) {
                maxAddresses--;
                //NostalgyDebug(nostalgy_CountsQuery+" "+folder_id+" "+aAdresses[i]);
                var nostalgy_Array1 = nostalgy_sqlite.select(this.getDBFile(),nostalgy_CountsQuery,folder_id,aAdresses[i]);
                if (nostalgy_Array1.length==0) {
                    // Add address if necessary
                    address_id=this.find_address_id(aAdresses[i]);

                    var nostalgy_Array2 = nostalgy_sqlite.select(this.getDBFile(),nostalgy_GetAddressCount,address_id);
                    if (nostalgy_Array2.length!=0) { // This should never fail
                        var addr_count = 1+parseInt(nostalgy_Array2[0]["count"]);
                        var prob_count = 1;
                        var prob = parseFloat(prob_count)/parseFloat(addr_count);

                        //NostalgyDebug(nostalgy_UpdateAddressCount+" "+address_id+" "+addr_count);
                        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_UpdateAddressCount,address_id,addr_count);

                        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_ProbabilityInsert,address_id,folder_id,prob,prob_count);
                    }
                }
                else {
                    //NostalgyDebug(nostalgy_Array1.length);
                    for(var j=0;j<nostalgy_Array1.length;j++) {
                        var addr_count = 1+parseInt(nostalgy_Array1[j]["address_count"]);
                        var prob_count = 1+parseInt(nostalgy_Array1[j]["probability_count"]);
                        var prob = parseFloat(prob_count)/parseFloat(addr_count);

                        //NostalgyDebug(nostalgy_UpdateAddressCount+" "+nostalgy_Array1[j]["address_id"]+" "+addr_count);
                        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_UpdateAddressCount,nostalgy_Array1[j]["address_id"],addr_count);

                        //NostalgyDebug(nostalgy_UpdateProbabilityCount,nostalgy_Array1[j]["probability_id"]+" "+prob_count+" "+prob);
                        nostalgy_sqlite.cmd(this.getDBFile(),nostalgy_UpdateProbabilityCount,nostalgy_Array1[j]["probability_id"],prob_count,prob);
                    }
                }
            }
        }
    }
}
