import osmtogeojson from 'osmtogeojson';
import request from 'request';

export function query_overpass(query, cb, options) {
    options = options || {};
    var defaultUrl;
    if(window.location.protocol === 'https:') {
      defaultUrl = 'https://overpass-api.de:443/api/interpreter'
    } else {
      defaultUrl = 'http://overpass-api.de:80/api/interpreter'
    }
    request.post({
      url: options.overpassUrl || defaultUrl,
      withCredentials: false
    }, function (error, response, body) {
        var geojson;

        if (!error && response.statusCode === 200) {
            geojson = osmtogeojson(JSON.parse(body), {
                flatProperties: options.flatProperties || false
            });
            cb(undefined, geojson);
        } else if (error) {
            cb(error);
        } else if (response) {
            cb({
                message: 'Request failed: HTTP ' + response.statusCode,
                statusCode: response.statusCode
            });
        } else {
            cb({
                message: 'Unknown error.',
            });
        }
    }).form({
        data: query
    });
};
