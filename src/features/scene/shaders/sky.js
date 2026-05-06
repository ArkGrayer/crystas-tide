export const skyVertexShader = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const skyFragmentShader = `
uniform float uTime;
uniform vec3 uSunDir;
uniform float uSunGlow;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uSunColor;

varying vec3 vWorldPosition;

vec3 hash32(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash32(i).x;
    float b = hash32(i + vec2(1.0, 0.0)).x;
    float c = hash32(i + vec2(0.0, 1.0)).x;
    float d = hash32(i + vec2(1.0, 1.0)).x;

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// Domain-warped FBM — a chave para nuvens cumulus orgânicas
// em vez de blobs uniformes. Distorce o input do FBM com outro FBM.
float cloudFBM(vec2 p) {
    vec2 q = vec2(
        fbm(p + vec2(0.0, 0.0)),
        fbm(p + vec2(5.2, 1.3))
    );
    return fbm(p + 4.0 * q);
}

void main() {
    vec3 rd = normalize(vWorldPosition - cameraPosition);

    // Gradiente vertical do céu
    float t = clamp(pow(max(rd.y, 0.0), 0.38), 0.0, 1.0);
    vec3 skyCol = mix(uSkyHorizon, uSkyTop, t);

    // ── Nuvens ──
    // Projeção em plano horizontal infinito acima da câmera
    float horizonGuard = max(rd.y, 0.18);
    vec2 cloudPlane = rd.xz / horizonGuard;
    vec2 wind = vec2(uTime * 0.008, uTime * 0.003);
    vec2 p = cloudPlane * 0.18 + wind;

    // Densidade da nuvem com domain warping (forma fluffy)
    float density = cloudFBM(p);

    // Auto-sombra: amostra a densidade na direção do sol.
    // Onde há mais nuvem entre o ponto e o sol = mais sombra.
    vec2 sunDir2D = normalize(uSunDir.xz + vec2(0.0001));
    float lightDensity = cloudFBM(p - sunDir2D * 0.18);
    float shading = exp(-max(density - lightDensity, 0.0) * 3.5);

    // Cobertura — onde a nuvem aparece (threshold suave)
    float coverage = smoothstep(0.38, 0.68, density);
    coverage *= smoothstep(0.15, 0.38, rd.y);

    // Cor da nuvem: lado iluminado puxa a cor do sol (quente no entardecer),
    // lado sombreado puxa a cor do horizonte (frio).
    vec3 litColor = mix(vec3(1.0), uSunColor, 0.35) * 1.15;
    vec3 shadowColor = uSkyHorizon * 0.65;
    vec3 cloudCol = mix(shadowColor, litColor, shading);

    // ── Sol ──
    float sunDot = max(dot(rd, normalize(uSunDir)), 0.0);
    float sunGlow = pow(sunDot, 380.0) * 7.0
                  + pow(sunDot, 22.0) * 0.25
                  + pow(sunDot, 5.0) * 0.09;
    sunGlow *= uSunGlow;

    // ── Composite ──
    vec3 col = mix(skyCol, cloudCol, coverage);
    col += uSunColor * sunGlow;

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;
