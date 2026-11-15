// Stars, the Milky Way, the Sun and the Moon around the visitor.
import * as THREE from 'three';
import { EARTH } from './earth.js';

const R_SKY = 900;

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function glowTex(rgb, soft = 0.35) {
  return canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(soft, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

export function createSky(scene, renderer) {
  const sky = new THREE.Group(); scene.add(sky);

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uTw: { value: 1 } },
    vertexShader: `attribute float size; attribute vec3 color; attribute float phase; varying vec3 vC; varying float vA;
      uniform float uTime, uPx, uTw;
      void main(){ vC = color; float tw = 0.75 + 0.25 * sin(uTime * (1.1 + fract(phase * 7.3) * 2.2) + phase); vA = mix(1.0, tw, uTw);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uPx; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const field = (count, pick, sizeFn, colorFn) => {
    const pos = new Float32Array(count * 3), size = new Float32Array(count), col = new Float32Array(count * 3), ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const d = pick(); pos.set([d.x * R_SKY, d.y * R_SKY, d.z * R_SKY], i * 3);
      size[i] = sizeFn(); col.set(colorFn(), i * 3); ph[i] = Math.random() * 6.283;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    return new THREE.Points(geo, starMat);
  };
  const anyDir = () => new THREE.Vector3().randomDirection();
  const starColor = () => { const r = Math.random(); return r < 0.12 ? [0.7, 0.8, 1] : r < 0.75 ? [1, 1, 1] : r < 0.93 ? [1, 0.93, 0.78] : [1, 0.72, 0.6]; };
  sky.add(field(7000, anyDir, () => 1.4 + Math.pow(Math.random(), 7) * 6, starColor));
  const tilt = new THREE.Euler(1.05, 0.4, 0.2);
  const bandDir = () => {
    const t = Math.random() * Math.PI * 2, s = 0.13;
    return new THREE.Vector3(Math.cos(t) + (Math.random() - .5) * s * 2, (Math.random() + Math.random() + Math.random() - 1.5) * s, Math.sin(t) + (Math.random() - .5) * s * 2).normalize().applyEuler(tilt);
  };
  sky.add(field(14000, bandDir, () => 1.3 + Math.pow(Math.random(), 4) * 3, () => { const k = 0.65 + Math.random() * 0.3; return [k, k * 0.97, k * 1.08]; }));
  [[0.55, '201,166,255', 300], [0.2, '124,196,255', 260], [0.85, '255,180,120', 220], [0.4, '91,227,160', 200], [0.7, '124,196,255', 240]].forEach(([u, rgb, s]) => {
    const t = u * Math.PI * 2, p = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).applyEuler(tilt).multiplyScalar(R_SKY - 20);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(rgb), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2 }));
    sp.position.copy(p); sp.scale.set(s, s * 0.6, 1); sky.add(sp);
  });

  // The Sun: a bright core with a wide soft glare, placed along EARTH.sunDir
  const sun = new THREE.Group(); scene.add(sun);
  sun.position.copy(EARTH.sunDir).multiplyScalar(R_SKY * 0.8);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,250,235', 0.12), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.scale.set(70, 70, 1); sun.add(core);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,220,170', 0.25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
  glare.scale.set(420, 420, 1); sun.add(glare);

  // The Moon
  const moonTex = new THREE.TextureLoader().load('/textures/moon_1024.jpg'); moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 32), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 }));
  moon.position.set(-380, 210, -560); scene.add(moon);
  const light = new THREE.DirectionalLight(0xfff4e0, 2.2); light.position.copy(EARTH.sunDir).multiplyScalar(100); scene.add(light);
  scene.add(new THREE.AmbientLight(0x223355, 0.25));

  // shooting stars burning up in the atmosphere below us
  const meteor = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
  scene.add(meteor); let met = null, nextMet = 9;

  return {
    starMat,
    update(dt, t, reduce) {
      starMat.uniforms.uTime.value = t;
      starMat.uniforms.uTw.value = reduce ? 0 : 1;
      if (!reduce) sky.rotation.y += dt * 0.002;
      if (reduce) { meteor.material.opacity = 0; return; }
      nextMet -= dt;
      if (nextMet <= 0 && !met) {
        const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 18;
        met = { s: new THREE.Vector3(Math.sin(a) * d, -EARTH.ALT + 3.2, Math.cos(a) * d), d: new THREE.Vector3(Math.random() - .5, -0.12, Math.random() - .5).normalize(), t: 0 };
        nextMet = 10 + Math.random() * 16;
      }
      if (met) {
        met.t += dt; const q = met.t / 0.8;
        const head = met.s.clone().addScaledVector(met.d, q * 7), tail = met.s.clone().addScaledVector(met.d, Math.max(0, q * 7 - 2.2));
        meteor.geometry.setFromPoints([tail, head]); meteor.material.opacity = Math.sin(Math.min(1, q) * Math.PI) * 0.9;
        if (q >= 1) { met = null; meteor.material.opacity = 0; }
      }
    },
  };
}
