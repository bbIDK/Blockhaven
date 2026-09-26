// Key binds, as in Minecraft's Options → Controls → Key Binds: every action has a key, which the
// player can change. The settings keep only the ones changed (`settings.keys`, action → key code).
export const BINDINGS = [
  { section: 'Movement' },
  { id: 'forward', label: 'Walk Forwards', key: 'KeyW' },
  { id: 'left', label: 'Strafe Left', key: 'KeyA' },
  { id: 'back', label: 'Walk Backwards', key: 'KeyS' },
  { id: 'right', label: 'Strafe Right', key: 'KeyD' },
  { id: 'jump', label: 'Jump', key: 'Space' },
  { id: 'sneak', label: 'Sneak', key: 'ShiftLeft' },
  { id: 'sprint', label: 'Sprint', key: 'ControlLeft' },
  { section: 'Inventory' },
  { id: 'inventory', label: 'Open/Close Inventory', key: 'KeyE' },
  { id: 'drop', label: 'Drop Selected Item', key: 'KeyQ' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `hotbar${n}`, label: `Hotbar Slot ${n}`, key: `Digit${n}` })),
  { section: 'Multiplayer' },
  { id: 'chat', label: 'Open Chat', key: 'KeyT' },
  { id: 'command', label: 'Open Command', key: 'Slash' },
  { section: 'Miscellaneous' },
  { id: 'perspective', label: 'Toggle Perspective', key: 'F5' },
  { id: 'hideHud', label: 'Hide HUD', key: 'F1' },
  { id: 'debug', label: 'Debug Screen', key: 'F3' },
];
export const DEFAULT_KEYS = Object.fromEntries(BINDINGS.filter((b) => b.id).map((b) => [b.id, b.key]));

// The other key of a pair (both Shifts sneak while Sneak is Left Shift, and so on), and the arrow
// keys, which walk too while the walking keys are the usual ones.
const TWIN = { ShiftLeft: 'ShiftRight', ControlLeft: 'ControlRight', AltLeft: 'AltRight', MetaLeft: 'MetaRight' };
const ARROWS = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };

// Keys that can't be bound (they open the game menu, or belong to the browser).
export const RESERVED = new Set(['Escape', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ContextMenu']);

export class Keys {
  constructor(settings) {
    this.settings = settings;
  }

  // The key code for an action ('' when it isn't bound).
  code(id) {
    const k = this.settings.keys?.[id];
    return typeof k === 'string' ? k : DEFAULT_KEYS[id] ?? '';
  }

  // Whether `code` does the action `id`.
  is(code, id) {
    const k = this.code(id);
    if (!k) return false;
    if (code === k || code === TWIN[k]) return true;
    const a = ARROWS[id];
    return !!a && k === a[0] && code === a[1];
  }

  // The codes that do `id` (for Input.isDown and wasPressed).
  codes(id) {
    const k = this.code(id);
    if (!k) return [];
    const out = [k];
    if (TWIN[k]) out.push(TWIN[k]);
    const a = ARROWS[id];
    if (a && k === a[0]) out.push(a[1]);
    return out;
  }

  set(id, code) {
    const keys = { ...(this.settings.keys ?? {}) };
    if (code === DEFAULT_KEYS[id]) delete keys[id]; else keys[id] = code;
    this.settings.keys = keys;
  }

  reset(id = null) {
    if (id === null) { this.settings.keys = {}; return; }
    this.set(id, DEFAULT_KEYS[id]);
  }

  // Actions sharing `id`'s key (shown in red on the Key Binds screen).
  clashes(id) {
    const k = this.code(id);
    if (!k) return [];
    return BINDINGS.filter((b) => b.id && b.id !== id && this.code(b.id) === k).map((b) => b.id);
  }
}

// A key's name as the Key Binds screen and the help show it.
const NAMES = {
  Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Control', ControlRight: 'Right Control',
  AltLeft: 'Left Alt', AltRight: 'Right Alt', Tab: 'Tab', CapsLock: 'Caps Lock', Enter: 'Enter', Backspace: 'Backspace',
  Slash: '/', Backslash: '\\', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '=', Backquote: '`', ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow', ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow',
  Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'Page Up', PageDown: 'Page Down',
};
export function keyName(code) {
  if (!code) return 'Not Bound';
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(.+)$/.exec(code);
  if (m) return `Keypad ${m[1].replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.')}`;
  return code;
}
