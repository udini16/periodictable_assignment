import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import * as TWEEN from '@tweenjs/tween.js';
import Papa from 'papaparse';
import './style.css';

let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };
const tweenGroup = new TWEEN.Group();

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

// Public Landing Page -> Login Screen navigation
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

function getNetWorthColor(valueStr) {
  // Strip out the $ and commas to turn it into a real number
  const value = parseFloat(String(valueStr).replace(/[^0-9.-]+/g, ""));
  if (value < 100000) return 'rgba(239, 48, 34, 0.8)';   // Red (< $100K)
  if (value > 200000) return 'rgba(58, 148, 72, 0.8)';   // Green (> $200K)
  return 'rgba(245, 166, 35, 0.8)';                      // Orange ($100K - $200K)
}

function init() {
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 3000;
  scene = new THREE.Scene();

  // 1. Fetch YOUR Google Sheet Data
  const sheetId = '1sZ5Bqk9ug1dLvotbat-kT4vrAUQrhGYDaWIGNHcDU7E';
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  Papa.parse(sheetUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      // Filter out any empty rows just in case
      const data = results.data.filter(row => row.Name);
      buildPeriodicTable(data);
    },
    error: function(error) {
      console.error("Error fetching Google Sheet:", error);
      alert("Failed to load data. Make sure the Google Sheet sharing setting is 'Anyone with the link'.");
    }
  });

  // --- RENDERER SETUP ---
  renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('container').appendChild(renderer.domElement);

  // --- CAMERA CONTROLS ---
  controls = new TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.addEventListener('change', render);

  // --- EVENT LISTENERS ---
  const setActiveMenuButton = (activeId) => {
    ['table', 'sphere', 'helix', 'grid'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', id === activeId);
      }
    });
  };
  setActiveMenuButton('table');

  document.getElementById('table').addEventListener('click', () => {
    setActiveMenuButton('table');
    transform(targets.table, 2000);
  });
  document.getElementById('sphere').addEventListener('click', () => {
    setActiveMenuButton('sphere');
    transform(targets.sphere, 2000);
  });
  document.getElementById('helix').addEventListener('click', () => {
    setActiveMenuButton('helix');
    transform(targets.helix, 2000);
  });
  document.getElementById('grid').addEventListener('click', () => {
    setActiveMenuButton('grid');
    transform(targets.grid, 2000);
  });
  window.addEventListener('resize', onWindowResize);
}

// 2. Build the 3D Elements once data is loaded
function buildPeriodicTable(data) {
  data.forEach((person) => {
    const element = document.createElement('div');
    element.className = 'element';

    // Handle Net Worth column name variations
    const netWorthRaw = person['Net Worth'] || person[' Net Worth '] || "$0";
    element.style.backgroundColor = getNetWorthColor(netWorthRaw);

    // Top row: Country (left) and Age (right) - matching Image B
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

    // Center: Photo
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

    const objectCSS = new CSS3DObject(element);
    objectCSS.position.x = Math.random() * 4000 - 2000;
    objectCSS.position.y = Math.random() * 4000 - 2000;
    objectCSS.position.z = Math.random() * 4000 - 2000;
    scene.add(objectCSS);
    objects.push(objectCSS);
  });

  // TABLE (20x10)
  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    object.position.x = ((i % 20) * 140) - 1330;
    object.position.y = -(Math.floor(i / 20) * 180) + 990;
    targets.table.push(object);
  }

  // SPHERE
  const vector = new THREE.Vector3();
  for (let i = 0; i < objects.length; i++) {
    const phi = Math.acos(-1 + (2 * i) / objects.length);
    const theta = Math.sqrt(objects.length * Math.PI) * phi;
    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(800, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

  // DOUBLE HELIX
  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    const strand = i % 2;
    const index = Math.floor(i / 2);
    const theta = index * 0.175 + (strand * Math.PI);
    const y = -(index * 16) + 800;

    object.position.setFromCylindricalCoords(900, theta, y);

    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);
    targets.helix.push(object);
  }

  // GRID (5x4x10)
  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    object.position.x = ((i % 5) * 400) - 800;
    object.position.y = (-(Math.floor(i / 5) % 4) * 400) + 600;
    object.position.z = (Math.floor(i / 20)) * 1000 - 2000;
    targets.grid.push(object);
  }

  // Start with table layout immediately after data loads
  transform(targets.table, 2000);
}

// 3. Transformation Logic
function transform(targets, duration) {
  tweenGroup.removeAll();
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targets[i];

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
