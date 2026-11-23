// input.js — keyboard + mouse-drag camera input.
// Original code, written for this entry. No external assets.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    yaw: Math.PI, // face north (-z is forward when yaw = PI? see player)
    pitch: 0.18,
    // Mouse button + movement state (updated by the listeners below).
    mouseDown: false,
    mouseUp: true,
    mouseDelta: { x: 0, y: 0 },
    consumePressed(code) {
      if (input.pressed.has(code)) {
        input.pressed.delete(code);
        return true;
      }
      return false;
    },
    // Alias used by HUD/menu code; same one-shot semantics.
    consume(code) {
      return input.consumePressed(code);
    },
    // Held-key query: 'Enter', 'Escape', 'Tab', 'Digit1'..'Digit3',
    // 'KeyR', 'KeyF', 'KeyV', 'KeyE', 'KeyW', ... (all e.code values).
    down(code) {
      return input.keys.has(code);
    },
    // One-shot query without consuming: true only on the press frame.
    justPressed(code) {
      return input.pressed.has(code);
    },
    // Returns accumulated mouse movement since the last call, then resets.
    consumeMouseDelta() {
      const d = { x: input.mouseDelta.x, y: input.mouseDelta.y };
      input.mouseDelta.x = 0;
      input.mouseDelta.y = 0;
      return d;
    },
  };

  window.addEventListener('keydown', (e) => {
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
  });

  // Simple mouse drag for yaw/pitch (safe in headless browsers).
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    input.mouseDown = true;
    input.mouseUp = false;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    input.mouseDown = false;
    input.mouseUp = true;
  });
  window.addEventListener('mousemove', (e) => {
    // Always accumulate raw movement for mouse-look consumers.
    input.mouseDelta.x += e.movementX || 0;
    input.mouseDelta.y += e.movementY || 0;
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    input.yaw -= dx * 0.005;
    input.pitch += dy * 0.004;
    input.pitch = Math.max(-1.1, Math.min(1.2, input.pitch));
  });

  return input;
}
