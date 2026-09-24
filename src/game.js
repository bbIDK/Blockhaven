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
import { Weather } from './weather.js';
import { Entities } from './entities.js';
import { TouchControls } from './touch.js';
import * as storage from './storage.js';
import { makeEnvironment, updateEnvironment, clockText } from './sky.js';
import {
  B, BLOCKS, BASE, CREATIVE_BLOCKS, SOLID, REPLACEABLE, WATERLIKE, FACING_VARIANTS, WALL_TORCH, FACE_DIRS,
  RENDER, R, SLAB, STAIRS, DOOR, doorId, CLIMB, LADDER, oppositeFace, CHEST, BED, bedId,
} from './blocks.js';
import { ITEMS, I, itemDef, itemLabel, breakTime, dropsFor, blockOfItem, RECIPES } from './items.js';
import { BIOME_NAMES } from './biomes.js';
import { CHUNK_VOLUME, HEIGHT, TICKS_PER_DAY } from './config.js';
import { seedFromText, clamp, hashString, mat4, identity, translate, rotateX, rotateZ } from './math.js';

const SETTINGS_KEY = 'blockhaven.settings';
const DEG = Math.PI / 180;
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULT_SETTINGS = {
  renderDistance: COARSE ? 5 : 8, resolution: 0, fov: 75, sensitivity: 100, brightness: 50, volume: 70, music: 45,
  viewBobbing: !REDUCED_MOTION, clouds: true, invertMouse: false, showFps: false,
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
  'Sleep in a bed to skip the night and set your respawn point.',
  'Chests hold 27 stacks. Shift-click moves a whole stack across.',
  'You only heal when your food bar is nearly full. Cooked meat fills it best.',
  'Hit a mob while falling for a critical hit.',
  'Zombies don’t burn in the rain.',
  'Golden tools are the fastest, but they wear out quickly.',
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
    this.handItem = 0;
    this.handHeight = 1;
    this.lastHeld = -1;
    this.lagPitch = 0;
    this.lagYaw = 0;
    this.viewPre = mat4();
    this.hurtFlash = 0;
    this.hurtTime = 0;
    this.health = 20;
    this.air = 300;
    // Hunger, as in the original: food points (the drumsticks), hidden saturation that is used up
    // first, and exhaustion that builds up from sprinting, jumping, fighting and mining.
    this.food = 20;
    this.saturation = 5;
    this.exhaustion = 0;
    this.foodTimer = 0;
    this.eating = null;
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
    this.containers = new Map();
    this.openChest = null;
    this.weather = new Weather();
    this.drawnInvVersion = -1;
    this.saveTimer = 0;
    this.tipIndex = Math.floor(Math.random() * TIPS.length);

    this.autoScale = 1;
    this.slowTime = 0;
    this.fastTime = 0;
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

  // Resolution: a fixed share of the screen's pixels, or Auto, which starts at full resolution and
  // trades pixels for frame rate only when frames run slow.
  onResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
    const fixed = this.settings.resolution;
    const scale = fixed ? (40 + fixed * 10) / 100 : this.autoScale;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr * scale));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr * scale));
    this.renderer.resize(w, h);
  }

  // Auto resolution: watch the frame time over a couple of seconds and step the scale down when
  // the game can't keep up, or back up when there's room to spare.
  adaptResolution(dt) {
    if (this.settings.resolution || this.state !== 'play') { this.slowTime = this.fastTime = 0; return; }
    if (this.frameMs > 21) { this.slowTime += dt; this.fastTime = 0; }
    else if (this.frameMs < 14) { this.fastTime += dt; this.slowTime = 0; }
    else { this.slowTime = this.fastTime = 0; }
    let next = this.autoScale;
    if (this.slowTime > 2 && next > 0.55) next = Math.max(0.55, next - 0.12);
    else if (this.fastTime > 6 && next < 1) next = Math.min(1, next + 0.1);
    else return;
    this.slowTime = this.fastTime = 0;
    this.autoScale = next;
    this.onResize();
  }

  get creative() { return this.meta?.mode === 'creative'; }
  get mode() { return this.creative ? 'creative' : 'survival'; }

  applySettings() {
    this.audio.setVolume(this.settings.volume / 100);
    this.audio.setMusicVolume(this.settings.music / 100);
    if (this.renderer) this.onResize();
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
    ui.on('close-inv', () => { if (this.state === 'inventory') this.closeInventory(); });
    ui.on('close-chest', () => { if (this.state === 'chest') this.closeChest(); });
    ui.on('inventory-outside', () => {
      if (this.inv.cursor && this.creative) { this.inv.cursor = null; this.invChanged(); }
    });
    ui.on('search', (q) => { this.search = q.trim().toLowerCase(); this.renderInventory(); });
    ui.on('craft', (i, shift) => this.craft(i, shift));
    ui.on('chest-slot', (kind, i, button, shift) => this.chestClick(kind, i, button, shift));
    ui.onButton = () => { this.audio.unlock(); this.audio.click(); };
    ui.chestItem = (i) => this.openChest?.slots[i]?.id ?? null;
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
    this.needsRespawnY = false;
    this.respawnAtBed = false;
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
    if (meta.player && (meta.player.health ?? 20) > 0) {
      Object.assign(p, { x: meta.player.x, y: meta.player.y, z: meta.player.z, yaw: meta.player.yaw, pitch: meta.player.pitch, flying: !!meta.player.flying });
      this.health = meta.player.health ?? 20;
      this.air = meta.player.air ?? 300;
      this.food = meta.player.food ?? 20;
      this.saturation = meta.player.saturation ?? 5;
      this.exhaustion = meta.player.exhaustion ?? 0;
      this.needsPlacement = false;
    } else if (meta.player && (meta.spawn?.y || meta.bed)) {
      // Saved while dead: come back at the bed or spawn point with full health.
      Object.assign(p, { yaw: meta.player.yaw, pitch: 0 });
      this.goToSpawn();
      this.health = 20;
      this.air = 300;
      this.resetHunger();
      this.needsPlacement = false;
    } else {
      p.x = meta.spawn.x; p.z = meta.spawn.z; p.y = 100;
      p.yaw = Math.random() * Math.PI * 2;
      this.health = 20;
      this.air = 300;
      this.resetHunger();
      this.needsPlacement = true;
    }
    if (!this.creative) p.flying = false;
    this.entities.reset(meta.entities);
    this.weather.load(meta.weather);
    this.containers = new Map((meta.containers ?? []).map((c) => [c.k, c.slots.map((x) => (x && itemDef(x.id) ? x : null))]));
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
    w.update(p.x, p.z, Math.min(this.settings.renderDistance, 4), 12);
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

  // Sends the player to their bed (or the world spawn); the exact spot is found once that chunk loads.
  goToSpawn() {
    const p = this.player, bed = this.meta.bed, s = this.meta.spawn;
    this.respawnAtBed = !!bed;
    p.x = bed ? bed.x + 0.5 : s.x;
    p.z = bed ? bed.z + 0.5 : s.z;
    p.y = bed ? bed.y + 1 : (s.y ?? 100);
    p.vx = p.vy = p.vz = 0;
    p.fallDistance = 0;
    this.needsRespawnY = true;
  }

  // Stand next to the bed. If it was broken or boxed in, fall back to the world spawn.
  placeAtBed() {
    const p = this.player, b = this.meta.bed;
    this.respawnAtBed = false;
    const spot = b && this.bedSpot(b.x, b.y, b.z);
    if (spot) {
      [p.x, p.y, p.z] = spot;
      p.vx = p.vy = p.vz = 0;
      p.fallDistance = 0;
      this.needsRespawnY = false;
      return;
    }
    this.meta.bed = null;
    this.ui.message('Your bed was missing or blocked', '#e88a78');
    p.x = this.meta.spawn.x;
    p.z = this.meta.spawn.z;
  }

  // A free spot to stand beside a bed (given by its foot block), or null.
  bedSpot(x, y, z) {
    const w = this.world, b = BED[w.getBlock(x, y, z)];
    if (!b || b.head) return null;
    const d = FACE_DIRS[b.dir];
    const free = (cx, cy, cz) => { const id = w.getBlock(cx, cy, cz); return !SOLID[id] && RENDER[id] !== R.LIQUID; };
    for (const dy of [0, 1, -1]) {
      for (const [ox, oz] of [[0, 0], [d[0], d[2]]]) {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const cx = x + ox + dx, cy = y + dy, cz = z + oz + dz, below = w.getBlock(cx, cy - 1, cz);
          if (free(cx, cy, cz) && free(cx, cy + 1, cz) && SOLID[below] && !BED[below] && below !== B.cactus) return [cx + 0.5, cy, cz + 0.5];
        }
      }
    }
    return null;
  }

  // Frees the mouse without the unlock being mistaken for the player pressing Esc.
  releasePointer() {
    this.input.capture = false;
    if (this.input.locked) { this.expectUnlock = true; this.input.unlock(); }
  }

  async quitToTitle() {
    await this.save();
    this.releasePointer();
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
      player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying, health: this.health, air: this.air,
        food: this.food, saturation: this.saturation, exhaustion: this.exhaustion },
      inventory: this.inv.serialize(),
      entities: this.entities.serialize(),
      containers: [...this.containers].map(([k, slots]) => ({ k, slots: slots.map((x) => (x ? { ...x } : null)) })),
      weather: this.weather.serialize(),
    });
    await storage.saveWorld(this.meta);
  }

  // ---------------------------------------------------------------- state changes
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.releasePointer();
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
    this.releasePointer();
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
        const held = this.inv.cursor;
        const left = this.inv.returnCursor();
        if (left) this.entities.dropItem(this.player, { id: held.id, count: left, dmg: held.dmg });
      }
    }
    this.invChanged();
    this.ui.hideCursor();
    this.ui.show(null);
    this.state = 'play';
    this.input.capture = true;
    if (!this.touch.enabled) this.input.lock();
  }

  // ---------------------------------------------------------------- chests and beds
  containerKey(x, y, z) { return `${x},${y},${z}`; }

  openChestAt(x, y, z) {
    const key = this.containerKey(x, y, z);
    if (!this.containers.has(key)) this.containers.set(key, new Array(27).fill(null));
    this.openChest = { key, slots: this.containers.get(key), at: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } };
    this.state = 'chest';
    this.releasePointer();
    this.mining = null;
    this.audio.chest(true, this.openChest.at);
    this.ui.show('screen-chest');
    this.ui.renderChest(this.inv, this.openChest.slots);
  }

  closeChest() {
    if (this.inv.cursor) {
      const held = this.inv.cursor;
      const left = this.inv.returnCursor();
      if (left) this.entities.dropItem(this.player, { id: held.id, count: left, dmg: held.dmg });
    }
    if (this.openChest) this.audio.chest(false, this.openChest.at);
    this.openChest = null;
    this.invChanged();
    this.ui.hideCursor();
    this.ui.show(null);
    this.state = 'play';
    this.input.capture = true;
    if (!this.touch.enabled) this.input.lock();
  }

  chestClick(kind, i, button, shift) {
    if (this.state !== 'chest' || !this.openChest) return;
    const chest = this.openChest.slots;
    if (shift) {
      // Move the whole stack to the other side.
      const from = kind === 'chest' ? chest : this.inv.slots;
      const stack = from[i];
      if (stack) {
        from[i] = null;
        const left = kind === 'chest' ? this.inv.add(stack.id, stack.count, stack.dmg) : Inventory.insert(chest, stack);
        if (left) from[i] = { ...stack, count: left };
      }
    } else {
      this.inv.clickSlots(kind === 'chest' ? chest : this.inv.slots, i, button === 2 ? 2 : 0);
    }
    this.invChanged();
    this.ui.renderChest(this.inv, chest);
  }

  // Spill a broken chest's contents.
  dropContainer(x, y, z) {
    const key = this.containerKey(x, y, z);
    const slots = this.containers.get(key);
    if (!slots) return;
    this.containers.delete(key);
    if (this.openChest?.key === key) this.closeChest();
    for (const s of slots) if (s) this.entities.spawnItem(x + 0.5, y + 0.5, z + 0.5, s.id, s.count, s.dmg ?? 0);
  }

  sleepIn(x, y, z) {
    const p = this.player;
    if (this.env.daylight > 0.6) { this.ui.message('You can only sleep at night'); return; }
    const near = this.entities.list.some((e) => e.kind === 'mob' && e.def.hostile && !e.dead && Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < 10);
    if (near) { this.ui.message('You may not rest now, there are monsters nearby', '#e88a78'); return; }
    this.meta.bed = { x, y, z };
    // The mouse stays captured while the screen fades out and back in, so play just carries on.
    this.state = 'sleeping';
    this.mining = null;
    this.ui.setSleeping(true);
    const world = this.world;
    setTimeout(() => {
      this.ui.setSleeping(false);
      if (this.world !== world) return;
      this.time = (Math.floor(this.time / TICKS_PER_DAY) + 1) * TICKS_PER_DAY + 300;
      this.weather.set(false);
      this.weather.rain = 0;
      this.ui.message('Good morning! Your bed is now your spawn point.', '#f3b73f');
      if (this.state === 'sleeping') this.state = 'play';
      this.save();
    }, 1400);
  }

  // World listener: react to blocks that vanish (chests spill their items).
  blockChanged(x, y, z, old, id) {
    if (CHEST[old] !== undefined && CHEST[id] === undefined) this.dropContainer(x, y, z);
  }

  openChat(prefix = '') {
    this.state = 'chat';
    this.releasePointer();
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
    this.releasePointer();
    this.mining = null;
    $('death-cause').textContent = `${cause}. Your items are safe in your inventory.`;
    this.ui.show('screen-death');
  }

  resetHunger() {
    this.food = 20;
    this.saturation = 5;
    this.exhaustion = 0;
    this.foodTimer = 0;
    this.eating = null;
  }

  respawn() {
    this.goToSpawn();
    this.health = 20;
    this.resetHunger();
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
      } else if (s === 'chest') {
        if (e.code === 'KeyE' || e.code === 'Escape') this.closeChest();
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
    let sprint = (k.isDown('ControlLeft') || k.isDown('ControlRight') || this.sprintLatch || t.sprint) && (this.creative || this.food > 6);
    if (this.eating) { forward *= 0.3; right *= 0.3; sprint = false; }
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
    c.yaw += dt * (REDUCED_MOTION ? 0.006 : 0.035);
    this.panorama.update(c.x, c.z, COARSE ? 4 : 6);
    this.time = 2600 + performance.now() / 1000 * 2;
    updateEnvironment(this.env, this.time);
    const rd = COARSE ? 4 : 6;
    this.renderer.render({
      cam: c, fov: 70, env: this.env, time: performance.now() / 1000, renderDist: rd, world: this.panorama,
      fogColor: this.env.fogColor, fogStart: rd * 16 * 0.5, fogEnd: rd * 16 * 0.92, underwater: false,
      clouds: true, cloudHeight: CLOUD_HEIGHT, brightness: 0.5, wave: true,
    });
    this.audio.update('title');
  }

  updateGame(dt) {
    const p = this.player, w = this.world;
    const active = this.state === 'play';
    const paused = this.state === 'pause';
    w.update(p.x, p.z, this.settings.renderDistance);
    if (this.needsRespawnY && w.isLoaded(p.x, p.z)) {
      if (this.respawnAtBed) this.placeAtBed();
      else { this.placeAt(Math.floor(p.x), Math.floor(p.z)); this.needsRespawnY = false; }
    }
    if (active) this.handleLook();
    const move = active ? this.movementInput() : { forward: 0, right: 0, jump: false, sneak: false, sprint: false };
    p.frozen = !w.isLoaded(p.x, p.z) || this.needsRespawnY;
    if (!paused && this.state !== 'dead') {
      const prevInWater = p.inWater;
      p.update(dt, move, w);
      if (p.inWater && !prevInWater && p.vy < -4) this.audio.splash(Math.min(1, -p.vy / 14));
      this.afterMove(dt);
    }
    if (!paused) {
      this.tickAcc += dt * 20;
      let n = 0;
      while (this.tickAcc >= 1 && n++ < 5) { this.tickAcc -= 1; this.gameTick(); }
      if (this.tickAcc > 5) this.tickAcc = 0;
      this.particles.update(dt, w);
      this.entities.update(dt);
      this.weather.update(dt);
    }
    this.target = this.state === 'play' || this.state === 'inventory' ? this.pickTarget() : null;
    if (active) this.handleActions(dt);
    else { this.mining = null; this.eating = null; }
    this.updateHand(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.renderScene(dt, false);
    this.updateHUD();
    this.adaptResolution(dt);
    this.audio.setListener(p.x, p.eyeY, p.z, p.yaw, p.headInWater);
    this.audio.update(this.musicMood());
  }

  // Music follows the time of day, and turns darker deep underground.
  musicMood() {
    const p = this.player;
    if (this.state === 'loading') return null;
    const sky = this.world.getLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z)) >> 4;
    if (p.y < 52 && sky < 4) return 'cave';
    return this.env.daylight < 0.45 ? 'night' : 'day';
  }

  afterMove(dt) {
    const p = this.player;
    if (!p.flying) {
      const moved = Math.hypot(p.vx, p.vz) * dt;
      if (p.inWater) this.exhaust(0.01 * moved);
      else if (p.sprinting && p.onGround) this.exhaust(0.1 * moved);
    }
    if (p.jumped) { p.jumped = false; this.exhaust(p.sprinting ? 0.2 : 0.05); }
    // Footsteps, ladder climbing and swimming strokes.
    if (p.onLadder && !p.onGround && Math.abs(p.vy) > 0.5) {
      this.stepAcc += Math.abs(p.vy) * dt;
      if (this.stepAcc > 1.4) { this.stepAcc = 0; this.audio.step('wood', 0.3); }
    } else if (p.inWater && !p.onGround) {
      this.stepAcc += Math.hypot(p.vx, p.vy, p.vz) * dt;
      if (this.stepAcc > 2.2) { this.stepAcc = 0; this.audio.swim(); }
    } else if (p.onGround && !p.flying) {
      if (p.sprinting && Math.random() < dt * 14) {
        const g = p.groundBlock(this.world);
        if (g) this.particles.spawn(p.x + (Math.random() - 0.5) * 0.5, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.5, -p.vx * 0.15, 1.2 + Math.random(), -p.vz * 0.15, g, 2, 0.35, 0.05);
      }
      this.stepAcc += Math.hypot(p.vx, p.vz) * dt;
      if (this.stepAcc > 1.7) {
        this.stepAcc = 0;
        const g = p.groundBlock(this.world);
        if (g && !p.sneaking) this.audio.step(BLOCKS[g]?.sound ?? 'stone');
      }
    }
    if (p.inWater && !this.wasInWater && p.vy >= -4) this.audio.splash(0.3);
    this.wasInWater = p.inWater;
    // Fall damage
    if (p.landed !== null) {
      const d = p.landed;
      p.landed = null;
      if (d > 3.2 && !p.inWater && !this.creative) this.audio.fall(d > 7);
      if (d > 3.2 && !p.inWater) this.damage(Math.floor(d - 3), 'You fell from a high place');
      if (d > 1.2) { const g = p.groundBlock(this.world); if (g) this.audio.land(BLOCKS[g]?.sound ?? 'stone'); }
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
      this.hungerTick();
      if (this.eating) this.eatTick();
    }
    if (this.time % 20 === 0) this.ambientTick();
    this.saveTimer++;
    if (this.saveTimer >= 600) { this.saveTimer = 0; this.save(); }
  }

  exhaust(amount) { if (!this.creative) this.exhaustion = Math.min(40, this.exhaustion + amount); }

  hungerTick() {
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.food = Math.max(0, this.food - 1);
    }
    this.foodTimer++;
    if (this.saturation > 0 && this.food >= 20 && this.health < 20) {
      // Well fed: heal quickly, using up saturation.
      if (this.foodTimer >= 10) { this.foodTimer = 0; this.health++; this.exhaust(6); }
    } else if (this.food >= 18 && this.health < 20) {
      if (this.foodTimer >= 80) { this.foodTimer = 0; this.health++; this.exhaust(6); }
    } else if (this.food <= 0) {
      // Starving hurts, down to half a heart.
      if (this.foodTimer >= 80) { this.foodTimer = 0; if (this.health > 1) this.damage(1, 'You starved to death', true); }
    } else this.foodTimer = 0;
  }

  // Eating takes 1.6 seconds of holding right click, with chewing along the way.
  eatTick() {
    const e = this.eating, p = this.player;
    e.left--;
    if (e.left <= 25 && e.left % 4 === 0) {
      this.audio.eat();
      const d = p.lookDir();
      this.particles.bits(p.x + d[0] * 0.4, p.eyeY - 0.15 + d[1] * 0.4, p.z + d[2] * 0.4, itemDef(e.id).tex, 5, 1.2, 0.5);
    }
    if (e.left > 0) return;
    const def = itemDef(e.id);
    this.eating = null;
    if (this.inv.heldId !== e.id) return;
    this.food = Math.min(20, this.food + def.food);
    this.saturation = Math.min(this.food, this.saturation + def.food * (def.sat ?? 0.3) * 2);
    this.inv.consumeHeld();
    this.invChanged();
    this.audio.burp();
  }

  // Now and then, lava close by bubbles and pops.
  ambientTick() {
    const p = this.player, w = this.world;
    if (Math.random() > 0.35) return;
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 24), y = Math.floor(p.y + (Math.random() - 0.5) * 12);
      const z = Math.floor(p.z + (Math.random() - 0.5) * 24);
      if (w.getBlock(x, y, z) === B.lava && !w.getBlock(x, y + 1, z)) {
        this.audio.lavaPop({ x: x + 0.5, y: y + 1, z: z + 0.5 });
        return;
      }
    }
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
    this.exhaust(0.1);
    this.invuln = 10;
    this.sinceDamage = 0;
    this.hurtFlash = 1;
    this.hurtTime = 0.5;
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
    const touchTap = !!t.tap;
    t.breakStart = false;
    t.tap = false;

    if (attackClick && target?.entity) {
      this.swingArm();
      const e = target.entity, p = this.player;
      // Hitting while falling is a critical hit: half again as much damage, with sparks.
      const crit = !p.onGround && p.vy < -0.5 && !p.inWater && !p.onLadder && !p.flying;
      this.audio.punch({ x: e.x, y: e.y + e.def.h * 0.6, z: e.z });
      if (crit) this.particles.bits(e.x, e.y + e.def.h * 0.7, e.z, TEX.crit, 10, 2.4, 0.5);
      this.entities.attack(e, this.inv.heldId, crit);
      this.exhaust(0.1);
      if (!this.creative && this.inv.damageHeld(1)) this.audio.toolBreak();
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

    // Holding right click with food eats it (when hungry), unless you're using a door, chest or bed.
    const held = this.inv.held, hdef = held && itemDef(held.id);
    const usable = target && !target.entity && !this.player.sneaking && (DOOR[target.id] || CHEST[target.id] !== undefined || BED[target.id]);
    // (On touch screens a tap starts eating and it carries on by itself.)
    const eatInput = use || useClick || (this.eating?.touch && !useClick);
    if (hdef?.food && !this.creative && this.food < 20 && eatInput && !usable) {
      if (!this.eating || this.eating.id !== held.id || this.eating.slot !== this.inv.selected) {
        this.eating = { id: held.id, slot: this.inv.selected, left: 32, touch: touchTap };
      }
    } else this.eating = null;
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
    if (byPlayer) this.exhaust(0.005);
    this.particles.burst(x, y, z, id);
    this.audio.breakBlock(def.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (!this.creative && byPlayer) {
      const held = this.inv.heldId;
      for (const drop of dropsFor(id, held)) this.entities.spawnItem(x + 0.5, y + 0.3, z + 0.5, drop.id, drop.count);
      if (def.hardness > 0 && itemDef(held)?.durability && this.inv.damageHeld(1)) this.audio.toolBreak();
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
    if (!this.swinging || this.swing >= 0.5) this.swingArm();
    if (cur.sound <= 0) {
      cur.sound = 0.24;
      this.audio.dig(BLOCKS[target.id].sound, { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 });
      this.particles.chip(target.x, target.y, target.z, target.face, target.id);
    }
    if (cur.progress >= 1) {
      this.breakBlockAt(target.x, target.y, target.z, target.id, true);
      this.mining = null;
      this.breakCooldown = 0.15;
    }
  }

  // Horizontal direction the player faces, as a face index (+X 0, -X 1, +Z 4, -Z 5).
  lookFace() {
    const d = this.player.lookDir();
    return Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 0 : 1) : (d[2] > 0 ? 4 : 5);
  }

  useItem(repeat = false) {
    const held = this.inv.held, t = this.target, p = this.player, w = this.world;
    const def = held ? itemDef(held.id) : null;
    // Doors, chests and beds are used rather than built on (sneak to place blocks against them).
    if (t && !t.entity && !p.sneaking && (DOOR[t.id] || CHEST[t.id] !== undefined || BED[t.id])) {
      if (repeat) return;
      if (DOOR[t.id] && w.toggleDoor(t.x, t.y, t.z)) {
        this.audio.door(!!DOOR[w.getBlock(t.x, t.y, t.z)]?.open, { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
        this.swingArm();
      }
      else if (CHEST[t.id] !== undefined) this.openChestAt(t.x, t.y, t.z);
      else if (BED[t.id]) {
        const b = BED[t.id], d = FACE_DIRS[b.dir];
        if (b.head) this.sleepIn(t.x - d[0], t.y, t.z - d[2]); else this.sleepIn(t.x, t.y, t.z);
      }
      return;
    }
    if (def?.food && !this.creative) return; // eaten by holding right click (see handleActions)
    if (!t || t.entity) {
      if (t?.entity && !repeat) this.entities.interact(t.entity, held);
      return;
    }
    if (t.id === B.tnt && held?.id === I.flint_and_steel && !repeat) {
      w.setBlock(t.x, t.y, t.z, 0);
      this.audio.ignite({ x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
      this.entities.primeTNT(t.x, t.y, t.z, 80);
      if (!this.creative) { this.inv.damageHeld(1); this.invChanged(); }
      this.swingArm();
      return;
    }
    if (!held || def.block === null || def.block === undefined || t.face < 0) return;
    const blockId = def.block, face = t.face;
    // Where on the clicked block the crosshair landed (for top/bottom halves).
    const hitFrac = p.eyeY + p.lookDir()[1] * t.t - t.y;
    const upperHalf = face === 3 || (face !== 2 && hitFrac > 0.5);
    const slab = SLAB[blockId];
    if (slab) {
      // Clicking the open side of a matching slab turns it into a full block.
      const ts = SLAB[t.id];
      if (ts && ts.bottom === slab.bottom && ((face === 2 && !ts.top) || (face === 3 && ts.top))) {
        this.finishPlace(t.x, t.y, t.z, slab.material);
        return;
      }
    }
    let x = t.x, y = t.y, z = t.z;
    if (!REPLACEABLE[t.id] || t.id === blockId) {
      const d = FACE_DIRS[face];
      x += d[0]; y += d[1]; z += d[2];
    }
    if (y < 0 || y >= HEIGHT) return;
    const existing = w.getBlock(x, y, z);
    if (slab && SLAB[existing]?.bottom === slab.bottom) {
      if (SLAB[existing].top !== upperHalf || face === 2 || face === 3) this.finishPlace(x, y, z, slab.material);
      return;
    }
    if (existing && !REPLACEABLE[existing]) return;
    if (existing === blockId) return;
    let id = blockId;
    if (blockId === B.torch) {
      if (face === 3) return;
      if (face !== 2) id = WALL_TORCH[face];
    } else if (FACING_VARIANTS[blockId]) {
      id = FACING_VARIANTS[blockId][oppositeFace(this.lookFace())];
    } else if (LOG_AXES[blockId]) {
      if (face === 0 || face === 1) id = LOG_AXES[blockId][0];
      else if (face === 4 || face === 5) id = LOG_AXES[blockId][1];
    } else if (slab) {
      id = upperHalf ? slab.topId : slab.bottom;
    } else if (STAIRS[blockId]) {
      id = STAIRS[blockId].ids[this.lookFace()][upperHalf ? 1 : 0];
    } else if (CLIMB[blockId]) {
      if (face === 2 || face === 3) return;
      id = LADDER[oppositeFace(face)];
    } else if (CHEST[blockId] !== undefined) {
      const front = oppositeFace(this.lookFace());
      id = Number(Object.keys(CHEST).find((k) => CHEST[k] === front));
    } else if (BED[blockId]) {
      const dir = this.lookFace(), d = FACE_DIRS[dir];
      const hx = x + d[0], hz = z + d[2];
      const headCell = w.getBlock(hx, y, hz);
      if ((headCell && !REPLACEABLE[headCell]) || !SOLID[w.getBlock(x, y - 1, z)] || !SOLID[w.getBlock(hx, y - 1, hz)]) return;
      if (p.intersectsBlock(x, y, z) || p.intersectsBlock(hx, y, hz) || this.entities.blocksPlacement(x, y, z) ||
          this.entities.blocksPlacement(hx, y, hz)) return;
      w.setBlock(x, y, z, bedId(dir, false), { updates: false });
      w.setBlock(hx, y, hz, bedId(dir, true), { updates: false });
      w.neighborsChanged(x, y, z);
      w.neighborsChanged(hx, y, hz);
      this.afterPlace(blockId, x, y, z);
      return;
    } else if (DOOR[blockId]) {
      const above = w.getBlock(x, y + 1, z);
      if (y + 1 >= HEIGHT || (above && !REPLACEABLE[above]) || !SOLID[w.getBlock(x, y - 1, z)]) return;
      if (p.intersectsBlock(x, y, z) || p.intersectsBlock(x, y + 1, z) || this.entities.blocksPlacement(x, y, z) ||
          this.entities.blocksPlacement(x, y + 1, z)) return;
      const facing = this.lookFace();
      w.setBlock(x, y, z, doorId(facing, false, false), { updates: false });
      w.setBlock(x, y + 1, z, doorId(facing, false, true), { updates: false });
      w.neighborsChanged(x, y, z);
      w.neighborsChanged(x, y + 1, z);
      this.afterPlace(id, x, y, z);
      return;
    }
    if (BLOCKS[id].support && !w.supported(x, y, z, id)) return;
    if (SOLID[id] && (p.intersectsBlock(x, y, z) || this.entities.blocksPlacement(x, y, z))) return;
    if (w.setBlock(x, y, z, id)) this.afterPlace(id, x, y, z);
  }

  finishPlace(x, y, z, id) {
    if (SOLID[id] && (this.player.intersectsBlock(x, y, z) || this.entities.blocksPlacement(x, y, z))) return;
    if (this.world.setBlock(x, y, z, id)) this.afterPlace(id, x, y, z);
  }

  afterPlace(id, x, y, z) {
    this.audio.place(BLOCKS[id].sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.swingArm();
    if (!this.creative) { this.inv.consumeHeld(); this.invChanged(); }
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

  // World listener: water met lava.
  fizz(x, y, z) {
    const at = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    this.audio.fizz(at);
    this.particles.smoke?.(at.x, at.y + 0.4, at.z, 6);
  }

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
    while ((n === 0 || shift) && n < 64 && this.inv.craft(r, stations)) n++;
    if (!n && this.inv.canCraft(r, stations)) this.ui.message('Your inventory is full', '#e88a78');
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
        say('/gamemode creative|survival, /tp <x> <y> <z>, /give <item> [count], /weather clear|rain');
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
      case 'spawn': p.x = this.meta.spawn.x; p.z = this.meta.spawn.z; this.respawnAtBed = false; this.needsRespawnY = true; say('Teleported to spawn'); break;
      case 'setspawn': this.meta.spawn = { x: p.x, y: p.y, z: p.z }; say('Spawn point set here'); break;
      case 'fly': if (this.creative) { p.flying = !p.flying; say(p.flying ? 'Flying' : 'Not flying'); } else say('Flying needs Creative mode', '#e88a78'); break;
      case 'weather': {
        const kind = (args[0] ?? '').toLowerCase(), secs = Number(args[1]);
        if (kind !== 'clear' && kind !== 'rain') { say('Usage: /weather clear|rain [seconds]', '#e88a78'); break; }
        this.weather.set(kind === 'rain', Number.isFinite(secs) && secs > 0 ? secs : null);
        say(kind === 'rain' ? 'It starts to rain' : 'The sky clears');
        break;
      }
      case 'kill': if (this.creative) { p.y = this.meta.spawn.y ?? 100; } else this.damage(999, 'You gave up', true); break;
      case 'clear': this.inv.slots.fill(null); this.invChanged(); say('Inventory cleared'); break;
      default: say(`Unknown command: /${cmd}. Try /help`, '#e88a78');
    }
  }

  // ---------------------------------------------------------------- rendering
  updateHand(dt) {
    const held = this.inv.heldId, p = this.player;
    if (held !== this.lastHeld) {
      this.lastHeld = held;
      if (held) this.ui.showItemName(itemLabel(held));
    }
    // Switching items: the old one dips out of view, then the new one comes up.
    if (held !== this.handItem) {
      this.handHeight = Math.max(0, this.handHeight - dt * 8);
      if (this.handHeight < 0.1) this.handItem = held;
    } else this.handHeight = Math.min(1, this.handHeight + dt * 6);
    if (this.swinging) {
      this.swing += dt * 3.4;
      if (this.swing >= 1) { this.swing = 0; this.swinging = false; }
    }
    // The hand trails a little behind the view when turning.
    const k = 1 - Math.exp(-dt * 14);
    this.lagPitch += (p.pitch - this.lagPitch) * k;
    let dyaw = p.yaw - this.lagYaw;
    dyaw -= Math.round(dyaw / (Math.PI * 2)) * Math.PI * 2;
    this.lagYaw = p.yaw - dyaw * (1 - k);
  }

  // Rain greys out the sky, dims the daylight and hides the sun, moon and stars.
  applyWeather() {
    const k = this.weather.rain, e = this.env;
    if (k <= 0) return;
    const grey = (c, amount, dark) => {
      const l = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) * dark;
      for (let i = 0; i < 3; i++) c[i] += (l - c[i]) * amount;
    };
    grey(e.zenith, k * 0.7, 0.75);
    grey(e.horizon, k * 0.65, 0.8);
    grey(e.fogColor, k * 0.65, 0.8);
    grey(e.cloudColor, k * 0.7, 0.7);
    grey(e.skyLight, k * 0.5, 0.9);
    e.daylight = Math.max(0.2, e.daylight * (1 - 0.25 * k));
    e.stars *= 1 - k;
    e.sunset *= 1 - k * 0.8;
  }

  updateWeatherEffects(cam, dt) {
    const w = this.weather, p = this.player, world = this.world;
    w.build(cam, world, dt);
    const inRain = w.rain > 0 && w.kind(world, Math.floor(p.x), Math.floor(p.z), Math.floor(p.y)) === 1;
    if (inRain && w.rain > 0.2) {
      for (const s of w.splashSpots(cam, world, Math.round(w.rain * 4))) this.particles.bits(s[0], s[1], s[2], TEX.splash, 2, 0.7, 0.25);
    }
    // Quieter under a roof, silent in the snow.
    const sky = world.getLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z)) >> 4;
    this.audio.setRain(inRain ? w.rain * (0.25 + 0.75 * (sky / 15) ** 2) : 0);
  }

  renderScene(dt, loading) {
    const p = this.player, s = this.settings;
    updateEnvironment(this.env, this.time);
    this.applyWeather();
    // View bobbing and the hurt tilt, done like the original: a small sway and roll while walking,
    // and a quick roll of the camera when you take damage.
    const bob = s.viewBobbing ? p.bob * 0.1 : 0, walk = p.bobPhase / Math.PI;
    const hurtF = this.hurtTime / 0.5;
    const roll = hurtF > 0 && !REDUCED_MOTION ? -Math.sin(hurtF ** 4 * Math.PI) * 14 * DEG : 0;
    const pre = identity(this.viewPre);
    if (roll) rotateZ(pre, pre, roll);
    if (bob) {
      translate(pre, pre, Math.sin(walk * Math.PI) * bob * 0.5, -Math.abs(Math.cos(walk * Math.PI) * bob), 0);
      rotateZ(pre, pre, Math.sin(walk * Math.PI) * bob * 3 * DEG);
      rotateX(pre, pre, Math.abs(Math.cos(walk * Math.PI - 0.2) * bob) * 5 * DEG);
    }
    const cam = { x: p.x, y: p.eyeY, z: p.z, yaw: p.yaw, pitch: p.pitch, pre };
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
    if (!loading) this.updateWeatherEffects(cam, dt);
    const target = !loading && this.target && !this.target.entity ? this.target : null;
    const heldLight = this.world.getLight(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
    this.particles.build(cam, this.world);
    this.renderer.render({
      cam, fov: s.fov * this.fovMul, env: this.env, time: performance.now() / 1000, renderDist: rd, world: this.world,
      fogColor, fogStart, fogEnd, underwater, clouds: s.clouds, cloudHeight: CLOUD_HEIGHT, brightness: s.brightness / 100,
      wave: true,
      selection: target && this.state !== 'dead' ? { x: target.x, y: target.y, z: target.z, box: this.world.selectionBox(target.x, target.y, target.z, target.id) } : null,
      crack: this.mining && this.mining.progress > 0 ? { x: this.mining.x, y: this.mining.y, z: this.mining.z, stage: Math.floor(this.mining.progress * 10) } : null,
      particles: this.particles,
      weather: this.weather,
      entities: this.entities.renderList(cam),
      hand: loading || this.hideHud || this.state === 'dead' ? null : {
        item: this.handItem, swing: this.swinging ? this.swing : 0, equip: 1 - this.handHeight,
        bob, walk, roll, lag: [(this.lagPitch - p.pitch) * 0.1, (this.lagYaw - p.yaw) * 0.1],
        eat: this.eating ? this.eating.left : undefined,
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
    ui.renderStats(!this.creative, this.health, this.air, p.headInWater, this.food);
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
    const f = Math.round(deg / 90) % 4;
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
      `Chunks: ${w.chunks.size} · Sections drawn: ${r.sections} · Triangles: ${(r.triangles / 1000).toFixed(0)}k · ${this.canvas.width}x${this.canvas.height}`,
      `Food: ${this.food} (saturation ${this.saturation.toFixed(1)}) · Weather: ${this.weather.raining ? 'rain' : 'clear'} ${Math.round(this.weather.rain * 100)}%`,
      `Entities: ${this.entities.list.length} · Particles: ${this.particles.list.length}`,
      t && !t.entity ? `Looking at: ${BLOCKS[t.id].label} (${t.x}, ${t.y}, ${t.z}) face ${FACE_NAMES[t.face] ?? '-'}` : t?.entity ? `Looking at: ${t.entity.label}` : 'Looking at: nothing',
    ];
  }
}

