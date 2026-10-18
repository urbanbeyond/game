export const SIZE = 28;
export const MAX_HEIGHT = 40;
export const BLOCKS = [
  {
    id: 1,
    name: "잔디",
    english: "Grass",
    color: "#7caa52",
    side: "#876543",
    top: "#87b85a",
  },
  {
    id: 2,
    name: "흙",
    english: "Earth",
    color: "#96704f",
    side: "#96704f",
    top: "#ac825d",
  },
  {
    id: 3,
    name: "돌",
    english: "Stone",
    color: "#929b96",
    side: "#929b96",
    top: "#b2b9ac",
  },
  {
    id: 4,
    name: "나무",
    english: "Wood",
    color: "#9e7849",
    side: "#947047",
    top: "#c4a16a",
  },
  {
    id: 5,
    name: "잎",
    english: "Leaves",
    color: "#608d45",
    side: "#608d45",
    top: "#80aa55",
  },
  {
    id: 6,
    name: "모래",
    english: "Sand",
    color: "#d5bd80",
    side: "#d5bd80",
    top: "#e7d29e",
  },
  {
    id: 7,
    name: "벽돌",
    english: "Brick",
    color: "#b77556",
    side: "#b77556",
    top: "#ce9473",
  },
] as const;
export type Cell = [number, number, number];
export type Edit = [...Cell, number];
export const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const hash = (x: number, z: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export function terrainHeight(x: number, z: number): number {
  const river = Math.abs(x - (Math.sin(z * 0.095) * 6 + 2));
  const hills =
    5 +
    Math.sin(x * 0.14) * 1.8 +
    Math.cos(z * 0.13) * 1.5 +
    Math.sin((x + z) * 0.19) * 0.7;
  return river < 2.6 ? 2 : river < 3.8 ? 3 : Math.max(4, Math.floor(hills));
}
export class World {
  blocks = new Map<string, number>();
  edits = new Map<string, Edit>();
  constructor() {
    this.generate();
  }
  get(x: number, y: number, z: number) {
    return this.blocks.get(key(x, y, z)) ?? 0;
  }
  set(x: number, y: number, z: number, type: number) {
    if (type) this.blocks.set(key(x, y, z), type);
    else this.blocks.delete(key(x, y, z));
  }
  valid(x: number, y: number, z: number, type: number) {
    return (
      [x, y, z, type].every(Number.isInteger) &&
      Math.abs(x) <= SIZE &&
      Math.abs(z) <= SIZE &&
      y >= 1 &&
      y < MAX_HEIGHT &&
      type >= 0 &&
      type <= BLOCKS.length
    );
  }
  edit(x: number, y: number, z: number, type: number) {
    if (!this.valid(x, y, z, type)) return false;
    this.set(x, y, z, type);
    this.edits.set(key(x, y, z), [x, y, z, type]);
    return true;
  }
  surface(x: number, z: number) {
    for (let y = MAX_HEIGHT - 1; y >= 0; y--)
      if (this.get(x, y, z)) return y + 1;
    return 4;
  }
  generate() {
    for (let x = -SIZE; x <= SIZE; x++)
      for (let z = -SIZE; z <= SIZE; z++) {
        const h = terrainHeight(x, z);
        for (let y = 0; y <= h; y++)
          this.set(x, y, z, y === h ? (h <= 3 ? 6 : 1) : y < h - 2 ? 3 : 2);
      }
    for (let x = -SIZE + 3; x < SIZE - 3; x += 4)
      for (let z = -SIZE + 3; z < SIZE - 3; z += 4) {
        const h = terrainHeight(x, z);
        if (h < 4 || hash(x, z) < 0.6 || (x > 7 && z > 3 && z < 19)) continue;
        const tall = 4 + Math.floor(hash(z, x) * 2);
        for (let y = 1; y <= tall; y++) this.set(x, h + y, z, 4);
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++)
            for (let dy = -1; dy <= 1; dy++) {
              if (
                Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 4 ||
                (dx === 0 && dz === 0 && dy <= 0)
              )
                continue;
              this.set(x + dx, h + tall + dy, z + dz, 5);
            }
        this.set(x, h + tall + 2, z, 5);
      }
    // A small, deliberately hand-built ruin gives the empty sandbox a starting point.
    const base = terrainHeight(14, 8) + 1;
    for (let x = 11; x <= 17; x++)
      for (let z = 5; z <= 11; z++) {
        for (let y = 1; y < base; y++) this.set(x, y, z, 3);
        this.set(x, base - 1, z, 3);
      }
    for (const x of [12, 16])
      for (let y = 0; y < 4; y++) this.set(x, base + y, 7, 7);
    for (let x = 12; x <= 16; x++) this.set(x, base + 4, 7, 7);
    for (let z = 8; z <= 10; z++) this.set(16, base, z, 7);
    this.set(15, base, 10, 7);
    // A wooden footbridge across the stream.
    const riverX = Math.round(Math.sin(9 * 0.095) * 6 + 2);
    for (let x = riverX - 4; x <= riverX + 4; x++)
      for (let z = 8; z <= 10; z++) this.set(x, 4, z, 4);
  }
  restore(raw: unknown): boolean {
    if (
      !raw ||
      typeof raw !== "object" ||
      !("version" in raw) ||
      raw.version !== 1 ||
      !("edits" in raw) ||
      !Array.isArray(raw.edits) ||
      raw.edits.length > 100000
    )
      return false;
    const edits = raw.edits;
    if (
      !edits.every(
        (e) =>
          Array.isArray(e) &&
          e.length === 4 &&
          this.valid(e[0], e[1], e[2], e[3]),
      )
    )
      return false;
    for (const [x, y, z, type] of edits) this.edit(x, y, z, type);
    return true;
  }
  serialize() {
    return JSON.stringify({ version: 1, edits: [...this.edits.values()] });
  }
}
export function intersectsPlayer(
  cell: Cell,
  position: { x: number; y: number; z: number },
) {
  return (
    cell[0] < position.x + 0.28 &&
    cell[0] + 1 > position.x - 0.28 &&
    cell[1] < position.y + 1.75 &&
    cell[1] + 1 > position.y &&
    cell[2] < position.z + 0.28 &&
    cell[2] + 1 > position.z - 0.28
  );
}
export function collides(world: World, x: number, y: number, z: number) {
  if (Math.abs(x) > SIZE - 0.3 || Math.abs(z) > SIZE - 0.3) return true;
  for (let bx = Math.floor(x - 0.28); bx <= Math.floor(x + 0.28); bx++)
    for (let by = Math.floor(y + 0.001); by <= Math.floor(y + 1.75); by++)
      for (let bz = Math.floor(z - 0.28); bz <= Math.floor(z + 0.28); bz++)
        if (world.get(bx, by, bz)) return true;
  return false;
}
export function trace(
  world: World,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  reach = 7,
): { cell: Cell; adjacent: Cell } | null {
  // Exact grid traversal, including diagonal edges, without a per-mesh raycast.
  const p = [origin.x, origin.y, origin.z];
  const d = [direction.x, direction.y, direction.z];
  const c = p.map(Math.floor) as Cell;
  const step = d.map((v) => (v >= 0 ? 1 : -1));
  const delta = d.map((v) => (v === 0 ? Infinity : Math.abs(1 / v)));
  const next = d.map((v, i) =>
    v === 0 ? Infinity : ((v > 0 ? c[i] + 1 : c[i]) - p[i]) / v,
  );
  let adjacent = [...c] as Cell;
  let distance = 0;
  while (distance <= reach) {
    if (world.get(...c)) return { cell: [...c] as Cell, adjacent };
    const axis =
      next[0] < next[1]
        ? next[0] < next[2]
          ? 0
          : 2
        : next[1] < next[2]
          ? 1
          : 2;
    if (!Number.isFinite(next[axis])) return null;
    adjacent = [...c] as Cell;
    distance = next[axis];
    c[axis] += step[axis];
    next[axis] += delta[axis];
  }
  return null;
}
