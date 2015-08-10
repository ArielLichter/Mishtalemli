var Path = require('path');
var FS = require('fs');
var Hapi = require('hapi');
var CONFIGS = require('./configs.js');

// Setup dynamo
var dynamo = require('./dynamoAccessLayer')(CONFIGS);
dynamo.setup();

// Setup ebay
var ebay = require('./ebayAccessLayer')();
ebay.setup(CONFIGS.ebayAppId);
//ebay.searchComputer()

// Setup zap
var zap = require('./zapAccessLayer')();
zap.setup();

// Setup amazon
var amazon = require('./amazonAccessLayer')();
amazon.setup(CONFIGS.credentials);

var server = new Hapi.Server();
server.connection(
    { port: CONFIGS.port,
        routes: {
            files: {
                relativeTo: Path.join(__dirname, 'public')
            }
        }
    }
);

// Save user query in dynamo
function storeSearch(username, zapId) {
    var table = 'Search';
    var keyCondition =
    {
        'UserId': {
            ComparisonOperator: 'EQ',
            AttributeValueList: [{'S': username}]
        }
    };

    dynamo.query(table, keyCondition).then(function (result) {
        // First time search
        if (result.Count == 0) {
            var input = {
                UserId : {S : username},
                ZapId : {S : zapId},
                Rank : {S : '1'}
            }
            dynamo.putItem(table, input).then(function (putItemResult) {
            });
        // Update search rank
        } else {
            var newCount = parseInt(result.Items[0].Rank.S, 10) + 1;
            var key = {UserId : {S : username}, ZapId : {S : zapId}};
            var attributeUpdate = {
                'Rank' : {
                    Action : 'PUT',
                    Value : {S : newCount.toString()}
                }
            }
            dynamo.updateItem(table, key, attributeUpdate).then(function (updateItemResult) {
            });
        }
    });
}

server.views({
    engines: {
        html: require('handlebars')
    },
    relativeTo: __dirname,
    path: './views'
});

// Get static resources from folder 'public'
server.route({
    method: 'GET',
    path: '/{file}.{extension}',
    handler: function (request, reply) {
        var path = request.params.file + '.' + request.params.extension;
        reply.file(path);
    }
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply.view('index.html');
    }
});

server.route({
    method: 'POST',
    path: '/',
    handler: function (request, reply) {
        var table = 'Users';
        // Check if request come from register
        if (request.payload.firstname) {
            var queryData = {
                email: request.payload.email,
                password: request.payload.password,
                firstname: request.payload.firstname,
                lastname: request.payload.lastname,
                birthyear: request.payload.birthyear,
                city: request.payload.city,
                gender: request.payload.gender
            };

            var query = {
                Email: {S: queryData.email},
                Password: {S: queryData.password},
                FirstName: {S: queryData.firstname},
                LastName: {S: queryData.lastname},
                Birthyear: {N: queryData.birthyear},
                City: {S: queryData.city},
                Gender: {SS: [queryData.gender]}
            };

            dynamo.putItem(table, query).then(function (data) {
                return reply.view('index.html');
            });
        }

        // Check if request come from sign in
        else if (request.payload.email) {
            var queryData = {
                email: request.payload.email,
                password: request.payload.password
            };

            //check if user exist in dynamodb
            var query = {Email: {S: queryData.email}};
            dynamo.getItem(table, query).then(function (data) {
                console.log(data);
                if (data && data.Item && data.Item.Password.S == queryData.password) {

                    //user exist, redirect to search page
                    return reply.redirect('search').rewritable(false);
                } else {
                    console.log('user does not exist, please check your input or register!');
                    return reply.view('index.html');
                }
            });
        } else {
            console.log('no email');
            return reply.view('index.html');
        }
    }
});

server.route({
    method: 'POST',
    path: '/search',
    handler: function (request, reply) {
        var username = request.payload.email;
        if (request.payload.search) {
            console.log('zap search start');
            zap.search(request.payload.search).then(function (zapResult) {
                if (zapResult.Id) {
                    storeSearch(username, zapResult.Id);
                }
                console.log('zap search end');
                console.log('ebay search start');
                ebay.search(zapResult.Title).then(function (ebayResult) {
                    console.log('ebay search end');
                    console.log('amazon search start');
                    amazon.search(zapResult.Title).then(function (amazonResult) {
                        console.log('amazon search end');
                        console.log('zapResult: ' + JSON.stringify(zapResult));
                        console.log('ebayResult: ' + JSON.stringify(ebayResult));
                        console.log('amazonResult: ' + JSON.stringify(amazonResult));
                        return reply.view('search.html', {zap: zapResult, ebay: ebayResult, amazon: amazonResult, email: request.payload.email}, {layout: 'layout/layout'});
                    });
                });
            });
        } else {
            console.log('search end');
            return reply.view('search_empty.html', {zap: null, ebay: null, amazon: null, email: request.payload.email}, {layout: 'layout/layout'});
        }
    }
});

server.route({
    method: 'GET',
    path: '/register',
    handler: function (request, reply) {
        // Page requested
        return reply.view('register.html');
    }
});

server.start(function () {
    console.log('Server running at:', server.info.uri);
});