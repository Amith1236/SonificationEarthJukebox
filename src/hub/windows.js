// The chapter "windows": curved holographic screens floating around the visitor
// above the Earth. One per entry in CHAPTERS (src/content/story.js).
import * as THREE from 'three';
import { canvasTex, glowTex } from './sky.js';

const R_SCR = 10.5, H_SCR = 3.8, Y_SCR = -0.35;
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); };

export function createWindows(scene, chapters, visitedSet) {
  const n = chapters.length, step = (Math.PI * 2) / n, ARC = Math.min(0.82, step * 0.78);
  const loader = new THREE.TextureLoader();
  const items = chapters.map((ch, i) => {
    const a = -i * step;                      // chapter i+1 sits to the right of chapter i
    const col = new THREE.Color(ch.color);
    const seg = (r, h, arc, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true, a - arc / 2, arc), mat); m.position.y = Y_SCR; scene.add(m); return m; };

    const frame = seg(R_SCR + 0.08, H_SCR + 0.3, ARC + 0.035, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.BackSide, depthWrite: false }));
    seg(R_SCR + 0.04, H_SCR + 0.08, ARC + 0.01, new THREE.MeshBasicMaterial({ color: 0x020308, side: THREE.BackSide, transparent: true, opacity: 0.92 }));
    const tex = loader.load(ch.thumb); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: 0xbbbbbb, transparent: true });
    const scr = seg(R_SCR, H_SCR, ARC, mat); scr.userData.idx = i;

    // soft halo behind the window
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(hexRgb(ch.color), 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.18 }));
    halo.position.set(Math.sin(a) * (R_SCR + 1.5), Y_SCR, Math.cos(a) * (R_SCR + 1.5)); halo.scale.set(16, 9, 1); scene.add(halo);

    // a thread of light falling from the window toward the planet
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 9), new THREE.MeshBasicMaterial({
      map: canvasTex(4, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(${hexRgb(ch.color)},.9)`); gr.addColorStop(1, `rgba(${hexRgb(ch.color)},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(Math.sin(a) * R_SCR * 0.99, Y_SCR - H_SCR / 2 - 4.5, Math.cos(a) * R_SCR * 0.99); beam.lookAt(0, beam.position.y, 0); scene.add(beam);

    const label = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.65), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    label.position.set(Math.sin(a) * (R_SCR - 0.3), Y_SCR + H_SCR / 2 + 1.0, Math.cos(a) * (R_SCR - 0.3));
    label.lookAt(0, label.position.y - 0.6, 0); label.userData.idx = i; scene.add(label);
    const item = { ch, i, angle: a, yaw: a + Math.PI, scr, mat, frame, halo, beam, label, glow: 0 };
    item.drawLabel = seen => {
      label.material.map?.dispose();
      label.material.map = canvasTex(1024, 256, (g, w) => {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = ch.color; g.shadowBlur = 28; g.fillStyle = '#ffffff'; g.font = '700 100px "Space Grotesk", system-ui, sans-serif';
        g.fillText(ch.title.toUpperCase(), w / 2, 104, w - 40);
        g.shadowBlur = 10; g.fillStyle = ch.color; g.font = '500 34px "JetBrains Mono", monospace';
        g.fillText(`CHAPTER 0${i + 1}  ·  ${ch.subtitle.toUpperCase()}${seen ? '  ·  ✓ HEARD' : ''}`, w / 2, 204, w - 40);
      });
      label.material.needsUpdate = true;
    };
    item.drawLabel(visitedSet.has(ch.id));
    return item;
  });

  return {
    items,
    pickables: items.flatMap(it => [it.scr, it.label]),
    update(dt, t, focusIdx, hoverIdx, reduce) {
      for (const s of items) {
        const target = s.i === focusIdx ? 1 : s.i === hoverIdx ? 0.6 : 0;
        s.glow += (target - s.glow) * Math.min(1, dt * 6);
        const pulse = reduce ? 0 : 0.08 * Math.sin(t * 2.2);
        s.frame.material.opacity = 0.25 + 0.6 * s.glow + pulse * s.glow;
        s.halo.material.opacity = 0.08 + 0.22 * s.glow;
        s.beam.material.opacity = 0.15 + 0.55 * s.glow;
        const k = 0.6 + 0.4 * s.glow; s.mat.color.setRGB(k, k, k);
        s.label.material.opacity = 0.55 + 0.45 * s.glow;
      }
    },
  };
}
