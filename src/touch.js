// On-screen controls for phones and tablets: a movement stick, drag-to-look, tap to place,
// hold to break, plus jump/sneak/fly buttons.
import { $ } from './ui.js';

const HOLD_MS = 280;

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.active = false;
    this.move = [0, 0];
    this.look = [0, 0];
    this.jump = false;
    this.sneak = false;
    this.sprint = false;
    this.breaking = false;
    this.breakStart = false;
    this.tap = false;
    this.lookTouch = null;
    this.stickTouch = null;
    this.holdTimer = 0;
    this.lastJump = 0;

    window.addEventListener('touchstart', () => this.enable(), { passive: true, once: true });
    const canvas = $('view');
    canvas.addEventListener('touchstart', (e) => this.lookStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.lookMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.lookEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.lookEnd(e), { passive: false });

    const stick = $('stick');
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.stickTouch = t.identifier;
      this.stickMove(t);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.stickTouch) this.stickMove(t);
    }, { passive: false });
    const endStick = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.stickTouch) {
        this.stickTouch = null;
        this.move[0] = this.move[1] = 0;
        this.sprint = false;
        $('stick-knob').style.transform = '';
      }
    };
    stick.addEventListener('touchend', endStick);
    stick.addEventListener('touchcancel', endStick);

    this.hold('t-jump', (on) => {
      this.jump = on;
      if (on && this.game.creative) {
        const now = performance.now();
        if (now - this.lastJump < 300) this.game.player.flying = !this.game.player.flying;
        this.lastJump = now;
      }
    });
    this.hold('t-sneak', (on) => { this.sneak = on; });
    this.press('t-fly', () => {
      if (!this.game.creative) { this.game.ui.message('Flying needs Creative mode'); return; }
      this.game.player.flying = !this.game.player.flying;
    });
    this.press('t-inv', () => { if (this.game.state === 'play') this.game.openInventory(); else if (this.game.state === 'inventory') this.game.closeInventory(); });
    this.press('t-pause', () => { if (this.game.state === 'play') this.game.pause(); });
    this.press('t-chat', () => { if (this.game.state === 'play') this.game.openChat(); });
  }

  enable() {
    this.enabled = true;
    this.setActive(this.active);
  }

  setActive(on) {
    this.active = on;
    $('touch').hidden = !(on && this.enabled);
  }

  update() {
    if (!this.active || !this.enabled) return;
    const creative = this.game.creative, flying = this.game.player.flying;
    if (creative === this.lastCreative && flying === this.lastFlying) return;
    this.lastCreative = creative;
    this.lastFlying = flying;
    $('t-fly').hidden = !creative;
    $('t-fly').classList.toggle('on', flying);
  }

  hold(id, fn) {
    const el = $(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('on'); fn(true); }, { passive: false });
    const up = (e) => { e.preventDefault(); el.classList.remove('on'); fn(false); };
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
  }

  press(id, fn) {
    $(id).addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
    $(id).addEventListener('click', (e) => { if (!this.enabled) fn(); e.preventDefault(); });
  }

  stickMove(t) {
    const r = $('stick').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
    let dx = (t.clientX - cx) / rad, dy = (t.clientY - cy) / rad;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.move[0] = Math.abs(dx) < 0.12 ? 0 : dx;
    this.move[1] = Math.abs(dy) < 0.12 ? 0 : dy;
    this.sprint = len > 1.05 && dy < -0.6;
    $('stick-knob').style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
  }

  lookStart(e) {
    if (this.game.state !== 'play') return;
    e.preventDefault();
    this.enable();
    if (this.lookTouch) return;
    const t = e.changedTouches[0];
    this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: false };
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      if (this.lookTouch && !this.lookTouch.moved) { this.breaking = true; this.breakStart = true; }
    }, HOLD_MS);
  }

  lookMove(e) {
    const lt = this.lookTouch;
    if (!lt) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lt.id) continue;
      this.look[0] += (t.clientX - lt.x) * 1.6;
      this.look[1] += (t.clientY - lt.y) * 1.6;
      lt.x = t.clientX;
      lt.y = t.clientY;
      if (Math.hypot(t.clientX - lt.sx, t.clientY - lt.sy) > 10) lt.moved = true;
    }
  }

  lookEnd(e) {
    const lt = this.lookTouch;
    if (!lt) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== lt.id) continue;
      if (!lt.moved && !this.breaking && performance.now() - lt.t0 < HOLD_MS) this.tap = true;
      this.lookTouch = null;
      this.breaking = false;
      clearTimeout(this.holdTimer);
    }
  }
}
