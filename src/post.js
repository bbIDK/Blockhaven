// The shaders look, the parts that aren't the scene itself: the shadow map drawn from the sun,
// and the passes that turn the HDR picture into the one on screen (bloom, light shafts, tone
// curve). Programs come from shaders.js; the renderer drives both.
import { compile } from './gl.js';
import { shadowVS, shadowFS, fullscreenVS, downFS, blurFS, compositeFS } from './shaders.js';
import { SECTION_OFFSET } from './mesher.js';
import { mat4 } from './math.js';

// ---------------------------------------------------------------- shadow map
// An orthographic view from the sun (or moon) centred near the player, squeezed so that detail
// is finest close by (see distortShadow in shaders.js). It follows the player in 2-block steps
// and the sun in small ones, so shadow edges hold still.
export class Shadows {
  constructor(gl) {
    this.gl = gl;
    this.prog = compile(gl, shadowVS, shadowFS);
    this.size = 0;
    this.radius = 96;   // blocks from the centre to the edge of the map
    this.depth = 300;   // blocks towards and away from the sun it reaches
    this.mat = mat4();  // camera-relative position -> the map's (undistorted) clip space
    this.tex = null;
    this.fbo = null;
    // A 1x1 stand-in (all lit), so the terrain shader always has a depth texture to sample.
    this.blank = this.depthTexture(1, new Uint32Array([0xffffffff]));
  }

  depthTexture(size, data = null) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, data);
    else gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    return tex;
  }

  ensure(size) {
    if (this.size === size) return;
    const gl = this.gl;
    if (this.tex) { gl.deleteTexture(this.tex); gl.deleteFramebuffer(this.fbo); }
    this.size = size;
    this.tex = this.depthTexture(size);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // The map's matrix for this frame (camera-relative positions in, clip space out).
  update(cam, lightDir) {
    const R = this.radius, D = this.depth;
    const Z = lightDir;
    let X = [-Z[1], Z[0], 0];
    const xl = Math.hypot(X[0], X[1]) || 1;
    X = [X[0] / xl, X[1] / xl, 0];
    const Y = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]];
    // Centre: the player's position in 2-block steps. (What the map holds depends only on that
    // and the light, so while those stay put it needn't be redrawn every frame.)
    const t = [cam.x - Math.floor(cam.x / 2) * 2, cam.y - Math.floor(cam.y / 2) * 2, cam.z - Math.floor(cam.z / 2) * 2];
    this.key = `${Math.floor(cam.x / 2)},${Math.floor(cam.y / 2)},${Math.floor(cam.z / 2)},${Z[0]},${Z[1]}`;
    const m = this.mat;
    for (let i = 0; i < 3; i++) {
      m[i * 4] = X[i] / R;
      m[i * 4 + 1] = Y[i] / R;
      m[i * 4 + 2] = -Z[i] / D;
      m[i * 4 + 3] = 0;
    }
    m[12] = (t[0] * X[0] + t[1] * X[1] + t[2] * X[2]) / R;
    m[13] = (t[0] * Y[0] + t[1] * Y[1] + t[2] * Y[2]) / R;
    m[14] = -(t[0] * Z[0] + t[1] * Z[1] + t[2] * Z[2]) / D;
    m[15] = 1;
  }

  // Draws everything that casts a shadow: the solid terrain near the player, and creatures.
  render(r, f) {
    const gl = this.gl, world = f.world, cam = f.cam, m = this.mat, R = this.radius;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.size, this.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 3);
    const { prog, u } = this.prog;
    gl.useProgram(prog);
    for (let i = 0; i < 4; i++) gl.uniform1i(u[`u_tex${i}`], i);
    gl.uniform1i(u.u_skin, 4);
    gl.uniformMatrix4fv(u.u_shadowMat, false, m);
    gl.uniformMatrix4fv(u.u_model, false, r.ident);
    let draws = 0;
    const reach = (R + 24) * (R + 24);
    // (A section is drawn if its bounding sphere, 14 blocks across, falls on the map.)
    const rad = 14 / R;
    const lit = (x) => (x?.skyMax ?? 15) >= 6;
    for (const chunk of world.chunks.values()) {
      if (chunk.state !== 2) continue;
      const ox = chunk.cx * 16 - cam.x, oz = chunk.cz * 16 - cam.z;
      if ((ox + 8) * (ox + 8) + (oz + 8) * (oz + 8) > reach) continue;
      const secs = chunk.sections, nb = chunk.nb;
      for (let sy = 0; sy < secs.length; sy++) {
        const sec = secs[sy];
        if (!sec.solid) continue;
        // (Only sections the open sky reaches, or next to one: the rest are buried.)
        if (!lit(sec) && !lit(secs[sy + 1]) && !(sy > 0 && lit(secs[sy - 1])) && !(nb[0] && lit(nb[0].sections[sy])) && !(nb[1] && lit(nb[1].sections[sy]))
          && !(nb[2] && lit(nb[2].sections[sy])) && !(nb[3] && lit(nb[3].sections[sy]))) continue;
        const oy = sy * 16 - cam.y, cx = ox + 8, cy = oy + 8, cz = oz + 8;
        const px = m[0] * cx + m[4] * cy + m[8] * cz + m[12], py = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
        if (Math.abs(px) > 1 + rad || Math.abs(py) > 1 + rad) continue;
        gl.uniform3f(u.u_offset, ox - SECTION_OFFSET, oy - SECTION_OFFSET, oz - SECTION_OFFSET);
        gl.bindVertexArray(sec.solid.vao);
        gl.drawElements(gl.TRIANGLES, (sec.solid.count / 4) * 6, gl.UNSIGNED_INT, 0);
        draws++;
      }
    }
    gl.uniform3f(u.u_offset, 0, 0, 0);
    if (f.entities) for (const e of f.entities) {
      for (const part of e.parts) {
        if (!part.mesh?.count) continue;
        gl.uniformMatrix4fv(u.u_model, false, part.model);
        gl.bindVertexArray(part.mesh.vao);
        gl.drawElements(gl.TRIANGLES, (part.mesh.count / 4) * 6, gl.UNSIGNED_INT, 0);
      }
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return draws;
  }
}

// ---------------------------------------------------------------- the picture
export class Post {
  constructor(gl) {
    this.gl = gl;
    // A floating-point picture keeps the sun and lava brighter than white, for the bloom. Without
    // it, colours are stored at half strength for some headroom.
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    this.scale = this.hdr ? 1 : 0.5;
    this.down = compile(gl, fullscreenVS, downFS);
    this.blur = compile(gl, fullscreenVS, blurFS);
    this.composite = compile(gl, fullscreenVS, compositeFS);
    this.vao = gl.createVertexArray();
    this.w = 0; this.h = 0;
    this.scene = null;
  }

  colorTexture(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.hdr ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  target(tex, depth = null) {
    const gl = this.gl, fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('Framebuffer incomplete');
    return fbo;
  }

  free() {
    const gl = this.gl;
    if (!this.scene) return;
    for (const t of [this.scene.color, this.scene.depth, this.qa.tex, this.qb.tex]) gl.deleteTexture(t);
    for (const fb of [this.scene.fbo, this.qa.fbo, this.qb.fbo]) gl.deleteFramebuffer(fb);
    this.scene = null;
  }

  // Makes (or remakes, on resize) the targets for a w x h picture.
  ensure(w, h) {
    if (this.scene && this.w === w && this.h === h) return;
    this.free();
    const gl = this.gl;
    this.w = w; this.h = h;
    const color = this.colorTexture(w, h);
    const depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.scene = { color, depth, fbo: this.target(color, depth) };
    this.qw = Math.max(1, Math.ceil(w / 4)); this.qh = Math.max(1, Math.ceil(h / 4));
    const qa = this.colorTexture(this.qw, this.qh), qb = this.colorTexture(this.qw, this.qh);
    this.qa = { tex: qa, fbo: this.target(qa) };
    this.qb = { tex: qb, fbo: this.target(qb) };
  }

  begin() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.w, this.h);
  }

  pass(p, fbo, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(p.prog);
    return p.u;
  }

  // Before the hand is drawn (it clears the depth the light shafts need): the bright copy.
  bright(sun) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    gl.bindVertexArray(this.vao);
    const u = this.pass(this.down, this.qa.fbo, this.qw, this.qh);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.depth);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.u_scene, 6);
    gl.uniform1i(u.u_depth, 7);
    gl.uniform2f(u.u_texel, 1 / this.w, 1 / this.h);
    gl.uniform1f(u.u_inScale, this.scale);
    gl.uniform1f(u.u_threshold, 0.85);
    gl.uniform2f(u.u_sun, sun.x, sun.y);
    gl.uniform1f(u.u_aspect, this.w / this.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.unbind();
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    this.begin();
  }

  // After the hand: blur, then put it all together on the screen.
  finish(sun, rays, underwater, time) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    gl.bindVertexArray(this.vao);
    const blur = (src, dst, dx, dy, radial) => {
      const u = this.pass(this.blur, dst.fbo, this.qw, this.qh);
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.u_src, 6);
      gl.uniform2f(u.u_dir, dx, dy);
      gl.uniform2f(u.u_sun, sun.x, sun.y);
      gl.uniform1f(u.u_radial, radial ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    blur(this.qa, this.qb, 1.5 / this.qw, 0, true);
    blur(this.qb, this.qa, 0, 1.5 / this.qh, false);
    const u = this.pass(this.composite, null, this.w, this.h);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this.qa.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.u_scene, 6);
    gl.uniform1i(u.u_bloom, 7);
    gl.uniform1f(u.u_inScale, this.scale);
    gl.uniform1f(u.u_exposure, 1.0);
    gl.uniform1f(u.u_bloomAmt, 0.22);
    gl.uniform3fv(u.u_rays, rays);
    gl.uniform1f(u.u_underwater, underwater ? 1 : 0);
    gl.uniform1f(u.u_time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.unbind();
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  unbind() {
    const gl = this.gl;
    for (const unit of [6, 7]) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
  }
}
