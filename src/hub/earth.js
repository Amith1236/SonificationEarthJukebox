// The planet beneath the visitor: a day/night Earth with clouds, ocean glint and
// a glowing atmosphere limb. Units: Earth radius R = 100.
// ALT is how high the gallery floats. Real ISS altitude would be ~6.6, but from
// that height you only see a sliver of blurry horizon; ~20 shows the curve of
// the planet with readable continents and clouds.
import * as THREE from 'three';

export const EARTH = {
  R: 100,
  ALT: 20,
  ATMOS: 3.2,                       // thickness of the glowing limb
  orbitSpeed: 0.0012,               // rad/s the ground drifts beneath us
  tilt: 0.9,                        // orbit inclination look (radians)
  sunDir: new THREE.Vector3(0.9, 0.22, -0.38).normalize(),
};

// 4K NASA Blue Marble / Black Marble (via the three.js examples).
// The third map packs bump (r), roughness (g) and clouds (b) into one image.
const TEX = {
  day: '/textures/earth_day_4096.jpg',
  night: '/textures/earth_night_4096.jpg',
  brc: '/textures/earth_bump_roughness_clouds_4096.jpg',
};

const earthVert = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const earthFrag = /* glsl */`
  uniform sampler2D dayMap, nightMap, brcMap;
  uniform vec3 sunDir; uniform float cloudShift; uniform float hasTex;
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vP);
    float ndl = dot(n, sunDir);
    float dayMix = smoothstep(-0.10, 0.22, ndl);
    vec3 day = mix(vec3(0.04, 0.12, 0.26), texture2D(dayMap, vUv).rgb, hasTex);
    vec3 night = texture2D(nightMap, vUv).rgb * hasTex;
    vec3 brc = texture2D(brcMap, vUv).rgb;
    float cloud = smoothstep(0.15, 1.0, texture2D(brcMap, vUv + vec2(cloudShift, 0.0)).b) * hasTex;
    float rough = mix(1.0, brc.g, hasTex);
    float lit = max(ndl, 0.0);
    vec3 dayCol = day * (0.03 + 1.15 * pow(lit, 0.8));
    dayCol = mix(dayCol, vec3(1.0) * (0.02 + 1.05 * lit), cloud * 0.92);
    vec3 h = normalize(sunDir + v);
    float ocean = 1.0 - smoothstep(0.25, 0.6, rough);
    float spec = pow(max(dot(n, h), 0.0), 60.0) * ocean * (1.0 - cloud) * 1.1;
    vec3 nightCol = night * vec3(1.0, 0.8, 0.5) * 1.8 * (1.0 - cloud * 0.9);
    vec3 col = mix(nightCol, dayCol, dayMix) + spec * vec3(1.0, 0.9, 0.75) * dayMix;
    // thin haze only toward the limb, where we look through more air
    float ndv = max(dot(n, v), 0.0);
    float fres = pow(1.0 - ndv, 5.0);
    float sunSide = smoothstep(-0.2, 0.4, ndl);
    vec3 haze = mix(vec3(0.0, 0.01, 0.03), vec3(0.35, 0.6, 1.0), sunSide);
    float terminator = pow(1.0 - abs(ndl), 10.0);
    haze = mix(haze, vec3(1.0, 0.5, 0.25), terminator * 0.5 * sunSide);
    col = mix(col, haze, fres * 0.75);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const atmosVert = /* glsl */`
  varying vec3 vP;
  void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

const atmosFrag = /* glsl */`
  uniform vec3 center; uniform float R; uniform float Ra; uniform vec3 sunDir;
  varying vec3 vP;
  void main() {
    vec3 ro = cameraPosition, rd = normalize(vP - ro);
    vec3 oc = center - ro; float t = dot(oc, rd);
    vec3 closest = ro + rd * max(t, 0.0);
    float hgt = length(closest - center);
    if (hgt < R) discard;                       // behind the planet
    float x = clamp((hgt - R) / (Ra - R), 0.0, 1.0);
    float glow = pow(1.0 - x, 2.6);
    vec3 up = normalize(closest - center);
    float s = dot(up, sunDir);
    float sun = smoothstep(-0.4, 0.3, s);
    vec3 col = mix(vec3(0.18, 0.38, 1.0), vec3(0.6, 0.82, 1.0), pow(1.0 - x, 3.0));
    col = mix(col, vec3(1.0, 0.5, 0.25), pow(1.0 - abs(s), 8.0) * 0.7 * (1.0 - x));
    col *= glow * (0.04 + 1.3 * sun);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function createEarth(scene, renderer) {
  const { R, ALT, ATMOS } = EARTH;
  const center = new THREE.Vector3(0, -(R + ALT), 0);
  const group = new THREE.Group();                 // pivot at Earth's centre
  group.position.copy(center);
  scene.add(group);
  const spin = new THREE.Group();                  // the orbit drift happens here
  spin.rotation.z = EARTH.tilt;
  group.add(spin);

  const loader = new THREE.TextureLoader();
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  const uniforms = {
    dayMap: { value: blank }, nightMap: { value: blank }, brcMap: { value: blank },
    sunDir: { value: EARTH.sunDir }, cloudShift: { value: 0 }, hasTex: { value: 0 },
  };
  let loaded = 0;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const keys = Object.keys(TEX);
  for (const k of keys) {
    loader.load(TEX[k], tex => {
      tex.colorSpace = k === 'brc' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso; tex.wrapS = THREE.RepeatWrapping;
      uniforms[k + 'Map'].value = tex;
      if (++loaded === keys.length) uniforms.hasTex.value = 1;
    }, undefined, () => { /* texture failed: the planet stays a soft blue fallback sphere */ });
  }

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 256, 160),
    new THREE.ShaderMaterial({ uniforms, vertexShader: earthVert, fragmentShader: earthFrag }),
  );
  // start over the Atlantic / West Africa so the first view has land, cloud and a terminator
  planet.rotation.y = -1.9; planet.rotation.x = 0.35;
  spin.add(planet);

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R + ATMOS, 160, 120),
    new THREE.ShaderMaterial({
      uniforms: { center: { value: center }, R: { value: R }, Ra: { value: R + ATMOS }, sunDir: { value: EARTH.sunDir } },
      vertexShader: atmosVert, fragmentShader: atmosFrag,
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  group.add(atmos);

  return {
    center, planet,
    update(dt, reduce) {
      if (reduce) return;
      spin.rotation.x += dt * EARTH.orbitSpeed;
      uniforms.cloudShift.value = (uniforms.cloudShift.value + dt * 0.0000035) % 1;
    },
  };
}
