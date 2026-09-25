// Tropical fish: [name, shape (0 slim A, 1 tall B), pattern (1-6), base colour, pattern colour], a
// set of Minecraft's commonest. Their skins are made from Pixel Perfection's (see
// tools/skin-sources.mjs, and tex/mobskins.js for the drawn fallback).
export const TROPICAL = [
  ['clownfish', 0, 1, 'orange', 'white'], ['tomato_clownfish', 0, 1, 'red', 'white'], ['triggerfish', 0, 2, 'gray', 'white'],
  ['parrotfish', 0, 2, 'cyan', 'pink'], ['blue_tang', 0, 4, 'blue', 'yellow'], ['queen_angelfish', 0, 5, 'lime', 'light_blue'],
  ['cotton_candy_betta', 0, 6, 'pink', 'light_blue'], ['snooper', 0, 3, 'gray', 'red'], ['threadfin', 1, 1, 'white', 'yellow'],
  ['yellow_tang', 1, 2, 'yellow', 'yellow'], ['red_lipped_blenny', 1, 2, 'gray', 'orange'], ['glitterfish', 1, 3, 'white', 'gray'],
  ['red_snapper', 1, 4, 'red', 'white'], ['red_cichlid', 1, 5, 'red', 'white'], ['ornate_butterflyfish', 1, 6, 'white', 'orange'],
  ['goatfish', 1, 4, 'white', 'yellow'],
];
// Their colours (Minecraft's tropical fish dye colours).
export const FISH_COLOURS = {
  white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f, pink: 0xf38baa,
  gray: 0x474f52, light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa, brown: 0x835432, green: 0x5e7c16, red: 0xb02e26,
  black: 0x1d1d21,
};
