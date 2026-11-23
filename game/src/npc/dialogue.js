// dialogue.js — bottom-centre dialogue box for VELVET COAST.
// Original code, written for this entry. No external assets.
import { CHARACTERS, portraitCanvas, characterLine } from '../story/characters.js';

const MAX_LINE = 200;

export class DialogueBox {
  constructor(ctx) {
    this.ctx = ctx;
    this.lines = [];
    this.index = 0;
    this.onDone = null;
    this.open = false;
    this.choiceMode = false;
    this.choiceCallback = null;
    this.el = null;
    this.nameEl = null;
    this.textEl = null;
    this.hintEl = null;
    this.portraitEl = null;
    this.choiceEl = null;
    this.buildDom();
  }

  buildDom() {
    const box = document.createElement('div');
    box.id = 'dialog';
    Object.assign(box.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      // index.html sets `#dialog { inset: 0 }` for the static placeholder;
      // that rule also matches this JS-created #dialog, so its top/right
      // must be neutralised or the box stretches full-height and covers
      // the mission objective at the top of the screen.
      top: 'auto',
      right: 'auto',
      transform: 'translateX(-50%)',
      width: 'min(640px, 92vw)',
      minHeight: '110px',
      background: 'rgba(10,10,16,0.92)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderLeft: '4px solid #e8b34b',
      borderRadius: '10px',
      padding: '12px 16px 12px 12px',
      display: 'none',
      zIndex: '40',
      color: '#f2f2f2',
      fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box',
      cursor: 'pointer',
    });
    box.addEventListener('click', () => this.advance());

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '12px';
    row.style.alignItems = 'flex-start';
    box.appendChild(row);

    const portrait = document.createElement('div');
    portrait.style.flex = '0 0 64px';
    portrait.style.width = '64px';
    portrait.style.height = '64px';
    portrait.style.borderRadius = '8px';
    portrait.style.overflow = 'hidden';
    portrait.style.border = '1px solid rgba(255,255,255,0.25)';
    row.appendChild(portrait);
    this.portraitEl = portrait;

    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.minWidth = '0';
    row.appendChild(body);

    const name = document.createElement('div');
    name.style.fontWeight = '700';
    name.style.fontSize = '15px';
    name.style.marginBottom = '4px';
    body.appendChild(name);
    this.nameEl = name;

    const text = document.createElement('div');
    text.style.fontSize = '15px';
    text.style.lineHeight = '1.45';
    body.appendChild(text);
    this.textEl = text;

    const hint = document.createElement('div');
    hint.textContent = 'E ▸';
    hint.style.textAlign = 'right';
    hint.style.fontSize = '12px';
    hint.style.color = 'rgba(255,255,255,0.55)';
    hint.style.marginTop = '6px';
    box.appendChild(hint);
    this.hintEl = hint;

    const choices = document.createElement('div');
    choices.style.display = 'none';
    choices.style.flexDirection = 'column';
    choices.style.gap = '8px';
    choices.style.marginTop = '10px';
    box.appendChild(choices);
    this.choiceEl = choices;

    document.body.appendChild(box);
    this.el = box;
  }

  startDialogue(lines, onDone) {
    const clean = (Array.isArray(lines) ? lines : []).map((l) => ({
      speaker: l.speaker || 'marco',
      text: String(l.text || '').slice(0, MAX_LINE),
    }));
    if (!clean.length) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    this.lines = clean;
    this.index = 0;
    this.onDone = typeof onDone === 'function' ? onDone : null;
    this.choiceMode = false;
    this.open = true;
    this.ctx.dialogOpen = true;
    this.el.style.display = 'block';
    this.choiceEl.style.display = 'none';
    this.hintEl.style.display = 'block';
    this.renderLine();
  }

  renderLine() {
    const line = this.lines[this.index];
    if (!line) return;
    const info = characterLine(line.speaker);
    this.nameEl.textContent = info.name;
    this.nameEl.style.color = info.color;
    this.el.style.borderLeftColor = info.color;
    this.textEl.textContent = line.text;
    this.portraitEl.innerHTML = '';
    const canvas = portraitCanvas(line.speaker);
    canvas.style.display = 'block';
    this.portraitEl.appendChild(canvas);
    const ch = CHARACTERS[line.speaker];
    if (ch) this.nameEl.title = ch.role;
  }

  advance() {
    if (!this.open || this.choiceMode) return;
    this.index += 1;
    if (this.index >= this.lines.length) {
      this.close();
      return;
    }
    this.renderLine();
  }

  // Choice prompt: options [{id, label}]; onPick(id) fires once.
  showChoice(promptLine, options, onPick) {
    const opts = Array.isArray(options) ? options : [];
    if (!opts.length) {
      if (typeof onPick === 'function') onPick(null);
      return;
    }
    this.choiceMode = true;
    this.choiceCallback = typeof onPick === 'function' ? onPick : null;
    this.open = true;
    this.ctx.dialogOpen = true;
    this.el.style.display = 'block';
    this.hintEl.style.display = 'none';
    if (promptLine) {
      const info = characterLine(promptLine.speaker || 'marco');
      this.nameEl.textContent = info.name;
      this.nameEl.style.color = info.color;
      this.el.style.borderLeftColor = info.color;
      this.textEl.textContent = String(promptLine.text || '').slice(0, MAX_LINE);
      this.portraitEl.innerHTML = '';
      const canvas = portraitCanvas(promptLine.speaker || 'marco');
      canvas.style.display = 'block';
      this.portraitEl.appendChild(canvas);
    }
    this.choiceEl.innerHTML = '';
    this.choiceEl.style.display = 'flex';
    this._choiceIds = opts.map((o) => o.id);
    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = `${i + 1}. ${opt.label}`;
      Object.assign(btn.style, {
        textAlign: 'left',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '6px',
        color: '#f2f2f2',
        padding: '8px 10px',
        fontSize: '14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pickChoice(opt.id);
      });
      this.choiceEl.appendChild(btn);
    });
  }

  pickChoice(id) {
    if (!this.choiceMode) return;
    this.choiceMode = false;
    const cb = this.choiceCallback;
    this.choiceCallback = null;
    this.close();
    if (cb) cb(id);
  }

  isOpen() {
    return this.open;
  }

  close() {
    this.open = false;
    this.choiceMode = false;
    this.lines = [];
    this.index = 0;
    this.el.style.display = 'none';
    this.ctx.dialogOpen = false;
    const done = this.onDone;
    this.onDone = null;
    if (done) done();
  }

  // Called every frame by the mission runner (or main loop once wired):
  // E advances dialogue, number keys pick a choice.
  update(_dt) {
    if (!this.open) return;
    const input = this.ctx.input;
    if (!input) return;
    if (this.choiceMode) {
      for (let i = 0; i < 3; i++) {
        if (input.consumePressed(`Digit${i + 1}`)) {
          const btn = this.choiceEl.children[i];
          if (btn) {
            const id = this._choiceIds ? this._choiceIds[i] : null;
            this.pickChoice(id);
          }
          return;
        }
      }
      return;
    }
    if (input.consumePressed('KeyE')) this.advance();
  }
}
