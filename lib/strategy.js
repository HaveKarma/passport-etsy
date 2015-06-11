/**
 * Module dependencies.
 */
var parse = require('./profile').parse
  , util = require('util')
  , OAuthStrategy = require('passport-oauth1')
  , InternalOAuthError = require('passport-oauth1').InternalOAuthError
  , APIError = require('./errors/apierror');


/**
 * `Strategy` constructor.
 *
 * The Etsy authentication strategy authenticates requests by delegating to
 * Etsy using the OAuth protocol.
 *
 * Applications must supply a `verify` callback which accepts a `token`,
 * `tokenSecret` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options: (from passport-oauth1)
 *
 *   - `requestTokenURL`       URL used to obtain an unauthorized request token
 *   - `accessTokenURL`        URL used to exchange a user-authorized request token for an access token
 *   - `userAuthorizationURL`  URL used to obtain user authorization
 *   - `consumerKey`           identifies client to service provider
 *   - `consumerSecret`        secret used to establish ownership of the consumer key
 *   - `callbackURL`           URL to which the service provider will redirect the user after obtaining authorization
 *   - `passReqToCallback`     when `true`, `req` is the first argument to the verify callback (default: `false`)
 *
 * Examples:
 *
 *     passport.use(new EtsyStrategy({
 *         consumerKey: '{Etsy consumer key, same as "Key String"}',
 *         consumerSecret: '{Etsy shared secret}'
 *         callbackURL: 'https://www.example.net/auth/etsy/callback'
 *       },
 *       function(token, tokenSecret, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  options = options || {};
  options.requestTokenURL = options.requestTokenURL || 'https://openapi.etsy.com/v2/oauth/request_token';
  options.accessTokenURL = options.accessTokenURL || 'https://openapi.etsy.com/v2/oauth/access_token';
  options.userAuthorizationURL = options.userAuthorizationURL || 'https://www.etsy.com/oauth/signin';
  options.sessionKey = options.sessionKey || 'oauth:etsy';
  if ((options.scope) && (options.scope.length > 0)){
      //Etsy wants their scope varaibles passed in with the request token URL.
      var scopeString = '?scope=';
      for (var i = 0; i < options.scope.length; i++) {
          scopeString = scopeString+options.scope[i];
          if (i < options.scope.length - 1) {
              scopeString = scopeString+'%20';
          }
      }
      options.requestTokenURL = options.requestTokenURL + scopeString;
  }
  OAuthStrategy.call(this, options, verify);
  this.name = 'etsy';
  this._userProfileURL = options.userProfileURL || 'https://openapi.etsy.com/v2/users/__SELF__';
  this._skipExtendedUserProfile = (options.skipExtendedUserProfile !== undefined) ? options.skipExtendedUserProfile : false;
}

/**
 * Inherit from `OAuthStrategy`.
 */
util.inherits(Strategy, OAuthStrategy);


/**
 * Authenticate request by delegating to Etsy using OAuth.
 *
 * @param {Object} req
 * @api protected
 */
Strategy.prototype.authenticate = function(req, options) {
  // When a user denies authorization on Etsy, they are presented with a link
  // to return to the application in the following format (where xxx is the
  // value of the request token):
  //
  //     http://www.example.com/auth/twitter/callback?denied=xxx
  //
  // Following the link back to the application is interpreted as an
  // authentication failure.
  if (req.query && req.query.denied) {
    return this.fail();
  }

  // Call the base class for standard OAuth authentication.
  OAuthStrategy.prototype.authenticate.call(this, req, options);
};

/**
 * Retrieve user profile from Etsy.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `id`        (equivalent to `user_id`)
 *   - `username`  (equivalent to `login_name`)
 *   - `emails`  (equivalent to `primary_email`)
 *
 * Note that because Etsy supplies basic profile information in query
 * parameters when redirecting back to the application, loading of Etsy
 * profiles *does not* result in an additional HTTP request, when the
 * `skipExtendedUserProfile` is enabled.
 *
 * @param {String} token
 * @param {String} tokenSecret
 * @param {Object} params
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(token, tokenSecret, params, done) {
  if (!this._skipExtendedUserProfile) {
    var json;

    this._oauth.get(this._userProfileURL + '?user_id=' + params.user_id, token, tokenSecret, function (err, body, res) {
      if (err) {
        if (err.data) {
          try {
            json = JSON.parse(err.data);
          } catch (_) {}
        }

        if (json && json.errors && json.errors.length) {
          var e = json.errors[0];
          return done(new APIError(e.message, e.code));
        }
        return done(new InternalOAuthError('Failed to fetch user profile', err));
      }

      try {
        json = JSON.parse(body);
      } catch (ex) {
        return done(new Error('Failed to parse user profile'));
      }

      var profile = parse(json);
      profile.provider = 'etsy';
      profile._raw = body;
      profile._json = json;

      done(null, profile);
    });
  } else {
    var profile = { provider: 'etsy' };
    profile.id = params.user_id;
    profile.username = params.screen_name;

    done(null, profile);
  }
};

/**
 * Return extra Etsy-specific parameters to be included in the user
 * authorization request.
 *
 * @param {Object} options
 * @return {Object}
 * @api protected
 */
Strategy.prototype.userAuthorizationParams = function(options) {
  var params = {};
  if (options.forceLogin) {
    params.force_login = options.forceLogin;
  }
  if (options.screenName) {
    params.screen_name = options.screenName;
  }
  return params;
};

/**
 * Parse error response from Etsy OAuth endpoint.
 *
 * @param {String} body
 * @param {Number} status
 * @return {Error}
 * @api protected
 */
Strategy.prototype.parseErrorResponse = function(body, status) {
  //@TODO: once we know what the error format is, we can parse it properly
  //       and return just the error message
  return new Error(body);
};


/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
