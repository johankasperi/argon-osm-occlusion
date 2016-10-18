argon-osm-occlusion
============

Adds [OSM building data](http://wiki.openstreetmap.org/wiki/Buildings) to [Argon.js](http://argonjs.io/) for occlusion with real world buildings. This module queries the [Overpass API](http://overpass-turbo.eu/) for OSM building data, it then converts it to transparent Threejs meshes and adds it to your Argonjs scene.

Status
-----

The state of this module is very experimental. It needs further development and testing before being used in production.

Usage
-----

#### Installation:
```
$ npm install argon-osm-occlusion --save
```

#### Usage:
```javascript
import ArgonOsmOcclusion from 'argon-osm-occlusion'

var app = Argon.init();
var scene = new THREE.Scene();

var argonOsmOcclusion = new ArgonOsmOcclusion(app, scene);
argonOsmOcclusion.add({
  longitude: 59.347457,
  latitude: 18.073780
});
```
Then you edit the renderOrder property of your Three Objects you wish to be affected by the occlusion:
```javascript
var mesh = new THREE.Mesh(geometry, material)
mesh.renderOrder = 2
```
Meshes with renderOrder < 1 (0 is default) will not be affected by this occlusion handling.

API
-----

### `ArgonOsmOcclusion( app, scene )`

The main class for handling all occlusion,

* `app`: Your Argonjs app.
* `scene`: Your Threejs scene.

### Properties

##### `featureGroups`
Array of all feature groups added to the scene. A feature group has the properties:
* `id`: Id of the group.
* `name`: Name of the group.
* `longitude`: Longitude of the bounding circle center.
* `latitude`: Latitude of the bounding circle center.
* `altitude`: Altitude of the added buildings.
* `radius`: Radius of the bounding circle.
* `features`: Array of all the buildings containing its geolocation data.
* `geoObjects`: Array of all the Three objects created from the OSM data, i.e. all the buildings in this bounding circle.
* `geoEntities`: Array of all the Argon.Cesium.Entity created for each building.

### Methods

##### `add(options, callback)`
Queries the Overpass API for OSM building features, converts them to Threejs meshes and adds them to the scene.

* `options`: This method takes to following options:
  * `longitude`: Float. Longitude of the bounding circle center used when querying the Overpass API. Required.
  * `latitude`: Float. Latitude of the bounding circle center used when querying the Overpass API. Required.
  * `altitude`: Float. Altitude (in meters) above the ellipsoid of the added buildings. Default 0. Optional.
  * `radius`: Float. The radius (in meters) of the bounding circle. All buildings within this radius from the longitude/latitude coordinate will be added to the scene. Default 500. Optional.
  * `name`: String. Name of this feature group. Default null. Optional.
* `callback`: Function. Callback returning either error or the id of the created feature group. Optional. Example:
```javascript
argonOsmOcclusion.add({
  longitude: 59.347457,
  latitude: 18.073780
}, function(error, id) {
  if(error) {
    throw error;
  } else {
    featureGroups.push(id)
  }
});
```

#### `remove(id)`
Removes all Threejs objects associated with the provided feature group id from the scene.

* `id`: Int. Id of the feature group to be removed.

#### `removeAll()`
Removes all feature groups from the scene.

#### `setDebug(debug)`
If debug is true it make all added Threejs buildings opaque (with a blue color) for debugging purposes. If false it will make them transparent again.

* ´debug´: Bool.

To do
-----
* Support for more advanced roof shapes. Currently is all roofs flat. (see [OSM-4D/Roof table](http://wiki.openstreetmap.org/wiki/OSM-4D/Roof_table))
* Performance testing.
* Method for setting the fallback of the "building:levels" property. Many buildings in OSM don't have any "building:levels" property reported. And it's this property who determines the height of the Threejs objects added to the scene. The current fallback is 3 levels. Read more at [Key:building:levels](http://wiki.openstreetmap.org/wiki/Key:building:levels)

Author
-----
Johan Kasperi
[kspri.se](http://kspri.se)
Part of my Master Thesis at the [Royal Institute of Technology](http://kth.se)
