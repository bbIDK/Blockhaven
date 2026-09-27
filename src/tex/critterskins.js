// The wild update's creature skins, painted over their models (rigs.js) in the style of the rest
// (see mobskins.js): the ocelot, the axolotls in their five colours, the frogs in their three, the
// tadpole, a trader's llama's blanket, and the glow squid (whose skin comes from Mineclonia; this is
// the fallback).
import { skin } from '../skins.js';
import { ramp, mix } from './core.js';
import { reg, cubesOf, each, fur, at, row, feet } from './mobskins.js';

// Glow squid: dark teal, with glowing spots and a pale glowing band round the eyes.
skin('glow_squid', (sk) => {
  fur(sk, 'squid', ['body', 'arm0'], ramp(0x1e5a5a, 5, 0.1, 8), { cell: 2, grain: 0.3 });
  each(sk, 'squid', ['body', 'arm0'], (face, r) => {
    for (let k = 0; k < Math.ceil((r[2] * r[3]) / 14); k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), sk.r() < 0.5 ? 0x8ff8d8 : 0x5ae0c0);
  });
  const b = reg(cubesOf('squid', 'body')[0]);
  for (const side of ['front', 'back']) {
    const r = b[side];
    for (const x of [2, 8]) { at(sk, r, x, 11, 0xd8fff0); at(sk, r, x + 1, 11, 0xd8fff0); at(sk, r, x, 12, 0xd8fff0); at(sk, r, x + 1, 12, 0x0c2a2a); }
  }
});

// Ocelots: a sandy yellow coat covered in dark rosettes, a pale belly and muzzle, green eyes.
skin('ocelot', (sk) => {
  const pal = ramp(0xd8a24a, 4, 0.08, 6), SPOT = [0x3a2616, 0x4a321e], PALE = ramp(0xf0dcaa, 3, 0.05, 4);
  fur(sk, 'cat', ['body', 'head', 'legFR', 'legBR', 'tail'], pal, { cell: 1, grain: 0.3 });
  each(sk, 'cat', ['body', 'head', 'legFR', 'legBR', 'tail'], (face, r) => {
    if (face === 'bottom') return;
    // Rosettes: a dark ring round a spot of the coat, here and there.
    for (let y = 0; y < r[3]; y += 2) for (let x = (y / 2) % 2 ? 1 : 0; x < r[2]; x += 3) {
      if (sk.r() < 0.55) at(sk, r, x, y, SPOT[sk.ri(2)]);
    }
  });
  const body = reg(cubesOf('cat', 'body')[0]);
  sk.fill(body.bottom, PALE, { cell: 1 });
  // The tail ringed in black, with a black tip.
  for (const cube of cubesOf('cat', 'tail')) sk.box(cube, (face, r) => {
    if (face === 'top' || face === 'bottom') return;
    for (let y = 0; y < r[3]; y += 2) row(sk, r, y, SPOT[0]);
  });
  const [head, earR, earL, nose] = cubesOf('cat', 'head');
  const H = reg(head);
  sk.fill(H.front, pal, { cell: 1, grain: 0.2 });
  for (const c of [earR, earL]) sk.box(c, (face, r) => { sk.fill(r, pal.slice(0, 3), { cell: 1 }); if (face === 'front') at(sk, r, 0, 0, SPOT[0]); });
  at(sk, H.front, 0, 1, 0x58c030); at(sk, H.front, 1, 1, 0x101010); at(sk, H.front, 3, 1, 0x101010); at(sk, H.front, 4, 1, 0x58c030);
  at(sk, H.front, 2, 0, SPOT[0]); at(sk, H.front, 1, 0, SPOT[1]); at(sk, H.front, 3, 0, SPOT[1]);
  sk.box(nose, (face, r) => { sk.fill(r, PALE, { cell: 1 }); if (face === 'front') { at(sk, r, 1, 0, 0xd07a6a); at(sk, r, 1, 1, 0x4a2a22); } });
  feet(sk, 'cat', ['legFR', 'legBR'], 1, PALE);
});

// Axolotls: smooth skin, darker speckles, three pairs of frilly gills (a deeper shade, bright at
// their tips), small black eyes, a pale belly, and a fin along the back and tail.
const AXOLOTLS = [
  ['lucy', 0xf2a6c6, 0xd84c86, 0xfbd4e4],
  ['wild', 0x7a5a3e, 0x5a3e2a, 0xa88a6a],
  ['gold', 0xf2c23e, 0xe0962a, 0xfae08a],
  ['cyan', 0xd2eef2, 0xe07ab0, 0xf0fafc],
  ['blue', 0x5c6ed0, 0x3c4ab0, 0x8c9ae4],
];
for (const [name, base, gill, belly] of AXOLOTLS) {
  skin(`axolotl_${name}`, (sk) => {
    const pal = ramp(base, 4, 0.06, 6), G = ramp(gill, 3, 0.1, 6), P = ramp(belly, 3, 0.05, 4);
    fur(sk, 'axolotl', ['body', 'head'], pal, { cell: 2, grain: 0.2 });
    each(sk, 'axolotl', ['body', 'head'], (face, r) => {
      if (face === 'bottom') { sk.fill(r, P, { cell: 1 }); return; }
      for (let k = 0; k < Math.ceil((r[2] * r[3]) / 18); k++) at(sk, r, sk.ri(r[2]), sk.ri(r[3]), mix(base, 0x000000, name === 'wild' ? 0.35 : 0.15));
    });
    // The fin along the back and down the tail: the body's colour, paler towards its edge.
    const [, crest] = cubesOf('axolotl', 'body');
    for (const cube of [crest, ...cubesOf('axolotl', 'tail')]) {
      sk.box(cube, (face, r) => {
        if (face !== 'right' && face !== 'left') return;
        for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
          const edge = y === 0 || y === r[3] - 1 || (cube.size[2] > 9 && x >= r[2] - 2);
          at(sk, r, x, y, edge ? mix(base, 0xffffff, 0.35) : pal[1 + ((x + y) % 2)]);
        }
      });
    }
    // Gills: frilly, a deeper colour, with bright tips.
    each(sk, 'axolotl', ['gillsTop', 'gillsR'], (face, r) => {
      for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
        const tip = face === 'front' || face === 'back' ? (r[2] > 3 ? y === 0 : x === (face === 'front' ? r[2] - 1 : 0)) : false;
        if ((x + y) % 3 === 2 && !tip) continue;
        at(sk, r, x, y, tip ? mix(gill, 0xffffff, 0.3) : G[(x + y) % G.length]);
      }
    });
    // The face: small eyes wide apart, a gentle smile.
    const f = reg(cubesOf('axolotl', 'head')[0]).front;
    at(sk, f, 1, 1, 0x141014); at(sk, f, 6, 1, 0x141014);
    for (let x = 2; x < 6; x++) at(sk, f, x, 3, mix(base, 0x000000, 0.3));
    at(sk, f, 1, 2, mix(base, 0x000000, 0.3)); at(sk, f, 6, 2, mix(base, 0x000000, 0.3));
    // The legs: the belly's colour, with toes.
    each(sk, 'axolotl', ['legFR'], (face, r) => {
      sk.fill(r, pal.slice(1), { cell: 1 });
      if (face === 'top') for (let y = 0; y < r[3]; y += 2) at(sk, r, r[2] - 1, y, mix(gill, 0xffffff, 0.2));
    });
  });
}

// Frogs: the temperate orange-brown, the warm pale cream, the cold green; each with a paler throat
// and belly, dark spots down the back, eyes of gold with a black bar, and webbed feet.
const FROGS = [
  ['temperate', 0xc2703a, 0xe8b070, 0x6a3a1c],
  ['warm', 0xe2d2b4, 0xf4ecd8, 0xa89070],
  ['cold', 0x5a8a42, 0x98c070, 0x2e4a22],
];
for (const [name, back, belly, spot] of FROGS) {
  skin(`frog_${name}`, (sk) => {
    const pal = ramp(back, 4, 0.08, 6), P = ramp(belly, 3, 0.05, 4);
    fur(sk, 'frog', ['head', 'body'], pal, { cell: 1, grain: 0.3 });
    for (const bone of ['armR', 'legR']) sk.box(cubesOf('frog', bone)[0], (face, r) => sk.fill(r, face === 'bottom' ? P : pal, { cell: 1, grain: 0.3 }));
    const [head, eyeR, eyeL] = cubesOf('frog', 'head'), [jaw] = cubesOf('frog', 'body');
    // Spots down the back, the underside pale.
    sk.box(head, (face, r) => {
      if (face === 'top') for (let y = 1; y < r[3]; y += 3) for (let x = 1 + (y % 2); x < r[2] - 1; x += 3) at(sk, r, x, y, spot);
      if (face === 'front') row(sk, r, r[3] - 1, mix(back, 0x000000, 0.45));
    });
    sk.box(jaw, (face, r) => {
      if (face === 'bottom') sk.fill(r, P, { cell: 1 });
      else if (face !== 'top') { row(sk, r, 0, mix(back, 0x000000, 0.35)); row(sk, r, r[3] - 1, P[1]); }
    });
    // Eyes: gold, a black bar across, a glint.
    for (const eyeCube of [eyeR, eyeL]) {
      sk.box(eyeCube, (face, r) => {
        sk.fill(r, pal.slice(1), { cell: 1 });
        if (face === 'front' || face === 'right' || face === 'left') {
          for (let x = 0; x < r[2]; x++) at(sk, r, x, 0, x === 1 ? 0x141010 : 0xe8c050);
          if (face === 'front') at(sk, r, 0, 0, 0xfff4c0);
        }
      });
    }
    // The throat pouch: pale, and pink inside the mouth (the tongue).
    sk.box(cubesOf('frog', 'croak')[0], (face, r) => sk.fill(r, P.map((c) => mix(c, 0xffffff, 0.15)), { cell: 1 }));
    sk.box(cubesOf('frog', 'tongue')[0], (face, r) => sk.fill(r, [0xd8586a, 0xe06a7a, 0xe87e8a], { cell: 1 }));
    // Hands and feet: webbed, drawn as toes on the flat planes.
    for (const [bone, i] of [['armR', 1], ['legR', 1]]) {
      const plane = reg(cubesOf('frog', bone)[i]);
      for (const face of ['top', 'bottom']) {
        const r = plane[face], cx = Math.floor(r[2] / 2);
        for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) {
          const toe = (y === 0 && x % 2 === 0) || (Math.abs(x - cx) <= 1 && y >= 1) || (y === 1 && x > 0 && x < r[2] - 1);
          if (toe) at(sk, r, x, y, pal[(x + y) % pal.length]);
        }
      }
    }
  });
}

// Tadpoles: a dark brown head, the tail a lighter brown.
skin('tadpole', (sk) => {
  fur(sk, 'tadpole', ['body'], [0x2e241a, 0x3a2e22, 0x46382a], { cell: 1, grain: 0.3 });
  const f = reg(cubesOf('tadpole', 'body')[0]).front;
  at(sk, f, 0, 0, 0x0c0a08); at(sk, f, 2, 0, 0x0c0a08);
  each(sk, 'tadpole', ['tail'], (face, r) => {
    for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) if (y > 0 || x < r[2] - 2) at(sk, r, x, y, [0x5a4a36, 0x6a5840, 0x4e4030][(x + y) % 3]);
  });
});

// A trader's llama wears a blanket in the traders' blue, bordered in gold and edged with red.
skin('llama_trader_decor', (sk) => {
  const BLUE = ramp(0x2e4e9a, 4, 0.08, 6), GOLD = 0xe8b838, RED = 0xb8302a;
  const body = reg(cubesOf('llama', 'decor')[0]);
  sk.fill(body.top, BLUE, { cell: 1, grain: 0.2 });
  const [tx, ty, tw, th] = body.top;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (x === 1 || x === tw - 2) sk.set(tx + x, ty + y, y % 2 ? GOLD : RED);
    if ((x === 5 || x === tw - 6) && y % 3 === 1) sk.set(tx + x, ty + y, GOLD);
  }
  // Down the sides it hangs to below the middle, with a gold hem and red tassels.
  for (const side of ['right', 'left', 'front', 'back']) {
    const r = body[side], drop = side === 'front' || side === 'back' ? 3 : 6;
    sk.fill([r[0], r[1], r[2], drop], BLUE, { cell: 1, grain: 0.2 });
    for (let x = 0; x < r[2]; x++) { at(sk, r, x, drop - 1, GOLD); if (x % 3 === 1) at(sk, r, x, drop, RED); }
    if (side === 'right' || side === 'left') for (let y = 1; y < drop - 1; y += 2) for (let x = 2; x < r[2] - 2; x += 4) at(sk, r, x, y, GOLD);
  }
});
