// The planet beneath the visitor: a day/night Earth with clouds, ocean glint and
// a glowing atmosphere limb. Units: Earth radius R = 100, orbit altitude ALT
// (420 km ≈ 6.6 units; slightly exaggerated so the curve reads well on screen).
import * as THREE from 'three';

export const EARTH = {
  R: 100,
  ALT: 4.6,
  ATMOS: 2.8,                       // thickness of the glowing limb
  orbitSpeed: 0.0009,               // rad/s the ground drifts beneath us (≈ ISS ground speed, visually)
  tilt: 0.9,                        // orbit inclination look (radians) – which way "forward" runs over the map
  sunDir: new THREE.Vector3(0.9, 0.22, -0.38).normalize(),
};

const TEX = {
  day: '/textures/earth_atmos_2048.jpg',
  night: '/textures/earth_lights_2048.png',
  cloud: '/textures/earth_clouds_1024.png',
  spec: '/textures/earth_specular_2048.jpg',
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
  uniform sampler2D dayMap, nightMap, cloudMap, specMap;
  uniform vec3 sunDir; uniform float cloudShift; uniform float hasTex;
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vP);
    float ndl = dot(n, sunDir);
    float dayMix = smoothstep(-0.12, 0.28, ndl);
    vec3 day = mix(vec3(0.05, 0.16, 0.32), texture2D(dayMap, vUv).rgb, hasTex);
    vec3 night = texture2D(nightMap, vUv).rgb * hasTex;
    float cloud = texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).r * hasTex;
    float lit = max(ndl, 0.0);
    vec3 dayCol = day * (0.06 + 1.05 * lit);
    dayCol = mix(dayCol, vec3(0.96, 0.98, 1.0) * (0.04 + 1.0 * lit), cloud * 0.88);
    vec3 h = normalize(sunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 38.0) * texture2D(specMap, vUv).r * (1.0 - cloud) * 0.7;
    vec3 nightCol = night * vec3(1.0, 0.78, 0.48) * 1.5 * (1.0 - cloud * 0.85) + vec3(0.004, 0.008, 0.02);
    vec3 col = mix(nightCol, dayCol, dayMix) + spec * vec3(1.0, 0.92, 0.78) * dayMix;
    // haze: looking through the atmosphere toward the horizon
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
    float sunSide = smoothstep(-0.25, 0.45, ndl);
    vec3 haze = mix(vec3(0.03, 0.06, 0.14), vec3(0.32, 0.56, 1.0), sunSide);
    float terminator = pow(1.0 - abs(ndl), 8.0);
    haze = mix(haze, vec3(1.0, 0.52, 0.28), terminator * 0.55);
    col = mix(col, haze, fres * 0.85);
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
    float glow = pow(1.0 - x, 2.2) * smoothstep(1.0, 0.82, x);
    vec3 up = normalize(closest - center);
    float s = dot(up, sunDir);
    float sun = smoothstep(-0.45, 0.35, s);
    vec3 col = mix(vec3(0.22, 0.42, 1.0), vec3(0.62, 0.82, 1.0), 1.0 - x);
    col = mix(col, vec3(1.0, 0.5, 0.25), pow(1.0 - abs(s), 7.0) * 0.7 * (1.0 - x));
    col *= glow * (0.06 + 1.25 * sun);
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
    dayMap: { value: blank }, nightMap: { value: blank }, cloudMap: { value: blank }, specMap: { value: blank },
    sunDir: { value: EARTH.sunDir }, cloudShift: { value: 0 }, hasTex: { value: 0 },
  };
  let loaded = 0;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  for (const [k, url] of Object.entries(TEX)) {
    loader.load(url, tex => {
      tex.colorSpace = k === 'day' || k === 'night' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = maxAniso; tex.wrapS = THREE.RepeatWrapping;
      uniforms[k + 'Map'].value = tex;
      if (++loaded === 4) uniforms.hasTex.value = 1;
    }, undefined, () => { /* texture failed: the planet stays a soft blue fallback sphere */ });
  }

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 192, 128),
    new THREE.ShaderMaterial({ uniforms, vertexShader: earthVert, fragmentShader: earthFrag }),
  );
  // start over the Atlantic / West Africa so the first view has land, cloud and a terminator
  planet.rotation.y = -1.9; planet.rotation.x = 0.35;
  spin.add(planet);

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R + ATMOS, 128, 96),
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
