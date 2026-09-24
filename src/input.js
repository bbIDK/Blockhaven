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
    this.lockFailed = false;
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
      if (this.locked) { this.lockFailed = false; this.skipMoves = 1; }
      if (was && !this.locked) { this.buttons = 0; this.onUnlock?.(); }
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
  }

  lock() {
    if (this.locked || !this.target.requestPointerLock) { if (!this.target.requestPointerLock) this.lockFailed = true; return; }
    try {
      const p = this.target.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          const q = this.target.requestPointerLock();
          if (q && q.catch) q.catch(() => { this.lockFailed = true; });
        });
      }
    } catch {
      this.lockFailed = true;
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
