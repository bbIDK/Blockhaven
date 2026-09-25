// WebGL2 renderer: terrain sections, sky, clouds, selection box, cracks, particles, entities, held item.
// Two looks: classic (drawn straight to the screen) and shaders (lit from the sun with shadows,
// drawn in HDR and finished by post.js).
import {
  perspective, viewRotation, multiply, invert, translate, scale, rotateX, rotateY, rotateZ,
  frustumPlanes, boxInFrustum, mat4, identity,
} from './math.js';
import { generateTextures, TEXTURE_NAMES, TEX, ARRAY_LAYERS } from './textures.js';
import { STRIDE, meshBlockItem, SECTION_OFFSET, FACE_PAIR, ALL_OPEN } from './mesher.js';
import { boxMesh, spriteMesh, skinMesh, MODEL_OFFSET } from './models.js';
import { generateSkins, SKINS, SKIN_SIZE, skinLayer } from './skins.js';
import { RIGS } from './rigs.js';
import './tex/mobskins.js';
import { RENDER, R, TEXL, FFLAGS, TINT, TINT_RGB, SHAPE, ICON_SHAPE, boxFaceUV, boxLayer, spriteOf } from './blocks.js';
import { ITEMS } from './items.js';
import { SECTIONS } from './config.js';
import { compile } from './gl.js';
import { terrainVS, terrainFS, fullscreenVS, skyFS, cloudVS, cloudFS, lineVS, lineFS } from './shaders.js';
import { Shadows, Post } from './post.js';
import { linePoints } from './fishing.js';

const OPPOSITE = [1, 0, 3, 2, 5, 4];
const QCAP = 1 << 15;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2 is not available in this browser.');
    this.gl = gl;
    this.lost = false;
    // Drawn by the processor rather than a graphics card? (Then the shaders look is too slow.)
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onLost?.(); });
    this.classic = {
      terrain: compile(gl, terrainVS(false), terrainFS(false)),
      sky: compile(gl, fullscreenVS, skyFS(false)),
      clouds: compile(gl, cloudVS, cloudFS(false)),
    };
    this.fancy = null; // (the shaders look, built the first time it's asked for)
    this.fancyFailed = false;
    Object.assign(this, this.classic);
    this.lines = compile(gl, lineVS, lineFS);
    this.mode = 0;
    this.shadowKey = '';
    this.shadowTick = 0;
    this.lightView = new Float32Array(3);
    this.linear = { fog: new Float32Array(3), zenith: new Float32Array(3), horizon: new Float32Array(3) };
    this.proj = mat4(); this.view = mat4(); this.viewProj = mat4(); this.inv = mat4(); this.model = mat4();
    this.tmp = mat4(); this.ident = mat4(); this.planes = new Float32Array(24);
    this.stats = { sections: 0, triangles: 0, draws: 0 };
    // Several index ranges of one section in a single call, where the browser supports it.
    this.multiDraw = gl.getExtension('WEBGL_multi_draw');
    this.mdCounts = new Int32Array(8);
    this.mdOffsets = new Int32Array(8);
    this.occlusion = true;
    this.frameId = 0;
    this.visible = [];
    this.transList = [];
    this.qChunk = new Array(QCAP);
    this.qSy = new Int8Array(QCAP);
    this.qFrom = new Int8Array(QCAP);
    this.qDirs = new Uint8Array(QCAP);
    this.itemMeshes = new Map();

    this.pixels = generateTextures();
    this.layers = TEXTURE_NAMES.length;
    this.textures = [];
    for (let first = 0; first < this.layers; first += ARRAY_LAYERS) {
      const n = Math.min(ARRAY_LAYERS, this.layers - first);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, n, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        this.pixels.subarray(first * 1024, (first + n) * 1024));
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 4);
      this.textures.push(tex);
    }

    // Creature skins.
    this.skinPixels = generateSkins();
    this.skinTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.skinTex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, SKIN_SIZE, SKIN_SIZE, Math.max(1, SKINS.length), 0, gl.RGBA, gl.UNSIGNED_BYTE, this.skinPixels);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 3);

    this.quadIndex = gl.createBuffer();
    this.indexQuads = 0;
    this.ensureIndices(1 << 15);

    this.cloudVao = gl.createVertexArray();
    gl.bindVertexArray(this.cloudVao);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.lineVao);
    this.lineBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 24 * 3 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    this.lineData = new Float32Array(24 * 3);
    // Thin lines in the world (fishing lines), up to 1024 points a frame.
    this.polyVao = gl.createVertexArray();
    gl.bindVertexArray(this.polyVao);
    this.polyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.polyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 1024 * 3 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    this.polyData = new Float32Array(1024 * 3);
    gl.bindVertexArray(null);
    this.skyVao = gl.createVertexArray();

    this.particleMesh = this.createMesh(new Uint8Array(0), true);
    this.rainMesh = this.createMesh(new Uint8Array(0), true);
    this.snowMesh = this.createMesh(new Uint8Array(0), true);
    this.weatherVersion = -1;
    this.cracks = [];
    for (let i = 0; i < 10; i++) {
      const layer = TEX[`destroy_${i}`];
      this.cracks.push(this.createMesh(boxMesh([{ from: [0, 0, 0], to: [1, 1, 1], faces: { layer } }])));
    }
    this.setPlayerSkin('player_0');
  }

  // The first-person arm, cut from the player's skin: the model's right arm and sleeve around the
  // shoulder. (drawHand turns it into the original's model space, where y points down the arm.)
  setPlayerSkin(name) {
    if (this.handSkin === name) return;
    this.handSkin = name;
    const arm = RIGS.humanoid.bones.rightArm;
    if (this.handMesh) this.deleteMesh(this.handMesh);
    this.handMesh = this.createMesh(skinMesh(arm.cubes, skinLayer(name), arm.pivot));
  }

  // The shaders look's programs and targets, made the first time they're asked for (if the
  // device can't manage them, the classic look carries on).
  ensureFancy() {
    if (this.fancy || this.fancyFailed) return !!this.fancy;
    const gl = this.gl;
    try {
      this.fancy = {
        terrain: compile(gl, terrainVS(true), terrainFS(true)),
        sky: compile(gl, fullscreenVS, skyFS(true)),
        clouds: compile(gl, cloudVS, cloudFS(true)),
      };
      this.shadows = new Shadows(gl);
      this.post = new Post(gl);
    } catch (e) {
      console.warn('Shaders unavailable:', e.message);
      this.fancy = null;
      this.fancyFailed = true;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return !!this.fancy;
  }

  ensureIndices(quads) {
    if (quads <= this.indexQuads) return;
    const n = Math.max(quads, this.indexQuads * 2);
    const idx = new Uint32Array(n * 6);
    for (let q = 0, v = 0, i = 0; q < n; q++, v += 4) {
      idx[i++] = v; idx[i++] = v + 1; idx[i++] = v + 2;
      idx[i++] = v; idx[i++] = v + 2; idx[i++] = v + 3;
    }
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.indexQuads = n;
  }

  createMesh(bytes, dynamic = false) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, bytes, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.UNSIGNED_BYTE, false, STRIDE, 6);
    gl.enableVertexAttribArray(2); gl.vertexAttribIPointer(2, 4, gl.UNSIGNED_BYTE, STRIDE, 8);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, STRIDE, 12);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, STRIDE, 16);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndex);
    gl.bindVertexArray(null);
    const count = bytes.length / STRIDE;
    this.ensureIndices(count / 4);
    return { vao, vbo, count, cap: bytes.length };
  }

  updateMesh(mesh, bytes) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    if (bytes.length > mesh.cap) {
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW);
      mesh.cap = bytes.length;
    } else if (bytes.length) {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, bytes);
    }
    mesh.count = bytes.length / STRIDE;
    this.ensureIndices(mesh.count / 4);
  }

  deleteMesh(mesh) {
    if (!mesh) return;
    this.gl.deleteBuffer(mesh.vbo);
    this.gl.deleteVertexArray(mesh.vao);
  }

  uploadSection(sec, chunk, sy, solid, trans, groups = null) {
    sec.origin = [chunk.cx * 16, sy * 16, chunk.cz * 16];
    // The most sky light anywhere in the section: sections deep underground can't shadow anything
    // the sun reaches, so the shadow map leaves them out.
    const L = chunk.light;
    let sky = L ? 0 : 15;
    if (L) for (let i = sy << 12, end = i + 4096; i < end; i++) { const v = L[i] >> 4; if (v > sky) { sky = v; if (v === 15) break; } }
    sec.skyMax = sky;
    for (const [key, bytes] of [['solid', solid], ['trans', trans]]) {
      if (!bytes.length) {
        if (sec[key]) { this.deleteMesh(sec[key]); sec[key] = null; }
      } else if (sec[key]) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sec[key].vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, bytes, this.gl.STATIC_DRAW);
        sec[key].count = bytes.length / STRIDE;
        sec[key].cap = bytes.length;
        this.ensureIndices(sec[key].count / 4);
      } else {
        sec[key] = this.createMesh(bytes);
      }
    }
    if (sec.solid) sec.solid.groups = groups;
  }

  freeSection(sec) {
    this.deleteMesh(sec.solid);
    this.deleteMesh(sec.trans);
    sec.solid = sec.trans = null;
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  // Per-item meshes for the held item and dropped items (cached).
  itemMesh(id) {
    if (this.itemMeshes.has(id)) return this.itemMeshes.get(id);
    let mesh = null;
    const def = ITEMS.get(id);
    const flat = def?.block !== null && def?.block !== undefined ? spriteOf(def.block) : -1;
    const blockTint = (b) => (TINT[b] === 3 ? [...TINT_RGB.subarray(b * 3, b * 3 + 3)] : TINT[b] === 4 ? [88, 164, 255]
      : TINT[b] === 1 ? [124, 189, 84] : [110, 170, 70]);
    if (def && def.block !== null && RENDER[def.block] === R.MODEL && flat < 0) {
      const id = def.block, tint = TINT[id] ? blockTint(id) : null;
      const parts = (ICON_SHAPE[id] ?? SHAPE[id]).map((b) => ({
        from: [b[0] / 16, b[1] / 16, b[2] / 16], to: [b[3] / 16, b[4] / 16, b[5] / 16], tint: b.length > 6 ? null : tint,
        flags: tint && b.length <= 6 ? 1 : 0,
        faces: [0, 1, 2, 3, 4, 5].map((f) => ({ layer: boxLayer(id, b, f), uv: boxFaceUV(b, f) })),
      }));
      mesh = { ...this.createMesh(boxMesh(parts)), kind: 'block' };
    } else if (flat >= 0) {
      const tint = FFLAGS[def.block * 6] & 1 && TINT[def.block] ? blockTint(def.block) : null;
      mesh = { ...this.createMesh(spriteMesh(flat, this.pixels.subarray(flat * 1024, flat * 1024 + 1024), tint ? 1 : 0, tint)), kind: 'sprite' };
    } else if (def) {
      if (def.block !== null && (RENDER[def.block] === R.CUBE || RENDER[def.block] === R.CACTUS || RENDER[def.block] === R.LIQUID)) {
        const m = meshBlockItem(def.block);
        const bytes = new Uint8Array(m.solid.length + m.trans.length);
        bytes.set(m.solid); bytes.set(m.trans, m.solid.length);
        // Re-base the block mesh (section coords 0..1) into model space with MODEL_OFFSET.
        const u16 = new Uint16Array(bytes.buffer);
        for (let v = 0; v < bytes.length / STRIDE; v++) for (let k = 0; k < 3; k++) u16[v * 10 + k] += (MODEL_OFFSET - SECTION_OFFSET) * 256;
        mesh = { ...this.createMesh(bytes), kind: 'block' };
      } else {
        const layer = def.block !== null ? TEXL[def.block * 6] : def.tex;
        const flags = def.block !== null ? FFLAGS[def.block * 6] & 1 : def.tint ? 1 : 0;
        const tint = def.block !== null ? (TINT[def.block] ? blockTint(def.block) : null) : def.tint;
        const px = this.pixels.subarray(layer * 1024, layer * 1024 + 1024);
        mesh = { ...this.createMesh(spriteMesh(layer, px, flags, tint)), kind: 'sprite' };
      }
    }
    this.itemMeshes.set(id, mesh);
    return mesh;
  }

  setCommon(f) {
    const gl = this.gl, u = this.terrain.u;
    gl.useProgram(this.terrain.prog);
    gl.uniformMatrix4fv(u.u_proj, false, this.proj);
    gl.uniformMatrix4fv(u.u_view, false, this.view);
    gl.uniform3f(u.u_camPos, f.cam.x, f.cam.y, f.cam.z);
    gl.uniform1f(u.u_time, f.time);
    gl.uniform1f(u.u_wave, f.wave ? 1 : 0);
    for (let i = 0; i < 4; i++) gl.uniform1i(u[`u_tex${i}`], i);
    gl.uniform1i(u.u_skin, 4);
    gl.uniform1f(u.u_daylight, f.env.daylight);
    gl.uniform3fv(u.u_skyLight, f.env.skyLight);
    gl.uniform3fv(u.u_fogColor, f.fogColor);
    gl.uniform2f(u.u_fog, f.fogStart, f.fogEnd);
    gl.uniform1f(u.u_gamma, 1 - 0.45 * f.brightness);
    gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
    gl.uniform4f(u.u_colorMul, 1, 1, 1, 1);
    gl.uniform1f(u.u_alphaMul, 1);
    gl.uniform3f(u.u_offset, 0, 0, 0);
    gl.uniform1f(u.u_hurt, 0);
    if (this.mode) {
      const e = f.env;
      gl.uniform3fv(u.u_fogColor, this.linear.fog);
      gl.uniform3fv(u.u_lightDir, e.lightDir);
      gl.uniform3fv(u.u_lightColor, e.lightColor);
      gl.uniform3fv(u.u_ambient, e.ambient);
      gl.uniform3fv(u.u_zenithL, this.linear.zenith);
      gl.uniform3fv(u.u_horizonL, this.linear.horizon);
      gl.uniform3fv(u.u_sunGlow, e.sunGlow);
      gl.uniform1f(u.u_shadowOn, this.shadowsOn ? 1 : 0);
      gl.uniformMatrix4fv(u.u_shadowMat, false, this.shadows.mat);
      gl.uniform2f(u.u_shadowInfo, this.shadows.radius, Math.max(1, this.shadows.size));
      gl.uniform1i(u.u_shadowMap, 5);
      gl.uniform1f(u.u_outScale, this.post.scale);
      gl.uniform1f(u.u_underwater, f.underwater ? 1 : 0);
    }
  }

  drawModel(mesh, model) {
    if (!mesh || !mesh.count) return;
    const gl = this.gl;
    gl.uniformMatrix4fv(this.terrain.u.u_model, false, model);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, (mesh.count / 4) * 6, gl.UNSIGNED_INT, 0);
  }

  // A terrain section at (ox, oy, oz) relative to the camera. Groups of faces that point away from
  // the camera are skipped: +X faces can only be seen from the +X side of them, and so on.
  drawSection(mesh, ox, oy, oz, cull) {
    const gl = this.gl;
    gl.uniform3f(this.terrain.u.u_offset, ox - SECTION_OFFSET, oy - SECTION_OFFSET, oz - SECTION_OFFSET);
    gl.bindVertexArray(mesh.vao);
    const g = mesh.groups;
    if (!cull || !g || !this.multiDraw) {
      gl.drawElements(gl.TRIANGLES, (mesh.count / 4) * 6, gl.UNSIGNED_INT, 0);
      this.stats.draws++;
      return mesh.count / 2;
    }
    const show = 1 | (ox < 0 ? 2 : 0) | (ox + 16 > 0 ? 4 : 0) | (oy < 0 ? 8 : 0) | (oy + 16 > 0 ? 16 : 0) | (oz < 0 ? 32 : 0) | (oz + 16 > 0 ? 64 : 0);
    let n = 0, tris = 0;
    for (let k = 0; k < 7; k++) {
      if (!(show & (1 << k)) || g[k + 1] === g[k]) continue;
      // Merge with the previous range when they touch.
      if (n && this.mdOffsets[n - 1] + this.mdCounts[n - 1] * 4 === g[k] * 24) this.mdCounts[n - 1] += (g[k + 1] - g[k]) * 6;
      else { this.mdOffsets[n] = g[k] * 24; this.mdCounts[n] = (g[k + 1] - g[k]) * 6; n++; }
      tris += (g[k + 1] - g[k]) * 2;
    }
    if (n) {
      this.multiDraw.multiDrawElementsWEBGL(gl.TRIANGLES, this.mdCounts, 0, gl.UNSIGNED_INT, this.mdOffsets, 0, n);
      this.stats.draws++;
    }
    return tris;
  }

  // Sections to draw this frame, near to far. From the camera's section, spread out through
  // neighbouring sections, but only through faces that open space inside the section connects
  // (so caves sealed off by rock are skipped), never turning back towards the camera, and only
  // into sections inside the view frustum (cave culling as in the original game).
  collectVisible(f) {
    const world = f.world, cam = f.cam, out = this.visible;
    out.length = 0;
    if (!world) return out;
    const frame = ++this.frameId;
    const ccx = Math.floor(cam.x) >> 4, ccz = Math.floor(cam.z) >> 4, csy = Math.floor(cam.y) >> 4;
    const maxD = (f.renderDist + 1) * 16, maxD2 = maxD * maxD;
    const start = world.chunks.get(((ccx & 0xffff) | ((ccz & 0xffff) << 16)) >>> 0);
    if (!this.occlusion || !start || start.state !== 2 || csy < 0 || csy >= SECTIONS) {
      // Plain frustum culling (outside the world, or while the area is still loading).
      for (const chunk of world.chunks.values()) {
        const ox = chunk.cx * 16 - cam.x, oz = chunk.cz * 16 - cam.z;
        const dx = Math.max(0, Math.abs(ox + 8) - 8), dz = Math.max(0, Math.abs(oz + 8) - 8);
        if (dx * dx + dz * dz > maxD2) continue;
        for (let sy = 0; sy < SECTIONS; sy++) {
          const sec = chunk.sections[sy];
          if (!sec.solid && !sec.trans) continue;
          const oy = sy * 16 - cam.y;
          if (!boxInFrustum(this.planes, ox, oy, oz, ox + 16, oy + 16, oz + 16)) continue;
          sec._ox = ox; sec._oy = oy; sec._oz = oz;
          sec._d = (ox + 8) * (ox + 8) + (oy + 8) * (oy + 8) + (oz + 8) * (oz + 8);
          out.push(sec);
        }
      }
      out.sort((a, b) => a._d - b._d);
      return out;
    }
    const qc = this.qChunk, qs = this.qSy, qf = this.qFrom, qd = this.qDirs;
    let head = 0, tail = 0;
    qc[0] = start; qs[0] = csy; qf[0] = -1; qd[0] = 0; tail = 1;
    start.sections[csy]._frame = frame;
    while (head < tail) {
      const chunk = qc[head], sy = qs[head], from = qf[head], dirs = qd[head];
      qc[head] = null;
      head++;
      const sec = chunk.sections[sy];
      const ox = chunk.cx * 16 - cam.x, oy = sy * 16 - cam.y, oz = chunk.cz * 16 - cam.z;
      if (sec.solid || sec.trans) {
        sec._ox = ox; sec._oy = oy; sec._oz = oz;
        sec._d = (ox + 8) * (ox + 8) + (oy + 8) * (oy + 8) + (oz + 8) * (oz + 8);
        out.push(sec);
      }
      const vis = sec.solid || sec.trans || sec.count ? sec.vis : ALL_OPEN;
      for (let d = 0; d < 6; d++) {
        if (dirs & (1 << OPPOSITE[d])) continue;
        if (from >= 0 && !(vis & (1 << FACE_PAIR[from][d]))) continue;
        let nc = chunk, ns = sy;
        if (d === 0) nc = chunk.nb[0]; else if (d === 1) nc = chunk.nb[1];
        else if (d === 2) ns = sy + 1; else if (d === 3) ns = sy - 1;
        else if (d === 4) nc = chunk.nb[2]; else nc = chunk.nb[3];
        if (!nc || nc.state !== 2 || ns < 0 || ns >= SECTIONS) continue;
        const nsec = nc.sections[ns];
        if (nsec._frame === frame) continue;
        const nx = nc.cx * 16 - cam.x, ny = ns * 16 - cam.y, nz = nc.cz * 16 - cam.z;
        const hx = Math.max(0, Math.abs(nx + 8) - 8), hz = Math.max(0, Math.abs(nz + 8) - 8);
        if (hx * hx + hz * hz > maxD2) continue;
        if (!boxInFrustum(this.planes, nx, ny, nz, nx + 16, ny + 16, nz + 16)) continue;
        nsec._frame = frame;
        if (tail >= QCAP) continue;
        qc[tail] = nc; qs[tail] = ns; qf[tail] = OPPOSITE[d]; qd[tail] = dirs | (1 << d);
        tail++;
      }
    }
    return out;
  }

  // f: frame description assembled by the game each frame.
  render(f) {
    if (this.lost) return;
    const gl = this.gl, cam = f.cam;
    const w = this.canvas.width, h = this.canvas.height;
    // Shaders: 0 off, 1 lighting and effects, 2 with shadows.
    this.mode = f.shaders && this.ensureFancy() ? f.shaders : 0;
    const fancy = this.mode > 0;
    Object.assign(this, fancy ? this.fancy : this.classic);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    const far = Math.max(160, f.renderDist * 16 + 48);
    perspective(this.proj, (f.fov * Math.PI) / 180, w / h, 0.08, far);
    viewRotation(this.view, cam.yaw, cam.pitch);
    if (cam.pre) multiply(this.view, cam.pre, this.view);
    multiply(this.viewProj, this.proj, this.view);
    frustumPlanes(this.planes, this.viewProj);
    invert(this.inv, this.viewProj);

    if (fancy) {
      const lin = (out, c) => { for (let i = 0; i < 3; i++) out[i] = Math.pow(c[i], 2.2); };
      lin(this.linear.fog, f.fogColor);
      lin(this.linear.zenith, f.env.zenith);
      lin(this.linear.horizon, f.env.horizon);
      const lc = f.env.lightColor;
      this.shadowsOn = this.mode >= 2 && lc[0] + lc[1] + lc[2] > 0.01 && !!f.world;
      if (this.shadowsOn) {
        for (let i = 0; i < 5; i++) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, i < 4 ? this.textures[Math.min(i, this.textures.length - 1)] : this.skinTex);
        }
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        this.shadows.ensure(2048);
        this.shadows.update(cam, f.env.lightDir);
        // Redrawn when the view from the sun moves, else every other frame (for things that move).
        if (this.shadows.key !== this.shadowKey || (++this.shadowTick & 1)) {
          this.shadowKey = this.shadows.key;
          this.stats.shadowDraws = this.shadows.render(this, f);
        }
      }
      this.post.ensure(w, h);
      this.post.begin();
    }

    gl.clearColor(f.fogColor[0], f.fogColor[1], f.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textures[Math.min(i, this.textures.length - 1)]);
    }
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.skinTex);
    if (fancy) {
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowsOn ? this.shadows.tex : this.shadows.blank);
    }
    gl.activeTexture(gl.TEXTURE0);

    // Sky
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(this.sky.prog);
    const su = this.sky.u;
    gl.uniformMatrix4fv(su.u_invViewProj, false, this.inv);
    gl.uniform3fv(su.u_sunDir, f.env.sunDir);
    gl.uniform3fv(su.u_zenith, f.env.zenith);
    gl.uniform3fv(su.u_horizon, f.underwater ? f.fogColor : f.env.horizon);
    gl.uniform1f(su.u_stars, f.env.stars);
    gl.uniform1f(su.u_sunset, f.env.sunset);
    gl.uniform1f(su.u_starAngle, f.env.sunAngle);
    gl.uniform1f(su.u_underwater, f.underwater ? 1 : 0);
    gl.uniform1f(su.u_rain, f.weather?.rain ?? 0);
    if (fancy) {
      gl.uniform1f(su.u_time, f.time);
      gl.uniform3fv(su.u_sunGlow, f.env.sunGlow);
      gl.uniform1f(su.u_outScale, this.post.scale);
    }
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Terrain (opaque + cutout), front to back.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    this.setCommon(f);
    const u = this.terrain.u;
    gl.uniform1f(u.u_alphaCut, 0.5);
    this.stats.draws = 0;
    const visible = this.collectVisible(f);
    gl.uniformMatrix4fv(u.u_model, false, this.ident);
    let tris = 0;
    for (const sec of visible) {
      if (sec.solid) tris += this.drawSection(sec.solid, sec._ox, sec._oy, sec._oz, true);
    }
    gl.uniform3f(u.u_offset, 0, 0, 0);

    // Entities and dropped items.
    if (f.entities) for (const e of f.entities) {
      gl.uniform4f(u.u_lightOverride, 1, e.light[0] / 15, e.light[1] / 15, 0);
      gl.uniform4f(u.u_colorMul, e.tint ? e.tint[0] : 1, e.tint ? e.tint[1] : 1, e.tint ? e.tint[2] : 1, 1);
      gl.uniform1f(u.u_hurt, e.hurt ? 0.45 : 0);
      for (const part of e.parts) this.drawModel(part.mesh, part.model);
    }
    gl.uniform1f(u.u_hurt, 0);
    gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
    gl.uniform4f(u.u_colorMul, 1, 1, 1, 1);
    // Fishing lines (this player's starts at the tip of the rod in hand).
    if (f.rod) {
      const tip = this.rodTip(f) ?? f.rod.from;
      (f.lines ??= []).push(linePoints(tip, f.rod.to, f.rod.slack, this.rodLine ??= []));
    }
    if (f.lines?.length) this.drawLines(f.lines, cam);

    // Particles
    if (f.particles && f.particles.count) {
      this.updateMesh(this.particleMesh, f.particles.bytes());
      gl.disable(gl.CULL_FACE);
      identity(this.model);
      translate(this.model, this.model, f.particles.base[0] - cam.x, f.particles.base[1] - cam.y, f.particles.base[2] - cam.z);
      this.drawModel(this.particleMesh, this.model);
      gl.enable(gl.CULL_FACE);
    }

    // Cracks on the block being mined.
    if (f.crack) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -2);
      gl.uniform1f(u.u_alphaCut, 0.05);
      gl.uniform4f(u.u_lightOverride, 1, 1, 1, 0);
      const c = f.crack;
      identity(this.model);
      translate(this.model, this.model, c.x - cam.x - 0.001, c.y - cam.y - 0.001, c.z - cam.z - 0.001);
      scale(this.model, this.model, 1.002, 1.002, 1.002);
      translate(this.model, this.model, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
      this.drawModel(this.cracks[Math.min(9, c.stage)], this.model);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Selection outline
    if (f.selection) this.drawSelection(f.selection, cam);

    const cloudsAbove = f.clouds && cam.y < f.cloudHeight;
    if (cloudsAbove) this.drawClouds(f);

    // Translucent terrain, back to front.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(this.terrain.prog);
    gl.uniform1f(u.u_alphaCut, 0.01);
    const trans = this.transList;
    trans.length = 0;
    for (const sec of visible) if (sec.trans) trans.push(sec);
    trans.sort((a, b) => b._d - a._d);
    gl.uniformMatrix4fv(u.u_model, false, this.ident);
    for (const sec of trans) tris += this.drawSection(sec.trans, sec._ox, sec._oy, sec._oz, false);
    gl.uniform3f(u.u_offset, 0, 0, 0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    if (f.clouds && !cloudsAbove) this.drawClouds(f);
    if (f.weather && f.weather.rain > 0) this.drawWeather(f);

    this.stats.sections = visible.length;
    this.stats.triangles = tris;

    if (fancy) {
      const sun = this.sunOnScreen(f);
      this.post.bright(sun);
      if (f.hand) this.drawHand(f);
      this.post.finish(sun, sun.rays, f.underwater, f.time);
    } else if (f.hand) this.drawHand(f);
  }

  // Where the sun (or the moon) is on screen, for the light shafts, and how strong they are.
  sunOnScreen(f) {
    const e = f.env, day = e.sunDir[1] > -0.05, m = this.viewProj;
    const d = day ? e.sunDir : [-e.sunDir[0], -e.sunDir[1], -e.sunDir[2]];
    const cx = m[0] * d[0] + m[4] * d[1] + m[8] * d[2], cy = m[1] * d[0] + m[5] * d[1] + m[9] * d[2], cw = m[3] * d[0] + m[7] * d[1] + m[11] * d[2];
    const out = this.sunInfo ?? (this.sunInfo = { x: 0.5, y: 2, rays: new Float32Array(3) });
    out.rays.fill(0);
    if (cw <= 0.01 || f.underwater) { out.x = 0.5; out.y = 2; return out; }
    out.x = cx / cw * 0.5 + 0.5;
    out.y = cy / cw * 0.5 + 0.5;
    const off = Math.max(0, Math.max(Math.abs(out.x - 0.5), Math.abs(out.y - 0.5)) - 0.5);
    const k = Math.max(0, 1 - off * 2.5) * (1 - (f.weather?.rain ?? 0)) * (day ? 0.55 : 0.12) * Math.min(1, Math.abs(e.sunDir[1]) * 6 + 0.25);
    for (let i = 0; i < 3; i++) out.rays[i] = e.sunGlow[i] * k;
    return out;
  }

  drawSelection(s, cam) {
    const gl = this.gl;
    const e = 0.002;
    const x0 = s.x + s.box[0] - e - cam.x, y0 = s.y + s.box[1] - e - cam.y, z0 = s.z + s.box[2] - e - cam.z;
    const x1 = s.x + s.box[3] + e - cam.x, y1 = s.y + s.box[4] + e - cam.y, z1 = s.z + s.box[5] + e - cam.z;
    const d = this.lineData;
    let i = 0;
    const seg = (a, b, c, a2, b2, c2) => { d[i++] = a; d[i++] = b; d[i++] = c; d[i++] = a2; d[i++] = b2; d[i++] = c2; };
    for (const y of [y0, y1]) { seg(x0, y, z0, x1, y, z0); seg(x1, y, z0, x1, y, z1); seg(x1, y, z1, x0, y, z1); seg(x0, y, z1, x0, y, z0); }
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) seg(x, y0, z, x, y1, z);
    gl.useProgram(this.lines.prog);
    gl.uniformMatrix4fv(this.lines.u.u_viewProj, false, this.viewProj);
    gl.uniform4f(this.lines.u.u_color, 0, 0, 0, 0.55);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.disable(gl.BLEND);
    gl.useProgram(this.terrain.prog);
  }

  // Lines through the world: each a list of points [x, y, z, ...] joined up in order.
  drawLines(lines, cam) {
    const gl = this.gl, d = this.polyData;
    let n = 0;
    for (const pts of lines) {
      for (let i = 0; i + 5 < pts.length && n + 6 <= d.length; i += 3) {
        d[n++] = pts[i] - cam.x; d[n++] = pts[i + 1] - cam.y; d[n++] = pts[i + 2] - cam.z;
        d[n++] = pts[i + 3] - cam.x; d[n++] = pts[i + 4] - cam.y; d[n++] = pts[i + 5] - cam.z;
      }
    }
    if (!n) return;
    gl.useProgram(this.lines.prog);
    gl.uniformMatrix4fv(this.lines.u.u_viewProj, false, this.viewProj);
    gl.uniform4f(this.lines.u.u_color, 0.06, 0.06, 0.06, 0.85);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.polyVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.polyBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n);
    gl.drawArrays(gl.LINES, 0, n / 3);
    gl.disable(gl.BLEND);
    gl.useProgram(this.terrain.prog);
  }

  drawClouds(f) {
    const gl = this.gl, u = this.clouds.u;
    gl.useProgram(this.clouds.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    const size = Math.max(320, f.renderDist * 16 * 2.2);
    gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
    gl.uniform3f(u.u_camPos, f.cam.x, f.cam.y, f.cam.z);
    gl.uniform1f(u.u_height, f.cloudHeight);
    gl.uniform1f(u.u_size, size);
    gl.uniform1f(u.u_time, f.time);
    gl.uniform3fv(u.u_color, f.env.cloudColor);
    gl.uniform3fv(u.u_fogColor, this.mode ? this.linear.fog : f.fogColor);
    if (this.mode) gl.uniform1f(u.u_outScale, this.post.scale);
    gl.bindVertexArray(this.cloudVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(this.terrain.prog);
  }

  // Rain and snow sheets around the player.
  drawWeather(f) {
    const gl = this.gl, u = this.terrain.u, w = f.weather, cam = f.cam;
    if (w.version !== this.weatherVersion) {
      this.weatherVersion = w.version;
      this.updateMesh(this.rainMesh, w.rainSheet.bytes());
      this.updateMesh(this.snowMesh, w.snowSheet.bytes());
    }
    gl.useProgram(this.terrain.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(u.u_alphaCut, 0.01);
    gl.uniform1f(u.u_alphaMul, Math.min(1, w.rain * 1.2));
    identity(this.model);
    translate(this.model, this.model, w.base[0] - cam.x, w.base[1] - cam.y, w.base[2] - cam.z);
    const t = f.time;
    gl.uniform3f(u.u_precip, (t * 7) % 1, 0, 0);
    gl.uniform2f(u.u_precipScale, 4, 1);
    this.drawModel(this.rainMesh, this.model);
    gl.uniform3f(u.u_precip, (t * 1.2) % 1, 0.05, (t * 0.9) % (Math.PI * 2));
    gl.uniform2f(u.u_precipScale, 2, 2);
    this.drawModel(this.snowMesh, this.model);
    gl.uniform1f(u.u_alphaMul, 1);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // The first-person hand or held item, drawn over the world with its own projection. The
  // transforms follow the original game's first-person rendering: walking bob, a slight lag behind
  // turning, the arm position, the attack swing (a quick jab that twists the item forward), the dip
  // when switching items, and each item's own "held in first person" placement.
  drawHand(f) {
    const gl = this.gl, u = this.terrain.u, hand = f.hand;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.terrain.prog);
    gl.uniformMatrix4fv(u.u_proj, false, this.handProjection(this.tmp));
    gl.uniformMatrix4fv(u.u_view, false, this.ident);
    gl.uniform2f(u.u_fog, 1e5, 2e5);
    gl.uniform1f(u.u_alphaCut, 0.5);
    gl.uniform1f(u.u_wave, 0);
    gl.uniform4f(u.u_lightOverride, 1, hand.light[0] / 15, hand.light[1] / 15, 0);
    if (this.mode) {
      // (The hand is drawn in the camera's space, so the light's direction is turned into it.)
      const v = this.view, L = f.env.lightDir, lv = this.lightView;
      for (let i = 0; i < 3; i++) lv[i] = v[i] * L[0] + v[4 + i] * L[1] + v[8 + i] * L[2];
      gl.uniform3fv(u.u_lightDir, lv);
      gl.uniform1f(u.u_shadowOn, 0);
    }
    const m = identity(this.model);
    const mesh = this.handModel(hand, m);
    if (!mesh || mesh.kind !== 'block') gl.disable(gl.CULL_FACE);
    this.drawModel(mesh ?? this.handMesh, m);
    gl.enable(gl.CULL_FACE);
    gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
  }

  // The projection the hand is drawn with. It's laid out for a 16:9 screen: on narrower screens it
  // shrinks evenly (keeping to the bottom edge) so it lands where it would on 16:9, without being
  // cut off or stretched.
  handProjection(proj) {
    const aspect = this.canvas.width / this.canvas.height;
    perspective(proj, 70 * Math.PI / 180, aspect, 0.01, 10);
    const fit = Math.min(1, aspect / (16 / 9));
    if (fit < 1) {
      const k = this.handFit ?? (this.handFit = mat4());
      identity(k);
      // On portrait screens, lift it above the hotbar.
      k[0] = fit; k[5] = fit; k[13] = fit - 1 + (aspect < 1 ? 0.16 : 0);
      multiply(proj, k, proj);
    }
    return proj;
  }

  // Sets `m` to the model matrix of the hand, or of the item in it, this frame (in the camera's
  // space). Returns the item's mesh, or null for the bare arm.
  handModel(hand, m) {
    const deg = Math.PI / 180;
    if (hand.roll) rotateZ(m, m, hand.roll);
    if (hand.bob) {
      const w = hand.walk * Math.PI, b = hand.bob;
      translate(m, m, Math.sin(w) * b * 0.5, -Math.abs(Math.cos(w) * b), 0);
      rotateZ(m, m, Math.sin(w) * b * 3 * deg);
      rotateX(m, m, Math.abs(Math.cos(w - 0.2) * b) * 5 * deg);
    }
    rotateX(m, m, hand.lag[0]);
    rotateY(m, m, hand.lag[1]);
    const s = hand.swing, sq = Math.sqrt(s), eq = hand.equip;
    const mesh = hand.item ? this.itemMesh(hand.item) : null;
    if (!mesh) {
      // Bare arm.
      translate(m, m, -0.3 * Math.sin(sq * Math.PI) + 0.64, 0.4 * Math.sin(sq * Math.PI * 2) - 0.6 - eq * 0.6, -0.4 * Math.sin(s * Math.PI) - 0.72);
      rotateY(m, m, 45 * deg);
      rotateY(m, m, Math.sin(sq * Math.PI) * 70 * deg);
      rotateZ(m, m, Math.sin(s * s * Math.PI) * -20 * deg);
      translate(m, m, -1, 3.6, 3.5);
      rotateZ(m, m, 120 * deg);
      rotateX(m, m, 200 * deg);
      rotateY(m, m, -135 * deg);
      translate(m, m, 5.6, 0, 0);
      translate(m, m, -5 / 16, 2 / 16, 0);
      rotateZ(m, m, Math.PI);
      translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
      return null;
    }
    if (hand.eat !== undefined) {
      // Bringing food to the mouth and chewing.
      const left = hand.eat, frac = left / 32;
      if (frac < 0.8) translate(m, m, 0, Math.abs(Math.cos((left / 4) * Math.PI) * 0.1), 0);
      const k = 1 - frac ** 27;
      translate(m, m, k * 0.6, k * -0.5, 0);
      rotateY(m, m, k * 90 * deg);
      rotateX(m, m, k * 10 * deg);
      rotateZ(m, m, k * 30 * deg);
      translate(m, m, 0.56, -0.52 - eq * 0.6, -0.72);
    } else {
      translate(m, m, -0.4 * Math.sin(sq * Math.PI), 0.2 * Math.sin(sq * Math.PI * 2), -0.2 * Math.sin(s * Math.PI));
      translate(m, m, 0.56, -0.52 - eq * 0.6, -0.72);
      rotateY(m, m, (45 - Math.sin(s * s * Math.PI) * 20) * deg);
      rotateZ(m, m, Math.sin(sq * Math.PI) * -20 * deg);
      rotateX(m, m, Math.sin(sq * Math.PI) * -80 * deg);
      rotateY(m, m, -45 * deg);
    }
    if (mesh.kind === 'block') {
      // (Raised a little from the original so the hotbar doesn't hide it.)
      translate(m, m, 0, 0.08, 0);
      rotateY(m, m, 45 * deg);
      scale(m, m, 0.4, 0.4, 0.4);
    } else {
      translate(m, m, 1.13 / 16, 3.2 / 16, 1.13 / 16);
      rotateY(m, m, -90 * deg);
      rotateZ(m, m, 25 * deg);
      scale(m, m, 0.68, 0.68, 0.68);
    }
    translate(m, m, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
    return mesh;
  }

  // Where the tip of the fishing rod in hand appears, as a point in the world a little in front of
  // the camera (so a fishing line drawn from it meets the rod on screen). Null without a hand.
  rodTip(f) {
    if (!f.hand) return null;
    const m = identity(this.tipModel ??= mat4());
    if (!this.handModel(f.hand, m)) return null;
    const P = this.handProjection(this.tipProj ??= mat4()), O = MODEL_OFFSET;
    // The tip of the rod: the top right corner of its picture.
    const vx = 15.5 / 16 + O, vy = 1 - 0.5 / 16 + O, vz = 0.5 + O;
    const x = m[0] * vx + m[4] * vy + m[8] * vz + m[12], y = m[1] * vx + m[5] * vy + m[9] * vz + m[13], z = m[2] * vx + m[6] * vy + m[10] * vz + m[14];
    const cw = P[3] * x + P[7] * y + P[11] * z + P[15];
    const nx = (P[0] * x + P[4] * y + P[8] * z + P[12]) / cw, ny = (P[1] * x + P[5] * y + P[9] * z + P[13]) / cw;
    // Back out through the world's camera, 0.9 blocks along that line of sight.
    const I = this.inv, ww = I[3] * nx + I[7] * ny + I[11] + I[15];
    const dx = (I[0] * nx + I[4] * ny + I[8] + I[12]) / ww, dy = (I[1] * nx + I[5] * ny + I[9] + I[13]) / ww, dz = (I[2] * nx + I[6] * ny + I[10] + I[14]) / ww;
    const len = Math.hypot(dx, dy, dz) || 1;
    return [f.cam.x + (dx / len) * 0.9, f.cam.y + (dy / len) * 0.9, f.cam.z + (dz / len) * 0.9];
  }
}
