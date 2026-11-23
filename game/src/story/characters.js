// characters.js — VELVET COAST story cast.
// Original code, written for this entry. No external assets.
import * as THREE from 'three';

export const CHARACTERS = {
  marco: {
    name: 'Marco Varela',
    color: '#e8b34b',
    role: 'Ex-soldier, pulang setelah 12 tahun',
    accent: '#e8b34b',
  },
  rosa: {
    name: 'Rosa Quintero',
    color: '#ff5fa2',
    role: 'DJ radio, sekutu',
    accent: '#ff5fa2',
  },
  dex: {
    name: 'Dex Marlowe',
    color: '#59d6ff',
    role: 'Mekanik, partner',
    accent: '#59d6ff',
  },
  elfaro: {
    name: 'Augusto "El Faro" Retes',
    color: '#b388ff',
    role: 'Bos kartel',
    accent: '#b388ff',
  },
  vega: {
    name: 'Lt. Vega',
    color: '#8fd17a',
    role: 'Polisi yang lelah secara moral',
    accent: '#8fd17a',
  },
  eltoro: {
    name: 'El Toro',
    color: '#ff6b4a',
    role: 'Tangan kanan El Faro',
    accent: '#ff6b4a',
  },
};

// Skin tones per character, kept muted so the accent colour reads first.
const SKINS = {
  marco: '#c98d64',
  rosa: '#e8b88a',
  dex: '#d9a075',
  elfaro: '#8a5a3b',
  vega: '#c98d64',
  eltoro: '#6e4530',
};

function initials(name) {
  const parts = name.replace(/"/g, '').split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// Procedural 64x64 portrait: dark backdrop, accent shoulders,
// head silhouette in the character skin tone, initial letter.
export function portraitCanvas(characterKey) {
  const ch = CHARACTERS[characterKey] || CHARACTERS.marco;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  // Backdrop: near-black with a faint accent wash at the top.
  c.fillStyle = '#14141c';
  c.fillRect(0, 0, 64, 64);
  const wash = c.createLinearGradient(0, 0, 0, 40);
  wash.addColorStop(0, ch.accent);
  wash.addColorStop(1, 'rgba(20,20,28,0)');
  c.globalAlpha = 0.35;
  c.fillStyle = wash;
  c.fillRect(0, 0, 64, 40);
  c.globalAlpha = 1;
  // Shoulders in the accent colour.
  c.fillStyle = ch.accent;
  c.beginPath();
  c.ellipse(32, 72, 26, 20, 0, Math.PI, 0);
  c.fill();
  // Head silhouette.
  c.fillStyle = SKINS[characterKey] || '#c98d64';
  c.beginPath();
  c.arc(32, 28, 14, 0, Math.PI * 2);
  c.fill();
  // Hair cap, darker shade of the accent.
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.arc(32, 26, 14, Math.PI, 0);
  c.fill();
  // Initial, bottom-right, on a small dark chip.
  c.fillStyle = 'rgba(0,0,0,0.55)';
  c.fillRect(42, 44, 20, 18);
  c.fillStyle = '#ffffff';
  c.font = 'bold 13px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(initials(ch.name), 52, 53);
  return canvas;
}

export function characterLine(key) {
  const ch = CHARACTERS[key] || CHARACTERS.marco;
  return { name: ch.name, color: ch.color };
}

// Small helper for 3D name tags: accent colour as a THREE.Color.
export function characterColor(key) {
  const ch = CHARACTERS[key] || CHARACTERS.marco;
  return new THREE.Color(ch.accent);
}
