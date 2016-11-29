import * as THREE from 'three'
import * as Argon from '@argonjs/argon'

var app, scene;
export default class ArgonOsmOcclusion {

    /**
     * @constructor
     * @param {app} Argon app
     * @param {scene} THREE scene
     */
    constructor(_app, _scene) {
      app = _app
      scene = _scene

      this.debugMode = false
      this.featureGroups = []

      // Bind this to methods
      this.add.bind(this)
      this.remove.bind(this)
      this.removeAll.bind(this)
      this.setDebug.bind(this)

      app.updateEvent.addEventListener(this.update.bind(this))
    }

    /**
     * @method
     * @name add
     * @description Function for adding occlusion with real world buildings from OSM around coordinate
     * @param {options} Options
     *        {longitude} Coordinate longitude
     *        {latitude} Coordinate latitude
     *        {altitude} Altitude of the added objects. Default 0. Optional.
     *        {radius} Radius of bounding circle when querying for OSM features. Default 500 m. Optional
     *        {name} Name of this feature group. Optional.
     *        {levels} Fallback number of levels if tag is not available on feature in Overpass API. Optional.
     * @param {callback} Callback with id of the feature group or error. Optional.
     */
    add(options, callback) {
      if(options.longitude == null || options.latitude == null) {
        if(callback) {
          callback({
            message: "Wrong params provided to method. Lng, lat, alt, r required."
          })
        }
        return
      }
      options.altitude = options.altitude != null ? options.altitude : 0
      options.radius = options.radius != null ? options.radius : 500
      options.levels = options.levels != null ? options.levels : 3

      var boundingCircle = '(around:'+options.radius+','+options.latitude+','+options.longitude+')'
      var query = '[out:json];(way["building"]'+boundingCircle+';relation["building"]'+boundingCircle+';);out body;>;out skel qt;'
      query_overpass(query, function(error, data) {
        if(error) {
          if(callback) {
            return callback(error, undefined)
          }
          return;
        }
        var features = []
        data.features.forEach(function(osmFeature) {
          features.push(createFeatureEntities(osmFeature, options.altitude, options.levels))
        })
        var featureGroup = {
          id: this.featureGroups.length,
          name: options.name,
          longitude: options.longitude,
          latitude: options.latitude,
          altitude: options.altitude,
          radius: options.radius,
          levels: options.levels,
          features: features,
          geoObjects: [],
          geoEntities: []
        }
        this.featureGroups.push(featureGroup)
        if(callback) {
          callback(undefined, featureGroup.id)
        }
      }.bind(this))
    }

    /**
     * @method
     * @name remove
     * @description Function for removing all occlusion objects tied to featureGroup in scene
     * @param {id} Id of the feature group which associated occlusion objects should be removed
     */
     remove(id) {
       var featureGroups = this.featureGroups.filter(function(group) { return group.id === id })
       if(featureGroups[0] != null) {
         featureGroups[0].geoObjects.forEach(function(obj) {
           scene.remove(obj);
         }.bind(this))
         this.featureGroups = this.featureGroups.filter(function(group) { return group.is !== id })
       } else {
         console.log("ArgonOsmOcclusion: Cannot remove feature group with id "+id+", it does not exist.")
       }
     }

    /**
     * @method
     * @name removeAll
     * @description Function for removing all occlusion objects in scene
     */
    removeAll() {
      var temp = this.featureGroups
      temp.forEach(function(group) {
        this.remove(group.id)
      }.bind(this))
    }

    /**
     * @method
     * @name enable
     * @description Enables all buildings in the scene
     */
    enable() {
      this.featureGroups.forEach(function(group) {
        group.geoObjects.forEach(function(object) {
          object.visible = true
        })
      })
    }

    /**
     * @method
     * @name disable
     * @description Disables all buildings in the scene
     */
    disable() {
      this.featureGroups.forEach(function(group) {
        group.geoObjects.forEach(function(object) {
          object.visible = false
        })
      })
    }

    /**
     * @method
     * @name setDebug
     * @description Shows/hides all the OSM buildings in the scene
     * @param {debug} Bool
     */
    setDebug(debug) {
      this.debugMode = debug
      this.featureGroups.forEach(function(group) {
        group.geoObjects.forEach(function(geoObject) {
          geoObject.children[0].material.colorWrite = debug
        })
      })
    }

    /**
     * @method
     * @name update
     * @description Triggered on every Argon UpdateEvent
     */
    update() {
      this.featureGroups.forEach(function(group) {
        if(group.geoObjects.length < group.features.length) {
          group.features.forEach(function(feature) {
            if(feature.hasCreatedGeometry == false) {
              var result = createGeometry(feature, this.debugMode, app.context, scene)
              if(result !== null) {
                group.geoEntities.push(result.geoEntity)
                group.geoObjects.push(result.geoObject)
              }
            }
          }.bind(this))
        } else {
          group.geoEntities.forEach(function(geoEntity, index) {
            var targetPose = app.context.getEntityPose(geoEntity)
            group.geoObjects[index].position.copy(targetPose.position)
          }.bind(this))
        }
      }.bind(this))
    }

}

function createFeatureEntities(osmFeature, alt, levelsFallback) {
  if (osmFeature.geometry.type !== "Polygon") {
    return;
  }

  var feature = {
    shape: [],
    holes: [],
    hasCreatedGeometry: false,
    position: null,
    height: 0
  }

  osmFeature.geometry.coordinates.forEach(function(coordinateGroup, index) {
    var entities = []
    coordinateGroup.forEach(function(coordinate, index) {
      var geoEntity = new Argon.Cesium.Entity({
          name: "",
          position: Argon.Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1], alt),
          orientation: Argon.Cesium.Quaternion.IDENTITY
      });
      entities.push(geoEntity);
    })
    if(index == 0) {
      feature.shape = entities
      feature.position = entities[0].position
    } else {
      feature.holes.push(entities)
    }
  })

  var levels = levelsFallback
  if (osmFeature.properties.tags['building:levels']) {
    levels = parseInt(osmFeature.properties.tags['building:levels'])
  }
  if(osmFeature.properties.tags['roof:shape'] && osmFeature.properties.tags['roof:shape'] !== 'flat') {
    levels += 1
  }
  feature.height = levels * 3;

  return feature
}

function getVertices(entites, context) {
  var vertices = []
  entites.forEach(function(entity) {
    var geoPos = context.getEntityPose(entity);
    if(geoPos.poseStatus == 0) {
      return;
    }
    var v = new THREE.Vector2(geoPos.position.x, geoPos.position.z);
    vertices.push(v);
  })
  return vertices;
}

function createGeometry(feature, debug, context, scene) {
  var vertices = getVertices(feature.shape, context);
  if(vertices.length == 0) {
    return null
  }

  var holes = [];
  feature.holes.forEach(function(holeEntites) {
    holes.concat(getVertices(holeEntites, context))
  })

  var shape = new THREE.Shape(vertices, holes);
  var extrudeSettings = { amount: feature.height, step: 1, bevelEnabled: false };
  var geometry = new THREE.ExtrudeGeometry( shape, extrudeSettings )

  geometry.center()
  geometry.rotateX(Math.PI/2)
  geometry.applyMatrix( new THREE.Matrix4().makeTranslation( -geometry.vertices[0].x, geometry.vertices[0].y, -geometry.vertices[0].z ) )

  var material = new THREE.MeshPhongMaterial({
    color: 0x0000ff,
    colorWrite: debug,
    side: THREE.DoubleSide,
    shading: THREE.FlatShading
  });
  var mesh = new THREE.Mesh( geometry, material )
  mesh.renderOrder = 1
  var geoObject = new THREE.Object3D()
  geoObject.add(mesh)
  scene.add(geoObject)

  var geoEntity = new Argon.Cesium.Entity({
      name: "",
      position: feature.position,
      orientation: Argon.Cesium.Quaternion.IDENTITY
  })
  feature.hasCreatedGeometry = true

  return {
    geoObject: geoObject,
    geoEntity: geoEntity
  }
}
