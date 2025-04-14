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

// ----- Các biến style cho WebGLVectorLayer -----
const styleVariables = {
  width: 12,
  offset: 0,
  capType: "butt",
  joinType: "miter",
  miterLimit: 10, // ratio
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

/**
 * @param {boolean} dash Include line dash
 * @param {boolean} pattern Include image pattern
 * @return {import('ol/style/flat.js').FlatStyle} Generated style
 */
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

let vector = new WebGLVectorLayer({
  source,
  style,
  variables: { ...styleVariables },
});

// ----- Khởi tạo Map -----
const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    vector,
  ],
  target: "map",
  view: new View({
    center: fromLonLat([8.43, 46.82]),
    zoom: 7,
  }),
});

/**
 * Hàm rebuild style: trước khi rebuild, lưu lại các feature hiện tại từ source
 */
const rebuildStyle = () => {
  // Lấy trạng thái của checkbox
  const dash = document.getElementById("dashEnable").checked;
  const pattern = document.getElementById("patternEnable").checked;

  style = getStyle(dash, pattern);

  map.removeLayer(vector);
  vector = new WebGLVectorLayer({
    source,
    style,
    variables: { ...styleVariables },
  });
  map.addLayer(vector);
};

// ----- Khởi tạo các interaction của Modify, Draw, Snap -----
let draw, snap;
const geoJsonFormat = new GeoJSON();

// Tải lại actionHistory từ localStorage
let actionHistory = JSON.parse(localStorage.getItem("actionHistory") || "[]");
const modify = new Modify({ source });

// Khôi phục lại các feature đã vẽ (nếu cần)
actionHistory.forEach((action) => {
  if (action.type === "draw") {
    const feature = geoJsonFormat.readFeature(action.featureGeoJson);
    source.addFeature(feature);
    action._featureRef = feature; // lưu lại tham chiếu để undo sau
  }
});

map.addInteraction(modify);

modify.on("modifystart", (evt) => {
  evt.features.forEach((feature) => {
    const oldGeometry = geoJsonFormat.writeGeometry(feature.getGeometry());

    actionHistory.push({
      type: "modify",
      featureId: feature.ol_uid, // sử dụng id để định danh
      oldGeometry,
    });

    saveHistory();
  });
});

function addInteractions() {
  draw = new Draw({
    source: source,
    type: "LineString",
  });
  map.addInteraction(draw);

  snap = new Snap({ source });
  map.addInteraction(snap);

  draw.on("drawend", (event) => {
    const feature = event.feature;
    const featureGeoJson = geoJsonFormat.writeFeature(feature);

    actionHistory.push({
      type: "draw",
      featureGeoJson,
      _featureRef: feature,
    });

    saveHistory();
  });
}

addInteractions();

function undoDraw() {
  if (actionHistory.length === 0) {
    alert("Không có thao tác nào để undo");
    return;
  }

  const lastAction = actionHistory.pop();

  if (lastAction.type === "draw") {
    // Nếu đang ở phiên hiện tại, có thể dùng _featureRef
    if (lastAction._featureRef) {
      source.removeFeature(lastAction._featureRef);
    } else {
      // Nếu đã reload → tạo lại feature từ GeoJSON
      const feature = geoJsonFormat.readFeature(lastAction.featureGeoJson);
      source.removeFeature(feature);
    }
  } else if (lastAction.type === "modify") {
    const features = source.getFeatures();
    const target = features.find((f) => f.ol_uid === lastAction.featureId);
    if (target) {
      const oldGeom = geoJsonFormat.readGeometry(lastAction.oldGeometry);
      target.setGeometry(oldGeom);
    }
  }

  saveHistory();
  map.render();
}

// Lưu actionHistory vào localStorage
function saveHistory() {
  const serializable = actionHistory.map((a) => {
    if (a.type === "draw") {
      return { type: "draw", featureGeoJson: a.featureGeoJson };
    } else if (a.type === "modify") {
      return {
        type: "modify",
        featureId: a.featureId,
        oldGeometry: a.oldGeometry,
      };
    }
  });

  localStorage.setItem("actionHistory", JSON.stringify(serializable));
}

// ----- Lắng nghe sự thay đổi các input để update style variables -----
const inputListener = (event) => {
  const variableName = event.target.name;
  if (event.target.type === "radio") {
    styleVariables[variableName] = event.target.value;
  } else {
    styleVariables[variableName] = parseFloat(event.target.value);
  }
  vector.updateStyleVariables(styleVariables);
  const valueSpan = document.getElementById(`value-${variableName}`);
  if (valueSpan) {
    valueSpan.textContent = String(styleVariables[variableName]);
  }
  map.render();
};

document
  .querySelectorAll("input.uniform")
  .forEach((input) => input.addEventListener("input", inputListener));
document
  .querySelectorAll("input.rebuild")
  .forEach((input) => input.addEventListener("input", rebuildStyle));

// ----- Giả sử có một nút (button) cho undo với id 'undo-btn' -----
document.getElementById("undo-btn").addEventListener("click", undoDraw);
