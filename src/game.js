// Game state and the main loop: menus, loading, playing (movement, mining, building, survival),
// saving, and the rotating title-screen panorama.
import { Renderer } from './renderer.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI, $ } from './ui.js';
import { Audio } from './audio.js';
import { Inventory } from './inventory.js';
import { initIcons } from './icons.js';
import { TEX } from './textures.js';
import { Particles } from './particles.js';
import { Entities } from './entities.js';
import { TouchControls } from './touch.js';
import * as storage from './storage.js';
import { makeEnvironment, updateEnvironment, clockText } from './sky.js';
import {
  B, BLOCKS, BASE, CREATIVE_BLOCKS, SOLID, REPLACEABLE, WATERLIKE, FACING_VARIANTS, WALL_TORCH, FACE_DIRS,
  RENDER, R,
} from './blocks.js';
import { ITEMS, I, itemDef, itemLabel, breakTime, dropsFor, blockOfItem, RECIPES } from './items.js';
import { BIOME_NAMES } from './biomes.js';
import { CHUNK_VOLUME, HEIGHT, TICKS_PER_DAY } from './config.js';
import { seedFromText, clamp, hashString } from './math.js';
import { blockBounds } from './world.js';

const SETTINGS_KEY = 'blockhaven.settings';
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const DEFAULT_SETTINGS = {
  renderDistance: COARSE ? 5 : 8, fov: 75, sensitivity: 100, brightness: 50, volume: 70, music: 45,
  viewBobbing: true, clouds: true, invertMouse: false, showFps: false,
};
const LOG_AXES = { [B.oak_log]: [100, 101], [B.birch_log]: [102, 103], [B.spruce_log]: [104, 105] };
const FACE_NAMES = ['east (+X)', 'west (-X)', 'up', 'down', 'south (+Z)', 'north (-Z)'];
const TIPS = [
  'Punch a tree to collect logs, then turn them into planks.',
  'Hold Shift to sneak: you won’t fall off edges.',
  'Torches keep the dark away. Craft them from coal and sticks.',
  'Double-tap Space in Creative mode to fly.',
  'Type /help in chat for commands.',
  'Water and lava make obsidian when they meet.',
  'Middle-click a block to pick it into your hand.',
  'Sand and gravel fall when nothing holds them up.',
];
const CLOUD_HEIGHT = 108.5;
const REACH = { creative: 5.5, survival: 4.6 };

export class Game {
  constructor() {
    this.canvas = $('view');
    this.ui = new UI();
    this.renderer = new Renderer(this.canvas);
    initIcons(this.renderer.pixels);
    this.input = new Input(this.canvas);
    this.touch = new TouchControls(this);
    this.audio = new Audio();
    this.settings = storage.loadPrefs(SETTINGS_KEY, DEFAULT_SETTINGS);
    this.env = makeEnvironment();
    this.particles = new Particles();
    this.entities = new Entities(this);
    this.player = new Player();
    this.inv = new Inventory();
    this.state = 'boot';
    this.world = null;
    this.meta = null;
    this.time = 1000;
    this.tickAcc = 0;
    this.last = performance.now();
    this.fps = 60;
    this.frameMs = 16;
    this.target = null;
    this.mining = null;
    this.breakCooldown = 0;
    this.useCooldown = 0;
    this.swing = 0;
    this.swinging = false;
    this.equip = 0;
    this.lastHeld = -1;
    this.hurtFlash = 0;
    this.hurtTilt = 0;
    this.health = 20;
    this.air = 300;
    this.fire = 0;
    this.invuln = 0;
    this.sinceDamage = 0;
    this.lastSpace = 0;
    this.lastW = 0;
    this.stepAcc = 0;
    this.wasInWater = false;
    this.fovMul = 1;
    this.showDebug = false;
    this.hideHud = false;
    this.expectUnlock = false;
    this.screenStack = [];
    this.search = '';
    this.chatHistory = [];
    this.chatIndex = 0;
    this.invVersion = 0;
    this.drawnInvVersion = -1;
    this.saveTimer = 0;
    this.tipIndex = Math.floor(Math.random() * TIPS.length);

    this.applySettings();
    this.bindUI();
    this.bindInput();
    this.frame = this.frame.bind(this);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.world && this.meta) {
        if (this.state === 'play') this.pause();
        this.save();
      }
    });
    window.addEventListener('pagehide', () => this.save());
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  start(hot = {}) {
    this.startPanorama();
    this.ui.show('screen-title');
    this.state = 'title';
    $('title-foot').textContent = COARSE ? 'Touch controls on · Worlds are saved on this device' : 'Worlds are saved on this device';
    requestAnimationFrame(this.frame);
    if (hot.worldId) storage.loadWorld(hot.worldId).then((meta) => meta && this.enterWorld(meta));
  }

  onResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
    this.renderer.resize(Math.max(1, Math.floor(this.canvas.clientWidth * dpr)), Math.max(1, Math.floor(this.canvas.clientHeight * dpr)));
  }

  get creative() { return this.meta?.mode === 'creative'; }
  get mode() { return this.creative ? 'creative' : 'survival'; }

  applySettings() {
    this.audio.setVolume(this.settings.volume / 100);
    this.audio.setMusicVolume(this.settings.music / 100);
  }

  // ---------------------------------------------------------------- UI wiring
  bindUI() {
    const ui = this.ui;
    ui.bindSettings(this.settings, () => { this.applySettings(); storage.savePrefs(SETTINGS_KEY, this.settings); });
    ui.slotItem = (i) => this.inv.slots[i]?.id ?? null;
    ui.on('play', async () => {
      this.audio.unlock();
      const worlds = await storage.listWorlds();
      if (worlds.length) this.openWorlds(); else this.openCreate();
    });
    ui.on('settings', (from) => this.pushScreen('screen-settings', from));
    ui.on('controls', (from) => this.pushScreen('screen-controls', from));
    ui.on('done', () => this.popScreen());
    ui.on('back', (from) => {
      if (from === 'screen-worlds') { this.ui.show('screen-title'); this.screenStack = []; }
      else if (from === 'screen-create') storage.listWorlds().then((w) => (w.length ? this.openWorlds() : this.ui.show('screen-title')));
      else this.popScreen();
    });
    ui.on('new-world', () => this.openCreate());
    ui.on('create-world', () => this.createWorld());
    ui.on('open-world', async (_, btn) => {
      this.audio.unlock();
      const meta = await storage.loadWorld(btn.dataset.id);
      if (meta) this.enterWorld(meta);
    });
    ui.on('delete-world', async (_, btn) => {
      const worlds = await storage.listWorlds();
      const w = worlds.find((x) => x.id === btn.dataset.id);
      if (!w) return;
      if (await ui.confirm(`Delete “${w.name}”? It can't be recovered.`, 'Delete world')) {
        await storage.deleteWorld(w.id);
        this.openWorlds();
      }
    });
    ui.on('resume', () => this.resume());
    ui.on('quit', () => this.quitToTitle());
    ui.on('respawn', () => this.respawn());
    ui.on('hotbar-tap', (i) => { if (this.state === 'play') this.select(i); });
    ui.on('slot', (i, button, shift) => this.inventoryClick(i, button, shift));
    ui.on('palette', (id, button, shift) => this.paletteClick(id, button, shift));
    ui.on('inventory-outside', () => {
      if (this.inv.cursor && this.creative) { this.inv.cursor = null; this.invChanged(); }
    });
    ui.on('search', (q) => { this.search = q.trim().toLowerCase(); this.renderInventory(); });
    ui.on('craft', (i, shift) => this.craft(i, shift));
    ui.on('chat-send', (text) => this.sendChat(text));
    ui.on('chat-close', () => this.closeChat());
    ui.on('chat-history', (d) => {
      if (!this.chatHistory.length) return;
      this.chatIndex = clamp(this.chatIndex + d, 0, this.chatHistory.length);
      $('chat-input').value = this.chatHistory[this.chatIndex] ?? '';
    });
  }

  pushScreen(id, from) {
    this.screenStack.push(from ?? this.ui.current);
    this.ui.show(id);
  }

  popScreen() {
    const prev = this.screenStack.pop() ?? (this.world ? 'screen-pause' : 'screen-title');
    this.ui.show(prev);
  }

  async openWorlds() {
    this.audio.unlock();
    this.ui.show('screen-worlds');
    const [worlds, persistent] = await Promise.all([storage.listWorlds(), storage.persistent()]);
    this.ui.renderWorlds(worlds, persistent);
  }

  async openCreate() {
    const worlds = await storage.listWorlds();
    let n = worlds.length + 1, name = 'New World';
    while (worlds.some((w) => w.name === name)) name = `New World ${n++}`;
    $('cw-name').value = name;
    $('cw-seed').value = '';
    this.ui.show('screen-create');
  }

  async createWorld() {
    this.audio.unlock();
    const name = $('cw-name').value.trim() || 'New World';
    const seedText = $('cw-seed').value.trim();
    const seed = seedFromText(seedText);
    const mode = document.querySelector('input[name=mode]:checked')?.value ?? 'survival';
    const type = document.querySelector('input[name=type]:checked')?.value ?? 'default';
    const meta = {
      id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      name, seed, seedText, mode, type, created: Date.now(), lastPlayed: Date.now(), time: 1000,
      spawn: null, player: null, inventory: null, version: 1,
    };
    await storage.saveWorld(meta);
    this.enterWorld(meta);
  }

  // ---------------------------------------------------------------- world lifecycle
  startPanorama() {
    const seed = hashString('blockhaven-title-2');
    this.panorama = new World({ seed, renderer: this.renderer });
    const spawn = this.panorama.gen.findSpawn();
    const h = this.panorama.gen.sample(Math.floor(spawn.x), Math.floor(spawn.z)).height;
    this.panoCam = { x: spawn.x, y: Math.max(h, 62) + 14, z: spawn.z, yaw: 0.6, pitch: -0.12 };
  }

  async enterWorld(meta) {
    this.state = 'loading';
    this.ui.show('screen-loading');
    this.ui.setHUD(false);
    $('loading-text').textContent = 'Generating terrain';
    $('loading-bar').style.width = '0%';
    $('loading-tip').textContent = TIPS[this.tipIndex++ % TIPS.length];
    $('screen-loading').style.backgroundImage = `linear-gradient(rgba(8,12,14,.78), rgba(8,12,14,.78)), url(${this.dirtTile()})`;
    if (this.panorama) { this.panorama.dispose(); this.panorama = null; }
    if (this.world) { this.world.dispose(); this.world = null; }
    const store = await new storage.WorldStore(meta.id, CHUNK_VOLUME).init();
    this.meta = meta;
    this.world = new World({ seed: meta.seed, type: meta.type, renderer: this.renderer, store });
    this.world.listener = this;
    this.time = meta.time ?? 1000;
    this.inv = new Inventory();
    if (meta.inventory) this.inv.load(meta.inventory);
    else if (meta.mode === 'creative') {
      ['grass_block', 'dirt', 'stone', 'cobblestone', 'oak_planks', 'oak_log', 'glass', 'torch', 'bricks'].forEach((n, i) => {
        this.inv.slots[i] = { id: I[n], count: 1, dmg: 0 };
      });
    }
    this.invChanged();
    if (!meta.spawn) {
      const s = this.world.gen.findSpawn();
      meta.spawn = { x: s.x, y: null, z: s.z };
    }
    const p = this.player = new Player();
    if (meta.player) {
      Object.assign(p, { x: meta.player.x, y: meta.player.y, z: meta.player.z, yaw: meta.player.yaw, pitch: meta.player.pitch, flying: !!meta.player.flying });
      this.health = meta.player.health ?? 20;
      this.air = meta.player.air ?? 300;
      this.needsPlacement = false;
    } else {
      p.x = meta.spawn.x; p.z = meta.spawn.z; p.y = 100;
      p.yaw = Math.random() * Math.PI * 2;
      this.health = 20;
      this.air = 300;
      this.needsPlacement = true;
    }
    if (!this.creative) p.flying = false;
    this.entities.reset(meta.entities);
    this.fire = 0;
    this.loadStart = performance.now();
    this.mining = null;
  }

  dirtTile() {
    if (this._dirt) return this._dirt;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const i = TEX.dirt;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.renderer.pixels.subarray(i * 1024, i * 1024 + 1024)), 16, 16), 0, 0);
    this._dirt = c.toDataURL();
    return this._dirt;
  }

  updateLoading(dt) {
    const p = this.player, w = this.world;
    w.update(p.x, p.z, Math.min(this.settings.renderDistance, 4));
    const prog = w.progress(2);
    $('loading-bar').style.width = `${Math.round(prog * 100)}%`;
    $('loading-text').textContent = prog < 1 ? 'Generating terrain' : 'Almost there';
    this.renderScene(dt, true);
    const timedOut = performance.now() - this.loadStart > 25000;
    if ((prog >= 1 || timedOut) && w.isLoaded(p.x, p.z)) {
      if (this.needsPlacement) {
        const [sx, sy, sz] = this.placeAt(Math.floor(p.x), Math.floor(p.z));
        this.meta.spawn = { x: sx, y: sy, z: sz };
        this.needsPlacement = false;
      }
      this.state = 'play';
      this.ui.show(null);
      this.ui.setHUD(true);
      this.touch.setActive(true);
      this.input.capture = true;
      this.invChanged();
      this.ui.message(`Welcome to ${this.meta.name}! Press E for your inventory, /help for commands.`, '#f3b73f');
      if (!this.touch.enabled) this.input.lock();
      this.save();
    }
  }

  // A safe standing spot near (x, z): open ground (not a tree, not water) with headroom.
  // Returns [x, y, z] of the feet position.
  safeSpot(x, z) {
    const w = this.world;
    const ok = (cx, cz) => {
      const top = w.topAt(cx, cz);
      if (top < 1) return -1;
      const id = w.getBlock(cx, top, cz), name = BLOCKS[id].name;
      if (!SOLID[id] || name.endsWith('leaves') || name.includes('_log') || id === B.cactus) return -1;
      return top + 1;
    };
    for (let r = 0; r <= 8; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const y = ok(x + dx, z + dz);
        if (y > 0) return [x + dx + 0.5, y, z + dz + 0.5];
      }
    }
    return [x + 0.5, Math.max(1, w.topAt(x, z) + 1), z + 0.5];
  }

  placeAt(x, z) {
    const [sx, sy, sz] = this.safeSpot(x, z);
    const p = this.player;
    p.x = sx; p.y = sy; p.z = sz;
    p.vx = p.vy = p.vz = 0;
    p.fallDistance = 0;
    return [sx, sy, sz];
  }

  async quitToTitle() {
    await this.save();
    this.input.capture = false;
    this.expectUnlock = true;
    this.input.unlock();
    this.touch.setActive(false);
    if (this.world) { await this.world.store?.drain(); this.world.dispose(); this.world = null; }
    this.meta = null;
    this.entities.reset(null);
    this.ui.setHUD(false);
    this.startPanorama();
    this.state = 'title';
    this.screenStack = [];
    this.ui.show('screen-title');
  }

  async save() {
    if (!this.world || !this.meta || this.state === 'loading') return;
    const p = this.player;
    this.world.saveAll();
    Object.assign(this.meta, {
      lastPlayed: Date.now(),
      time: Math.floor(this.time),
      player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying, health: this.health, air: this.air },
      inventory: this.inv.serialize(),
      entities: this.entities.serialize(),
    });
    await storage.saveWorld(this.meta);
  }

  // ---------------------------------------------------------------- state changes
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.input.capture = false;
    if (this.input.locked) { this.expectUnlock = true; this.input.unlock(); }
    this.mining = null;
    const day = Math.floor(this.time / TICKS_PER_DAY) + 1;
    $('pause-info').textContent = `${this.meta.name} · ${this.creative ? 'Creative' : 'Survival'} · Day ${day}, ${clockText(this.time)}`;
    this.screenStack = [];
    this.ui.show('screen-pause');
    this.save();
  }

  resume() {
    this.audio.unlock();
    this.ui.show(null);
    this.state = 'play';
    this.input.capture = true;
    if (!this.touch.enabled) this.input.lock();
  }

  openInventory() {
    this.state = 'inventory';
    this.input.capture = false;
    this.expectUnlock = true;
    this.input.unlock();
    this.mining = null;
    this.search = '';
    $('inv-search').value = '';
    this.ui.show('screen-inventory');
    this.renderInventory();
  }

  closeInventory() {
    if (this.inv.cursor) {
      if (this.creative) this.inv.cursor = null;
      else {
        const left = this.inv.returnCursor();
        if (left) this.entities.dropItem(this.player, { id: this.inv.cursor?.id, count: left });
      }
    }
    this.invChanged();
    this.ui.show(null);
    this.state = 'play';
    this.input.capture = true;
    if (!this.touch.enabled) this.input.lock();
  }

  openChat(prefix = '') {
    this.state = 'chat';
    this.input.capture = false;
    this.expectUnlock = true;
    this.input.unlock();
    this.chatIndex = this.chatHistory.length;
    this.ui.openChat(prefix);
  }

  closeChat() {
    this.ui.closeChat();
    if (this.state !== 'chat') return;
    this.state = 'play';
    this.input.capture = true;
    if (!this.touch.enabled) this.input.lock();
  }

  die(cause) {
    this.state = 'dead';
    this.health = 0;
    this.input.capture = false;
    this.expectUnlock = true;
    this.input.unlock();
    this.mining = null;
    $('death-cause').textContent = `${cause}. Your items are safe in your inventory.`;
    this.ui.show('screen-death');
  }

  respawn() {
    const p = this.player, s = this.meta.spawn;
    p.x = s.x; p.z = s.z;
    p.y = (s.y ?? 100);
    p.vx = p.vy = p.vz = 0;
    p.fallDistance = 0;
    this.needsRespawnY = true;
    this.health = 20;
    this.air = 300;
    this.fire = 0;
    this.resume();
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    this.input.onUnlock = () => {
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (this.state === 'play') this.pause();
    };
    this.input.onKey = (e) => {
      if (e.repeat) return;
      const s = this.state;
      if (s === 'play') {
        if (e.code === 'KeyE') this.openInventory();
        else if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); this.openChat(); }
        else if (e.code === 'Slash') { e.preventDefault(); this.openChat('/'); }
        else if (e.code === 'F3') { this.showDebug = !this.showDebug; }
        else if (e.code === 'F1') { this.hideHud = !this.hideHud; }
        else if (e.code === 'Escape' && !this.input.locked) this.pause();
      } else if (s === 'inventory') {
        if (e.code === 'KeyE' || e.code === 'Escape') this.closeInventory();
        else if (/^Digit[1-9]$/.test(e.code)) this.hotbarSwapHovered(Number(e.code.slice(5)) - 1);
      } else if (s === 'pause' && e.code === 'Escape' && this.ui.current === 'screen-pause') {
        this.resume();
      } else if (e.code === 'Escape' && (this.ui.current === 'screen-settings' || this.ui.current === 'screen-controls')) {
        this.popScreen();
      }
    };
  }

  select(i) {
    this.inv.selected = ((i % 9) + 9) % 9;
    this.invChanged();
  }

  movementInput() {
    const k = this.input, t = this.touch;
    let forward = (k.isDown('KeyW') || k.isDown('ArrowUp') ? 1 : 0) - (k.isDown('KeyS') || k.isDown('ArrowDown') ? 1 : 0);
    let right = (k.isDown('KeyD') || k.isDown('ArrowRight') ? 1 : 0) - (k.isDown('KeyA') || k.isDown('ArrowLeft') ? 1 : 0);
    if (t.enabled && (t.move[0] || t.move[1])) { forward = -t.move[1]; right = t.move[0]; }
    const jump = k.isDown('Space') || t.jump;
    const sneak = k.isDown('ShiftLeft') || k.isDown('ShiftRight') || t.sneak;
    const now = performance.now();
    if (k.wasPressed('KeyW')) {
      if (now - this.lastW < 280) this.sprintLatch = true;
      this.lastW = now;
    }
    if (forward <= 0) this.sprintLatch = false;
    const sprint = k.isDown('ControlLeft') || k.isDown('ControlRight') || this.sprintLatch || t.sprint;
    if (k.wasPressed('Space') && this.creative) {
      if (now - this.lastSpace < 300) { this.player.flying = !this.player.flying; this.lastSpace = 0; } else this.lastSpace = now;
    }
    return { forward, right, jump, sneak, sprint };
  }

  handleLook() {
    const k = this.input, p = this.player;
    const sens = (this.settings.sensitivity / 100) * 0.0023;
    let dx = k.mdx, dy = k.mdy;
    if (this.touch.enabled) { dx += this.touch.look[0]; dy += this.touch.look[1]; this.touch.look[0] = this.touch.look[1] = 0; }
    p.yaw -= dx * sens;
    p.pitch -= dy * sens * (this.settings.invertMouse ? -1 : 1);
    p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
    p.yaw = ((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  // ---------------------------------------------------------------- main loop
  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.frameMs += ((dt * 1000) - this.frameMs) * 0.05;
    this.fps = 1000 / Math.max(1, this.frameMs);
    try {
      if (this.state === 'loading') { if (this.world) this.updateLoading(dt); }
      else if (this.world) this.updateGame(dt);
      else if (this.panorama) this.updatePanorama(dt);
    } catch (err) {
      console.error(err);
    }
    this.input.endFrame();
  }

  updatePanorama(dt) {
    const c = this.panoCam;
    c.yaw += dt * 0.035;
    this.panorama.update(c.x, c.z, COARSE ? 4 : 6);
    this.time = 2600 + performance.now() / 1000 * 2;
    updateEnvironment(this.env, this.time);
    const rd = COARSE ? 4 : 6;
    this.renderer.render({
      cam: c, fov: 70, env: this.env, time: performance.now() / 1000, renderDist: rd, world: this.panorama,
      fogColor: this.env.fogColor, fogStart: rd * 16 * 0.5, fogEnd: rd * 16 * 0.92, underwater: false,
      clouds: true, cloudHeight: CLOUD_HEIGHT, brightness: 0.5, wave: true,
    });
    this.audio.update(true);
  }

  updateGame(dt) {
    const p = this.player, w = this.world;
    const active = this.state === 'play';
    const paused = this.state === 'pause';
    w.update(p.x, p.z, this.settings.renderDistance);
    if (this.needsRespawnY && w.isLoaded(p.x, p.z)) {
      this.placeAt(Math.floor(p.x), Math.floor(p.z));
      this.needsRespawnY = false;
    }
    if (active) this.handleLook();
    const move = active ? this.movementInput() : { forward: 0, right: 0, jump: false, sneak: false, sprint: false };
    p.frozen = !w.isLoaded(p.x, p.z) || this.needsRespawnY;
    if (!paused && this.state !== 'dead') {
      const prevInWater = p.inWater;
      p.update(dt, move, w);
      if (p.inWater && !prevInWater && p.vy < -4) { this.audio.splash(); }
      this.afterMove(dt);
    }
    if (!paused) {
      this.tickAcc += dt * 20;
      let n = 0;
      while (this.tickAcc >= 1 && n++ < 5) { this.tickAcc -= 1; this.gameTick(); }
      if (this.tickAcc > 5) this.tickAcc = 0;
      this.particles.update(dt, w);
      this.entities.update(dt);
    }
    this.target = this.state === 'play' || this.state === 'inventory' ? this.pickTarget() : null;
    if (active) this.handleActions(dt);
    else this.mining = null;
    this.updateHand(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    this.hurtTilt = Math.max(0, this.hurtTilt - dt * 3);
    this.renderScene(dt, false);
    this.updateHUD();
    this.audio.update(true);
  }

  afterMove(dt) {
    const p = this.player;
    // Footsteps
    if (p.onGround && !p.flying) {
      this.stepAcc += Math.hypot(p.vx, p.vz) * dt;
      if (this.stepAcc > 1.9) {
        this.stepAcc = 0;
        const g = p.groundBlock(this.world);
        if (g) this.audio.step(BLOCKS[g]?.sound ?? 'stone');
      }
    }
    if (p.inWater && !this.wasInWater) this.audio.splash();
    this.wasInWater = p.inWater;
    // Fall damage
    if (p.landed !== null) {
      const d = p.landed;
      p.landed = null;
      if (d > 3.2 && !p.inWater) this.damage(Math.floor(d - 3), 'You fell from a high place');
      if (d > 1.5) { const g = p.groundBlock(this.world); if (g) this.audio.step(BLOCKS[g]?.sound ?? 'stone'); }
    }
    if (this.creative && p.y < -64) { p.y = 120; p.vy = 0; p.flying = true; }
  }

  gameTick() {
    this.time++;
    this.world.tick();
    this.entities.tick();
    const p = this.player;
    if (!this.creative && this.state !== 'dead') {
      this.invuln = Math.max(0, this.invuln - 1);
      this.sinceDamage++;
      if (p.headInWater) {
        this.air--;
        if (this.air <= -20) { this.air = 0; this.damage(2, 'You drowned', true); }
      } else this.air = Math.min(300, this.air + 6);
      if (p.inLava) { this.fire = 140; if (this.time % 10 === 0) this.damage(4, 'You tried to swim in lava', true); }
      else if (this.fire > 0) {
        this.fire = p.inWater ? 0 : this.fire - 1;
        if (this.fire % 20 === 0 && this.fire > 0) this.damage(1, 'You burned to death', true);
      }
      if (p.y < -40 && this.time % 10 === 0) this.damage(4, 'You fell out of the world', true);
      if (this.time % 10 === 0 && this.touchingCactus()) this.damage(1, 'You were pricked to death');
      if (this.health < 20 && this.health > 0 && this.sinceDamage > 80 && this.time % 30 === 0) this.health++;
    }
    this.saveTimer++;
    if (this.saveTimer >= 600) { this.saveTimer = 0; this.save(); }
  }

  touchingCactus() {
    const b = this.player.box();
    for (let y = Math.floor(b[1]); y <= Math.floor(b[4]); y++)
      for (let z = Math.floor(b[2] - 0.05); z <= Math.floor(b[5] + 0.05); z++)
        for (let x = Math.floor(b[0] - 0.05); x <= Math.floor(b[3] + 0.05); x++)
          if (this.world.getBlock(x, y, z) === B.cactus) return true;
    return false;
  }

  damage(amount, cause, ignoreInvuln = false, knock = null) {
    if (this.creative || this.state === 'dead' || amount <= 0) return false;
    if (this.invuln > 0 && !ignoreInvuln) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = 10;
    this.sinceDamage = 0;
    this.hurtFlash = 1;
    this.hurtTilt = 1;
    this.audio.hurt();
    if (knock) { this.player.vx += knock[0]; this.player.vy = Math.max(this.player.vy, knock[1]); this.player.vz += knock[2]; }
    if (this.health <= 0) this.die(cause);
    return true;
  }

  // ---------------------------------------------------------------- targeting & actions
  pickTarget() {
    const p = this.player, d = p.lookDir();
    const reach = REACH[this.mode];
    const hit = this.world.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], reach);
    const mob = this.entities.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], Math.min(reach, hit ? hit.t : reach));
    if (mob) return { entity: mob.entity, t: mob.t };
    return hit;
  }

  handleActions(dt) {
    const k = this.input, t = this.touch;
    for (let i = 1; i <= 9; i++) if (k.wasPressed(`Digit${i}`)) this.select(i - 1);
    if (k.wheel) this.select(this.inv.selected + (k.wheel > 0 ? 1 : -1));
    if (k.wasPressed('KeyQ')) this.dropHeld(k.isDown('ControlLeft'));

    const target = this.target;
    const attack = (k.buttons & 1) || t.breaking;
    const attackClick = (k.clicked & 1) || t.breakStart;
    const use = (k.buttons & 2);
    const useClick = (k.clicked & 2) || t.tap;
    t.breakStart = false;
    t.tap = false;

    if (attackClick && target?.entity) {
      this.swingArm();
      this.entities.attack(target.entity, this.inv.heldId);
      if (!this.creative) this.inv.damageHeld(1) && this.audio.breakBlock('metal');
      this.invChanged();
    } else if (this.creative) {
      this.breakCooldown -= dt;
      if (attackClick && target && !target.entity) { this.breakTarget(); this.breakCooldown = 0.3; }
      else if (attack && target && !target.entity && this.breakCooldown <= 0) { this.breakTarget(); this.breakCooldown = 0.22; }
      else if (attackClick) this.swingArm();
    } else {
      this.updateMining(dt, attack && target && !target.entity ? target : null);
      if (attackClick && !target) this.swingArm();
    }

    this.useCooldown -= dt;
    if (useClick) { this.useItem(); this.useCooldown = 0.25; }
    else if (use && this.useCooldown <= 0) { this.useItem(true); this.useCooldown = 0.21; }
    if ((k.clicked & 4)) this.pickBlock();
  }

  swingArm() { this.swing = 0; this.swinging = true; }

  breakTarget() {
    const t = this.target;
    if (!t || t.entity) return;
    const def = BLOCKS[t.id];
    if (def.hardness < 0 && !this.creative) return;
    if (t.id === B.bedrock && !this.creative) return;
    this.swingArm();
    this.breakBlockAt(t.x, t.y, t.z, t.id, true);
  }

  breakBlockAt(x, y, z, id, byPlayer) {
    const def = BLOCKS[id];
    this.world.setBlock(x, y, z, 0);
    this.particles.burst(x, y, z, id);
    this.audio.breakBlock(def.sound);
    if (!this.creative && byPlayer) {
      const held = this.inv.heldId;
      for (const drop of dropsFor(id, held)) this.entities.spawnItem(x + 0.5, y + 0.3, z + 0.5, drop.id, drop.count);
      if (def.hardness > 0 && itemDef(held)?.durability && this.inv.damageHeld(1)) this.audio.breakBlock('metal');
      this.invChanged();
    }
    if (id === B.tnt && byPlayer && this.creative) { /* creative players remove TNT without lighting it */ }
  }

  updateMining(dt, target) {
    if (!target || BLOCKS[target.id].hardness < 0) { this.mining = null; return; }
    const m = this.mining;
    if (!m || m.x !== target.x || m.y !== target.y || m.z !== target.z || m.id !== target.id) {
      this.mining = { x: target.x, y: target.y, z: target.z, id: target.id, progress: 0, sound: 0 };
    }
    const cur = this.mining;
    const time = breakTime(BLOCKS[target.id], this.inv.heldId);
    cur.progress += time <= 0 ? 1 : dt / time;
    cur.sound -= dt;
    if (!this.swinging || this.swing > 0.8) this.swingArm();
    if (cur.sound <= 0) {
      cur.sound = 0.24;
      this.audio.dig(BLOCKS[target.id].sound);
      this.particles.chip(target.x, target.y, target.z, target.face, target.id);
    }
    if (cur.progress >= 1) {
      this.breakBlockAt(target.x, target.y, target.z, target.id, true);
      this.mining = null;
      this.breakCooldown = 0.15;
    }
  }

  useItem(repeat = false) {
    const held = this.inv.held, t = this.target, p = this.player;
    const def = held ? itemDef(held.id) : null;
    if (def?.food && !this.creative && !repeat) {
      if (this.health < 20) {
        this.health = Math.min(20, this.health + def.food);
        this.inv.consumeHeld();
        this.audio.eat();
        this.swingArm();
        this.invChanged();
      }
      return;
    }
    if (!t || t.entity) {
      if (t?.entity && !repeat) this.entities.interact(t.entity, held);
      return;
    }
    if (t.id === B.tnt && held?.id === I.flint_and_steel && !repeat) {
      this.world.setBlock(t.x, t.y, t.z, 0);
      this.entities.primeTNT(t.x, t.y, t.z, 80);
      if (!this.creative) { this.inv.damageHeld(1); this.invChanged(); }
      this.swingArm();
      return;
    }
    if (!held || def.block === null || def.block === undefined || t.face < 0) return;
    const blockId = def.block;
    let x = t.x, y = t.y, z = t.z;
    const face = t.face;
    if (!REPLACEABLE[t.id] || t.id === blockId) {
      const d = FACE_DIRS[face];
      x += d[0]; y += d[1]; z += d[2];
    }
    if (y < 0 || y >= HEIGHT) return;
    const existing = this.world.getBlock(x, y, z);
    if (existing && !REPLACEABLE[existing]) return;
    if (existing === blockId) return;
    let id = blockId;
    if (blockId === B.torch) {
      if (face === 3) return;
      if (face !== 2) id = WALL_TORCH[face];
    } else if (FACING_VARIANTS[blockId]) {
      const dir = p.lookDir();
      const f = Math.abs(dir[0]) > Math.abs(dir[2]) ? (dir[0] > 0 ? 1 : 0) : (dir[2] > 0 ? 5 : 4);
      id = FACING_VARIANTS[blockId][f];
    } else if (LOG_AXES[blockId]) {
      if (face === 0 || face === 1) id = LOG_AXES[blockId][0];
      else if (face === 4 || face === 5) id = LOG_AXES[blockId][1];
    }
    if (BLOCKS[id].support && !this.world.supported(x, y, z, id)) return;
    if (SOLID[id] && (p.intersectsBlock(x, y, z) || this.entities.blocksPlacement(x, y, z))) return;
    if (this.world.setBlock(x, y, z, id)) {
      this.audio.place(BLOCKS[id].sound);
      this.swingArm();
      if (!this.creative) { this.inv.consumeHeld(); this.invChanged(); }
    }
  }

  pickBlock() {
    const t = this.target;
    if (!t || t.entity) return;
    const id = BASE[t.id];
    if (!ITEMS.has(id)) return;
    const hot = this.inv.slots.findIndex((s, i) => i < 9 && s?.id === id);
    if (hot >= 0) { this.select(hot); return; }
    if (this.creative) {
      const empty = this.inv.slots.findIndex((s, i) => i < 9 && !s);
      if (empty >= 0) this.inv.selected = empty;
      this.inv.slots[this.inv.selected] = { id, count: 1, dmg: 0 };
      this.invChanged();
    } else {
      const j = this.inv.slots.findIndex((s, i) => i >= 9 && s?.id === id);
      if (j >= 0) {
        const tmp = this.inv.slots[this.inv.selected];
        this.inv.slots[this.inv.selected] = this.inv.slots[j];
        this.inv.slots[j] = tmp;
        this.invChanged();
      }
    }
  }

  dropHeld(all) {
    const s = this.inv.held;
    if (!s) return;
    const count = all ? s.count : 1;
    if (!this.creative) {
      this.entities.dropItem(this.player, { id: s.id, count, dmg: s.dmg });
      s.count -= count;
      if (s.count <= 0) this.inv.slots[this.inv.selected] = null;
    } else {
      this.entities.dropItem(this.player, { id: s.id, count, dmg: 0 });
    }
    this.swingArm();
    this.invChanged();
  }

  // Items walked over are picked up (called by entities).
  pickup(id, count, dmg) {
    const left = this.creative ? 0 : this.inv.add(id, count, dmg);
    if (left < count) { this.audio.pop(); this.invChanged(); }
    return left;
  }

  // World listener: a block was knocked out by a neighbour change (plants, torches, water flow).
  blockDropped(x, y, z, id) {
    this.particles.burst(x, y, z, id);
    if (this.creative) return;
    for (const d of dropsFor(id, 0)) this.entities.spawnItem(x + 0.5, y + 0.3, z + 0.5, d.id, d.count);
  }

  chunkLoaded(chunk) { this.entities.chunkLoaded(chunk); }

  // ---------------------------------------------------------------- inventory
  invChanged() { this.invVersion++; }

  nearbyStations() {
    const set = new Set();
    const p = this.player, w = this.world;
    const x0 = Math.floor(p.x), y0 = Math.floor(p.y), z0 = Math.floor(p.z);
    for (let y = y0 - 2; y <= y0 + 3; y++) for (let z = z0 - 4; z <= z0 + 4; z++) for (let x = x0 - 4; x <= x0 + 4; x++) {
      const id = w.getBlock(x, y, z);
      if (id === B.crafting_table) set.add('table');
      else if (BASE[id] === B.furnace) set.add('furnace');
    }
    return set;
  }

  paletteItems() {
    const all = [...CREATIVE_BLOCKS, ...[...ITEMS.keys()].filter((id) => id >= 256)];
    if (!this.search) return all;
    return all.filter((id) => itemLabel(id).toLowerCase().includes(this.search));
  }

  renderInventory() {
    if (this.state !== 'inventory') return;
    this.ui.renderInventory(this.inv, { creative: this.creative, palette: this.creative ? this.paletteItems() : [], stations: this.nearbyStations() });
  }

  inventoryClick(i, button, shift) {
    if (this.state !== 'inventory') return;
    if (shift && !this.creative) this.inv.quickMove(i);
    else if (shift && this.creative && i < 9) this.inv.slots[i] = null;
    else this.inv.click(i, button === 2 ? 2 : 0);
    this.audio.click();
    this.invChanged();
    this.renderInventory();
  }

  paletteClick(id, button, shift) {
    if (!this.creative) return;
    if (id === null || Number.isNaN(id)) { this.inv.cursor = null; this.renderInventory(); return; }
    const max = itemDef(id)?.stack ?? 64;
    if (shift) {
      const empty = this.inv.slots.findIndex((s, i) => i < 9 && !s);
      this.inv.slots[empty >= 0 ? empty : this.inv.selected] = { id, count: max, dmg: 0 };
    } else if (this.inv.cursor) {
      this.inv.cursor = this.inv.cursor.id === id ? { id, count: max, dmg: 0 } : null;
      if (!this.inv.cursor) this.inv.cursor = { id, count: max, dmg: 0 };
    } else {
      this.inv.cursor = { id, count: button === 2 ? 1 : max, dmg: 0 };
    }
    this.audio.click();
    this.invChanged();
    this.renderInventory();
  }

  hotbarSwapHovered(n) {
    const el = document.querySelector('#screen-inventory .slot:hover');
    if (!el) return;
    if (el.dataset.item) this.inv.slots[n] = { id: Number(el.dataset.item), count: itemDef(Number(el.dataset.item))?.stack ?? 64, dmg: 0 };
    else if (el.dataset.slot !== undefined) {
      const i = Number(el.dataset.slot);
      const tmp = this.inv.slots[n];
      this.inv.slots[n] = this.inv.slots[i];
      this.inv.slots[i] = tmp;
    }
    this.invChanged();
    this.renderInventory();
  }

  craft(i, shift) {
    const r = RECIPES[i];
    if (!r) return;
    const stations = this.nearbyStations();
    let n = 0;
    while (this.inv.canCraft(r, stations) && (n === 0 || shift) && n < 64) {
      this.inv.craft(r, stations);
      n++;
    }
    if (n) { this.audio.pop(); this.invChanged(); }
    this.renderInventory();
  }

  // ---------------------------------------------------------------- chat & commands
  sendChat(text) {
    text = text.trim();
    this.closeChat();
    if (!text) return;
    this.chatHistory.push(text);
    if (text.startsWith('/')) this.command(text.slice(1));
    else this.ui.message(`<You> ${text}`);
  }

  command(line) {
    const [cmd, ...args] = line.split(/\s+/);
    const say = (t, c) => this.ui.message(t, c);
    const p = this.player;
    const num = (s, base) => (s?.startsWith('~') ? base + (Number(s.slice(1)) || 0) : Number(s));
    switch (cmd.toLowerCase()) {
      case 'help':
        say('/time set day|noon|night|midnight|<ticks>, /time add <n>');
        say('/gamemode creative|survival, /tp <x> <y> <z>, /give <item> [count]');
        say('/spawn, /setspawn, /seed, /fly, /kill, /clear');
        break;
      case 'time': {
        const presets = { day: 1000, noon: 6000, sunset: 12000, night: 13500, midnight: 18000, sunrise: 23000 };
        const day = Math.floor(this.time / TICKS_PER_DAY) * TICKS_PER_DAY;
        if (args[0] === 'set' && args[1] in presets) this.time = day + presets[args[1]];
        else if (args[0] === 'set' && !Number.isNaN(Number(args[1]))) this.time = day + Number(args[1]);
        else if (args[0] === 'add' && !Number.isNaN(Number(args[1]))) this.time += Number(args[1]);
        else { say('Usage: /time set day|night|<ticks>', '#e88a78'); break; }
        say(`Time is now ${clockText(this.time)}`);
        break;
      }
      case 'gamemode': case 'gm': {
        const m = (args[0] ?? '').toLowerCase();
        const mode = ['c', 'creative', '1'].includes(m) ? 'creative' : ['s', 'survival', '0'].includes(m) ? 'survival' : null;
        if (!mode) { say('Usage: /gamemode creative|survival', '#e88a78'); break; }
        this.meta.mode = mode;
        if (mode === 'survival') p.flying = false;
        this.health = 20;
        say(`Game mode set to ${mode === 'creative' ? 'Creative' : 'Survival'}`);
        this.invChanged();
        break;
      }
      case 'tp': case 'teleport': {
        const x = num(args[0], p.x), y = num(args[1], p.y), z = num(args[2], p.z);
        if ([x, y, z].some(Number.isNaN)) { say('Usage: /tp <x> <y> <z>', '#e88a78'); break; }
        p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.fallDistance = 0;
        say(`Teleported to ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
        break;
      }
      case 'give': {
        const name = (args[0] ?? '').toLowerCase().replace(/^minecraft:/, '');
        const id = I[name] ?? [...ITEMS.values()].find((d) => d.label.toLowerCase() === name.replace(/_/g, ' '))?.id;
        if (id === undefined) { say(`Unknown item: ${args[0] ?? ''}`, '#e88a78'); break; }
        const count = clamp(Number(args[1]) || 1, 1, 64 * 36);
        const left = this.inv.add(id, count);
        say(`Gave ${count - left} × ${itemLabel(id)}`);
        this.invChanged();
        break;
      }
      case 'seed': say(`Seed: ${this.meta.seedText || this.meta.seed}`); break;
      case 'spawn': p.x = this.meta.spawn.x; p.z = this.meta.spawn.z; this.needsRespawnY = true; say('Teleported to spawn'); break;
      case 'setspawn': this.meta.spawn = { x: p.x, y: p.y, z: p.z }; say('Spawn point set here'); break;
      case 'fly': if (this.creative) { p.flying = !p.flying; say(p.flying ? 'Flying' : 'Not flying'); } else say('Flying needs Creative mode', '#e88a78'); break;
      case 'kill': if (this.creative) { p.y = this.meta.spawn.y ?? 100; } else this.damage(999, 'You gave up', true); break;
      case 'clear': this.inv.slots.fill(null); this.invChanged(); say('Inventory cleared'); break;
      default: say(`Unknown command: /${cmd}. Try /help`, '#e88a78');
    }
  }

  // ---------------------------------------------------------------- rendering
  updateHand(dt) {
    const held = this.inv.heldId;
    if (held !== this.lastHeld) {
      this.equip = 1;
      this.lastHeld = held;
      if (held) this.ui.showItemName(itemLabel(held));
    }
    this.equip = Math.max(0, this.equip - dt * 5);
    if (this.swinging) {
      this.swing += dt * 3.4;
      if (this.swing >= 1) { this.swing = 0; this.swinging = false; }
    }
  }

  renderScene(dt, loading) {
    const p = this.player, s = this.settings;
    updateEnvironment(this.env, this.time);
    const bobAmt = s.viewBobbing ? p.bob : 0;
    const bx = Math.sin(p.bobPhase) * 0.045 * bobAmt, by = -Math.abs(Math.cos(p.bobPhase)) * 0.07 * bobAmt;
    const cam = {
      x: p.x + Math.cos(p.yaw) * bx, y: p.eyeY + by, z: p.z - Math.sin(p.yaw) * bx,
      yaw: p.yaw, pitch: p.pitch,
    };
    const fovTarget = (p.sprinting ? 1.12 : 1) * (p.flying && p.sprinting ? 1.08 : 1) * (p.headInWater ? 0.9 : 1);
    this.fovMul += (fovTarget - this.fovMul) * Math.min(1, dt * 8);
    const rd = s.renderDistance;
    let fogColor = this.env.fogColor, fogStart = rd * 16 * 0.55, fogEnd = rd * 16 * 0.95;
    const eyeBlock = this.world.getBlock(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    const underwater = p.headInWater;
    if (underwater) {
      const d = this.env.daylight;
      fogColor = [0.04 * d + 0.01, 0.14 * d + 0.02, 0.38 * d + 0.05];
      fogStart = 0; fogEnd = 22 + 10 * d;
    } else if (WATERLIKE[eyeBlock] === 2) {
      fogColor = [0.8, 0.3, 0.05]; fogStart = 0; fogEnd = 2.5;
    }
    const target = !loading && this.target && !this.target.entity ? this.target : null;
    const heldLight = this.world.getLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
    this.particles.build(cam, this.world);
    this.renderer.render({
      cam, fov: s.fov * this.fovMul, env: this.env, time: performance.now() / 1000, renderDist: rd, world: this.world,
      fogColor, fogStart, fogEnd, underwater, clouds: s.clouds, cloudHeight: CLOUD_HEIGHT, brightness: s.brightness / 100,
      wave: true,
      selection: target && this.state !== 'dead' ? { x: target.x, y: target.y, z: target.z, box: blockBounds(target.id) ?? [0, 0, 0, 1, 1, 1] } : null,
      crack: this.mining && this.mining.progress > 0 ? { x: this.mining.x, y: this.mining.y, z: this.mining.z, stage: Math.floor(this.mining.progress * 10) } : null,
      particles: this.particles,
      entities: this.entities.renderList(cam),
      hand: loading || this.hideHud || this.state === 'dead' ? null : {
        item: this.inv.heldId, swing: this.swinging ? this.swing : 0, equip: this.equip,
        bob: [Math.sin(p.bobPhase) * 0.03 * bobAmt, -Math.abs(Math.cos(p.bobPhase)) * 0.03 * bobAmt - this.hurtTilt * 0.05],
        light: [Math.max(heldLight >> 4, 0), heldLight & 15],
      },
    });
  }

  updateHUD() {
    const ui = this.ui, p = this.player;
    const show = !this.hideHud && this.state !== 'loading';
    ui.setHUD(show);
    if (!show) return;
    if (this.invVersion !== this.drawnInvVersion) {
      this.drawnInvVersion = this.invVersion;
      ui.renderHotbar(this.inv, this.creative);
      if (this.state === 'inventory') this.renderInventory();
    }
    ui.renderStats(!this.creative, this.health, this.air, p.headInWater);
    this.touch.update();
    ui.setFlags({
      water: p.headInWater,
      hurt: Math.round(this.hurtFlash * 0.9 * 20) / 20,
      'resume-hint': this.state === 'play' && !this.input.locked && !this.touch.enabled,
      crosshair: this.state === 'play' || this.state === 'chat',
    });
    if (this.showDebug) ui.setDebug(this.debugLines());
    else if (this.settings.showFps) ui.setDebug([`${Math.round(this.fps)} fps`]);
    else ui.setDebug(null);
  }

  debugLines() {
    const p = this.player, w = this.world;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const light = w.getLight(bx, Math.floor(p.eyeY), bz);
    const deg = ((p.yaw * 180) / Math.PI) % 360;
    const f = ((Math.round(((-deg + 360) % 360) / 90) % 4) + 4) % 4;
    const facing = ['north (-Z)', 'west (-X)', 'south (+Z)', 'east (+X)'][f];
    const biome = w.biomeAt(bx, bz);
    const t = this.target;
    const r = this.renderer.stats;
    return [
      `Blockhaven · ${Math.round(this.fps)} fps (${this.frameMs.toFixed(1)} ms)${this.world.pool.threaded ? '' : ' · single-threaded'}`,
      `XYZ: ${p.x.toFixed(3)} / ${p.y.toFixed(3)} / ${p.z.toFixed(3)}`,
      `Block: ${bx} ${by} ${bz} · Chunk: ${bx >> 4} ${bz >> 4}`,
      `Facing: ${facing} (${deg.toFixed(1)}° / ${((p.pitch * 180) / Math.PI).toFixed(1)}°)`,
      `Biome: ${BIOME_NAMES[biome] ?? '?'} · Light: ${light >> 4} sky, ${light & 15} block`,
      `Day ${Math.floor(this.time / TICKS_PER_DAY) + 1}, ${clockText(this.time)} · ${this.creative ? 'Creative' : 'Survival'}${p.flying ? ' · flying' : ''}`,
      `Chunks: ${w.chunks.size} · Sections drawn: ${r.sections} · Triangles: ${(r.triangles / 1000).toFixed(0)}k`,
      `Entities: ${this.entities.list.length} · Particles: ${this.particles.list.length}`,
      t && !t.entity ? `Looking at: ${BLOCKS[t.id].label} (${t.x}, ${t.y}, ${t.z}) face ${FACE_NAMES[t.face] ?? '-'}` : t?.entity ? `Looking at: ${t.entity.label}` : 'Looking at: nothing',
    ];
  }
}

