import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  BEST_KEY,
  COLORS,
  CRASH_PENALTY_SECONDS,
  MAX_SIMULATION_STEPS,
  PHYSICS_VERSION,
  RING_COUNT,
  SIMULATION_STEP,
  START_POSITION,
  START_SPEED,
  START_YAW
} from './config.js';
import { damp, formatTime } from './utils.js';
import { createSky } from './world/sky.js';
import { createCity } from './world/city.js';
import { Course } from './course.js';
import { createAircraft, createGhostAircraft } from './aircraft.js';
import { COURSES, getCourseById } from './content/courses.js';
import { GhostPlayer, GhostRecorder } from './ghost.js';
import {
  buildChallengeUrl,
  buildShareText,
  parseChallengeUrl
} from './share.js';
import { FlightModel } from './physics.js';
import { InputManager } from './input.js';
import { AudioSystem } from './audio.js';
import { HUD } from './hud.js';
import { Rain, CrashEffects } from './effects.js';
import { BuildingCollisionIndex } from './collision.js';
import { RaceSession, getMedal, formatDelta } from './race.js';
import {
  getRecord,
  getRecordKey,
  loadProfile,
  saveProfile,
  setRecord
} from './storage.js';

const app = document.getElementById('app');
const BLOOM_LEVELS = {
  low: 0.4,
  medium: 0.62,
  high: 0.82
};

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
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
const courses = COURSES.map((config) => {
  const item = new Course(scene, config.seed, config.tuning);
  item.config = config;
  return item;
});
const coursePaths = courses.map((item) => item.path);
let course = courses[0];
let selectedCourse = COURSES[0];
const city = createCity(scene, coursePaths);
const collisionIndex = new BuildingCollisionIndex(city.buildings);
const aircraft = createAircraft();
scene.add(aircraft.group);
const ghostAircraft = createGhostAircraft();
scene.add(ghostAircraft.group);

const rain = new Rain(scene);
const crashEffects = new CrashEffects(scene);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM_LEVELS.low,
  0.58,
  0.58
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const physics = new FlightModel();
const hud = new HUD();
const audio = new AudioSystem();
const race = new RaceSession();
const ghostRecorder = new GhostRecorder();
const ghostPlayer = new GhostPlayer();

const storage = (() => {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
})();

let recordKey = getRecordKey(COURSES[0].id, COURSES[0].version, PHYSICS_VERSION);
let profile = loadProfile(storage, { recordKey, legacyKey: BEST_KEY });
const challenge = parseChallengeUrl(
  window.location.href,
  COURSES.map((item) => item.id)
);
const activeChallenge = challenge.courseId && challenge.target
  ? { courseId: challenge.courseId, target: challenge.target }
  : null;
selectedCourse = getCourseById(challenge.courseId || profile.settings.lastCourse);
course = courses.find((item) => item.config.id === selectedCourse.id) || courses[0];
recordKey = getRecordKey(selectedCourse.id, selectedCourse.version, PHYSICS_VERSION);
let record = getRecord(profile, recordKey);
let bestTime = record ? record.bestTime : Number.POSITIVE_INFINITY;
let bestSplits = record ? record.bestSplits : [];
let bestGhost = record ? record.ghost : [];
let bestMedal = getMedal(bestTime, selectedCourse.medals);

audio.setMuted(profile.settings.muted);
audio.setVolumes({
  music: profile.settings.musicVolume,
  effects: profile.settings.effectsVolume
});

const startVector = new THREE.Vector3(START_POSITION.x, START_POSITION.y, START_POSITION.z);
physics.reset(startVector, START_YAW, START_SPEED);
physics.applyTo(aircraft.group);

let state = 'menu';
let accumulator = 0;
let cameraShake = 0;
let cameraSmoothed = false;
let lightning = 0;
let lightningTimer = 9 + Math.random() * 10;
let lastFov = camera.fov;
let lastFrameTime = performance.now();
let elapsedTime = 0;
let lastSpeedRatio = 0;
let reduceFlashing = true;
let settingsOpen = false;
let lastResult = null;

const musicVolumeInput = document.getElementById('music-volume');
const musicVolumeValue = document.getElementById('music-volume-value');
const effectsVolumeInput = document.getElementById('effects-volume');
const effectsVolumeValue = document.getElementById('effects-volume-value');
const bloomSelect = document.getElementById('bloom-select');
const flashingSelect = document.getElementById('flashing-select');
const ghostSelect = document.getElementById('ghost-select');
const courseList = document.getElementById('course-list');
const challengeBanner = document.getElementById('challenge-banner');
const challengeText = document.getElementById('challenge-text');

const forwardVector = new THREE.Vector3();
const chaseTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const menuTarget = new THREE.Vector3();
const guideLocal = new THREE.Vector3();
const guideProjected = new THREE.Vector3();
const ghostTransform = {
  x: 0,
  y: 0,
  z: 0,
  pitch: 0,
  yaw: 0,
  roll: 0
};

hud.setBest(bestTime, bestMedal);
hud.showHud(false);
hud.showStart(true);
hud.showFinish(false);
hud.showPause(false);
hud.showSettings(false);

applyBloom(profile.settings.bloom);
applyFlashing(profile.settings.flashing);
syncSettingsUi();
selectCourse(selectedCourse.id, { persist: false });

function applyBloom(level) {
  bloom.strength = BLOOM_LEVELS[level] ?? BLOOM_LEVELS.low;
}

function applyFlashing(mode) {
  reduceFlashing = mode === 'reduced';
  document.body.classList.toggle('reduce-flash', reduceFlashing);

  if (reduceFlashing) {
    lightning = 0;
    sky.flash(0);
  } else {
    lightningTimer = 7 + Math.random() * 8;
  }
}

function syncSettingsUi() {
  const music = Math.round(profile.settings.musicVolume * 100);
  const effects = Math.round(profile.settings.effectsVolume * 100);
  musicVolumeInput.value = String(music);
  musicVolumeValue.textContent = `${music}%`;
  effectsVolumeInput.value = String(effects);
  effectsVolumeValue.textContent = `${effects}%`;
  bloomSelect.value = profile.settings.bloom;
  flashingSelect.value = profile.settings.flashing;
  ghostSelect.value = profile.settings.ghost ? 'on' : 'off';
}

function renderCourseList() {
  courseList.replaceChildren();

  COURSES.forEach((config) => {
    const key = getRecordKey(config.id, config.version, PHYSICS_VERSION);
    const courseRecord = getRecord(profile, key);
    const courseBest = courseRecord ? courseRecord.bestTime : Number.POSITIVE_INFINITY;
    const courseMedal = getMedal(courseBest, config.medals);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `course-card${config.id === selectedCourse.id ? ' selected' : ''}`;
    button.dataset.course = config.id;

    const name = document.createElement('span');
    name.className = 'course-name';
    name.textContent = config.name;

    const difficulty = document.createElement('span');
    difficulty.className = 'course-difficulty';
    difficulty.textContent = config.difficulty;

    const tagline = document.createElement('span');
    tagline.className = 'course-tagline';
    tagline.textContent = config.tagline;

    const recordLine = document.createElement('span');
    recordLine.className = 'course-record';
    recordLine.textContent = courseRecord
      ? `${formatTime(courseBest)}${courseMedal ? ` · ${courseMedal.label}` : ''}`
      : 'NO RECORD';

    name.append(' · ', difficulty);
    button.append(name, tagline, recordLine);
    button.addEventListener('click', () => selectCourse(config.id));
    courseList.append(button);
  });
}

function renderChallengeBanner() {
  const isActive = activeChallenge && activeChallenge.courseId === selectedCourse.id;

  if (!isActive) {
    challengeBanner.classList.add('hidden');
    return;
  }

  challengeText.textContent = `BEAT ${formatTime(activeChallenge.target)} ON ${selectedCourse.name}`;
  challengeBanner.classList.remove('hidden');
}

function selectCourse(id, { persist = true } = {}) {
  selectedCourse = getCourseById(id);
  course = courses.find((item) => item.config.id === selectedCourse.id) || courses[0];

  courses.forEach((item) => {
    item.group.visible = item === course;
    item.reset();
  });

  recordKey = getRecordKey(selectedCourse.id, selectedCourse.version, PHYSICS_VERSION);
  record = getRecord(profile, recordKey);
  bestTime = record ? record.bestTime : Number.POSITIVE_INFINITY;
  bestSplits = record ? record.bestSplits : [];
  bestGhost = record ? record.ghost : [];
  bestMedal = getMedal(bestTime, selectedCourse.medals);

  physics.reset(startVector, START_YAW, START_SPEED);
  physics.applyTo(aircraft.group);
  ghostAircraft.group.visible = false;
  cameraSmoothed = false;

  if (persist) {
    profile.settings.lastCourse = selectedCourse.id;
    saveProfile(storage, profile);
  }

  hud.setBest(bestTime, bestMedal);
  renderCourseList();
  renderChallengeBanner();
}

function nextCourse() {
  const index = COURSES.findIndex((item) => item.id === selectedCourse.id);
  const next = COURSES[(index + 1) % COURSES.length];
  selectCourse(next.id);
  startRun();
}

async function shareCurrentRun() {
  if (!lastResult) return;

  const url = buildChallengeUrl(window.location.href, lastResult.courseId, lastResult.time);
  const text = buildShareText(lastResult.courseName, lastResult.time);

  if (navigator.share) {
    try {
      await navigator.share({ title: 'NEON SKYWAYS', text, url });
      hud.setShareStatus('SHARED');
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    hud.setShareStatus('CHALLENGE LINK COPIED');
  } catch (error) {
    window.prompt('Copy challenge link:', url);
    hud.setShareStatus('COPY LINK');
  }
}

function openSettings() {
  if (state === 'running') pauseRun();
  settingsOpen = true;
  hud.showSettings(true);
}

function closeSettings() {
  settingsOpen = false;
  hud.showSettings(false);
}

const input = new InputManager({
  onAction(action) {
    if (action === 'restart') {
      if (!settingsOpen) startRun();
    } else if (action === 'mute') {
      const muted = audio.toggleMute();
      profile.settings.muted = muted;
      saveProfile(storage, profile);
      hud.showMessage(muted ? 'AUDIO MUTED' : 'AUDIO ON', { duration: 900 });
    } else if (action === 'pause') {
      if (settingsOpen) {
        closeSettings();
      } else {
        togglePause();
      }
    }
  }
});

document.getElementById('start-btn').addEventListener('click', () => startRun());
document.getElementById('restart-btn').addEventListener('click', () => startRun());
document.getElementById('pause-restart-btn').addEventListener('click', () => startRun());
document.getElementById('resume-btn').addEventListener('click', () => resumeRun());
document.getElementById('pause-menu-btn').addEventListener('click', () => returnToMenu());
document.getElementById('finish-menu-btn').addEventListener('click', () => returnToMenu());
document.getElementById('next-course-btn').addEventListener('click', () => nextCourse());
document.getElementById('share-run-btn').addEventListener('click', () => shareCurrentRun());
document.getElementById('pause-btn').addEventListener('click', () => togglePause());
document.getElementById('settings-close').addEventListener('click', () => closeSettings());

document.querySelectorAll('[data-open-settings]').forEach((button) => {
  button.addEventListener('click', () => openSettings());
});

musicVolumeInput.addEventListener('input', () => {
  const value = Number(musicVolumeInput.value) / 100;
  profile.settings.musicVolume = value;
  musicVolumeValue.textContent = `${Math.round(value * 100)}%`;
  audio.setVolumes({ music: value });
  saveProfile(storage, profile);
});

effectsVolumeInput.addEventListener('input', () => {
  const value = Number(effectsVolumeInput.value) / 100;
  profile.settings.effectsVolume = value;
  effectsVolumeValue.textContent = `${Math.round(value * 100)}%`;
  audio.setVolumes({ effects: value });
  saveProfile(storage, profile);
});

bloomSelect.addEventListener('change', () => {
  profile.settings.bloom = bloomSelect.value;
  applyBloom(profile.settings.bloom);
  saveProfile(storage, profile);
});

flashingSelect.addEventListener('change', () => {
  profile.settings.flashing = flashingSelect.value;
  applyFlashing(profile.settings.flashing);
  saveProfile(storage, profile);
});

ghostSelect.addEventListener('change', () => {
  profile.settings.ghost = ghostSelect.value === 'on';
  saveProfile(storage, profile);

  if (!profile.settings.ghost) {
    ghostAircraft.group.visible = false;
  } else if (state === 'running' && bestGhost.length > 1) {
    ghostAircraft.group.visible = true;
  }
});

window.addEventListener('keydown', (event) => {
  if (settingsOpen) return;
  if (event.code === 'Enter' && (state === 'menu' || state === 'finished')) {
    event.preventDefault();
    startRun();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseRun();
});

window.addEventListener('blur', () => pauseRun());

function startRun() {
  state = 'running';
  lastResult = null;
  race.reset();
  accumulator = 0;
  lastFrameTime = performance.now();
  course.reset();
  physics.reset(startVector, START_YAW, START_SPEED);
  cameraSmoothed = false;
  cameraShake = 0;
  input.reset();

  ghostRecorder.reset();
  captureGhost(0, true);
  ghostPlayer.setSamples(bestGhost);
  ghostAircraft.group.visible = profile.settings.ghost && bestGhost.length > 1;

  hud.clearMessage();
  hud.showStart(false);
  hud.hideResult();
  hud.showPause(false);
  hud.showSettings(false);
  settingsOpen = false;
  hud.showHud(true);
  hud.setBest(bestTime, bestMedal);

  if (ghostAircraft.group.visible) {
    hud.showMessage('PB GHOST ACTIVE', { duration: 1100 });
  }

  audio.setPaused(false);
  audio.init().catch(() => {});
}

function pauseRun() {
  if (state !== 'running') return;
  state = 'paused';
  accumulator = 0;
  input.reset();
  hud.showPause(true);
  audio.setPaused(true);
}

function resumeRun() {
  if (state !== 'paused') return;
  state = 'running';
  accumulator = 0;
  lastFrameTime = performance.now();
  input.reset();
  hud.showPause(false);
  audio.setPaused(false);
}

function togglePause() {
  if (state === 'running') {
    pauseRun();
  } else if (state === 'paused') {
    resumeRun();
  }
}

function returnToMenu() {
  state = 'menu';
  accumulator = 0;
  race.reset();
  course.reset();
  physics.reset(startVector, START_YAW, START_SPEED);
  cameraSmoothed = false;
  input.reset();
  ghostAircraft.group.visible = false;

  hud.clearMessage();
  hud.showPause(false);
  hud.showSettings(false);
  settingsOpen = false;
  hud.hideResult();
  hud.showHud(false);
  hud.showStart(true);
  hud.setBest(bestTime, bestMedal);
  audio.setPaused(true);
}

function finishRun() {
  if (state !== 'running') return;
  state = 'finished';
  accumulator = 0;

  const previousBest = bestTime;
  const isRecord = race.time < bestTime;
  const medal = getMedal(race.time, selectedCourse.medals);
  captureGhost(race.elapsed, true);

  if (isRecord) {
    bestTime = race.time;
    bestMedal = medal;
    record = setRecord(profile, recordKey, {
      bestTime,
      bestSplits: race.sectorTimes.slice(),
      crashes: race.crashes,
      misses: race.misses,
      ghost: ghostRecorder.samples.slice(),
      medal: medal ? medal.id : null,
      updatedAt: Date.now()
    });
    bestSplits = record ? record.bestSplits : [];
    bestGhost = record ? record.ghost : [];
    saveProfile(storage, profile);
    hud.setBest(bestTime, bestMedal);
  }

  const challengeResult = activeChallenge && activeChallenge.courseId === selectedCourse.id
    ? {
      target: activeChallenge.target,
      beaten: race.time <= activeChallenge.target
    }
    : null;

  lastResult = {
    courseId: selectedCourse.id,
    courseName: selectedCourse.name,
    time: race.time
  };

  hud.showResult({
    time: race.time,
    best: bestTime,
    isRecord,
    previousBest,
    medal,
    crashes: race.crashes,
    misses: race.misses,
    challenge: challengeResult
  });
  hud.showMessage('COURSE CLEAR', { duration: 1800 });
  audio.finish();
  audio.setPaused(false);
}

function crash() {
  if (state !== 'running') return;

  audio.crash();
  crashEffects.trigger(physics.position);
  hud.flash();
  hud.showMessage(`CONNECTION LOST // +${CRASH_PENALTY_SECONDS.toFixed(1)}S`, {
    warn: true,
    duration: 1300
  });
  cameraShake = reduceFlashing ? 0.35 : 1.1;
  race.addCrash();

  const checkpoint = course.getCheckpoint();
  physics.respawn(checkpoint.position, checkpoint.yaw, 52);
  course.previousPosition = null;
}

function handleRingEvent(event) {
  if (!event.passed && !event.missed) return;

  if (event.missed) {
    race.addMiss();
  }

  if (event.refill) {
    physics.boost = 1;

    const split = race.recordSector();
    const sectorIndex = race.sectorTimes.length - 1;
    const bestSplit = bestSplits[sectorIndex];
    const delta = Number.isFinite(bestSplit) ? split - bestSplit : null;

    if (event.missed) {
      audio.checkpoint();
      hud.showMessage('CHECKPOINT // RING MISSED', { miss: true, duration: 1300 });
    } else {
      audio.checkpoint();
      hud.showMessage(
        delta === null ? 'CHECKPOINT // BOOST FULL' : `CHECKPOINT // ${formatDelta(delta)}`,
        { duration: 1300 }
      );
    }
  } else if (event.missed) {
    audio.miss();
    hud.showMessage('RING MISSED', { miss: true, duration: 700 });
  } else {
    audio.chime(event.index);
  }

  if (event.finished) finishRun();
}

function captureGhost(time, force = false) {
  ghostTransform.x = physics.position.x;
  ghostTransform.y = physics.position.y;
  ghostTransform.z = physics.position.z;
  ghostTransform.pitch = physics.pitch;
  ghostTransform.yaw = physics.yaw;
  ghostTransform.roll = physics.roll;
  return ghostRecorder.capture(time, ghostTransform, force);
}

function simulateStep(dt, time) {
  race.tick(dt);

  const info = physics.update(dt, input.state);
  lastSpeedRatio = info.speedRatio ?? 0;
  captureGhost(race.elapsed);

  const hitBuilding = physics.grace <= 0
    && collisionIndex.intersectsSegment(physics.previousPosition, physics.position);

  if (info.crashed || hitBuilding) {
    crash();
    return;
  }

  const event = course.update(dt, time, physics.position);
  handleRingEvent(event);

  if (info.boostStarted) audio.boostWhoosh();
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

  camera.updateMatrixWorld();
}

function getRingGuidance(ring) {
  if (!ring) return null;

  guideLocal.copy(ring.position).applyMatrix4(camera.matrixWorldInverse);
  guideProjected.copy(ring.position).project(camera);

  const inFront = guideLocal.z < 0;
  const onScreen = inFront
    && Math.abs(guideProjected.x) < 0.86
    && Math.abs(guideProjected.y) < 0.82;

  const angle = inFront
    ? Math.atan2(guideLocal.x, guideLocal.y)
    : Math.atan2(guideLocal.x, -guideLocal.z);

  return {
    visible: !onScreen,
    angle
  };
}

function updateFlightPresentation(dt, time) {
  physics.applyTo(aircraft.group);
  aircraft.update({
    throttle: physics.throttle,
    boost: physics.boosting ? 1 : 0,
    speed: physics.speed,
    time
  });

  audio.updateEngine(physics.throttle, lastSpeedRatio, physics.boosting ? 1 : 0);
  updateCamera(dt, lastSpeedRatio);

  if (ghostAircraft.group.visible) {
    const ghostTransform = ghostPlayer.update(race.elapsed);
    if (ghostTransform) {
      ghostAircraft.applyTo(ghostTransform);
    } else {
      ghostAircraft.group.visible = false;
    }
  }

  const ring = course.rings[course.currentIndex] || null;
  const distance = ring ? physics.position.distanceTo(ring.position) : 0;
  const guide = getRingGuidance(ring);

  hud.update({
    speed: physics.speed,
    altitude: physics.position.y,
    time: race.time,
    ring: course.currentIndex,
    total: RING_COUNT,
    best: bestTime,
    boost: physics.boost,
    distance,
    guide
  });
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

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const frameDt = Math.min((now - lastFrameTime) / 1000, 0.25);
  lastFrameTime = now;
  elapsedTime += frameDt;
  const time = elapsedTime;
  input.update();

  if (state === 'running') {
    accumulator += frameDt;
    let steps = 0;

    while (accumulator >= SIMULATION_STEP && steps < MAX_SIMULATION_STEPS && state === 'running') {
      simulateStep(SIMULATION_STEP, time);
      accumulator -= SIMULATION_STEP;
      steps++;
    }

    // Do not let a long frame build an endless simulation backlog.
    if (steps >= MAX_SIMULATION_STEPS) accumulator = 0;

    if (state === 'running' || state === 'finished') {
      updateFlightPresentation(frameDt, time);
    }
  } else if (state === 'menu') {
    updateMenu(frameDt, time);
  } else {
    aircraft.update({
      throttle: 0,
      boost: 0,
      speed: 0,
      time
    });
  }

  city.update(frameDt);

  if (!reduceFlashing) {
    lightningTimer -= frameDt;
    if (lightningTimer <= 0) {
      lightningTimer = 14 + Math.random() * 18;
      lightning = 0.65;
      sky.flash(0.35 + Math.random() * 0.15);
      audio.playNoiseBurst({ duration: 1.2, from: 260, to: 50, gain: 0.1 });
    }
  }
  lightning = damp(lightning, 0, 3, frameDt);
  ambient.intensity = 0.9 + lightning * 0.9;
  hemisphere.intensity = 0.8 + lightning * 0.7;

  rain.update(frameDt, camera.position);
  crashEffects.update(frameDt, camera);
  sky.update(frameDt, time, camera.position);

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
