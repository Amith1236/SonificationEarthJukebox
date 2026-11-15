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
  const items = chapters.map((ch, i) => {
    const a = -i * step;                      // work i+1 hangs to the right of work i
    const holder = new THREE.Group();
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), -HANG.pitch);
    const ce = Math.cos(HANG.pitch);
    holder.position.set(Math.sin(a) * ce * HANG.R, Math.sin(HANG.pitch) * HANG.R, Math.cos(a) * ce * HANG.R);
    holder.lookAt(0, 0, 0);
    scene.add(holder);

    // the work and its frame are curved: patches of a sphere centred on the visitor,
    // so every part of the screen is the same distance from the eye
    const art = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.BackSide }));
    art.userData.idx = i; art.quaternion.copy(tilt); scene.add(art);
    const frame = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(ch.color), transparent: true, opacity: 0.6, side: THREE.BackSide }));
    frame.quaternion.copy(tilt); scene.add(frame);
    const tc = Math.PI / 2;                 // built level, then tilted down to the eye-line
    const arcSeg = (r, h, arc) => { const ah = h / r; return new THREE.SphereGeometry(r, Math.max(24, Math.round(arc * 60)), 24, a + Math.PI / 2 - arc / 2, arc, tc - ah / 2, ah); };

    // a soft picture-light wash above the work
    const wash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,240,215', 0.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    holder.add(wash);

    // a small caption under the work
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    label.userData.idx = i; holder.add(label);

    const layout = aspect => {
      const w = HANG.H * aspect, h = HANG.H, m = 0.16;
      art.geometry.dispose(); art.geometry = arcSeg(HANG.R, h, w / HANG.R);
      frame.geometry.dispose(); frame.geometry = arcSeg(HANG.R + 0.03, h + m * 2, (w + m * 2) / (HANG.R + 0.03));
      wash.scale.set(w * 1.15, 2.6, 1); wash.position.set(0, h / 2 + 0.2, -0.05);
      label.scale.set(6, 0.75, 1); label.position.set(0, -h / 2 - 0.75, 0);
    };
    layout(1.6);
    loader.load(ch.thumb, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1;
      art.material.map = tex; art.material.needsUpdate = true;
      layout(tex.image.width / tex.image.height);
    });

    const item = { ch, i, angle: a, yaw: a + Math.PI, art, frame, wash, label, glow: 0 };
    item.drawLabel = seen => {
      label.material.map?.dispose();
      label.material.map = canvasTex(1024, 128, (g, w, h) => {
        g.textBaseline = 'middle'; g.textAlign = 'left';
        const num = String(i + 1).padStart(2, '0');
        g.font = '700 58px "Manrope", sans-serif'; const tw = g.measureText(ch.title).width;
        g.font = '500 30px "Manrope", sans-serif'; const sw = seen ? g.measureText('heard').width + 22 : 0;
        let x = (w - (70 + tw + sw)) / 2;
        g.fillStyle = ch.color; g.font = '500 34px "IBM Plex Mono", monospace'; g.fillText(num, x, h / 2 + 2); x += 70;
        g.fillStyle = '#ece9e2'; g.font = '700 58px "Manrope", sans-serif'; g.fillText(ch.title, x, h / 2); x += tw + 22;
        if (seen) { g.fillStyle = 'rgba(236,233,226,.5)'; g.font = '500 30px "Manrope", sans-serif'; g.fillText('heard', x, h / 2 + 6); }
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
