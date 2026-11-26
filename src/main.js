import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import * as TWEEN from '@tweenjs/tween.js';
import Papa from 'papaparse';
import './style.css';

// --- CONFIGURATION CONSTANTS ---
const GOOGLE_SHEET_ID = '1sZ5Bqk9ug1dLvotbat-kT4vrAUQrhGYDaWIGNHcDU7E';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;

const NET_WORTH_THRESHOLDS = {
  LOW: 100000,
  HIGH: 200000,
};

const TILE_COLORS = {
  RED: 'rgba(239, 48, 34, 0.8)',     // < $100K
  ORANGE: 'rgba(245, 166, 35, 0.8)', // $100K - $200K
  GREEN: 'rgba(58, 148, 72, 0.8)',   // > $200K
};

const LAYOUT_CONFIG = {
  TRANSITION_DURATION_MS: 2000,
  TABLE: { COLUMNS: 20, X_SPACING: 140, Y_SPACING: 180, X_OFFSET: 1330, Y_OFFSET: 990 },
  SPHERE: { RADIUS: 800 },
  HELIX: { STRANDS: 2, RADIUS: 900, THETA_STEP: 0.175, Y_STEP: 16, Y_OFFSET: 800 },
  GRID: { COLUMNS: 5, ROWS: 4, X_SPACING: 400, Y_SPACING: 400, Z_SPACING: 1000, X_OFFSET: 800, Y_OFFSET: 600, Z_OFFSET: 2000 },
  PYRAMID: { SCALE: 1200, ROWS: 10 },
};

// --- SCENE STATE ---
let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [], pyramid: [] };
const tweenGroup = new TWEEN.Group();

/**
 * Handles Google Identity Services OAuth callback and initializes the 3D scene.
 * @param {Object} response - Google credential response payload.
 */
window._startPeriodicTable = (response) => {
  const landingEl = document.getElementById('landing-container');
  if (landingEl) landingEl.style.display = 'none';
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  init();
  animate();
};
window.handleCredentialResponse = window._startPeriodicTable;

if (window._pendingCredential) {
  window._startPeriodicTable(window._pendingCredential);
}

// Public Landing Page <-> Login Screen navigation
const goToLoginBtn = document.getElementById('go-to-login-btn');
if (goToLoginBtn) {
  goToLoginBtn.addEventListener('click', () => {
    document.getElementById('landing-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
  });
}

const backToLandingLink = document.getElementById('back-to-landing-link');
if (backToLandingLink) {
  backToLandingLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('landing-container').style.display = 'flex';
  });
}

/**
 * Determines the tile background color based on parsed Net Worth value.
 * @param {string|number} valueStr - Raw Net Worth string from CSV (e.g., "$251,260.80").
 * @returns {string} CSS rgba color string.
 */
function getNetWorthColor(valueStr) {
  const value = parseFloat(String(valueStr).replace(/[^0-9.-]+/g, ''));
  if (value < NET_WORTH_THRESHOLDS.LOW) return TILE_COLORS.RED;
  if (value > NET_WORTH_THRESHOLDS.HIGH) return TILE_COLORS.GREEN;
  return TILE_COLORS.ORANGE;
}

/**
 * Initializes the Three.js camera, CSS3DRenderer, TrackballControls, and fetches CSV data.
 */
function init() {
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 3000;
  scene = new THREE.Scene();

  // 1. Fetch & parse Google Sheet CSV dataset
  Papa.parse(GOOGLE_SHEET_CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const data = results.data.filter((row) => row.Name);
      buildPeriodicTable(data);
    },
    error: function (error) {
      console.error('Error fetching Google Sheet:', error);
      alert("Failed to load data. Make sure the Google Sheet sharing setting is 'Anyone with the link'.");
    },
  });

  // 2. Renderer setup
  renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('container').appendChild(renderer.domElement);

  // 3. Camera controls
  controls = new TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.addEventListener('change', render);

  // 4. Layout view switcher listeners
  const setActiveMenuButton = (activeId) => {
    ['table', 'sphere', 'helix', 'grid', 'pyramid'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', id === activeId);
      }
    });
  };
  setActiveMenuButton('table');

  const duration = LAYOUT_CONFIG.TRANSITION_DURATION_MS;
  document.getElementById('table').addEventListener('click', () => {
    setActiveMenuButton('table');
    transform(targets.table, duration);
  });
  document.getElementById('sphere').addEventListener('click', () => {
    setActiveMenuButton('sphere');
    transform(targets.sphere, duration);
  });
  document.getElementById('helix').addEventListener('click', () => {
    setActiveMenuButton('helix');
    transform(targets.helix, duration);
  });
  document.getElementById('grid').addEventListener('click', () => {
    setActiveMenuButton('grid');
    transform(targets.grid, duration);
  });
  document.getElementById('pyramid').addEventListener('click', () => {
    setActiveMenuButton('pyramid');
    transform(targets.pyramid, duration);
  });

  window.addEventListener('resize', onWindowResize);
}

/**
 * Creates a DOM element for a single 3D profile tile matching Image B specification.
 * @param {Object} person - Row record from the Google Sheet CSV.
 * @returns {HTMLDivElement} Configured tile DOM element.
 */
function createTileElement(person) {
  const element = document.createElement('div');
  element.className = 'element';

  const netWorthRaw = person['Net Worth'] || person[' Net Worth '] || '$0';
  element.style.backgroundColor = getNetWorthColor(netWorthRaw);

  // Top header: Country (left) and Age (right)
  const header = document.createElement('div');
  header.className = 'tile-header';

  const country = document.createElement('span');
  country.className = 'country';
  country.textContent = person.Country || '';
  header.appendChild(country);

  const age = document.createElement('span');
  age.className = 'age';
  age.textContent = person.Age || '';
  header.appendChild(age);

  element.appendChild(header);

  // Center: Profile photo
  const photo = document.createElement('img');
  photo.decoding = 'async';
  photo.src = person.Photo || 'https://via.placeholder.com/60';
  photo.className = 'photo';
  photo.alt = person.Name || 'Profile';
  element.appendChild(photo);

  // Bottom: Name & Interest
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = person.Name || 'Unknown';
  element.appendChild(name);

  const interest = document.createElement('div');
  interest.className = 'interest';
  interest.textContent = person.Interest || 'N/A';
  element.appendChild(interest);

  return element;
}

/**
 * Builds the 3D CSS objects and precomputes coordinates for all 4 spatial formations.
 * @param {Array<Object>} data - Array of parsed CSV records.
 */
function buildPeriodicTable(data) {
  data.forEach((person) => {
    const element = createTileElement(person);
    const objectCSS = new CSS3DObject(element);
    objectCSS.position.x = Math.random() * 4000 - 2000;
    objectCSS.position.y = Math.random() * 4000 - 2000;
    objectCSS.position.z = Math.random() * 4000 - 2000;
    scene.add(objectCSS);
    objects.push(objectCSS);
  });

  const count = objects.length;
  const vector = new THREE.Vector3();

  // 1. TABLE (20x10)
  const { COLUMNS, X_SPACING, Y_SPACING, X_OFFSET, Y_OFFSET } = LAYOUT_CONFIG.TABLE;
  for (let i = 0; i < count; i++) {
    const object = new THREE.Object3D();
    object.position.x = (i % COLUMNS) * X_SPACING - X_OFFSET;
    object.position.y = -(Math.floor(i / COLUMNS) * Y_SPACING) + Y_OFFSET;
    targets.table.push(object);
  }

  // 2. SPHERE
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(LAYOUT_CONFIG.SPHERE.RADIUS, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

  // 3. DOUBLE HELIX
  const { STRANDS, RADIUS, THETA_STEP, Y_STEP, Y_OFFSET: HELIX_Y_OFFSET } = LAYOUT_CONFIG.HELIX;
  for (let i = 0; i < count; i++) {
    const object = new THREE.Object3D();
    const strand = i % STRANDS;
    const index = Math.floor(i / STRANDS);
    const theta = index * THETA_STEP + strand * Math.PI;
    const y = -(index * Y_STEP) + HELIX_Y_OFFSET;

    object.position.setFromCylindricalCoords(RADIUS, theta, y);

    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);
    targets.helix.push(object);
  }

  // 4. GRID (5x4x10)
  const gridCfg = LAYOUT_CONFIG.GRID;
  const layerSize = gridCfg.COLUMNS * gridCfg.ROWS;
  for (let i = 0; i < count; i++) {
    const object = new THREE.Object3D();
    object.position.x = (i % gridCfg.COLUMNS) * gridCfg.X_SPACING - gridCfg.X_OFFSET;
    object.position.y = -(Math.floor(i / gridCfg.COLUMNS) % gridCfg.ROWS) * gridCfg.Y_SPACING + gridCfg.Y_OFFSET;
    object.position.z = Math.floor(i / layerSize) * gridCfg.Z_SPACING - gridCfg.Z_OFFSET;
    targets.grid.push(object);
  }

  // 5. 4-FACE PYRAMID (TETRAHEDRON)
  const { SCALE: pyrScale, ROWS: pyrRows } = LAYOUT_CONFIG.PYRAMID;
  const V0 = new THREE.Vector3(0, 1, 0).multiplyScalar(pyrScale);
  const V1 = new THREE.Vector3(0, -1 / 3, (2 * Math.sqrt(2)) / 3).multiplyScalar(pyrScale);
  const V2 = new THREE.Vector3(Math.sqrt(6) / 3, -1 / 3, -Math.sqrt(2) / 3).multiplyScalar(pyrScale);
  const V3 = new THREE.Vector3(-Math.sqrt(6) / 3, -1 / 3, -Math.sqrt(2) / 3).multiplyScalar(pyrScale);

  // 4 triangular faces with outward-facing vertex winding and "up" hints
  const tetraFaces = [
    { a: V0, b: V1, c: V2, up: new THREE.Vector3(0, 1, 0) },
    { a: V0, b: V2, c: V3, up: new THREE.Vector3(0, 1, 0) },
    { a: V0, b: V3, c: V1, up: new THREE.Vector3(0, 1, 0) },
    { a: V1, b: V3, c: V2, up: new THREE.Vector3(0, 0, 1) },
  ];

  // Generate triangular grid slots across each of the 4 faces (55 slots per face for 10 rows)
  const faceSlots = [];
  tetraFaces.forEach((face) => {
    const edge1 = new THREE.Vector3().subVectors(face.b, face.a);
    const edge2 = new THREE.Vector3().subVectors(face.c, face.a);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    for (let r = 0; r < pyrRows; r++) {
      const vFrac = (r + 0.65) / (pyrRows + 0.5);
      for (let c = 0; c <= r; c++) {
        const uFrac = r === 0 ? 0.5 : c / r;
        const wA = 1 - vFrac;
        const wB = vFrac * (1 - uFrac);
        const wC = vFrac * uFrac;

        const pos = new THREE.Vector3()
          .addScaledVector(face.a, wA)
          .addScaledVector(face.b, wB)
          .addScaledVector(face.c, wC);

        faceSlots.push({ pos, normal, up: face.up });
      }
    }
  });

  const slotsPerFace = (pyrRows * (pyrRows + 1)) / 2;
  const itemsPerFace = Math.ceil(count / 4);
  for (let i = 0; i < count; i++) {
    const faceIdx = Math.floor(i / itemsPerFace) % 4;
    const localIdx = i % itemsPerFace;
    // Center the 50 items symmetrically across the 55 triangular grid slots on each face
    const slotOffset = Math.min(localIdx + 2, slotsPerFace - 1);
    const slot = faceSlots[faceIdx * slotsPerFace + slotOffset];

    const object = new THREE.Object3D();
    object.position.copy(slot.pos);
    object.up.copy(slot.up);
    vector.copy(slot.pos).add(slot.normal);
    object.lookAt(vector);
    targets.pyramid.push(object);
  }

  transform(targets.table, LAYOUT_CONFIG.TRANSITION_DURATION_MS);
}

/**
 * Animates all 3D objects toward the specified target formation.
 * @param {Array<THREE.Object3D>} targetList - Target positions and rotations.
 * @param {number} duration - Base animation duration in milliseconds.
 */
function transform(targetList, duration) {
  tweenGroup.removeAll();
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targetList[i];

    new TWEEN.Tween(object.position, tweenGroup)
      .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation, tweenGroup)
      .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }
  new TWEEN.Tween({}, tweenGroup)
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  requestAnimationFrame(animate);
  tweenGroup.update();
  if (controls) controls.update();
}

function render() {
  renderer.render(scene, camera);
}
