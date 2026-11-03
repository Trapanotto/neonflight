import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { BEST_KEY, COLORS, PLANE_RADIUS, RING_COUNT, START_POSITION, START_SPEED, START_YAW } from './config.js';
import { damp } from './utils.js';
import { createSky } from './world/sky.js';
import { createCity } from './world/city.js';
import { Course } from './course.js';
import { createAircraft } from './aircraft.js';
import { FlightModel } from './physics.js';
import { InputManager } from './input.js';
import { AudioSystem } from './audio.js';
import { HUD } from './hud.js';
import { Rain, CrashEffects } from './effects.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COLORS.fog, 0.00135);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 6500);
camera.position.set(0, 90, 300);

const ambient = new THREE.AmbientLight(0x4a2a7a, 0.9);
scene.add(ambient);

const hemisphere = new THREE.HemisphereLight(0x6a4cff, 0x120022, 0.8);
scene.add(hemisphere);

const magentaKey = new THREE.DirectionalLight(0xff2fd0, 0.6);
magentaKey.position.set(-260, 420, -340);
scene.add(magentaKey);

const cyanRim = new THREE.DirectionalLight(0x00f0ff, 0.4);
cyanRim.position.set(320, 240, 220);
scene.add(cyanRim);

const sky = createSky(scene);
const course = new Course(scene);
const city = createCity(scene, course.path);
const aircraft = createAircraft();
scene.add(aircraft.group);

const rain = new Rain(scene);
const crashEffects = new CrashEffects(scene);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.0,
  0.72,
  0.42
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const physics = new FlightModel();
const hud = new HUD();
const audio = new AudioSystem();

const startVector = new THREE.Vector3(START_POSITION.x, START_POSITION.y, START_POSITION.z);
physics.reset(startVector, START_YAW, START_SPEED);
physics.applyTo(aircraft.group);

let state = 'menu';
let runTime = 0;

function readBestTime() {
  try {
    const value = Number.parseFloat(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  } catch (error) {
    return Number.POSITIVE_INFINITY;
  }
}

function writeBestTime(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    // Storage may be unavailable in private mode; the run still works.
  }
}

let bestTime = readBestTime();

let cameraShake = 0;
let cameraSmoothed = false;
let lightning = 0;
let lightningTimer = 9 + Math.random() * 10;
let lastFov = camera.fov;

let lastFrameTime = performance.now();
let elapsedTime = 0;
const forwardVector = new THREE.Vector3();
const chaseTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const menuTarget = new THREE.Vector3();

hud.setBest(bestTime);
hud.showHud(false);
hud.showStart(true);
hud.showFinish(false);

const input = new InputManager({
  onAction(action) {
    if (action === 'restart') {
      startRun();
    } else if (action === 'mute') {
      const muted = audio.toggleMute();
      hud.showMessage(muted ? 'AUDIO MUTED' : 'AUDIO ON', { duration: 900 });
    }
  }
});

document.getElementById('start-btn').addEventListener('click', () => startRun());
document.getElementById('restart-btn').addEventListener('click', () => startRun());

window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && state !== 'flying') {
    startRun();
  }
});

function startRun() {
  state = 'flying';
  runTime = 0;
  course.reset();
  physics.reset(startVector, START_YAW, START_SPEED);
  cameraSmoothed = false;
  cameraShake = 0;

  hud.showStart(false);
  hud.hideResult();
  hud.showHud(true);
  hud.setBest(bestTime);

  audio.init().catch(() => {});
}

function finishRun() {
  if (state !== 'flying') return;
  state = 'finished';

  const isRecord = runTime < bestTime;
  if (isRecord) {
    bestTime = runTime;
    writeBestTime(bestTime);
    hud.setBest(bestTime);
  }

  hud.showResult({ time: runTime, best: bestTime, isRecord });
  hud.showMessage('COURSE CLEAR', { duration: 1800 });
  audio.finish();
}

function crash() {
  if (state !== 'flying') return;

  audio.crash();
  crashEffects.trigger(physics.position);
  hud.flash();
  hud.showMessage('CONNECTION LOST', { warn: true, duration: 1300 });
  cameraShake = 1.1;

  const checkpoint = course.getCheckpoint();
  const respawn = checkpoint.position.clone();
  physics.reset(respawn, checkpoint.yaw, 52);
  physics.throttle = 0.7;
  course.previousPosition = null;
}

function checkBuildingCollision() {
  if (physics.grace > 0) return false;

  const { x, y, z } = physics.position;

  for (let i = 0; i < city.buildings.length; i++) {
    const building = city.buildings[i];
    if (
      Math.abs(x - building.x) < building.width * 0.5 + PLANE_RADIUS &&
      Math.abs(z - building.z) < building.depth * 0.5 + PLANE_RADIUS &&
      y < building.height + PLANE_RADIUS
    ) {
      return true;
    }
  }

  return false;
}

function updateCamera(dt, speedRatio) {
  const backX = Math.sin(physics.yaw);
  const backZ = Math.cos(physics.yaw);

  chaseTarget.set(
    physics.position.x + backX * 17,
    physics.position.y + 5.2,
    physics.position.z + backZ * 17
  );

  if (!cameraSmoothed) {
    camera.position.copy(chaseTarget);
    cameraSmoothed = true;
  } else {
    camera.position.lerp(chaseTarget, 1 - Math.exp(-6 * dt));
  }

  physics.getForward(forwardVector);
  lookTarget.copy(physics.position).addScaledVector(forwardVector, 22);
  lookTarget.y += 1.2;
  camera.lookAt(lookTarget);

  if (cameraShake > 0) {
    camera.position.x += (Math.random() - 0.5) * cameraShake;
    camera.position.y += (Math.random() - 0.5) * cameraShake;
    camera.position.z += (Math.random() - 0.5) * cameraShake;
    cameraShake = damp(cameraShake, 0, 5, dt);
  }

  const targetFov = 70 + speedRatio * 9 + (physics.boosting ? 9 : 0);
  camera.fov = damp(camera.fov, targetFov, 4, dt);
  if (Math.abs(camera.fov - lastFov) > 0.01) {
    camera.updateProjectionMatrix();
    lastFov = camera.fov;
  }
}

function updateMenu(dt, time) {
  const orbit = time * 0.14;
  camera.position.set(
    Math.sin(orbit) * 300,
    105 + Math.sin(time * 0.5) * 10,
    280 + Math.cos(orbit) * 280
  );
  menuTarget.set(0, 95, -180);
  camera.lookAt(menuTarget);

  aircraft.group.position.set(0, START_POSITION.y + Math.sin(time * 0.9) * 1.4, START_POSITION.z);
  aircraft.group.rotation.set(0, START_YAW, Math.sin(time * 0.45) * 0.05);
  aircraft.update({
    throttle: 0.25,
    boost: 0,
    speed: 40,
    time
  });

  course.update(dt, time, physics.position);
}

function updateFlight(dt, time) {
  const info = physics.update(dt, input.state);
  runTime += dt;

  if (info.crashed || checkBuildingCollision()) {
    crash();
  } else {
    const event = course.update(dt, time, physics.position);

    if (event.passed) {
      if (event.refill) {
        physics.boost = 1;
        audio.checkpoint();
        hud.showMessage('CHECKPOINT // BOOST FULL', { duration: 1200 });
      } else {
        audio.chime(event.index);
      }

      if (event.finished) {
        finishRun();
      }
    }

    if (info.boostStarted) audio.boostWhoosh();
  }

  physics.applyTo(aircraft.group);
  aircraft.update({
    throttle: physics.throttle,
    boost: physics.boosting ? 1 : 0,
    speed: physics.speed,
    time
  });

  audio.updateEngine(physics.throttle, info.speedRatio ?? 0, physics.boosting ? 1 : 0);
  updateCamera(dt, info.speedRatio ?? 0);

  hud.update({
    speed: physics.speed,
    altitude: physics.position.y,
    time: runTime,
    ring: course.currentIndex,
    total: RING_COUNT,
    best: bestTime,
    boost: physics.boost
  });
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  elapsedTime += dt;
  const time = elapsedTime;

  if (state === 'flying') {
    updateFlight(dt, time);
  } else if (state === 'menu') {
    updateMenu(dt, time);
  } else {
    aircraft.update({
      throttle: 0,
      boost: 0,
      speed: 0,
      time
    });
  }

  city.update(dt);

  lightningTimer -= dt;
  if (lightningTimer <= 0) {
    lightningTimer = 11 + Math.random() * 16;
    lightning = 1;
    sky.flash(0.75 + Math.random() * 0.25);
    audio.playNoiseBurst({ duration: 1.4, from: 320, to: 50, gain: 0.16 });
  }
  lightning = damp(lightning, 0, 3, dt);
  ambient.intensity = 0.9 + lightning * 0.9;
  hemisphere.intensity = 0.8 + lightning * 0.7;

  rain.update(dt, camera.position);
  crashEffects.update(dt, camera);
  sky.update(dt, time, camera.position);

  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

animate();
