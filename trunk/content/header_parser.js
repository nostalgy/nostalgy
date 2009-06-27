var NostalgyHeaderParser = {
    get_address: function (s) {
        email_re = /(([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+)/
        var a = email_re.exec(s);
        if (a)
            return a[0];
        else
            return null;
    }
}
