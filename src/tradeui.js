// Talking to village people: a window like the game's other screens with their face, what they
// say, and what you can ask them: to trade, to chat, the way to somewhere in town. Trades are
// rows of what you give and what you get; click one to make it.
import { sprites, div, label, slotBox, fillSlot, tooltipLines } from './gui.js';
import { I, itemLabel } from './items.js';
import { ROLES } from './civilians.js';
import { SKIN_INDEX, SKIN_SIZE } from './skins.js';
import { HR } from './tex/mobskins.js';

const W = 276, H = 214;
const px = (n) => `calc(var(--u) * ${n})`;

export class TalkScreen {
  constructor(game) {
    this.game = game;
    this.who = null;
    this.mode = 'talk';
    this.el = document.createElement('section');
    this.el.className = 'screen mc-screen talk-screen';
    this.el.hidden = true;
    this.win = div('mc-panel talk-win', this.el);
    this.tip = document.createElement('div');
    this.tip.id = 'talk-tip';
    this.tip.hidden = true;
    this.el.appendChild(this.tip);
    (document.getElementById('screen-container')?.parentNode ?? document.body).appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.game.closeTalk(); });
    window.addEventListener('resize', () => { if (this.who) this.fit(); });
  }

  get open() { return !!this.who; }

  show(e) {
    this.who = e;
    this.mode = 'talk';
    this.line = this.game.entities.civilians.greeting(e);
    this.el.style.setProperty('--window', `url(${sprites().window})`);
    this.el.hidden = false;
    this.fit();
    this.build();
  }
  hide() { this.who = null; this.el.hidden = true; this.tip.hidden = true; }

  fit() {
    const vw = window.innerWidth - 20, vh = window.innerHeight - 20;
    const dpr = window.devicePixelRatio || 1;
    let u = Math.min(this.game.ui.u, vw / W, vh / H);
    u = u >= 1 ? Math.floor(u * dpr + 1e-6) / dpr : Math.max(0.5, Math.floor(u * dpr * 4) / (dpr * 4));
    this.el.style.setProperty('--u', `${u}px`);
    this.win.style.width = px(W);
    this.win.style.height = px(H);
  }

  say(text) { this.line = text; this.build(); }

  build() {
    const e = this.who, civ = this.game.entities.civilians, win = this.win;
    win.replaceChildren();
    // The face, drawn from their skin.
    const face = div('talk-face', win, 8, 8, 40, 40);
    face.appendChild(this.portrait(e));
    label(e.name, win, 8, 52);
    label(ROLES[e.role]?.title ?? 'Villager', win, 8, 62).classList.add('t-sub');
    const speech = div('talk-speech', win, 56, 10, W - 64, 56);
    speech.textContent = `“${this.line}”`;
    // What you can say.
    const buttons = [['Trade', () => { this.mode = 'trade'; this.build(); }], ['Chat', () => this.say(civ.chatLine(e))],
      ['Who are you?', () => this.say(civ.intro(e))], ['Ask the way', () => { this.mode = 'ways'; this.say('Where are you headed?'); }],
      ['Goodbye', () => this.game.closeTalk()]];
    buttons.forEach(([text, fn], i) => {
      const b = document.createElement('button');
      b.className = `btn talk-btn${(this.mode === 'trade' && i === 0) || (this.mode === 'ways' && i === 3) ? ' active' : ''}`;
      b.textContent = text;
      b.style.left = px(8 + i * 52.4); b.style.top = px(76); b.style.width = px(50); b.style.height = px(15);
      b.addEventListener('click', () => { this.game.audio.click(); fn(); });
      win.appendChild(b);
    });
    const coins = this.game.creative ? '∞' : this.game.inv.count(I.gold_coin);
    const purse = label(`Gold coins: ${coins}`, win, W - 8, H - 14);
    purse.style.transform = 'translateX(-100%)';
    if (this.mode === 'trade') this.buildTrades(win, e);
    else if (this.mode === 'ways') this.buildWays(win, e);
    else {
      const hint = div('talk-hint', win, 8, 100, W - 16, 60);
      hint.textContent = ROLES[e.role]?.trades?.length ? 'Villagers trade for gold coins. Find them in chests, or sell what you gather.' : '';
    }
  }

  buildTrades(win, e) {
    const civ = this.game.entities.civilians;
    const offers = civ.offers(e);
    if (!offers.length) { label("I've nothing to trade.", win, 8, 100); return; }
    const inv = this.game.inv;
    offers.forEach((o, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 8 + col * 132, y = 96 + row * 26;
      const give = o.kind === 'buy' ? { id: I.gold_coin, count: o.price } : { id: o.id, count: o.count };
      const get = o.kind === 'buy' ? { id: o.id, count: o.count } : { id: I.gold_coin, count: o.price };
      const can = o.left > 0 && (this.game.creative && o.kind === 'buy' ? true : inv.count(give.id) >= give.count);
      const rowEl = div(`talk-offer${can ? '' : ' off'}${o.left <= 0 ? ' sold' : ''}`, win, x, y, 128, 22);
      const a = slotBox(rowEl, 2, 2);
      fillSlot(a, give);
      const arrow = div('talk-arrow', rowEl, 24, 6, 16, 10);
      arrow.textContent = '→';
      const b = slotBox(rowEl, 42, 2);
      fillSlot(b, get);
      const note = label(o.left > 0 ? `${o.left} left` : 'Sold out', rowEl, 64, 7);
      note.classList.add('t-sub');
      rowEl.title = '';
      rowEl.addEventListener('pointerenter', (ev) => this.showTip(ev, o, give, get));
      rowEl.addEventListener('pointermove', (ev) => this.moveTip(ev));
      rowEl.addEventListener('pointerleave', () => { this.tip.hidden = true; });
      rowEl.addEventListener('click', () => {
        if (civ.trade(e, o)) { this.say(['Pleasure doing business.', 'Thank you kindly!', 'A fair trade.', 'Come again!'][Math.floor(Math.random() * 4)]); this.mode = 'trade'; this.build(); }
        else { this.game.audio.click(); this.say(o.left <= 0 ? "I'm out of those for today. Come back tomorrow." : "You can't afford that, I'm afraid."); this.mode = 'trade'; this.build(); }
      });
    });
  }

  buildWays(win, e) {
    const civ = this.game.entities.civilians;
    const places = civ.places(e);
    if (!places.length) { label("I don't know my way round here.", win, 8, 100); return; }
    places.forEach(([key, name], i) => {
      const b = document.createElement('button');
      b.className = 'btn talk-btn';
      b.textContent = name[0].toUpperCase() + name.slice(1);
      b.style.left = px(8 + (i % 3) * 87); b.style.top = px(98 + Math.floor(i / 3) * 18); b.style.width = px(83); b.style.height = px(15);
      b.addEventListener('click', () => { this.game.audio.click(); this.mode = 'ways'; this.say(civ.directions(e, key)); });
      win.appendChild(b);
    });
  }

  showTip(ev, o, give, get) {
    const lines = o.kind === 'buy'
      ? [`<b>Buy ${get.count} × ${itemLabel(get.id)}</b>`, `<span class="t-gray">for ${give.count} gold coin${give.count > 1 ? 's' : ''}</span>`]
      : [`<b>Sell ${give.count} × ${itemLabel(give.id)}</b>`, `<span class="t-gray">for ${get.count} gold coin${get.count > 1 ? 's' : ''}</span>`];
    lines.push(...tooltipLines({ id: get.id, count: get.count, dmg: 0 }).slice(1));
    this.tip.innerHTML = lines.join('<br>');
    this.tip.hidden = false;
    this.moveTip(ev);
  }
  moveTip(ev) { this.tip.style.left = `${ev.clientX + 14}px`; this.tip.style.top = `${ev.clientY - 10}px`; }

  // The front of their head, from their skin (and the hat layer over it).
  portrait(e) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    const idx = SKIN_INDEX[e.skin];
    const px8 = this.game.renderer.skinPixels;
    if (idx !== undefined && px8) {
      const img = g.createImageData(8, 8);
      for (const [rx, ry] of [HR.head.front, HR.hat.front]) {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const si = (idx * SKIN_SIZE * SKIN_SIZE + (ry + y) * SKIN_SIZE + rx + x) * 4;
          if (px8[si + 3] < 128) continue;
          img.data.set(px8.subarray(si, si + 4), (y * 8 + x) * 4);
        }
      }
      g.putImageData(img, 0, 0);
    }
    c.className = 'talk-portrait';
    return c;
  }
}
