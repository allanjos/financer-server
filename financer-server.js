'use strict';

console.log("Financer server");

// Global objects and constants

var http = require('http');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');
var mongojs = require('mongojs');
var debug = require('debug')('financer:db');
var config = require('config');

const SERVER_HTTP_LISTEN_PORT = 8000;
const SERVER_HTTPS_LISTEN_PORT = 8443;

var httpsOptions = {
    key: fs.readFileSync(''),
    cert: fs.readFileSync('')
};

// Database connection

function dbconnection() {
  var username =  config.get('mongo.username'),
      password = config.get('mongo.password'),
      server = config.get('mongo.server'),
      port = config.get('mongo.port'),
      database = config.get('mongo.database'),
      auth = username ? username + ':' + password + '@': '';

  return 'mongodb://' + auth + server + ':' + port + '/' + database;
}

console.log('db connection: ' + dbconnection());

var db = mongojs(dbconnection());

db.on('error', function(err) {
  console.log('database connection error')
  debug(err);
});

db.on('connect', function () {
  console.log('database connected')
})

module.exports = db;

// HTTP server

http.createServer(onRequest).listen(SERVER_HTTP_LISTEN_PORT);

function onRequest(request, response) {
  console.log("HTTP request.");

  appHandleRequest(request, response);
}

// HTTPS server

https.createServer(httpsOptions, function(request, response) {
  console.log("HTTPS request.");

  appHandleRequest(request, response);
}).listen(SERVER_HTTPS_LISTEN_PORT);

// Handle request

function appHandleRequest(request, response) {
  if (request.method != null )
    console.log("request method: " + request.method);

  if (request.url != null)
    console.log("request url: " + request.url);

  // Handle request
  if (request.method == 'GET') {
    switch (request.url) {
      // Expenses requested
      case '/expenses':
        handleExpensesListRequest(request, response);

        break;

      // Quotes requested
      case '/quotes':

        handleQuotesListRequest();

        break;

      default:

        console.log("response not found. request url unhandled");

        responseNotFound(response);
    }
  }
  else if (request.method == 'POST') {
    switch (request.url) {
      // Expenses requested
      case '/expense/new':
        handleExpenseNewRequest(request, response);

        break;

      case '/expense/delete':
        handleExpenseDeleteRequest(request, response);

        break;
    }
  }
  else {
    responseNotFound(response);
  }
}

function handleExpensesListRequest(request, response) {
  let body = [];

  // Request error
  request.on('error', function(err) {
    responseError(response);
  });

  request.on('data', function(chunk) {
    console.log("request on data");

    // Data flood
    if (body.length > 1e6) {
      console.log("Data flood");
      request.connection.destroy();
      return;
    }

    body.push(chunk);
  });

  request.on('end', function() {
    console.log("request on end");
    console.log("body: " + body);
    body = Buffer.concat(body).toString();
    console.log("body concat: " + body);

    let expense_collection = db.collection('expense');

    let expenses_collection_data = expense_collection.find().sort({name: 1}, function (err, docs) {
        if (err)
          throw new Error(err);

        console.log('DOCS', docs);

        let obj_response = {
          response: "expenses",
          status: 1,
          content: docs
        };

        let body_str = JSON.stringify(obj_response);

        sendResponse(response, body_str);
    });
  });
}

function handleQuotesListRequest(request, response) {
  let body = [];

  // Request error
  request.on('error', function(err) {
    responseError(response);
  });

  request.on('data', function(chunk) {
    console.log("request on data");

    // Data flood
    if (body.length > 1e6) {
      console.log("Data flood");
      request.connection.destroy();
      return;
    }

    body.push(chunk);
  });

  request.on('end', function() {
    console.log("request on end");
    console.log("body: " + body);
    body = Buffer.concat(body).toString();
    console.log("body concat: " + body);

    let obj_response = {
      response: "quotes",
      status: 1,
      content: [
        {
          quote: "^BVSP"
        }
      ]
    };

    let body_str = JSON.stringify(obj_response);

    sendResponse(response, body_str);
  });
}

function handleExpenseNewRequest(request, response) {
  console.log('handleExpenseNewRequest()');

  let body = [];

  // Request error
  request.on('error', function(err) {
    console.log('request.error');

    responseError(response);
  });

  request.on('data', function(chunk) {
    console.log('request.data');

    // Data flood
    // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
    if (body.length > 1e6) {
      console.log("Data flood");
      request.connection.destroy();
      return;
    }

    body.push(chunk);
  });

  request.on('end', function() {
    console.log('request.end');

    //let post = qs.parse(body);

    console.log('body: ' + body);

    //body = Buffer.concat(body).toString();

    console.log("body concat: " + body);

    let bodyStr = Buffer.concat(body).toString();

    let fields = {};

    let props = bodyStr.split('&');

    for (let i = 0; i < props.length; i++) {
      let [name, value] = props[i].split('=');

      fields[name] = value;

      console.log('fields[' + name + '] = ' + fields[name]);
    }

    registerNewExpense(response, fields);
  });
}

function registerNewExpense(response, fields) {
  let expense_collection = db.collection('expense');

  let expenses_collection_data = expense_collection.insert(fields,
                                                           expenseInsertCallback.bind({response: response}));
}

function expenseInsertCallback(err, result) {
  if (err) {
    throw err;
  }

  let obj_response = {
    response: "expense_new",
    status: 0
  };

  let body_str = JSON.stringify(obj_response);

  sendResponse(this.response, body_str);
}

function handleExpenseDeleteRequest(request, response) {
  console.log('handleExpenseDeleteRequest()');

  let body = [];

  request.on('error', function (e) {
    console.log('Error.');
    console.log(e);
  });

  request.on('data', function (chunk) {
    console.log('request on data');

    // Data flood
    // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
    if (body.length > 1e6) {
      console.log("Data flood");
      request.connection.destroy();
      return;
    }

    body.push(chunk);
  });

  request.on('end', function () {
    console.log('request on end');

    //let post = qs.parse(body);

    console.log('body: ' + body);

    //body = Buffer.concat(body).toString();

    console.log("body concat: " + body);

    let bodyStr = Buffer.concat(body).toString();

    let fields = {};

    let props = bodyStr.split('&');

    for (let i = 0; i < props.length; i++) {
      let [name, value] = props[i].split('=');

      fields[name] = value;

      console.log('fields[' + name + '] = ' + fields[name]);
    }

    expenseDelete(response, fields);
  });
}

function expenseDelete(response, fields) {
  console.log('expenseDelete()');

  /* for (var name in fields) {
    if (fields.hasOwnProperty(name)) {
      console.log("fields[" + name + "] = " + fields[name]);
    }
  }
  */

  console.log('ID of the expense to delete: ' + fields['id']);

  let expense_collection = db.collection('expense');

  expense_collection.remove({ "_id": db.ObjectId(fields['id']) },
                            expenseDeleteCallback.bind({response: response}));
}

function expenseDeleteCallback(err, docs) {
  console.log('expenseDeleteCallback()');
  console.log('docs: ' + docs);

  if (err) {
    console.log('Error on deletion');
    responseError(this.response);
    return;
  }

  console.log('No error on deletion');

  let obj_response = {
    response: "expense_delete",
    status: 0,
    content: docs
  };

  let body_str = JSON.stringify(obj_response);

  sendResponse(this.response, body_str);
}

function responseNotFound(response) {
  console.log("response not found");

  let obj_response = {
    response: "notfound",
    status: 0
  };

  let body_str = JSON.stringify(obj_response);

  sendResponse(response, body_str);
}

function responseError(response) {
  console.log("response error");

  let obj_response = {
    response: "error",
    status: 0
  };

  let body_str = JSON.stringify(obj_response);

  sendResponse(response, body_str);
}

function sendResponse(response, body_str) {
  console.log("sendResponse()");
  console.log("response body: " + body_str);
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.end(body_str);
}
