// main.js — VELVET COAST bootstrap: renderer, scene, camera, input, world,
// player, game loop. Original code, written for this entry.
import * as THREE from 'three';
import { createRenderer, resizeRenderer } from './engine/renderer.js';
import { createScene } from './engine/scene.js';
import { createInput } from './engine/input.js';
import { TimeOfDay } from './engine/time.js';
import { Weather } from './world/weather.js';
import { audio, RADIO_STATIONS } from './engine/audio.js';
import { saveGame, loadGame } from './engine/save.js';
import { buildCity, groundHeight } from './world/city.js';
import { Player } from './player/player.js';
import { createPlayerCamera, updatePlayerCamera } from './player/camera.js';
import { spawnCityVehicles, createVehicle, updateVehicleInteraction } from './vehicles/carfactory.js';
import { TrafficManager } from './vehicles/traffic.js';
import { PedestrianManager } from './npc/pedestrian.js';
import { WeaponSystem } from './crime/weapons.js';
import { CombatManager, spawnExplosion } from './crime/combat.js';
import { WantedSystem } from './crime/wanted.js';
import { PoliceOfficer } from './npc/police.js';
import { HUD } from './hud/hud.js';
import { Minimap } from './hud/minimap.js';
import { Menu } from './hud/menu.js';
import { Notifications } from './hud/notifications.js';
import { RadioHUD } from './hud/radio.js';
import { MissionRunner } from './missions/missionrunner.js';
import { MissionMarkers } from './missions/markers.js';
import { DialogueBox } from './npc/dialogue.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, -12);
const input = createInput(canvas);

const ctx = {
  scene,
  camera,
  renderer,
  input,
  clock: new THREE.Clock(),
  colliders: [],
  groundHeight,
  roadGraph: null,
  time: new TimeOfDay(10),
  weather: new Weather(),
  audio,
  save: { saveGame, loadGame },
  player: null,
  vehicles: [],
  traffic: null,
  pedestrians: null,
  radioStation: 0,
  radioStations: RADIO_STATIONS,
  lastGunshot: null,
  updatables: [],
  spawnPoints: [],
  wanted: 0,
  mission: 0,
  // Integration wave: pause/dialogue gates, HUD readouts, systems below.
  paused: true, // title screen shows on load; Enter starts the game
  dialogOpen: false,
  missionText: '',
  missionMarkers: [],
  nearestPoliceDist: null,
  storyFlags: {},
  weapons: null,
  combat: null,
  wantedSystem: null,
  police: null,
  notifications: null,
  hud: null,
  minimap: null,
  menu: null,
  radio: null,
  dialogue: null,
  missionRunner: null,
};

// Build the world (fills colliders, groundHeight, roadGraph, spawnPoints).
buildCity(ctx);

// Park the four player vehicles across the city.
spawnCityVehicles(ctx);

// Traffic AI + pedestrians (Wave 6); both register per-frame updates.
ctx.traffic = new TrafficManager(ctx);
ctx.pedestrians = new PedestrianManager(ctx);
ctx.updatables.push((dt) => ctx.traffic.update(dt));
ctx.updatables.push((dt) => ctx.pedestrians.update(dt));

// Restore a save if one exists, else spawn downtown.
const saved = loadGame();
ctx.player = new Player(ctx);
if (saved && saved.position) {
  ctx.player.pos.set(saved.position.x, saved.position.y, saved.position.z);
  ctx.player.cash = saved.cash || 0;
  if (typeof saved.hour === 'number') ctx.time.hour = saved.hour;
}
createPlayerCamera(ctx);

// --- Integration wave: wire every system onto ctx (order matters) ---
// Combat first (police registers enemies in it), then wanted/police,
// then HUD/menu/missions. DialogueBox is created here so the mission
// runner reuses this instance instead of building its own.
ctx.weapons = new WeaponSystem(ctx);
ctx.combat = new CombatManager(ctx, ctx.weapons);
ctx.wantedSystem = new WantedSystem(ctx);
ctx.police = new PoliceOfficer(ctx); // also sets ctx.onPlayerDeath
ctx.onPlayerDeath = () => ctx.police.handlePlayerDeath();
ctx.notifications = new Notifications(ctx);
ctx.hud = new HUD(ctx);
ctx.minimap = new Minimap(ctx);
ctx.menu = new Menu(ctx);
ctx.radio = ctx.hud.radio; // HUD owns the single shared RadioHUD instance
ctx.dialogue = new DialogueBox(ctx);
ctx.missionRunner = new MissionRunner(ctx);
ctx.missionMarkers = new MissionMarkers(ctx);
// Share the instances with the runner so it does not build duplicates.
ctx.missionRunner.dialogue = ctx.dialogue;
ctx.missionRunner.markers = ctx.missionMarkers;
ctx.markers = ctx.missionMarkers;

// Full-state save wrapper: fills every field from live state, so callers
// (pause menu, mission-complete autosave) can pass a partial patch.
function collectSaveState() {
  const p = ctx.player;
  return {
    position: p && p.pos ? { x: p.pos.x, y: p.pos.y, z: p.pos.z } : null,
    cash: p && typeof p.cash === 'number' ? p.cash : 0,
    hp: p && typeof p.hp === 'number' ? p.hp : 100,
    armor: p && typeof p.armor === 'number' ? p.armor : 0,
    wanted: ctx.wantedSystem ? ctx.wantedSystem.stars : ctx.wanted,
    mission: ctx.mission,
    missionsDone: ctx.missionRunner ? [...ctx.missionRunner.missionsDone] : [],
    radioStation: ctx.radioStation,
    hour: ctx.time ? ctx.time.hour : 10,
  };
}
ctx.saveGame = (extra = {}) => saveGame({ ...collectSaveState(), ...extra });
ctx.save.saveGame = ctx.saveGame;

// Restore the rest of the save (position/cash/hour were restored above).
if (saved) {
  if (typeof saved.hp === 'number') ctx.player.hp = saved.hp;
  if (typeof saved.armor === 'number') ctx.player.armor = saved.armor;
  if (typeof saved.radioStation === 'number') ctx.radioStation = saved.radioStation;
  if (typeof saved.mission === 'number') ctx.mission = saved.mission;
  if (Array.isArray(saved.missionsDone)) {
    ctx.missionRunner.missionsDone = new Set(saved.missionsDone);
  }
  if (typeof saved.wanted === 'number') ctx.wantedSystem.setStars(saved.wanted);
}

// Damage flash: red vignette + HUD hook (player.takeDamage calls
// ctx.screenFlash; same function under both names).
ctx.flashDamage = () => {
  const el = document.getElementById('damage-flash');
  if (el) {
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 180);
  }
  if (ctx.hud && typeof ctx.hud.flashDamage === 'function') ctx.hud.flashDamage();
};
ctx.screenFlash = ctx.flashDamage;

// Explosion: crime/combat.js's spawnExplosion (static import, export
// terverifikasi ada) — fireball, light, shake, flash + damage radius.
// SFX ledakan diputar di sini karena spawnExplosion sendiri tidak
// memutar audio. Fallback dynamic-import + lampu lokal dihapus.
ctx.spawnExplosion = (pos, radius = 5) => {
  const a = ctx.audio;
  if (a && typeof a.playExplosion === 'function') a.playExplosion();
  return spawnExplosion(ctx, pos, radius);
};

// Title screen on load; the world renders behind it, Enter starts play.
ctx.menu.showTitle();

window.addEventListener('resize', () => resizeRenderer(renderer, camera));

// Dev hooks (?dev=1): setTime + spawnAt must work in Wave A;
// setWanted / setWeather / loadMission are wired stubs for later waves.
const dev = new URLSearchParams(window.location.search).has('dev');
if (dev) {
  window.setTime = (hour) => {
    ctx.time.hour = ((Number(hour) % 24) + 24) % 24;
    return ctx.time.hour;
  };
  // opts.vehicle: 'moro'|'sports'|'sedan'|'van' — put the player into
  // the nearest car of that type, or spawn one next to the point.
  // opts.wanted / opts.mission chain into setWanted / loadMission.
  const VEHICLE_TYPE_ALIAS = { moro: 'muscle', sports: 'sports', sedan: 'sedan', van: 'van' };
  window.spawnAt = (x, z, opts) => {
    if (ctx.player.driving) {
      ctx.player.driving = null;
      ctx.player.mesh.group.visible = true;
      if (ctx.cameraRig) ctx.cameraRig.clearChase();
    }
    ctx.player.pos.set(Number(x), groundHeight(Number(x), Number(z)), Number(z));
    ctx.player.vel.set(0, 0, 0);
    if (opts && typeof opts === 'object') {
      if (opts.vehicle && VEHICLE_TYPE_ALIAS[opts.vehicle]) {
        const type = VEHICLE_TYPE_ALIAS[opts.vehicle];
        let best = null;
        let bestD = Infinity;
        for (const v of ctx.vehicles) {
          if (v.type !== type) continue;
          const d = Math.hypot(v.pos.x - x, v.pos.z - z);
          if (d < bestD) { bestD = d; best = v; }
        }
        if (!best) best = createVehicle(ctx, type, Number(x) + 6, Number(z) + 6, 0);
        ctx.player.driving = best;
        ctx.player.mesh.group.visible = false;
        if (ctx.cameraRig) ctx.cameraRig.setChase(best);
        if (ctx.audio) ctx.audio.engineLoop(true);
      }
      if (opts.wanted !== undefined) window.setWanted(opts.wanted);
      if (opts.mission !== undefined) window.loadMission(opts.mission);
    }
    return { x: ctx.player.pos.x, y: ctx.player.pos.y, z: ctx.player.pos.z };
  };
  window.setWanted = (n) => {
    if (ctx.wantedSystem) return ctx.wantedSystem.setStars(n);
    ctx.wanted = Number(n) || 0;
    return ctx.wanted;
  };
  window.setWeather = (m) => ctx.weather.setWeather(m);
  window.loadMission = (n) => {
    if (ctx.missionRunner) return ctx.missionRunner.startMission(n);
    ctx.mission = Number(n) || 0;
    return ctx.mission;
  };
  window.__velvet = ctx;
}

// Game loop: time -> (world, unless paused/dialogue) -> camera -> HUD -> render.
// While paused or in dialogue the world freezes but the scene still
// renders behind the menu and the HUD/menu keep updating.
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(ctx.clock.getDelta(), 0.05);
  ctx.time.advance(dt);
  ctx.weather.update(dt);
  if (ctx.menu) ctx.menu.update();

  if (!ctx.paused && !ctx.dialogOpen) {
    // Tab cycles the radio (checked before carfactory consumes it while
    // driving, so one press = one station change).
    if (input.consumePressed('Tab') && ctx.radio) ctx.radio.cycleStation();
    updateVehicleInteraction(ctx, dt);
    ctx.player.update(dt);
    if (ctx.weapons) ctx.weapons.update(dt);
    if (ctx.combat) ctx.combat.update(dt);
    if (ctx.wantedSystem) ctx.wantedSystem.update(dt);
    if (ctx.police) ctx.police.update(dt);
    if (ctx.missionRunner) ctx.missionRunner.update(dt);
    // Runner mengupdate dialogue + markers di dalam update()-nya
    // (missionrunner.js:139-140); pemanggilan langsung di sini dihapus
    // supaya tidak dobel — dialogue mengonsumsi input sekali per frame.
    for (const u of ctx.updatables) u(dt);

    // Engine hum follows driving speed; ambient bed while on foot.
    const driving = !!(ctx.player && ctx.player.driving);
    if (ctx.audio) {
      if (driving && typeof ctx.audio.setEngine === 'function') {
        const v = ctx.player.driving;
        const top = v.spec ? v.spec.topSpeed : 40;
        ctx.audio.setEngine(Math.abs(v.speed || 0) / top);
      } else if (typeof ctx.audio.setEngine === 'function') {
        ctx.audio.setEngine(0);
      }
      if (!driving && !ctx._ambientOn && typeof ctx.audio.playAmbientBed === 'function') {
        ctx.audio.playAmbientBed();
        ctx._ambientOn = true;
      } else if (driving && ctx._ambientOn && typeof ctx.audio.stopAmbientBed === 'function') {
        ctx.audio.stopAmbientBed();
        ctx._ambientOn = false;
      }
    }

    // HUD objective + nearest-police distance (escape stages read it).
    if (ctx.missionRunner && ctx.missionRunner.isActive()) {
      ctx.missionText = ctx.missionRunner.currentObjectiveText();
    } else {
      ctx.missionText = '';
    }
    if (ctx.wantedSystem && ctx.player) {
      let best = null;
      for (const e of ctx.wantedSystem.policeCars || []) {
        const d = Math.hypot(e.car.pos.x - ctx.player.pos.x, e.car.pos.z - ctx.player.pos.z);
        if (best === null || d < best) best = d;
      }
      if (ctx.police && ctx.police.officers) {
        for (const o of ctx.police.officers) {
          if (!o.alive) continue;
          const d = Math.hypot(o.pos.x - ctx.player.pos.x, o.pos.z - ctx.player.pos.z);
          if (best === null || d < best) best = d;
        }
      }
      ctx.nearestPoliceDist = best;
    } else {
      ctx.nearestPoliceDist = null;
    }
  }

  // Objective stays visible while a dialogue is open or the game is
  // paused: the intro dialogue must not hide the mission objective.
  // (The block above only refreshes missionText while the game runs.)
  if ((ctx.paused || ctx.dialogOpen) && ctx.missionRunner && ctx.missionRunner.isActive()) {
    ctx.missionText = ctx.missionRunner.currentObjectiveText();
  }
  // Dialogue advance (E / choice keys) must run while the dialogue is
  // open: missionRunner.update() is gated by !dialogOpen above, so
  // without this the intro could only be advanced by mouse click.
  if (ctx.dialogOpen && ctx.missionRunner && ctx.missionRunner.dialogue) {
    ctx.missionRunner.dialogue.update(dt);
  }

  updatePlayerCamera(ctx, dt);
  if (ctx.hud) ctx.hud.update(dt);
  if (ctx.minimap) ctx.minimap.update(dt);
  renderer.render(scene, camera);
}
loop();
