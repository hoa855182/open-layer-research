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

// ----- Backup các feature hiện tại để undo -----
// Stack lưu các phiên bản backup của các feature (mỗi backup là 1 mảng các feature đã clone)
let undoStack = [];

/**
 * Hàm rebuild style: trước khi rebuild, lưu lại các feature hiện tại từ source
 */
const rebuildStyle = () => {
  // Lưu lại các feature hiện có (clone để không bị ảnh hưởng bởi sự thay đổi của các feature gốc)
  const currentFeatures = source.getFeatures();
  const clonedFeatures = currentFeatures.map((feature) => feature.clone());

  // Thêm backup vào undo stack (có thể dùng cho logic undo)
  undoStack.push(clonedFeatures);

  // Lấy trạng thái của checkbox
  const dash = document.getElementById("dashEnable").checked;
  const pattern = document.getElementById("patternEnable").checked;

  // Tạo style mới theo các trạng thái này
  style = getStyle(dash, pattern);

  // Xóa layer cũ, tạo lại layer mới với style cập nhật
  map.removeLayer(vector);
  vector = new WebGLVectorLayer({
    source,
    style,
    variables: { ...styleVariables },
  });
  map.addLayer(vector);
};

/**
 * Hàm undo: phục hồi lại các feature từ phiên bản backup mới nhất
 */
const undoRebuild = () => {
  if (undoStack.length === 0) {
    console.warn("Không có thao tác nào để undo");
    return;
  }
  const previousFeatures = undoStack.pop();
  // Xóa các feature hiện tại
  source.clear();
  // Thêm lại các feature từ backup
  source.addFeatures(previousFeatures);
  // Cập nhật lại layer nếu cần (ở đây vector đang dùng source, nên update tự động khi source thay đổi)
  map.render();
};

// ----- Khởi tạo các interaction của Modify, Draw, Snap -----
const modify = new Modify({ source: source });
map.addInteraction(modify);

let draw, snap; // global để có thể remove sau

function addInteractions() {
  draw = new Draw({
    source: source,
    type: "LineString",
  });
  map.addInteraction(draw);

  snap = new Snap({ source: source });
  map.addInteraction(snap);
}

addInteractions();

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
document.getElementById("undo-btn").addEventListener("click", undoRebuild);
