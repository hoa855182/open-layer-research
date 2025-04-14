// ====== IMPORTS ======
import Map from "ol/Map.js";
import View from "ol/View.js";
import GeoJSON from "ol/format/GeoJSON.js";
import Draw from "ol/interaction/Draw.js";
import Modify from "ol/interaction/Modify.js";
import Snap from "ol/interaction/Snap.js";
import TileLayer from "ol/layer/Tile.js";
import WebGLVectorLayer from "ol/layer/WebGLVector.js";
import { fromLonLat } from "ol/proj.js";
import OSM from "ol/source/OSM.js";
import VectorSource from "ol/source/Vector.js";

// ====== STYLE VARIABLES ======
const styleVariables = {
  width: 12,
  offset: 0,
  capType: "butt",
  joinType: "miter",
  miterLimit: 10,
  dashLength1: 25,
  dashLength2: 15,
  dashLength3: 15,
  dashLength4: 15,
  dashOffset: 0,
  patternSpacing: 0,
};

const source = new VectorSource({
  url: "data/geojson/switzerland.geojson",
  format: new GeoJSON(),
});

const getStyle = (dash, pattern) => {
  let newStyle = {
    "stroke-width": ["var", "width"],
    "stroke-color": "rgba(24,86,34,0.7)",
    "stroke-offset": ["var", "offset"],
    "stroke-miter-limit": ["var", "miterLimit"],
    "stroke-line-cap": ["var", "capType"],
    "stroke-line-join": ["var", "joinType"],
  };
  if (dash) {
    newStyle = {
      ...newStyle,
      "stroke-line-dash": [
        ["var", "dashLength1"],
        ["var", "dashLength2"],
        ["var", "dashLength3"],
        ["var", "dashLength4"],
      ],
      "stroke-line-dash-offset": ["var", "dashOffset"],
    };
  }
  if (pattern) {
    delete newStyle["stroke-color"];
    newStyle = {
      ...newStyle,
      "stroke-pattern-src": "data/dot.svg",
      "stroke-pattern-spacing": ["var", "patternSpacing"],
    };
  }
  return newStyle;
};

let style = getStyle(false, false);
let vector = new WebGLVectorLayer({ source, style, variables: { ...styleVariables } });

const map = new Map({
  layers: [new TileLayer({ source: new OSM() }), vector],
  target: "map",
  view: new View({ center: fromLonLat([8.43, 46.82]), zoom: 7 }),
});

const rebuildStyle = () => {
  const dash = document.getElementById("dashEnable").checked;
  const pattern = document.getElementById("patternEnable").checked;
  style = getStyle(dash, pattern);
  map.removeLayer(vector);
  vector = new WebGLVectorLayer({ source, style, variables: { ...styleVariables } });
  map.addLayer(vector);
};

// ====== SETUP INTERACTIONS ======
let draw, snap;
const geoJsonFormat = new GeoJSON();
let actionHistory = JSON.parse(localStorage.getItem("actionHistory") || "[]");
const modify = new Modify({ source });

// Load feature từ GeoJSON gốc
source.once("change", () => {
  if (source.getState() === "ready") {
    actionHistory.forEach((action) => {
      if (action.type === "modify" && action.newGeometry) {
        const feature = source.getFeatures().find(f => f.ol_uid === action.featureId);
        if (feature) {
          const newGeom = geoJsonFormat.readGeometry(action.newGeometry);
          feature.setGeometry(newGeom); // Apply new geometry
        }
      }
      // Draw features from history (if they exist)
      if (action.type === "draw") {
        const feature = geoJsonFormat.readFeature(action.featureGeoJson);
        source.addFeature(feature);
        action._featureRef = feature;
      }
    });
  }
});

// Draw features từ history
actionHistory.forEach((action) => {
  if (action.type === "draw") {
    const feature = geoJsonFormat.readFeature(action.featureGeoJson);
    source.addFeature(feature);
    action._featureRef = feature;
  }
});

map.addInteraction(modify);

modify.on("modifystart", (evt) => {
  evt.features.forEach((feature) => {
    const oldGeometry = geoJsonFormat.writeGeometry(feature.getGeometry());
    feature.set("__modifying", true);
    actionHistory.push({ type: "modify", featureId: feature.ol_uid, oldGeometry, newGeometry: null });
    saveHistory();  // Save history when modification starts
  });
});

modify.on("modifyend", (evt) => {
  evt.features.forEach((feature) => {
    if (feature.get("__modifying")) {
      const newGeometry = geoJsonFormat.writeGeometry(feature.getGeometry());
      // Find the last action for this feature and update it with new geometry
      const lastAction = actionHistory.find(
        (a) => a.type === "modify" && a.featureId === feature.ol_uid && !a.newGeometry
      );
      if (lastAction) {
        lastAction.newGeometry = newGeometry; // Update with new geometry
      }
      feature.unset("__modifying");
      saveHistory(); // Save updated history after modification ends
    }
  });
});


function addInteractions() {
  draw = new Draw({ source, type: "LineString" });
  map.addInteraction(draw);
  snap = new Snap({ source });
  map.addInteraction(snap);

  draw.on("drawend", (event) => {
    const feature = event.feature;
    const featureGeoJson = geoJsonFormat.writeFeature(feature);
    actionHistory.push({ type: "draw", featureGeoJson, _featureRef: feature });
    saveHistory(); // Save immediately after drawing
  });
}
addInteractions();

function undoDraw() {
  if (actionHistory.length === 0) return alert("Không có thao tác nào để undo");
  const lastAction = actionHistory.pop();

  if (lastAction.type === "draw") {
    const feature = lastAction._featureRef || geoJsonFormat.readFeature(lastAction.featureGeoJson);
    source.removeFeature(feature);
  } else if (lastAction.type === "modify") {
    const feature = source.getFeatures().find(f => f.ol_uid === lastAction.featureId);
    if (feature) {
      const oldGeom = geoJsonFormat.readGeometry(lastAction.oldGeometry);
      feature.setGeometry(oldGeom);
    }
  }
  saveHistory();
  map.render();
}

function saveHistory() {
  const serializable = actionHistory.map((a) => {
    if (a.type === "draw") {
      return { type: "draw", featureGeoJson: a.featureGeoJson };
    } else if (a.type === "modify") {
      return {
        type: "modify",
        featureId: a.featureId,
        oldGeometry: a.oldGeometry,
        newGeometry: a.newGeometry || null, // Ensure we track new geometry
      };
    }
  });
  localStorage.setItem("actionHistory", JSON.stringify(serializable));
}


// ====== UI INPUT LISTENERS ======
document.querySelectorAll("input.uniform").forEach(input => input.addEventListener("input", (e) => {
  const variableName = e.target.name;
  styleVariables[variableName] = e.target.type === "radio" ? e.target.value : parseFloat(e.target.value);
  vector.updateStyleVariables(styleVariables);
  const valueSpan = document.getElementById(`value-${variableName}`);
  if (valueSpan) valueSpan.textContent = String(styleVariables[variableName]);
  map.render();
}));

document.querySelectorAll("input.rebuild").forEach(input => input.addEventListener("input", rebuildStyle));

document.getElementById("undo-btn").addEventListener("click", undoDraw);
