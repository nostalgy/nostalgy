var nostalgy_sqlite = {
    storageService: [],
    mDBConn: [],

    _initService : function(file){
        var db = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
        db.append(file);
        this.storageService[file] = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
        this.mDBConn[file] = (this.storageService[file]).openDatabase(db);

    },

    select : function(file,sql,param){
        if (this.storageService[file]== undefined){
            this._initService(file);
        }
        var ourTransaction = false;
        if ((this.mDBConn[file]).transactionInProgress){
            ourTransaction = true;
            (this.mDBConn[file]).beginTransactionAs((this.mDBConn[file]).TRANSACTION_DEFERRED);
        }
        var statement = (this.mDBConn[file]).createStatement(sql);
        if (param){
            for (var m=2, arg=null; arg=arguments[m]; m++) {
                statement.bindUTF8StringParameter(m-2, arg);
            }
        }
        try{
            var dataset = [];
            while (statement.executeStep()){
                var row = [];
                for(var i=0,k=statement.columnCount; i<k; i++){
                    row[statement.getColumnName(i)] = statement.getUTF8String(i);
                }
                dataset.push(row);
            }
            // return dataset;
        }
        finally {
            statement.reset();
        }
        if (ourTransaction){
            (this.mDBConn[file]).commitTransaction();
        }
        return dataset;
    },


    cmd : function(file,sql,param){
        if (this.storageService[file] == undefined){
            this._initService(file);
        }
        var ourTransaction = false;
        if ((this.mDBConn[file]).transactionInProgress){
            ourTransaction = true;
            (this.mDBConn[file]).beginTransactionAs((this.mDBConn[file]).TRANSACTION_DEFERRED);
        }
        var statement = (this.mDBConn[file]).createStatement(sql);
        if (param){
            for (var m=2, arg=null; arg=arguments[m]; m++) {
                statement.bindUTF8StringParameter(m-2, arg);
            }
        }
        try{
            statement.execute();
        }
        finally {
            statement.reset();
        }
        if (ourTransaction){
            (this.mDBConn[file]).commitTransaction();
        }
    }

}
