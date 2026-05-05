import { simplexNoise3D } from './noise'

export const oceanVertexShader = /* glsl */ `
uniform float uTime;
uniform float uBass;
uniform float uTreble;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vHeight;

${simplexNoise3D}

float waveHeight(vec2 p, float t, float bass, float treble) {
  // Calm baseline — always alive
  float h = 0.0;
  h += snoise(vec3(p * 0.0008, t * 0.12)) * 2.0;
  h += snoise(vec3(p * 0.002,  t * 0.20)) * 1.0;
  h += snoise(vec3(p * 0.005,  t * 0.30)) * 0.5;

  // Bass — massive swells
  h += snoise(vec3(p * 0.003 + 40.0, t * 0.25)) * bass * 14.0;
  h += snoise(vec3(p * 0.007 + 80.0, t * 0.40)) * bass * 6.0;

  // Treble — choppy ripples
  h += snoise(vec3(p * 0.015 + 120.0, t * 1.2)) * treble * 1.5;
  h += snoise(vec3(p * 0.04  + 200.0, t * 2.0)) * treble * 0.5;

  return h;
}

void main() {
  vec3 pos = position;
  float h = waveHeight(pos.xz, uTime, uBass, uTreble);
  pos.y += h;

  // Normal via central differences
  float e = 2.0;
  float hL = waveHeight(pos.xz + vec2(-e, 0.0), uTime, uBass, uTreble);
  float hR = waveHeight(pos.xz + vec2( e, 0.0), uTime, uBass, uTreble);
  float hD = waveHeight(pos.xz + vec2(0.0, -e), uTime, uBass, uTreble);
  float hU = waveHeight(pos.xz + vec2(0.0,  e), uTime, uBass, uTreble);
  vec3 normal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));

  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vHeight = h;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

export const oceanFragmentShader = /* glsl */ `
uniform vec3 uSunPosition;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSkyColor;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vHeight;

void main() {
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 N = normalize(vWorldNormal);

  // Fresnel
  float fresnel = pow(1.0 - max(dot(V, N), 0.0), 4.0);
  fresnel = clamp(fresnel, 0.0, 1.0);

  // Height-based color
  float hFactor = smoothstep(-2.0, 10.0, vHeight);
  vec3 water = mix(uDeepColor, uShallowColor, hFactor * 0.5);

  // Sky reflection via fresnel
  vec3 color = mix(water, uSkyColor, fresnel * 0.6);

  // Sun specular: sharp core + wide sun road
  vec3 L = normalize(uSunPosition);
  vec3 H = normalize(L + V);
  float specHard = pow(max(dot(N, H), 0.0), 256.0);
  float specMed  = pow(max(dot(N, H), 0.0), 32.0);
  float specSoft = pow(max(dot(N, H), 0.0), 8.0);
  color += vec3(1.0, 0.95, 0.85) * (specHard * 3.0 + specMed * 0.5 + specSoft * 0.15);

  // Distance fog
  float dist = length(vWorldPos - cameraPosition);
  float fog = smoothstep(400.0, 2500.0, dist);
  color = mix(color, uSkyColor * 0.4, fog);

  gl_FragColor = vec4(color, 0.95);
}
`
