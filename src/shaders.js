// GLSL for the renderer. Most programs come in two builds: the classic look (Minecraft's flat
// lighting, drawn straight to the screen) and, with FANCY defined, the shaders look: light worked
// out in linear colour from the sun or moon with shadows, the sky's ambient light and warm torch
// light, glinting water, a glowing sky, and an HDR picture that post.js finishes with bloom,
// light shafts and a filmic tone curve.

const header = (fancy) => `#version 300 es
precision highp float;
precision highp int;
${fancy ? '#define FANCY 1' : ''}
`;

// ---------------------------------------------------------------- terrain, entities, particles
export const terrainVS = (fancy) => `${header(fancy)}
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in uvec4 a_info;
layout(location=3) in vec4 a_light;
layout(location=4) in vec4 a_tint;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform mat4 u_model;
uniform vec3 u_offset;
uniform vec3 u_camPos;
uniform float u_time;
uniform float u_wave;
out vec3 v_uv;
out vec4 v_light;
out vec3 v_tint;
out float v_shade;
out vec3 v_rel;
flat out uint v_flags;
#ifdef FANCY
out vec3 v_normal;
flat out uint v_face;
const vec3 NORMALS[7] = vec3[7](vec3(1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, -1.0, 0.0),
  vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, -1.0), vec3(0.0, 1.0, 0.0));
#endif
const float SHADE[7] = float[7](0.6, 0.6, 1.0, 0.5, 0.8, 0.8, 0.9);
void main() {
  vec4 rel = u_model * vec4(a_pos / 256.0, 1.0);
  rel.xyz += u_offset;
  uint flags = a_info.z;
  if ((flags & 8u) != 0u && u_wave > 0.0) {
    vec3 wp = rel.xyz + u_camPos;
    float amp = a_info.y == 6u ? (a_uv.y < 0.5 ? 0.06 : 0.0) : 0.018;
    float ph = u_time * 1.7 + wp.x * 0.55 + wp.z * 0.35 + wp.y * 0.2;
    rel.x += sin(ph) * amp;
    rel.z += cos(ph * 0.8 + 1.3) * amp;
  }
  gl_Position = u_proj * u_view * rel;
  v_uv = vec3(a_uv / 16.0, float(a_info.x + a_info.w * 256u));
  // Animated textures (fire) step through eight consecutive layers.
  if ((flags & 4u) != 0u) v_uv.z += floor(mod(u_time * 12.0, 8.0));
  v_light = a_light;
  v_tint = a_tint.rgb;
  v_shade = SHADE[min(a_info.y, 6u)];
  v_rel = rel.xyz;
  v_flags = flags;
#ifdef FANCY
  v_normal = mat3(u_model) * NORMALS[min(a_info.y, 6u)];
  v_face = a_info.y;
#endif
}`;

// Texture arrays: the block textures in up to four arrays of 256 layers (every WebGL 2 device has
// at least that many), and the creature skins (64x64) for layer numbers from 1024 up.
const TEXTURES = `
uniform highp sampler2DArray u_tex0, u_tex1, u_tex2, u_tex3;
uniform highp sampler2DArray u_skin;
vec4 texel(vec2 uv, float layer, vec2 dx, vec2 dy) {
  float arr = floor(layer / 256.0);
  vec3 p = vec3(uv, layer - arr * 256.0);
  if (arr < 0.5) return textureGrad(u_tex0, p, dx, dy);
  if (arr < 1.5) return textureGrad(u_tex1, p, dx, dy);
  if (arr < 2.5) return textureGrad(u_tex2, p, dx, dy);
  return textureGrad(u_tex3, p, dx, dy);
}
vec4 sampleLayer(vec2 uv, float layer, vec2 dx, vec2 dy) {
  return layer > 1023.5 ? textureGrad(u_skin, vec3(uv * 0.25, layer - 1024.0), dx * 0.25, dy * 0.25) : texel(uv, layer, dx, dy);
}`;

// The distortion that gives the shadow map its detail near the player (as shader packs do):
// the map is squeezed so that texels are small close by and larger far away.
const DISTORT = `
const float SHADOW_K = 0.85;
vec2 distortShadow(vec2 p) { return p / (length(p) * SHADOW_K + (1.0 - SHADOW_K)); }`;

export const terrainFS = (fancy) => `${header(fancy)}
${TEXTURES}
uniform float u_time;
uniform float u_daylight;
uniform vec3 u_skyLight;
uniform vec3 u_fogColor;
uniform vec2 u_fog;
uniform float u_alphaCut;
uniform float u_alphaMul;
uniform float u_gamma;
uniform float u_night;
uniform vec4 u_lightOverride;
uniform vec4 u_colorMul;
uniform float u_hurt;
uniform float u_glint;  // enchanted things shimmer
uniform vec4 u_weather; // rain or snow: kind (1 rain, 2 snow), how far it has fallen (pixels), time
in vec3 v_uv;
in vec4 v_light;
in vec3 v_tint;
in float v_shade;
in vec3 v_rel;
flat in uint v_flags;
out vec4 o_color;
float curve(float l) { return l / (3.0 - 2.0 * l); }
// The shimmer on enchanted things: a purple sheen with bright bands sweeping across it.
vec3 glint() {
  vec2 p = gl_FragCoord.xy / 48.0;
  float s = fract(p.x * 0.7 + p.y * 0.35 - u_time * 0.45);
  float s2 = fract(-p.x * 0.3 + p.y * 0.8 - u_time * 0.3 + 0.37);
  float g = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.08, 0.3, s)) + 0.6 * smoothstep(0.0, 0.1, s2) * (1.0 - smoothstep(0.1, 0.25, s2));
  return vec3(0.45, 0.22, 0.85) * (0.2 + g * 0.9) * u_glint;
}
// Rain and snow on the sheets around the player (weather.js), in the manner of the original's
// rain.png and snow.png: 64 pixels to a block, a streak or a flake here and there. They're worked
// out here rather than read from a texture so that nothing repeats across a sheet. Across a sheet
// uv runs 0..1, down it half a unit to a block; the tint holds the sheet's fade and a random number.
uint ihash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rnd(uint x) { return float(ihash(x) >> 8) * (1.0 / 16777216.0); }
// Rain: a streak now and then down each one-pixel lane, fading towards its tail; the lanes fall at
// slightly different speeds. (A whole number of eighths, so the pattern stays seamless where the
// distance fallen wraps around.)
float rainAt(vec2 p, uint seed) {
  uint lane = ihash(uint(int(floor(p.x)) + 4096) + seed * 131u);
  float y = p.y - u_weather.y * float(7u + (lane & 3u)) / 8.0 + float(lane >> 20);
  float cell = floor(y / 72.0);
  uint c = ihash(lane ^ uint(mod(cell, 64.0)) * 0x9e3779b1u);
  if (rnd(c) > 0.17) return 0.0;
  float len = 10.0 + 22.0 * rnd(c + 1u);
  float f = (y - cell * 72.0 - rnd(c + 2u) * (72.0 - len)) / len;
  return f < 0.0 || f > 1.0 ? 0.0 : mix(0.3, 0.9, f);
}
// Snow: a flake in some of the 16 x 16 pixel cells, a dot, a cross, a ring or a little square, each
// rocking from side to side as it falls, and the whole sheet drifting a little.
float snowAt(vec2 p, uint seed) {
  p.x += sin(u_weather.z * 0.45 + float(seed & 255u)) * 6.0 + float(seed >> 8) * 16.0;
  p.y -= u_weather.y;
  vec2 cell = floor(p / 16.0);
  uint c = ihash(uint(int(cell.x) + 8192) * 0x27d4eb2du ^ uint(mod(cell.y, 64.0)) * 0x165667b1u ^ seed);
  if (rnd(c) > 0.6) return 0.0;
  vec2 at = vec2(3.0) + floor(vec2(rnd(c + 1u), rnd(c + 2u)) * 10.0);
  at.x += floor(sin(u_weather.z * (1.1 + rnd(c + 3u)) + rnd(c + 4u) * 6.2832) * 1.5 + 0.5);
  vec2 q = floor(p - cell * 16.0) - at, a = abs(q);
  uint shape = ihash(c + 5u) % 5u;
  bool on = shape == 0u ? a.x + a.y < 0.5
          : shape == 1u ? a.x + a.y < 1.5 && min(a.x, a.y) < 0.5
          : shape == 2u ? a.x == a.y && a.x < 1.5
          : shape == 3u ? a.x + a.y == 1.0
          : q.x >= 0.0 && q.y >= 0.0 && q.x < 1.5 && q.y < 1.5;
  return on ? 0.95 : 0.0;
}
vec4 precipitation(vec2 uv, vec2 dx, vec2 dy) {
  uint seed = uint(v_tint.g * 255.0 + 0.5) | (uint(v_tint.b * 255.0 + 0.5) << 8);
  vec2 p = uv * vec2(64.0, 128.0);
  bool rain = u_weather.x < 1.5;
  // Where a pixel is smaller than a screen pixel, two samples a screen pixel apart are averaged, so
  // that far-off streaks and flakes don't flicker.
  float fw = 64.0 * (abs(dx.x) + abs(dy.x));
  float a;
  if (fw > 1.2) {
    vec2 o = vec2(fw * 0.25, 0.0);
    a = rain ? (rainAt(p - o, seed) + rainAt(p + o, seed)) * 0.5 : (snowAt(p - o, seed) + snowAt(p + o, seed)) * 0.5;
  } else a = rain ? rainAt(p, seed) : snowAt(p, seed);
  // The sheet's own fade, and a softer top.
  a *= v_tint.r * clamp(uv.y, 0.0, 1.0);
  return vec4(rain ? vec3(0.5, 0.64, 1.0) : vec3(1.0), a);
}
#ifdef FANCY
uniform vec3 u_camPos;
uniform vec3 u_lightDir;    // towards the sun (or moon)
uniform vec3 u_lightColor;  // its light, linear
uniform vec3 u_ambient;     // the open sky's light, linear
uniform vec3 u_zenithL;     // sky colours for reflections, linear
uniform vec3 u_horizonL;
uniform vec3 u_sunGlow;
uniform float u_shadowOn;
uniform highp sampler2DShadow u_shadowMap;
uniform mat4 u_shadowMat;   // camera-relative position -> the shadow map's (undistorted) clip space
uniform vec2 u_shadowInfo;  // half the width it covers (blocks), its resolution
uniform float u_outScale;   // headroom when the picture is stored in 8 bits
uniform float u_underwater;
in vec3 v_normal;
flat in uint v_face;
${DISTORT}
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// How much of the sun reaches this point: soft-edged, fading out where the map ends.
float sunShadow(vec3 rel, vec3 n) {
  vec4 c0 = u_shadowMat * vec4(rel, 1.0);
  float df = length(c0.xy) * SHADOW_K + (1.0 - SHADOW_K);
  // Pushed out along the surface normal by about a texel there, which keeps surfaces from
  // shadowing themselves.
  float texel = 2.0 * u_shadowInfo.x / u_shadowInfo.y * df;
  vec4 c = u_shadowMat * vec4(rel + n * texel * 1.5, 1.0);
  vec2 d = distortShadow(c.xy);
  float edge = max(abs(d.x), abs(d.y));
  if (edge > 0.995) return 1.0;
  vec3 s = vec3(d * 0.5 + 0.5, c.z * 0.5 + 0.5 - 0.00003);
  vec2 t = 1.0 / vec2(textureSize(u_shadowMap, 0));
  // Four filtered taps in a small rotated square (each is itself a 2x2 comparison).
  float r = hash12(gl_FragCoord.xy) * 6.2832;
  vec2 a = vec2(cos(r), sin(r)) * t * 0.9, b = vec2(-a.y, a.x);
  float sum = texture(u_shadowMap, vec3(s.xy + a, s.z)) + texture(u_shadowMap, vec3(s.xy - a, s.z))
    + texture(u_shadowMap, vec3(s.xy + b, s.z)) + texture(u_shadowMap, vec3(s.xy - b, s.z));
  return mix(sum * 0.25, 1.0, smoothstep(0.88, 0.99, edge));
}
// Ripples on still water: a few layers of drifting value noise.
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float waves(vec2 p, float t) {
  return vnoise(p * 0.55 + vec2(t * 0.32, t * 0.21)) * 0.55 + vnoise(p * 1.3 - vec2(t * 0.27, -t * 0.41)) * 0.3
       + vnoise(p * 3.2 + vec2(t * 0.55, t * 0.47)) * 0.15;
}
vec3 skyColor(vec3 dir) {
  vec3 c = mix(u_horizonL, u_zenithL, pow(clamp(dir.y, 0.0, 1.0), 0.5));
  return c + u_sunGlow * pow(max(dot(dir, u_lightDir), 0.0), 10.0) * 0.4;
}
#endif
void main() {
  vec2 uv = v_uv.xy;
  if ((v_flags & 80u) != 0u) {
    // Water (16) and lava (64): flowing surfaces run downhill, falling sides run down, and a
    // slow ripple moves over everything. Lava is thick and slow.
    bool lava = (v_flags & 64u) != 0u;
    float code = floor(v_light.w * 255.0 + 0.5);
    float speed = lava ? 0.16 : 0.62;
    if (code > 254.5) uv.y -= u_time * speed * 1.5;
    else if (code > 0.5) {
      float a = (code - 1.0) / 253.0 * 6.2831853;
      uv -= vec2(cos(a), sin(a)) * u_time * speed;
    }
    uv += lava ? vec2(sin(u_time * 0.35 + uv.y * 3.1416) * 0.06, u_time * 0.02)
               : vec2(sin(u_time * 0.8 + uv.y * 6.2832) * 0.03, cos(u_time * 0.6 + uv.x * 6.2832) * 0.02);
  }
  // (Derivatives are taken here, outside any branch, so mipmapping works inside texel().)
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  float layer = floor(v_uv.z + 0.5);
  vec4 tex = (v_flags & 128u) != 0u ? precipitation(uv, dx, dy) : sampleLayer(uv, layer, dx, dy);
  vec3 col = tex.rgb;
  if ((v_flags & 2u) != 0u) {
    vec4 ov = texel(uv, layer + 1.0, dx, dy);
    col = mix(col, ov.rgb * v_tint, ov.a);
  } else if ((v_flags & 1u) != 0u) {
    col *= v_tint;
  }
  if (tex.a < u_alphaCut) discard;
  // Mobs flash red when hurt.
  col = mix(col, vec3(1.0, 0.0, 0.0), u_hurt);
  vec2 lv = u_lightOverride.x > 0.5 ? u_lightOverride.yz : v_light.xy;
#ifndef FANCY
  vec3 light;
  if ((v_flags & 32u) != 0u) {
    light = vec3(1.0);
  } else {
    float sky = curve(lv.x) * u_daylight;
    float blk = curve(lv.y);
    light = max(u_skyLight * sky, vec3(1.0, 0.86, 0.66) * blk);
    light = pow(max(light, vec3(0.0)), vec3(u_gamma)) * 0.96 + 0.04;
    // Night Vision: everything as bright as in full daylight.
    light = max(light, vec3(0.92 * u_night));
  }
  float ao = 0.5 + 0.5 * v_light.z;
  col *= light * ao * v_shade;
  col *= u_colorMul.rgb;
  float fog = clamp((length(v_rel) - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  col = mix(col, u_fogColor, fog);
  if (u_glint > 0.0) col += glint();
  o_color = vec4(col, tex.a * u_alphaMul * u_colorMul.a);
#else
  vec3 albedo = pow(col, vec3(2.2)) * u_colorMul.rgb;
  float alpha = tex.a * u_alphaMul * u_colorMul.a;
  vec3 N = normalize(v_normal);
  bool flat_ = v_face == 6u;
  // Direct light only where the open sky reaches (the shadow map can't see into every cave).
  float reach = smoothstep(0.5, 0.94, lv.x);
  float ndl = flat_ ? 0.45 + 0.55 * max(u_lightDir.y, 0.0) : dot(N, u_lightDir);
  float sun = 0.0;
  if (ndl > 0.0 && reach > 0.0) sun = ndl * reach * (u_shadowOn > 0.5 ? sunShadow(v_rel, flat_ ? vec3(0.0, 1.0, 0.0) : N) : 1.0);
  // The sky's light: most from straight above, less into overhangs (the sky light level).
  float up = flat_ ? 0.85 : 0.6 + 0.4 * N.y;
  vec3 amb = u_ambient * (lv.x * lv.x) * up;
  // Torches, lava and glowstone: warm, and falling off quickly.
  float b = lv.y;
  vec3 torch = vec3(1.0, 0.6, 0.3) * (b * b * b) * 2.0;
  vec3 direct = u_lightColor * sun;
  // Under water, sunlight comes down dimmer and blue-green, in rippling patches.
  if (u_underwater > 0.5) {
    vec3 wp = v_rel + u_camPos;
    float ca = waves(wp.xz * 1.6 + wp.y * 0.3, u_time * 1.4);
    direct *= vec3(0.2, 0.45, 0.55) * (0.45 + 2.2 * ca * ca * ca);
    amb *= vec3(0.4, 0.62, 0.8);
  }
  vec3 light = direct + amb + torch + vec3(0.012, 0.013, 0.02) + (1.0 - u_gamma) * 0.12;
  light = max(light, vec3(0.8 * u_night));
  float ao = 0.35 + 0.65 * v_light.z;
  light *= mix(ao, 1.0, sun * 0.35);
  if ((v_flags & 32u) != 0u) light = vec3(1.8);
  if ((v_flags & 64u) != 0u) light = vec3(2.4);
  // Rain and snow take their light mostly from the sky around them, not straight from the sun.
  if ((v_flags & 128u) != 0u) light = amb * 1.3 + direct * 0.3 + torch + 0.02;
  vec3 c = albedo * light;
  vec3 V = normalize(-v_rel);
  // Water is clear: mostly the bed showing through, tinted, under what it reflects.
  if ((v_flags & 16u) != 0u) { c *= u_underwater > 0.5 ? 0.35 : 0.5; alpha = min(alpha, 0.6); }
  // Still water catches the sky and glints in the sun.
  if ((v_flags & 16u) != 0u && v_face == 2u && u_underwater < 0.5) {
    vec3 wp = v_rel + u_camPos;
    float t = u_time;
    // (The ripples calm with distance, where they'd only shimmer.)
    float e = 0.1, strength = 0.22 / (1.0 + length(v_rel) * 0.06);
    float h0 = waves(wp.xz, t), hx = waves(wp.xz + vec2(e, 0.0), t), hz = waves(wp.xz + vec2(0.0, e), t);
    vec3 n = normalize(vec3(-(hx - h0) / e * strength, 1.0, -(hz - h0) / e * strength));
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    vec3 R = reflect(-V, n);
    vec3 refl = skyColor(R) * (0.15 + 0.85 * lv.x * lv.x);
    float spec = pow(max(dot(R, u_lightDir), 0.0), 400.0) * (sun > 0.0 ? sun / max(ndl, 0.001) : 0.0);
    c = mix(c, refl, fres * 0.8) + u_lightColor * spec * 2.5;
    alpha = mix(alpha, 1.0, fres * 0.7);
  }
  // Fog: into the horizon's colour at the edge of what's drawn, a light haze before that (and
  // brighter towards the sun).
  float dist = length(v_rel);
  float fog = clamp((dist - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  float haze = u_underwater > 0.5 ? 0.0 : 1.0 - exp(-dist * 0.0035);
  vec3 fogC = u_fogColor + u_sunGlow * pow(max(dot(-V, u_lightDir), 0.0), 6.0) * 0.35;
  c = mix(c, fogC, max(fog, haze * 0.45));
  if (u_glint > 0.0) c += pow(glint(), vec3(2.2)) * 3.0;
  o_color = vec4(c * u_outScale, alpha);
#endif
}`;

// ---------------------------------------------------------------- shadow map
export const shadowVS = `${header(false)}
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in uvec4 a_info;
uniform mat4 u_shadowMat;
uniform mat4 u_model;
uniform vec3 u_offset;
out vec3 v_uv;
${DISTORT}
void main() {
  vec4 rel = u_model * vec4(a_pos / 256.0, 1.0);
  rel.xyz += u_offset;
  vec4 c = u_shadowMat * rel;
  c.xy = distortShadow(c.xy);
  gl_Position = c;
  v_uv = vec3(a_uv / 16.0, float(a_info.x + a_info.w * 256u));
}`;

export const shadowFS = `${header(false)}
${TEXTURES}
in vec3 v_uv;
void main() {
  // Leaves and plants cast shadows with holes in them. (Only depth is written.)
  vec2 dx = dFdx(v_uv.xy), dy = dFdy(v_uv.xy);
  if (sampleLayer(v_uv.xy, floor(v_uv.z + 0.5), dx, dy).a < 0.5) discard;
}`;

// ---------------------------------------------------------------- sky
export const fullscreenVS = `#version 300 es
out vec2 v_ndc;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  v_ndc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const skyFS = (fancy) => `${header(fancy)}
uniform mat4 u_invViewProj;
uniform vec3 u_sunDir;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform float u_stars;
uniform float u_sunset;
uniform float u_starAngle;
uniform float u_underwater;
uniform float u_rain;
uniform float u_time;
uniform vec3 u_sunGlow;
uniform float u_outScale;
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
  float sd = dot(dir, u_sunDir);
#ifndef FANCY
  vec3 col = mix(u_horizon, u_zenith, pow(clamp(h, 0.0, 1.0), 0.5));
  if (h < 0.0) col = mix(u_horizon, u_horizon * 0.5, clamp(-h * 3.0, 0.0, 1.0));
  col += vec3(1.0, 0.42, 0.12) * u_sunset * pow(max(sd, 0.0), 5.0) * 0.6 * (1.0 - clamp(abs(h) * 1.4, 0.0, 1.0));
  float sunBright = 1.1, moonBright = 1.0, starBright = 1.0;
#else
  vec3 zen = pow(u_zenith, vec3(2.2)) * 0.72, hor = pow(u_horizon, vec3(2.2)) * 0.8;
  vec3 col = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.45));
  // A pale band along the horizon, and the ground below it fading darker.
  col += hor * 0.35 * exp(-abs(h) * 9.0);
  if (h < 0.0) col = mix(col, hor * 0.35, clamp(-h * 2.5, 0.0, 1.0));
  // The glow round the sun: a wide warm haze and a bright core (brightest at sunrise and sunset).
  float s = max(sd, 0.0);
  col += u_sunGlow * (pow(s, 8.0) * 0.28 + pow(s, 90.0) * 0.9) * (1.0 - u_rain * 0.8);
  col += u_sunGlow * u_sunset * pow(s, 3.0) * 0.35 * (1.0 - clamp(abs(h) * 1.6, 0.0, 1.0));
  float sunBright = 9.0, moonBright = 1.6, starBright = 1.5;
#endif
  if (u_stars > 0.01 && h > -0.1) {
    float c = cos(u_starAngle), s2 = sin(u_starAngle);
    vec3 sp = vec3(c * dir.x + s2 * dir.y, -s2 * dir.x + c * dir.y, dir.z);
    float r = hash(floor(sp * 150.0));
    float twinkle = 1.0;
#ifdef FANCY
    twinkle = 0.65 + 0.35 * sin(u_time * (2.0 + r * 3.0) + r * 60.0);
#endif
    if (r > 0.9968) col += vec3(0.85, 0.9, 1.0) * u_stars * starBright * twinkle * ((r - 0.9968) / 0.0032 * 0.7 + 0.3) * clamp(h * 5.0 + 0.4, 0.0, 1.0);
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
      col = mix(col, vec3(1.0, 0.95, 0.7) * rim * sunBright, smoothstep(-0.15, 0.02, h) * (1.0 - u_rain));
    }
  } else {
    vec2 q = vec2(dot(dir, U), dot(dir, V)) / -sd;
    float size = 0.065;
    if (max(abs(q.x), abs(q.y)) < size && h > -0.05) {
      vec2 g = floor(q / size * 4.0);
      float crater = hash(vec3(g, 7.0)) > 0.68 ? 0.74 : 1.0;
      col = mix(col, vec3(0.85, 0.88, 0.97) * crater * moonBright, clamp(u_stars * 1.2, 0.2, 1.0) * (1.0 - u_rain));
    }
  }
#ifndef FANCY
  if (u_underwater > 0.5) col = vec3(0.05, 0.16, 0.42);
  o_color = vec4(col, 1.0);
#else
  if (u_underwater > 0.5) col = pow(u_horizon, vec3(2.2));
  o_color = vec4(col * u_outScale, 1.0);
#endif
}`;

// ---------------------------------------------------------------- clouds
export const cloudVS = `#version 300 es
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

export const cloudFS = (fancy) => `${header(fancy)}
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_fogColor;
uniform float u_size;
uniform float u_outScale;
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
#ifndef FANCY
  o_color = vec4(mix(u_fogColor, u_color, fade), 0.8 * fade);
#else
  // Thicker middles are a little darker underneath.
  vec3 c = pow(u_color, vec3(2.2)) * (1.25 - (n - 0.56) * 0.8);
  o_color = vec4(mix(u_fogColor, c, fade) * u_outScale, 0.85 * fade);
#endif
}`;

// ---------------------------------------------------------------- selection box
export const lineVS = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
void main() { gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;

export const lineFS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o_color;
void main() { o_color = u_color; }`;

// ---------------------------------------------------------------- post-processing (post.js)
// A quarter-size copy of the picture keeping only what's bright (for bloom), with the sky's
// outline near the sun in alpha (for light shafts).
export const downFS = `#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform highp sampler2D u_depth;
uniform vec2 u_texel;
uniform float u_inScale;
uniform float u_threshold;
uniform vec2 u_sun;
uniform float u_aspect;
in vec2 v_ndc;
out vec4 o_color;
void main() {
  vec2 uv = v_ndc * 0.5 + 0.5;
  vec3 c = texture(u_scene, uv + u_texel * vec2(-1.0, -1.0)).rgb + texture(u_scene, uv + u_texel * vec2(1.0, -1.0)).rgb
         + texture(u_scene, uv + u_texel * vec2(-1.0, 1.0)).rgb + texture(u_scene, uv + u_texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25 / u_inScale;
  // (A stray NaN or infinity would spread through the blur into a black blot.)
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = min(c, vec3(64.0));
  float br = max(c.r, max(c.g, c.b));
  c *= smoothstep(u_threshold, u_threshold * 1.8 + 0.2, br);
  float sky = texture(u_depth, uv).r >= 0.99999 ? 1.0 : 0.0;
  vec2 q = (uv - u_sun) * vec2(u_aspect, 1.0);
  o_color = vec4(c, sky * exp(-dot(q, q) * 5.0));
}`;

// Blurs the bright copy one way (a 9-tap Gaussian); the first pass also smears the sky outline
// out from the sun into shafts.
export const blurFS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_dir;
uniform vec2 u_sun;
uniform float u_radial;
in vec2 v_ndc;
out vec4 o_color;
const float W[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
void main() {
  vec2 uv = v_ndc * 0.5 + 0.5;
  vec3 c = texture(u_src, uv).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = u_dir * float(i);
    c += (texture(u_src, uv + o).rgb + texture(u_src, uv - o).rgb) * W[i];
  }
  float a;
  if (u_radial > 0.5) {
    vec2 step = (u_sun - uv) * (0.85 / 28.0);
    vec2 p = uv;
    float acc = 0.0, wsum = 0.0, w = 1.0;
    for (int i = 0; i < 28; i++) { acc += texture(u_src, p).a * w; wsum += w; w *= 0.95; p += step; }
    a = acc / wsum;
  } else a = texture(u_src, uv).a;
  o_color = vec4(c, a);
}`;

// The finished picture: bloom and shafts added, a filmic tone curve, a little grading and a
// vignette.
export const compositeFS = `#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_inScale;
uniform float u_exposure;
uniform float u_bloomAmt;
uniform vec3 u_rays;
uniform float u_underwater;
uniform float u_time;
in vec2 v_ndc;
out vec4 o_color;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 uv = v_ndc * 0.5 + 0.5;
  if (u_underwater > 0.5) uv += vec2(sin(uv.y * 26.0 + u_time * 2.1), cos(uv.x * 21.0 + u_time * 1.7)) * 0.0022;
  vec3 c = texture(u_scene, uv).rgb / u_inScale;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  vec4 b = texture(u_bloom, uv);
  c += b.rgb * u_bloomAmt + u_rays * b.a;
  c = aces(c * u_exposure);
  c = pow(c, vec3(1.0 / 2.2));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.22);
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.5;
  c += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  o_color = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
