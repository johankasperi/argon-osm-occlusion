import osmtogeojson from 'osmtogeojson';
import request from 'request';

export function query_overpass(query, cb, options) {
    options = options || {};
    request.post({
      uri: options.overpassUrl || 'http://overpass-api.de/api/interpreter',
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
