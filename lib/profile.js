/**
 * Parse profile.
 *
 * @param {Object|String} json
 * @return {Object}
 * @api private
 */

/*
Full json response from etsy
{ 
  count: 1,
  results: 
   [ { user_id: {etsy-user-id},
       login_name: '{etsy-login-name}',
       primary_email: '{primariy-etsy-email}',
       creation_tsz: 1413324188,
       referred_by_user_id: null,
       feedback_info: [Object],
       awaiting_feedback_count: 0 } ],
  params: { user_id: '__SELF__' },
  type: 'User',
  pagination: {} 
}
*/
exports.parse = function(json) {
  if ('string' == typeof json) {
    json = JSON.parse(json);
  }
console.log('inside profile.js: ', json);
  var profile = {};
  profile.id = json.results[0].user_id;
  profile.username = json.results[0].login_name;
  profile.emails = json.results[0].primary_email;
  return profile;
};
