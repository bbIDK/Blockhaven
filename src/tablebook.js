// The book that floats over an enchanting table: it bobs, turns to face whoever is nearest, and
// opens when they come close, riffling its pages; bookshelves around the table send the glyphs of
// its writing drifting in (see Game.updateGame and Particles.glyph).
import { boxMesh, MODEL_OFFSET } from './models.js';
import { TEX } from './textures.js';
import { identity, translate, rotateX, rotateY } from './math.js';

let meshes = null;
function bookMeshes(renderer) {
  if (meshes) return meshes;
  const P = 1 / 16, C = TEX.ench_book_cover, G = TEX.ench_book_pages;
  // A board running out from the spine (at x = 0) along +x.
  const board = (w, h, t, layer, uv) => ({ from: [0, -h / 2 * P, -t / 2 * P], to: [w * P, h / 2 * P, t / 2 * P], faces: [0, 1, 2, 3, 4, 5].map((f) => ({ layer, uv: uv[f] })) });
  const coverUV = [[0, 0, 1, 10], [0, 0, 1, 10], [0, 0, 6, 1], [0, 0, 6, 1], [0, 3, 6, 13], [0, 3, 6, 13]];
  const pageUV = [[0, 0, 1, 8], [0, 0, 1, 8], [0, 0, 5, 1], [0, 0, 5, 1], [2, 4, 7, 12], [9, 4, 14, 12]];
  meshes = {
    cover: renderer.createMesh(boxMesh([board(6, 10, 0.5, C, coverUV)])),
    pages: renderer.createMesh(boxMesh([board(5, 8, 1.5, G, pageUV)])),
    leaf: renderer.createMesh(boxMesh([board(5, 8, 0.1, G, pageUV)])),
  };
  return meshes;
}

// Adds the book over the table at (x, y, z) to `out` (the renderer's entity list). `state` is kept
// per table between frames: how far open it is and which way it faces.
export function tableBook(renderer, mats, x, y, z, cam, time, near, state, out) {
  const m = bookMeshes(renderer);
  const cx = x + 0.5, cy = y + 0.75 + Math.sin(time * 1.6 + x) * 0.05, cz = z + 0.5;
  // Turn towards the nearest player within reach (drifting round slowly otherwise), and open.
  let goal = state.yaw + 0.3 * (1 / 60);
  if (near) goal = Math.atan2(near.x - cx, near.z - cz);
  let d = goal - state.yaw;
  d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
  state.yaw += d * 0.08;
  state.open += ((near ? 1 : 0) - state.open) * 0.06;
  const open = state.open, spread = Math.PI / 2 - open * 1.25;
  const base = (mat) => {
    identity(mat);
    translate(mat, mat, cx - cam.x, cy - cam.y, cz - cam.z);
    rotateY(mat, mat, state.yaw);
    rotateX(mat, mat, -0.4 * open);
    return mat;
  };
  const part = (mesh, angle, lift = 0) => {
    const mat = base(mats());
    rotateY(mat, mat, angle);
    translate(mat, mat, 0, lift, 0);
    translate(mat, mat, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
    return { mesh, model: mat };
  };
  const parts = [part(m.cover, Math.PI - spread), part(m.cover, spread), part(m.pages, Math.PI - spread * 0.9), part(m.pages, spread * 0.9)];
  // A page turning over now and then while it's open.
  if (open > 0.5) {
    const f = (time * 0.7 + x * 0.37) % 1.5;
    if (f < 1) parts.push(part(m.leaf, spread * 0.9 + (Math.PI - spread * 1.8) * (f * f * (3 - 2 * f))));
  }
  out.push({ parts, light: [15, 15], tint: null });
}
