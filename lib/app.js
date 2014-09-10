var ripple =    require('ripple-lib');
var express =   require('express');
var config =    require('./config-loader');
var remote =    require('./remote.js');
var respond =   require('./response-handler.js');
var api =       require('./../api');
var app =       express();

// Exporting the express app object
module.exports = app;

// Attaching the ripple remote class to the express app object so we can call it to connect
// TODO: reconsider this approach
app.remote = remote;

app.configure(function() {
  app.disable('x-powered-by');

  if (config.get('NODE_ENV') !== 'production' || config.get('debug')) {
    app.set('json spaces', 2);

    // TODO: consolidate logging format
    app.use(express.logger(':method :url (:response-time ms)'));
  }

  app.use(express.json());
  app.use(express.urlencoded());
});

// Check if there's a connected rippled
app.use(function(request, response, next) {
  if (remote._connected) {
    next();
  } else {
    respond.rippledConnectionError(response);
  }
});

app.use(function(req, res, next){
  var match = req.path.match(/\/api\/(.*)/);
  if (match) {
    res.redirect(match[1]);
  } else {
    next();
  }
});

function validateAddressParam(param) {
  return function(req, res, next, address) {
    if (ripple.UInt160.is_valid(address)) {
      next();
    } else {
      respond.invalidRequest(res, 'Specified address is invalid: ' + param);
    }
  };
}

app.param('account', validateAddressParam('account'));
app.param('destination_account', validateAddressParam('destination account'));

app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  next();
});


/**** **** **** **** ****/

/* Endpoints */
app.get('/', function(req, res) {
  res.redirect('/v1');
});

app.get('/v1', function(req, res) {
  var url_base = '/v1';

  respond.success(res,
    {
      name: 'ripple-rest',
      version: '1',
      documentation: 'https://github.com/ripple/ripple-rest',
      endpoints: {
        submit_payment:         url_base + '/payments',
        payment_paths:          url_base + '/accounts/{address}/payments/paths/{destination_account}/{destination_amount as value+currency or value+currency+issuer}',
        account_payments:       url_base + '/accounts/{address}/payments/{hash,client_resource_id}{?direction,exclude_failed}',
        account_notifications:  url_base + '/accounts/{address}/notifications/{hash,client_resource_id}',
        account_balances:       url_base + '/accounts/{address}/balances',
        account_settings:       url_base + '/accounts/{address}/settings',
        account_trustlines:     url_base + '/accounts/{address}/trustlines',
        ripple_transactions:    url_base + '/transactions/{hash}',
        server_status:          url_base + '/server',
        server_connected:       url_base + '/server/connected',
        uuid_generator:         url_base + '/uuid'
      }
    }
  );

});

/* Info - Server */
app.get('/v1/server', api.info.serverStatus);
app.get('/v1/server/connected', api.info.isConnected);

/* Info - Utils */
app.get('/v1/uuid', api.info.uuid);

/* Balances */
app.get('/v1/accounts/:account/balances', api.balances.get);

/* ---- TODO: use http_utils for response ----- */

/* Payments */
app.post('/v1/payments', api.payments.submit);
app.post('/v1/accounts/:account/payments', api.payments.submit);

app.get('/v1/accounts/:account/payments', api.payments.getAccountPayments);
app.get('/v1/accounts/:account/payments/:identifier', api.payments.get);
app.get('/v1/accounts/:account/payments/paths/:destination_account/:destination_amount_string', api.payments.getPathFind);

/* Notifications */
app.get('/v1/accounts/:account/notifications', api.notifications.getNotification);
app.get('/v1/accounts/:account/notifications/:identifier', api.notifications.getNotification);

/* Settings */
app.get('/v1/accounts/:account/settings', api.settings.get);
app.post('/v1/accounts/:account/settings', api.settings.change);

/* Standard Ripple Transactions */
app.get('/v1/tx/:identifier', api.transactions.get);
app.get('/v1/transaction/:identifier', api.transactions.get);
app.get('/v1/transactions/:identifier', api.transactions.get);

/* Trust lines */
app.get('/v1/accounts/:account/trustlines', api.trustlines.get);
app.post('/v1/accounts/:account/trustlines', api.trustlines.add);

/* Error handler */
app.use(require('./error-handler'));
