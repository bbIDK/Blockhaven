// The sixteen dye colours and what each looks like as wool, concrete, terracotta and glass.
// Coloured blocks share one grey texture per kind, tinted by these (see blocks.js).
export const DYES = [
  // name, wool, concrete, terracotta, dye item
  ['white', 0xe9ecec, 0xcfd5d6, 0xd1b2a1, 0xf0f0f0],
  ['orange', 0xf07613, 0xe06101, 0xa15325, 0xf9801d],
  ['magenta', 0xbd44b3, 0xa9309f, 0x95576c, 0xc74ebd],
  ['light_blue', 0x3aafd9, 0x2489c7, 0x706c8a, 0x3ab3da],
  ['yellow', 0xf8c627, 0xf1af15, 0xba8523, 0xfed83d],
  ['lime', 0x70b919, 0x5ea918, 0x677534, 0x80c71f],
  ['pink', 0xed8dac, 0xd5658f, 0xa04d4e, 0xf38baa],
  ['gray', 0x3e4447, 0x373a3e, 0x392a23, 0x474f52],
  ['light_gray', 0x8e8e86, 0x7d7d73, 0x876b62, 0x9d9d97],
  ['cyan', 0x158991, 0x157788, 0x575b5b, 0x169c9c],
  ['purple', 0x792aac, 0x64209c, 0x764656, 0x8932b8],
  ['blue', 0x35399d, 0x2d2f8f, 0x4a3b5b, 0x3c44aa],
  ['brown', 0x724728, 0x603c20, 0x4d3323, 0x835432],
  ['green', 0x546d1b, 0x495b24, 0x4c532a, 0x5e7c16],
  ['red', 0xa12722, 0x8e2121, 0x8f3d2e, 0xb02e26],
  ['black', 0x141519, 0x080a0f, 0x251610, 0x1d1d21],
].map(([name, wool, concrete, terracotta, dye]) => ({ name, wool, concrete, terracotta, dye }));

// A tint that turns a grey texture whose average brightness is `mean` into `color`.
export function tintFor(color, mean) {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255].map((c) => Math.min(255, Math.round(c / mean)));
}
export const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
