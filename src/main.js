import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import * as TWEEN from '@tweenjs/tween.js';
import './style.css';

let camera, scene, renderer;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

window.handleCredentialResponse = (response) => {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  init();
  animate();
};

function getNetWorthColor(valueStr) {
  // Strip out the $ and commas to turn it into a real number
  const value = parseFloat(valueStr.replace(/[^0-9.-]+/g, ""));
  if (value < 100000) return 'rgba(239, 48, 34, 0.8)'; 
  if (value > 200000) return 'rgba(58, 148, 72, 0.8)'; 
  return 'rgba(245, 166, 35, 0.8)'; 
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

  // --- EVENT LISTENERS ---
  document.getElementById('table').addEventListener('click', () => transform(targets.table, 2000));
  document.getElementById('sphere').addEventListener('click', () => transform(targets.sphere, 2000));
  document.getElementById('helix').addEventListener('click', () => transform(targets.helix, 2000));
  document.getElementById('grid').addEventListener('click', () => transform(targets.grid, 2000));
  window.addEventListener('resize', onWindowResize);
}

// 2. Build the 3D Elements once data is loaded
function buildPeriodicTable(data) {
  data.forEach((person, i) => {
    const element = document.createElement('div');
    element.className = 'element';
    
    // Ensure we handle spaces in the CSV column name: ' Net Worth '
    const netWorthRaw = person[' Net Worth '] || person['Net Worth'] || "$0";
    element.style.backgroundColor = getNetWorthColor(netWorthRaw);

    const photo = document.createElement('img');
    photo.src = person.Photo || 'https://via.placeholder.com/60';
    photo.className = 'photo';
    element.appendChild(photo);

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
    const phi = index * 0.175 + (strand * Math.PI);
    
    object.position.x = 900 * Math.sin(phi);
    object.position.y = -(index * 16) + 450;
    object.position.z = 900 * Math.cos(phi);
    
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
    object.position.y = -(Math.floor(i / 5) % 4) * 400 + 800;
    object.position.z = (Math.floor(i / 20)) * 1000 - 2000;
    targets.grid.push(object);
  }

  // Start with table layout immediately after data loads
  transform(targets.table, 2000);
}

// 3. Transformation Logic
function transform(targets, duration) {
  TWEEN.removeAll();
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targets[i];

    new TWEEN.Tween(object.position)
      .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }
  new TWEEN.Tween(this)
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
  TWEEN.update();
}

function render() {
  renderer.render(scene, camera);
}