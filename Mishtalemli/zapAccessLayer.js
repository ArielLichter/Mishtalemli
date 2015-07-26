module.exports = function () {
    var Promise;
    var cheerio;
    var request;

    function setup() {
        cheerio = require('cheerio');
        request = require('request');
        Promise = require('bluebird');
    }

    //function search(keyword) {
    //    var defer = Promise.defer();
    //    request({
    //        method: 'GET',
    //        url: 'http://www.zap.co.il/search.aspx?keyword=' + keyword
    //    }, function(err, response, html) {
    //        if (err) throw err;
    //        // OK
    //        if (response.statusCode == 200) {
    //            $ = cheerio.load(html);
    //            $('body').find('div').each(function(i, div) {
    //                if (div.attribs.class == 'ProductBox CompareModel') {
    //                    if (i == 72) {
    //                        var modelid = div.attribs['data-model-id'];
    //                        console.log(modelid);
    //                        request({
    //                            method: 'GET',
    //                            url: 'http://www.zap.co.il/model.aspx?modelid=' + modelid
    //                        }, function(err, response, html) {
    //                            if (err) throw err;
    //                            // OK
    //                            if (response.statusCode == 200) {
    //                                $ = cheerio.load(html);
    //                                var priceArray = [];
    //                                $('body').find('div').each(function (i, div) {
    //                                    if (div.attribs.class == 'StoreLine') {
    //                                        div.children.forEach(function(storeline) {
    //                                            if (storeline.attribs) {
    //                                                if (storeline.attribs.class == 'FinalPrice') {
    //                                                    storeline.children.forEach(function (pricediv) {
    //                                                        if (pricediv.attribs) {
    //                                                            if (pricediv.attribs.class == 'PriceNum') {
    //                                                                priceArray.push(pricediv.children[0].data.replace(/ |\n|\r|\r\n/g,''));
    //                                                            }
    //                                                        }
    //                                                    });
    //                                                }
    //                                            }
    //                                        });
    //                                    }
    //                                });
    //                                defer.resolve(priceArray);
    //                            }
    //                        });
    //                    }
    //                }
    //            });
    //        }
    //    });
    //    return defer.promise;
    //}

    function search(keyword) {
        var priceResultsArray = [];
            var defer = Promise.defer();
            request({
                method: 'GET',
                url: 'http://www.zap.co.il/search.aspx?keyword=' + keyword
            }, function(err, response, html) {
                if (err) throw err;
                // OK
                if (response.statusCode == 200) {
                    var modelUri;
                    var counter = 0;
                    $ = cheerio.load(html);
                    $('body').find('div .ProductBox.CompareModel').each(function (i, div) {
                        // For now, takes only the first comparison result
                        if (counter < 1) {
                            counter++;
                            div.children.forEach(function (child) {
                                if (child.attribs) {
                                    if (child.attribs.class == 'Prices') {
                                        $('body').find(child).each(function (i, pricesClass) {
                                            pricesClass.children.forEach(function (pricesChild) {
                                                if (pricesChild.name == 'a') {
                                                    modelUri = pricesChild.attribs.href;
                                                }
                                            });
                                        });
                                    }
                                }
                            });
                        }
                    });
                    request({
                        method: 'GET',
                        url: 'http://www.zap.co.il' + modelUri
                    }, function(err, response, html) {
                        if (err) throw err;
                        // OK
                        if (response.statusCode == 200) {
                            $ = cheerio.load(html);
                            $('body').find('div .FinalPrice').each(function(i, item) {
                                item.children.forEach(function (child) {
                                    if (child.attribs) {
                                        if (child.attribs.class = 'FinalPrice') {
                                            child.children.forEach(function (priceNum) {
                                                var data = priceNum.data;
                                                var res = data.match('[0-9]+,?[0-9]+');
                                                if (res != null) {
                                                    // Price
                                                    priceResultsArray.push(res[0]);
                                                }
                                            });
                                        }
                                    }
                                });
                            });
                            defer.resolve(priceResultsArray);
                        }
                    });
                }
            });

        return defer.promise;
    }

    return {
        setup : setup,
        search : search
    };
};