// menu.js — title screen + pause menu inside #menu.
// Title: "VELVET COAST", tagline, controls, "Press ENTER to play".
// Pause (Esc): Resume / Controls / Save / Quit to Title.
// Game pause is the ctx.paused flag; the main loop honours it.
// Original code, written for this entry. No network, no fetch.

const CONTROLS_HTML = `
  <div class="vc-controls">
    <div><b>W A S D</b> — gerak</div>
    <div><b>Mouse</b> — putar kamera</div>
    <div><b>F</b> — masuk / keluar mobil</div>
    <div><b>V</b> — ganti kamera</div>
    <div><b>Tab</b> — ganti stasiun radio</div>
    <div><b>1 / 2 / 3</b> — ganti senjata</div>
    <div><b>R</b> — reload</div>
    <div><b>E</b> — interaksi</div>
    <div><b>Esc</b> — pause</div>
  </div>`;

export class Menu {
  constructor(ctx) {
    this.ctx = ctx;
    this.menuEl = document.getElementById('menu');
    this.titleEl = document.getElementById('title-screen');
    this.pauseEl = document.getElementById('pause-menu');
    this.state = 'closed'; // 'closed' | 'title' | 'pause'
    this._built = false;
    this._buildOnce();
  }

  _buildOnce() {
    if (this._built || !this.menuEl) return;
    this._built = true;

    if (this.titleEl) {
      this.titleEl.innerHTML = `
        <div class="vc-title-wrap">
          <h1 class="vc-title">VELVET COAST</h1>
          <p class="vc-tagline">Port Solana — pulang setelah 12 tahun.</p>
          <p class="vc-press">PRESS ENTER TO PLAY</p>
          ${CONTROLS_HTML}
        </div>`;
    }

    if (this.pauseEl) {
      this.pauseEl.innerHTML = `
        <div class="vc-pause-wrap">
          <h2 class="vc-pause-title">PAUSED</h2>
          <button class="vc-btn" data-act="resume">Resume</button>
          <button class="vc-btn" data-act="controls">Controls</button>
          <button class="vc-btn" data-act="save">Save Game</button>
          <button class="vc-btn" data-act="quit">Quit to Title</button>
          <div class="vc-controls vc-controls-hidden" id="vc-pause-controls">
            ${CONTROLS_HTML}
          </div>
          <p class="vc-save-msg" id="vc-save-msg"></p>
        </div>`;
      this.pauseEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.getAttribute('data-act');
        if (act === 'resume') this.hide();
        else if (act === 'controls') this._togglePauseControls();
        else if (act === 'save') this._saveGame();
        else if (act === 'quit') this.showTitle();
      });
    }
  }

  _togglePauseControls() {
    const el = document.getElementById('vc-pause-controls');
    if (el) el.classList.toggle('vc-controls-hidden');
  }

  _saveGame() {
    const msg = document.getElementById('vc-save-msg');
    const p = this.ctx.player || {};
    const state = {
      position: p.pos ? { x: p.pos.x, y: p.pos.y, z: p.pos.z } : null,
      cash: typeof p.cash === 'number' ? p.cash : 0,
      mission: typeof this.ctx.mission === 'number' ? this.ctx.mission : 0,
      missionsDone: Array.isArray(this.ctx.missionsDone) ? this.ctx.missionsDone : [],
      wanted: typeof this.ctx.wanted === 'number' ? this.ctx.wanted : 0,
      hp: typeof p.hp === 'number' ? p.hp : 100,
      armor: typeof p.armor === 'number' ? p.armor : 0,
      radioStation: typeof this.ctx.radioStation === 'number' ? this.ctx.radioStation : 0,
      hour: this.ctx.time ? this.ctx.time.hour : 10,
    };
    let ok = false;
    try {
      ok = !!(this.ctx.save && this.ctx.save.saveGame && this.ctx.save.saveGame(state));
    } catch {
      ok = false;
    }
    if (msg) msg.textContent = ok ? 'Game saved.' : 'Save gagal.';
    if (this.ctx.hud && this.ctx.hud.notifications) {
      this.ctx.hud.notifications.toast(ok ? 'Game saved.' : 'Save gagal.', ok ? 'success' : 'error');
    }
  }

  _show(elToShow) {
    if (!this.menuEl) return;
    this.menuEl.style.display = 'block';
    this.menuEl.style.pointerEvents = 'auto';
    if (this.titleEl) this.titleEl.style.display = elToShow === 'title' ? 'flex' : 'none';
    if (this.pauseEl) this.pauseEl.style.display = elToShow === 'pause' ? 'flex' : 'none';
  }

  showTitle() {
    this.state = 'title';
    this.ctx.paused = true;
    this._show('title');
  }

  showPause() {
    this.state = 'pause';
    this.ctx.paused = true;
    this._show('pause');
  }

  hide() {
    this.state = 'closed';
    this.ctx.paused = false;
    if (this.menuEl) {
      this.menuEl.style.display = 'none';
      this.menuEl.style.pointerEvents = 'none';
    }
  }

  isOpen() {
    return this.state !== 'closed';
  }

  // Called every frame by the integration wave. ENTER starts from the
  // title, Esc toggles pause. Uses consumePressed so one press = one action.
  update() {
    const input = this.ctx.input;
    if (!input || typeof input.consumePressed !== 'function') return;
    if (this.state === 'title') {
      if (input.consumePressed('Enter')) this.hide();
    } else if (this.state === 'pause') {
      if (input.consumePressed('Escape')) this.hide();
      else if (input.consumePressed('Enter')) this.hide();
    } else if (this.state === 'closed') {
      if (input.consumePressed('Escape')) this.showPause();
    }
  }
}
