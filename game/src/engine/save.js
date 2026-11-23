// save.js — STUB for Wave A. Simple localStorage save/load.
// Safe when localStorage is unavailable (private mode, headless, etc.).

const KEY = 'velvet-coast-save';

export function saveGame(state) {
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      position: state.position || null,
      cash: typeof state.cash === 'number' ? state.cash : 0,
      mission: typeof state.mission === 'number' ? state.mission : 0,
      missionsDone: Array.isArray(state.missionsDone) ? state.missionsDone : [],
      wanted: typeof state.wanted === 'number' ? state.wanted : 0,
      hp: typeof state.hp === 'number' ? state.hp : 100,
      armor: typeof state.armor === 'number' ? state.armor : 0,
      radioStation: typeof state.radioStation === 'number' ? state.radioStation : 0,
      hour: typeof state.hour === 'number' ? state.hour : 10,
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    // Back-compat: old saves (version 1, pre-HUD fields) get defaults.
    return {
      version: typeof data.version === 'number' ? data.version : 1,
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
      position: data.position || null,
      cash: typeof data.cash === 'number' ? data.cash : 0,
      mission: typeof data.mission === 'number' ? data.mission : 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      wanted: typeof data.wanted === 'number' ? data.wanted : 0,
      hp: typeof data.hp === 'number' ? data.hp : 100,
      armor: typeof data.armor === 'number' ? data.armor : 0,
      radioStation: typeof data.radioStation === 'number' ? data.radioStation : 0,
      hour: typeof data.hour === 'number' ? data.hour : 10,
    };
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
