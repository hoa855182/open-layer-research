import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import {fromLonLat} from 'ol/proj.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import Fill from 'ol/style/Fill.js';
import RegularShape from 'ol/style/RegularShape.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import {unByKey} from 'ol/Observable.js';
import Overlay from 'ol/Overlay.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Draw from 'ol/interaction/Draw.js';
import {getArea, getLength} from 'ol/sphere.js';
import CircleStyle from 'ol/style/Circle.js';

const shaft = new RegularShape({
  points: 2,
  radius: 5,
  stroke: new Stroke({
    width: 2,
    color: 'black',
  }),
  rotateWithView: true,
});

const head = new RegularShape({
  points: 3,
  radius: 5,
  fill: new Fill({
    color: 'black',
  }),
  rotateWithView: true,
});

const styles = [new Style({image: shaft}), new Style({image: head})];

const source = new VectorSource({
  attributions:
    'Weather data by <a href="https://openweathermap.org/current">OpenWeather</a>',
});

// Style for the static vector layer
const vector = new VectorLayer({
  source: source,
  style: new Style({
    fill: new Fill({
      color: 'rgba(255, 255, 255, 0.2)',
    }),
    stroke: new Stroke({
      color: '#ffcc33',
      width: 2,
    }),
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({
        color: '#ffcc33',
      }),
    }),
  }),
});

// Dynamic style for wind direction
const windLayer = new VectorLayer({
  source: source,
  style: function (feature) {
    const wind = feature.get('wind');
    if (!wind) return null;

    const angle = ((wind.deg - 180) * Math.PI) / 180;
    const scale = wind.speed / 10;

    const shaft = new Style({
      stroke: new Stroke({
        color: '#3399CC',
        width: 2,
      }),
    });

    const head = new Style({
      image: new CircleStyle({
        radius: 4,
        fill: new Fill({ color: '#3399CC' }),
      }),
      geometry: function (feature) {
        const geom = feature.getGeometry();
        const coords = geom.getCoordinates();
        const offset = [
          Math.sin(angle) * (10 * scale),
          Math.cos(angle) * (10 * scale),
        ];
        return new Point([coords[0] + offset[0], coords[1] + offset[1]]);
      },
    });

    return [shaft, head];
  },
});

// Final map object
const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    windLayer,
    vector,
  ],
  view: new View({
    center: [0, 0],
    zoom: 2,
  }),
});


fetch('https://openlayers.org/en/latest/examples/data/openweather/weather.json')
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    const features = [];
    data.list.forEach(function (report) {
      const feature = new Feature(
        new Point(fromLonLat([report.coord.lon, report.coord.lat])),
      );
      feature.setProperties(report);
      features.push(feature);
    });
    source.addFeatures(features);
    map.getView().fit(source.getExtent());
  });





let sketch;

// /**
//  * The help tooltip element.
//  * @type {HTMLElement}
//  */
let helpTooltipElement;

// /**
//  * Overlay to show the help messages.
//  * @type {Overlay}
//  */
let helpTooltip;

// /**
//  * The measure tooltip element.
//  * @type {HTMLElement}
//  */
let measureTooltipElement;

// /**
//  * Overlay to show the measurement.
//  * @type {Overlay}
//  */
let measureTooltip;

// /**
//  * Message to show when the user is drawing a polygon.
//  * @type {string}
//  */
const continuePolygonMsg = 'Click to continue drawing the polygon';

// /**
//  * Message to show when the user is drawing a line.
//  * @type {string}
//  */
const continueLineMsg = 'Click to continue drawing the line';

// /**
//  * Handle pointer move.
//  * @param {import('../src/ol/MapBrowserEvent').default} evt The event.
//  */
const pointerMoveHandler = function (evt) {
  if (evt.dragging) {
    return;
  }

  let helpMsg = 'Click to start drawing';

  if (sketch) {
    const geom = sketch.getGeometry();
    if (geom instanceof Polygon) {
      helpMsg = continuePolygonMsg;
    } else if (geom instanceof LineString) {
      helpMsg = continueLineMsg;
    }
  }

  helpTooltipElement.innerHTML = helpMsg;
  helpTooltip.setPosition(evt.coordinate);

  helpTooltipElement.classList.remove('hidden');
};


map.on('pointermove', pointerMoveHandler);

map.getViewport().addEventListener('mouseout', function () {
  helpTooltipElement.classList.add('hidden');
});

const typeSelect = document.getElementById('type');

let draw; // global so we can remove it later

// /**
//  * Format length output.
//  * @param {LineString} line The line.
//  * @return {string} The formatted length.
//  */
const formatLength = function (line) {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
  } else {
    output = Math.round(length * 100) / 100 + ' ' + 'm';
  }
  return output;
};

// /**
//  * Format area output.
//  * @param {Polygon} polygon The polygon.
//  * @return {string} Formatted area.
//  */
const formatArea = function (polygon) {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
  } else {
    output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
  }
  return output;
};

const style = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: 'rgba(0, 0, 0, 0.5)',
    lineDash: [10, 10],
    width: 2,
  }),
  image: new CircleStyle({
    radius: 5,
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
    fill: new Fill({
      color: 'rgba(255, 255, 255, 0.2)',
    }),
  }),
});

function addInteraction() {
  const type = typeSelect.value == 'area' ? 'Polygon' : 'LineString';
  draw = new Draw({
    source: source,
    type: type,
    style: function (feature) {
      const geometryType = feature.getGeometry().getType();
      if (geometryType === type || geometryType === 'Point') {
        return style;
      }
    },
  });
  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  let listener;
  draw.on('drawstart', function (evt) {
    // set sketch
    sketch = evt.feature;

    let tooltipCoord;

    listener = sketch.getGeometry().on('change', function (evt) {
      const geom = evt.target;
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      } else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on('drawend', function () {
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
    measureTooltip.setOffset([0, -7]);
    // unset sketch
    sketch = null;
    // unset tooltip so that a new one can be created
    measureTooltipElement = null;
    createMeasureTooltip();
    unByKey(listener);
  });
}

/**
 * Creates a new help tooltip
 */
function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.remove();
  }
  helpTooltipElement = document.createElement('div');
  helpTooltipElement.className = 'ol-tooltip hidden';
  helpTooltip = new Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: 'center-left',
  });
  map.addOverlay(helpTooltip);
}

// /**
//  * Creates a new measure tooltip
//  */
function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.remove();
  }
  measureTooltipElement = document.createElement('div');
  measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false,
  });
  map.addOverlay(measureTooltip);
}

/**
 * Let user change the geometry type.
 */
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  addInteraction();
};

addInteraction();
