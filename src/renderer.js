// WebGL2 renderer: terrain sections, sky, clouds, selection box, cracks, particles, entities, held item.
import {
  perspective, viewRotation, multiply, invert, translate, scale, rotateX, rotateY, rotateZ,
  frustumPlanes, boxInFrustum, mat4, identity,
} from './math.js';
import { generateTextures, TEXTURE_NAMES, TEX } from './textures.js';
import { STRIDE, meshBlockItem, SECTION_OFFSET } from './mesher.js';
import { boxMesh, spriteMesh, MODEL_OFFSET } from './models.js';
import { RENDER, R, TEXL, BLOCKS, FFLAGS, TINT, TINT_RGB } from './blocks.js';
import { ITEMS } from './items.js';
import { SECTIONS } from './config.js';

const TERRAIN_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in uvec4 a_info;
layout(location=3) in vec4 a_light;
layout(location=4) in vec4 a_tint;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform mat4 u_model;
uniform vec3 u_camPos;
uniform float u_time;
uniform float u_wave;
out vec3 v_uv;
out vec4 v_light;
out vec3 v_tint;
out float v_shade;
out vec3 v_rel;
flat out uint v_flags;
const float SHADE[7] = float[7](0.6, 0.6, 1.0, 0.5, 0.8, 0.8, 0.9);
void main() {
  vec4 rel = u_model * vec4(a_pos / 256.0, 1.0);
  uint flags = a_info.z;
  if ((flags & 8u) != 0u && u_wave > 0.0) {
    vec3 wp = rel.xyz + u_camPos;
    float amp = a_info.y == 6u ? (a_uv.y < 0.5 ? 0.06 : 0.0) : 0.018;
    float ph = u_time * 1.7 + wp.x * 0.55 + wp.z * 0.35 + wp.y * 0.2;
    rel.x += sin(ph) * amp;
    rel.z += cos(ph * 0.8 + 1.3) * amp;
  }
  gl_Position = u_proj * u_view * rel;
  v_uv = vec3(a_uv / 16.0, float(a_info.x));
  v_light = a_light;
  v_tint = a_tint.rgb;
  v_shade = SHADE[min(a_info.y, 6u)];
  v_rel = rel.xyz;
  v_flags = flags;
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform float u_time;
uniform float u_daylight;
uniform vec3 u_skyLight;
uniform vec3 u_fogColor;
uniform vec2 u_fog;
uniform float u_alphaCut;
uniform float u_alphaMul;
uniform float u_gamma;
uniform vec4 u_lightOverride;
uniform vec4 u_colorMul;
in vec3 v_uv;
in vec4 v_light;
in vec3 v_tint;
in float v_shade;
in vec3 v_rel;
flat in uint v_flags;
out vec4 o_color;
float curve(float l) { return l / (3.0 - 2.0 * l); }
void main() {
  vec2 uv = v_uv.xy;
  if ((v_flags & 16u) != 0u) {
    uv += vec2(sin(u_time * 0.8 + uv.y * 6.2832) * 0.035, -u_time * 0.06);
  } else if ((v_flags & 64u) != 0u) {
    uv += vec2(sin(u_time * 0.35 + uv.y * 3.1416) * 0.06, u_time * 0.025);
  }
  vec4 tex = texture(u_tex, vec3(uv, v_uv.z));
  vec3 col = tex.rgb;
  if ((v_flags & 2u) != 0u) {
    vec4 ov = texture(u_tex, vec3(uv, v_uv.z + 1.0));
    col = mix(col, ov.rgb * v_tint, ov.a);
  } else if ((v_flags & 1u) != 0u) {
    col *= v_tint;
  }
  if (tex.a < u_alphaCut) discard;
  vec2 lv = u_lightOverride.x > 0.5 ? u_lightOverride.yz : v_light.xy;
  vec3 light;
  if ((v_flags & 32u) != 0u) {
    light = vec3(1.0);
  } else {
    float sky = curve(lv.x) * u_daylight;
    float blk = curve(lv.y);
    light = max(u_skyLight * sky, vec3(1.0, 0.86, 0.66) * blk);
    light = pow(max(light, vec3(0.0)), vec3(u_gamma)) * 0.96 + 0.04;
  }
  float ao = 0.5 + 0.5 * v_light.z;
  col *= light * ao * v_shade;
  col *= u_colorMul.rgb;
  float fog = clamp((length(v_rel) - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  col = mix(col, u_fogColor, fog);
  o_color = vec4(col, tex.a * u_alphaMul * u_colorMul.a);
}`;

const SKY_VS = `#version 300 es
out vec2 v_ndc;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  v_ndc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
uniform mat4 u_invViewProj;
uniform vec3 u_sunDir;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform float u_stars;
uniform float u_sunset;
uniform float u_starAngle;
uniform float u_underwater;
in vec2 v_ndc;
out vec4 o_color;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec4 p = u_invViewProj * vec4(v_ndc, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w);
  float h = dir.y;
  vec3 col = mix(u_horizon, u_zenith, pow(clamp(h, 0.0, 1.0), 0.5));
  if (h < 0.0) col = mix(u_horizon, u_horizon * 0.5, clamp(-h * 3.0, 0.0, 1.0));
  float sd = dot(dir, u_sunDir);
  col += vec3(1.0, 0.42, 0.12) * u_sunset * pow(max(sd, 0.0), 5.0) * 0.6 * (1.0 - clamp(abs(h) * 1.4, 0.0, 1.0));
  if (u_stars > 0.01 && h > -0.1) {
    float c = cos(u_starAngle), s = sin(u_starAngle);
    vec3 sp = vec3(c * dir.x + s * dir.y, -s * dir.x + c * dir.y, dir.z);
    float r = hash(floor(sp * 150.0));
    if (r > 0.9968) col += vec3(0.85, 0.9, 1.0) * u_stars * ((r - 0.9968) / 0.0032 * 0.7 + 0.3) * clamp(h * 5.0 + 0.4, 0.0, 1.0);
  }
  vec3 W = vec3(0.0, 0.0, 1.0);
  vec3 U = normalize(W - dot(W, u_sunDir) * u_sunDir);
  vec3 V = cross(u_sunDir, U);
  if (sd > 0.0) {
    vec2 q = vec2(dot(dir, U), dot(dir, V)) / sd;
    float size = 0.09;
    if (max(abs(q.x), abs(q.y)) < size) {
      vec2 g = floor(q / size * 4.0);
      float rim = (g.x < -3.0 || g.x > 2.0 || g.y < -3.0 || g.y > 2.0) ? 0.82 : 1.0;
      col = mix(col, vec3(1.0, 0.95, 0.7) * rim * 1.1, smoothstep(-0.15, 0.02, h));
    }
  } else {
    vec2 q = vec2(dot(dir, U), dot(dir, V)) / -sd;
    float size = 0.065;
    if (max(abs(q.x), abs(q.y)) < size && h > -0.05) {
      vec2 g = floor(q / size * 4.0);
      float crater = hash(vec3(g, 7.0)) > 0.68 ? 0.74 : 1.0;
      col = mix(col, vec3(0.85, 0.88, 0.97) * crater, clamp(u_stars * 1.2, 0.2, 1.0));
    }
  }
  if (u_underwater > 0.5) col = vec3(0.05, 0.16, 0.42);
  o_color = vec4(col, 1.0);
}`;

const CLOUD_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
uniform mat4 u_viewProj;
uniform vec3 u_camPos;
uniform float u_height;
uniform float u_size;
out vec3 v_rel;
out vec2 v_world;
void main() {
  vec3 rel = vec3(a_pos.x * u_size, u_height - u_camPos.y, a_pos.y * u_size);
  v_rel = rel;
  v_world = rel.xz + u_camPos.xz;
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;

const CLOUD_FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_fogColor;
uniform float u_size;
in vec3 v_rel;
in vec2 v_world;
out vec4 o_color;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 w = v_world + vec2(u_time * 1.1, 0.0);
  vec2 cell = floor(w / 12.0);
  float n = vnoise(cell * 0.21) * 0.62 + vnoise(cell * 0.07 + 17.0) * 0.28 + hash(cell) * 0.1;
  if (n < 0.56) discard;
  float d = length(v_rel.xz);
  float fade = 1.0 - smoothstep(u_size * 0.45, u_size * 0.95, d);
  o_color = vec4(mix(u_fogColor, u_color, fade), 0.8 * fade);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
void main() { gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;

const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o_color;
void main() { o_color = u_color; }`;

function compile(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`Shader error: ${gl.getShaderInfoLog(sh)}`);
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Link error: ${gl.getProgramInfoLog(prog)}`);
  const u = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2 is not available in this browser.');
    this.gl = gl;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onLost?.(); });
    this.terrain = compile(gl, TERRAIN_VS, TERRAIN_FS);
    this.sky = compile(gl, SKY_VS, SKY_FS);
    this.clouds = compile(gl, CLOUD_VS, CLOUD_FS);
    this.lines = compile(gl, LINE_VS, LINE_FS);
    this.proj = mat4(); this.view = mat4(); this.viewProj = mat4(); this.inv = mat4(); this.model = mat4();
    this.tmp = mat4(); this.ident = mat4(); this.planes = new Float32Array(24);
    this.stats = { sections: 0, triangles: 0 };
    this.itemMeshes = new Map();

    this.pixels = generateTextures();
    this.layers = TEXTURE_NAMES.length;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, this.layers, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 4);

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
    gl.bindVertexArray(null);
    this.skyVao = gl.createVertexArray();

    this.particleMesh = this.createMesh(new Uint8Array(0), true);
    this.cracks = [];
    for (let i = 0; i < 10; i++) {
      const layer = TEX[`destroy_${i}`];
      this.cracks.push(this.createMesh(boxMesh([{ from: [0, 0, 0], to: [1, 1, 1], faces: { layer } }])));
    }
    const skin = TEX.player_skin, sleeve = TEX.player_sleeve;
    this.handMesh = this.createMesh(boxMesh([
      { from: [-0.125, 0, -0.125], to: [0.125, 0.75, 0.125], faces: { layer: skin, uv: [0, 0, 4, 12] } },
      { from: [-0.135, -0.01, -0.135], to: [0.135, 0.32, 0.135], faces: { layer: sleeve, uv: [0, 0, 4, 5] } },
    ]));
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

  uploadSection(sec, chunk, sy, solid, trans) {
    sec.origin = [chunk.cx * 16, sy * 16, chunk.cz * 16];
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
    if (def) {
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
        const flags = def.block !== null ? FFLAGS[def.block * 6] & 1 : 0;
        const tint = def.block !== null && TINT[def.block] ? (TINT[def.block] === 3 ? [...TINT_RGB.subarray(def.block * 3, def.block * 3 + 3)] : [110, 170, 70]) : null;
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
    gl.uniform1i(u.u_tex, 0);
    gl.uniform1f(u.u_daylight, f.env.daylight);
    gl.uniform3fv(u.u_skyLight, f.env.skyLight);
    gl.uniform3fv(u.u_fogColor, f.fogColor);
    gl.uniform2f(u.u_fog, f.fogStart, f.fogEnd);
    gl.uniform1f(u.u_gamma, 1 - 0.45 * f.brightness);
    gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
    gl.uniform4f(u.u_colorMul, 1, 1, 1, 1);
    gl.uniform1f(u.u_alphaMul, 1);
  }

  drawModel(mesh, model) {
    if (!mesh || !mesh.count) return;
    const gl = this.gl;
    gl.uniformMatrix4fv(this.terrain.u.u_model, false, model);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, (mesh.count / 4) * 6, gl.UNSIGNED_INT, 0);
  }

  // f: frame description assembled by the game each frame.
  render(f) {
    if (this.lost) return;
    const gl = this.gl, cam = f.cam;
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    const far = Math.max(160, f.renderDist * 16 + 48);
    perspective(this.proj, (f.fov * Math.PI) / 180, w / h, 0.08, far);
    viewRotation(this.view, cam.yaw, cam.pitch);
    multiply(this.viewProj, this.proj, this.view);
    frustumPlanes(this.planes, this.viewProj);
    invert(this.inv, this.viewProj);

    gl.clearColor(f.fogColor[0], f.fogColor[1], f.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);

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
    const visible = [];
    const maxD = (f.renderDist + 1) * 16;
    let tris = 0;
    if (f.world) {
      for (const chunk of f.world.chunks.values()) {
        const ox = chunk.cx * 16 - cam.x, oz = chunk.cz * 16 - cam.z;
        const dx = Math.max(0, Math.abs(ox + 8) - 8), dz = Math.max(0, Math.abs(oz + 8) - 8);
        if (dx * dx + dz * dz > maxD * maxD) continue;
        for (let sy = 0; sy < SECTIONS; sy++) {
          const sec = chunk.sections[sy];
          if (!sec.solid && !sec.trans) continue;
          const oy = sy * 16 - cam.y;
          if (!boxInFrustum(this.planes, ox, oy, oz, ox + 16, oy + 16, oz + 16)) continue;
          sec._d = (ox + 8) * (ox + 8) + (oy + 8) * (oy + 8) + (oz + 8) * (oz + 8);
          sec._ox = ox; sec._oy = oy; sec._oz = oz;
          visible.push(sec);
        }
      }
    }
    visible.sort((a, b) => a._d - b._d);
    for (const sec of visible) {
      if (!sec.solid) continue;
      identity(this.model);
      translate(this.model, this.model, sec._ox - SECTION_OFFSET, sec._oy - SECTION_OFFSET, sec._oz - SECTION_OFFSET);
      this.drawModel(sec.solid, this.model);
      tris += sec.solid.count / 2;
    }

    // Entities and dropped items.
    if (f.entities) for (const e of f.entities) {
      gl.uniform4f(u.u_lightOverride, 1, e.light[0] / 15, e.light[1] / 15, 0);
      gl.uniform4f(u.u_colorMul, e.tint ? e.tint[0] : 1, e.tint ? e.tint[1] : 1, e.tint ? e.tint[2] : 1, 1);
      for (const part of e.parts) this.drawModel(part.mesh, part.model);
    }
    gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
    gl.uniform4f(u.u_colorMul, 1, 1, 1, 1);

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
    for (let i = visible.length - 1; i >= 0; i--) {
      const sec = visible[i];
      if (!sec.trans) continue;
      identity(this.model);
      translate(this.model, this.model, sec._ox - SECTION_OFFSET, sec._oy - SECTION_OFFSET, sec._oz - SECTION_OFFSET);
      this.drawModel(sec.trans, this.model);
      tris += sec.trans.count / 2;
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    if (f.clouds && !cloudsAbove) this.drawClouds(f);

    this.stats.sections = visible.length;
    this.stats.triangles = tris;

    if (f.hand) this.drawHand(f);
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
    gl.uniform3fv(u.u_fogColor, f.fogColor);
    gl.bindVertexArray(this.cloudVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(this.terrain.prog);
  }

  // The first-person hand or held item, drawn over the world with its own projection.
  drawHand(f) {
    const gl = this.gl, u = this.terrain.u, hand = f.hand;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.terrain.prog);
    const proj = this.tmp;
    perspective(proj, (70 * Math.PI) / 180, this.canvas.width / this.canvas.height, 0.01, 10);
    gl.uniformMatrix4fv(u.u_proj, false, proj);
    gl.uniformMatrix4fv(u.u_view, false, this.ident);
    gl.uniform2f(u.u_fog, 1e5, 2e5);
    gl.uniform1f(u.u_alphaCut, 0.5);
    gl.uniform1f(u.u_wave, 0);
    gl.uniform4f(u.u_lightOverride, 1, hand.light[0] / 15, hand.light[1] / 15, 0);
    const s = hand.swing, sw = Math.sin(s * Math.PI), sw2 = Math.sin(Math.sqrt(s) * Math.PI);
    const m = identity(this.model);
    const eq = hand.equip;
    const bx = hand.bob[0] - sw2 * 0.22, by = hand.bob[1] + sw2 * 0.1 - eq * 0.5, bz = -sw * 0.1;
    const mesh = hand.item ? this.itemMesh(hand.item) : null;
    if (!mesh) {
      // Bare arm reaching in from the lower right.
      translate(m, m, 0.62 + bx, -0.78 + by, -0.62 + bz);
      rotateY(m, m, -0.35 - sw2 * 0.3);
      rotateZ(m, m, 0.55 + sw * 0.25);
      rotateX(m, m, -1.15 - sw * 0.6);
      translate(m, m, -MODEL_OFFSET, -MODEL_OFFSET, -MODEL_OFFSET);
      this.drawModel(this.handMesh, m);
    } else if (mesh.kind === 'block') {
      translate(m, m, 0.5 + bx, -0.5 + by, -0.8 + bz);
      rotateX(m, m, -sw * 0.7);
      rotateY(m, m, 0.78 - sw2 * 0.3);
      scale(m, m, 0.27, 0.27, 0.27);
      translate(m, m, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
      this.drawModel(mesh, m);
    } else {
      // Flat items: handle at the lower right, tip leaning in towards the crosshair.
      gl.disable(gl.CULL_FACE);
      translate(m, m, 0.56 + bx, -0.58 + by, -0.8 + bz);
      rotateX(m, m, -sw * 0.9);
      rotateY(m, m, Math.PI - 0.55 - sw2 * 0.25);
      rotateZ(m, m, 0.15);
      scale(m, m, 0.5, 0.5, 0.5);
      translate(m, m, -0.15 - MODEL_OFFSET, -0.12 - MODEL_OFFSET, -0.5 - MODEL_OFFSET);
      this.drawModel(mesh, m);
      gl.enable(gl.CULL_FACE);
    }
    gl.uniform4f(u.u_lightOverride, 0, 0, 0, 0);
  }
}
