// The works: one framed piece per entry in CHAPTERS (src/content/story.js),
// hung in a ring around the visitor above the Earth, like a gallery in orbit.
import * as THREE from 'three';
import { canvasTex, glowTex } from './sky.js';

export const HANG = {
  R: 11,          // distance from the visitor to each work
  H: 5.0,         // height of every work (width follows the thumbnail's aspect)
  pitch: -0.30,   // works hang at the camera's resting eye-line (radians below level)
};

export function createWindows(scene, chapters, visitedSet) {
  const n = chapters.length, step = (Math.PI * 2) / n;
  const loader = new THREE.TextureLoader();
  const y = Math.tan(HANG.pitch) * HANG.R;
  const items = chapters.map((ch, i) => {
    const a = -i * step;                      // work i+1 hangs to the right of work i
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * HANG.R, y, Math.cos(a) * HANG.R);
    holder.lookAt(0, 0, 0);
    scene.add(holder);

    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x888888 }));
    art.scale.set(HANG.H * 1.6, HANG.H, 1);
    art.userData.idx = i; holder.add(art);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(ch.color), transparent: true, opacity: 0.6 }));
    frame.position.z = -0.02; holder.add(frame);

    // a soft picture-light wash above the work
    const wash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,240,215', 0.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    holder.add(wash);

    // a small caption under the work
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    label.userData.idx = i; holder.add(label);

    const layout = aspect => {
      const w = HANG.H * aspect, h = HANG.H, m = 0.16;
      art.scale.set(w, h, 1);
      frame.scale.set(w + m * 2, h + m * 2, 1);
      wash.scale.set(w * 1.15, 2.6, 1); wash.position.set(0, h / 2 + 0.2, -0.05);
      label.scale.set(4.8, 0.6, 1); label.position.set(-w / 2 + 2.4, -h / 2 - 0.75, 0);
    };
    layout(1.6);
    loader.load(ch.thumb, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      art.material.map = tex; art.material.needsUpdate = true;
      layout(tex.image.width / tex.image.height);
    });

    const item = { ch, i, angle: a, yaw: a + Math.PI, art, frame, wash, label, glow: 0 };
    item.drawLabel = seen => {
      label.material.map?.dispose();
      label.material.map = canvasTex(1024, 128, (g, w, h) => {
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillStyle = ch.color; g.font = '500 34px "IBM Plex Mono", monospace';
        const num = String(i + 1).padStart(2, '0'); g.fillText(num, 0, h / 2 + 2);
        g.fillStyle = '#ece9e2'; g.font = '700 58px "Manrope", sans-serif';
        g.fillText(ch.title, 70, h / 2);
        if (seen) { const tw = g.measureText(ch.title).width; g.fillStyle = 'rgba(236,233,226,.5)'; g.font = '500 30px "Manrope", sans-serif'; g.fillText('heard', 70 + tw + 22, h / 2 + 6); }
      });
      label.material.needsUpdate = true;
    };
    item.drawLabel(visitedSet.has(ch.id));
    return item;
  });
  // redraw captions once the gallery fonts have arrived
  if (document.fonts) Promise.all(['700 58px "Manrope"', '34px "IBM Plex Mono"', '500 30px "Manrope"'].map(f => document.fonts.load(f).catch(() => {})))
    .then(() => items.forEach(it => it.drawLabel(visitedSet.has(it.ch.id))));

  return {
    items,
    pickables: items.flatMap(it => [it.art, it.label]),
    update(dt, t, focusIdx, hoverIdx) {
      for (const s of items) {
        const target = s.i === focusIdx ? 1 : s.i === hoverIdx ? 0.6 : 0;
        s.glow += (target - s.glow) * Math.min(1, dt * 5);
        const k = 0.42 + 0.58 * s.glow; s.art.material.color.setRGB(k, k, k);
        s.frame.material.opacity = 0.55 + 0.45 * s.glow;
        s.wash.material.opacity = 0.16 * s.glow;
        s.label.material.opacity = 0.35 + 0.6 * s.glow;
      }
    },
  };
}
