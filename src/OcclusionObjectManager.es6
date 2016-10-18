import THREE from 'three'
import * as Argon from '@argonjs/argon'
import { query_overpass } from 'QueryOverpass'

export default class OcclusionObjectManager {

    /**
     * @constructor
     * @param {app} Argon app
     * @param {scene} THREE scene
     */
    constructor(app, scene) {
      this.app = app
      this.scene = scene
      this.featureGroups = []
      this.hasNewFeatureGroup = false

      // Bind this to methods
      this.add.bind(this)
      this.remove.bind(this)
      this.removeAll.bind(this)

      this.addListeners()
    }

    /**
     * @method
     * @name add
     * @description Function for adding occlusion with real world buildings from OSM around coordinate
     * @param {lng} Coordinate longitude
     * @param {lat} Coordinate latitude
     * @param {alt} Altitude of the added objects
     * @param {r} Radius of bounding circle when querying for OSM features.
     * @param {callback} Callback with id of the feature group or error. Optional.
     */
    add(lng, lat, alt, r, callback) {
      if(lng == null || lat == null || alt == null || r == null) {
        return callback({
          message: "Wrong params provided to method. Lng, lat, alt, r required."
        })
      }

      var boundingCircle = '(around:'+r+','+lat+','+lng+')'
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
          features.push(createFeatureEntities(osmFeature, alt))
        })
        var featureGroup = {
          id: this.featureGroups.length,
          features: features,
          geoObjects: [],
          geoEntities: []
        }
        this.featureGroups.push(featureGroup)
        this.hasNewFeatureGroup = true

        return callback(undefined, featureGroup.id)
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
       featureGroup[0].geoObjects.forEach(function(obj) {
         this.scene.remove(obj);
       }.bind(this))
       this.featureGroups = this.featureGroups.filter(function(group) { return group.is !== id })
     }

    /**
     * @method
     * @name removeAll
     * @description Function for removing all occlusion objects in scene
     */
    removeAll() {
      this.hasNewFeatureGroup = false
      var temp = this.featureGroups
      temp.forEach(function(group) {
        group.remove(group)
      }.bind(this))
    }

    /**
     * @method
     * @name addListeners
     */
    addListeners() {
      this.app.updateEvent.addEventListener(this.update.bind(this))
    }

    /**
     * @method
     * @name update
     * @description Triggered on every Argon UpdateEvent
     */
    update() {
      if(this.hasNewFeatureGroup) {
        this.featureGroups.forEach(function(group) {
          group.features.forEach(function(feature) {
            if(feature.hasCreatedGeometry == false) {
              var result = createGeometry(feature, this.app.context)
              if(result !== null) {
                group.geoEntities.push(result.geoEntity)
                group.geoObjects.push(result.geoObject)
                this.scene.add(result.geoObject)
              }
            }
          }.bind(this))
        }.bind(this))
      }

      this.featureGroups.forEach(function(group) {
        group.geoEntities.forEach(function(geoEntity, index) {
          var targetPose = this.app.context.getEntityPose(geoEntity)
          group.geoObjects[index].position.copy(targetPose.position)
        }.bind(this))
      }.bind(this))
    }

}

function createFeatureEntities(osmFeature, alt) {
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

  var levels = 2
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
    var v0 = new THREE.Vector2(geoPos.position.x, geoPos.position.z);
    vertices.push(v0);
  })
  return vertices;
}

function createGeometry(feature, context) {
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
    color: 0x156289,
    emissive: 0x072534,
    side: THREE.DoubleSide,
    shading: THREE.FlatShading
  });
  var mesh = new THREE.Mesh( geometry, material )

  var geoObject = new THREE.Object3D()
  geoObject.add(mesh)

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
