// Keyboard, mouse and pointer-lock state. Edge-triggered events are collected per frame and
// cleared by endFrame().
export class Input {
  constructor(target) {
    this.target = target;
    this.down = new Set();
    this.pressed = new Set();
    this.mdx = 0;
    this.mdy = 0;
    this.buttons = 0;
    this.clicked = 0;
    this.released = 0;
    this.wheel = 0;
    this.locked = false;
    this.lockFailed = false; // true once pointer lock looks unsupported: drag to look instead
    this.lockFailures = 0;
    this.capture = false; // true while the game (not a menu) has focus
    this.onUnlock = null;
    this.onKey = null;
    this.dragging = false;
    this.dragStart = null;
    this.skipMoves = 0;

    const typing = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      this.onKey?.(e);
      if (this.capture && (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'F3' ||
          ((e.ctrlKey || e.metaKey) && ['KeyW', 'KeyS', 'KeyD', 'KeyF'].includes(e.code)))) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.buttons = 0; });

    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // Some browsers report a bogus jump right after locking; skip it and any absurd spikes.
        if (this.skipMoves > 0) { this.skipMoves--; return; }
        if (Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return;
        this.mdx += e.movementX;
        this.mdy += e.movementY;
      } else if (this.capture && this.lockFailed && this.buttons) {
        // Fallback when pointer lock is unavailable: drag to look.
        if (this.dragStart && Math.hypot(e.clientX - this.dragStart[0], e.clientY - this.dragStart[1]) > 6) this.dragging = true;
        this.mdx += e.movementX;
        this.mdy += e.movementY;
      }
    });
    target.addEventListener('mousedown', (e) => {
      if (!this.capture) return;
      e.preventDefault();
      if (!this.locked && !this.lockFailed) { this.lock(); return; }
      const bit = e.button === 0 ? 1 : e.button === 2 ? 2 : e.button === 1 ? 4 : 0;
      this.buttons |= bit;
      if (this.locked) this.clicked |= bit;
      else { this.dragStart = [e.clientX, e.clientY]; this.dragging = false; }
    });
    window.addEventListener('mouseup', (e) => {
      const bit = e.button === 0 ? 1 : e.button === 2 ? 2 : e.button === 1 ? 4 : 0;
      if (!this.locked && this.lockFailed && this.capture && (this.buttons & bit) && !this.dragging) this.clicked |= bit;
      if (this.buttons & bit) this.released |= bit;
      this.buttons &= ~bit;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('wheel', (e) => {
      if (!this.capture) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === target;
      if (this.locked) { this.lockFailed = false; this.lockFailures = 0; this.skipMoves = 1; }
      // A lock that arrives after the game stopped wanting it (a menu opened meanwhile) is let go.
      if (this.locked && !this.capture) { document.exitPointerLock(); return; }
      if (was && !this.locked) { this.buttons = 0; this.onUnlock?.(); }
    });
    document.addEventListener('pointerlockerror', () => this.lockRefused());
  }

  // A refusal can be temporary (Chrome blocks re-locking for a moment after Esc), so only give up
  // on pointer lock after it has failed several times in a row.
  lockRefused() {
    this.lockFailures++;
    if (this.lockFailures >= 3) this.lockFailed = true;
  }

  lock() {
    if (this.locked) return;
    if (!this.target.requestPointerLock) { this.lockFailed = true; return; }
    try {
      // Refusals are counted by the pointerlockerror event; the promise only handles the
      // browsers that don't support unadjusted movement.
      const p = this.target.requestPointerLock({ unadjustedMovement: true });
      p?.catch?.((err) => {
        if (err?.name === 'NotSupportedError') this.target.requestPointerLock()?.catch?.(() => {});
      });
    } catch {
      this.lockRefused();
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mdx = 0;
    this.mdy = 0;
    this.clicked = 0;
    this.released = 0;
    this.wheel = 0;
  }
}
