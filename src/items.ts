import * as THREE from "three";
import { BLOCKS, World, type Position } from "./world.ts";

type Drop = { id: number; count: number; mesh: THREE.Mesh; vy: number };

/** Creative building remains unlimited; collected blocks are kept separately. */
export class DroppedItems {
  counts = BLOCKS.map(() => 0);
  drops: Drop[] = [];
  private geometry = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  private materials = BLOCKS.map(b => new THREE.MeshLambertMaterial({ color: b.color }));
  private scene: THREE.Scene;
  constructor(scene: THREE.Scene) { this.scene = scene; }

  spawn(id: number, x: number, y: number, z: number, count = 1) {
    if (!Number.isInteger(id) || id < 1 || id > BLOCKS.length) return;
    // Bound draw calls during long building sessions without losing collected value.
    const merge = this.drops.length >= 128 ? this.drops.find(d => d.id === id) : undefined;
    if (merge) { merge.count += count; return; }
    const mesh = new THREE.Mesh(this.geometry, this.materials[id - 1]);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.drops.push({ id, count, mesh, vy: 0 });
  }

  update(dt: number, player: Position, world: World) {
    let picked = 0;
    for (const drop of [...this.drops]) {
      const p = drop.mesh.position;
      drop.vy = Math.max(-10, drop.vy - 15 * dt);
      const nextY = p.y + drop.vy * dt;
      if (world.get(Math.floor(p.x), Math.floor(nextY - 0.12), Math.floor(p.z))) {
        p.y = Math.floor(nextY - 0.12) + 1.12;
        drop.vy = 0;
      } else p.y = Math.max(0.12, nextY);
      drop.mesh.rotation.y += dt;
      if (Math.hypot(p.x - player.x, p.y - (player.y + 0.6), p.z - player.z) < 1.65) {
        this.counts[drop.id - 1] = Math.min(999999, this.counts[drop.id - 1] + drop.count);
        picked += drop.count;
        this.scene.remove(drop.mesh);
        this.drops.splice(this.drops.indexOf(drop), 1);
      }
    }
    return picked;
  }

  clear() {
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops = [];
    this.counts.fill(0);
  }

  serialize() {
    return JSON.stringify({
      counts: this.counts,
      drops: this.drops.map(d => ({ id: d.id, count: d.count, position: d.mesh.position.toArray() })),
    });
  }

  restore(raw: string) {
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.counts) || data.counts.length !== BLOCKS.length ||
          !data.counts.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 999999) ||
          !Array.isArray(data.drops) || data.drops.length > 256) return;
      const valid = data.drops.every((d: { id: number; count: number; position: number[] }) =>
        d && Number.isInteger(d.id) && d.id >= 1 && d.id <= BLOCKS.length &&
        Number.isInteger(d.count) && d.count > 0 && d.count <= 999999 &&
        Array.isArray(d.position) && d.position.length === 3 &&
        d.position.every(n => Number.isFinite(n) && Math.abs(n) < 1000));
      if (!valid) return;
      this.clear();
      this.counts = [...data.counts];
      for (const d of data.drops) this.spawn(d.id, d.position[0], d.position[1], d.position[2], d.count);
    } catch { /* Invalid saved inventory never prevents entering the world. */ }
  }
}
