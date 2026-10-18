import * as THREE from "three";

// The supplied 300px sticker, transcribed as its original 11 × 6 pixel motif.
// These are model cells, not a replacement image or a dependency on a local D: drive.
export const FACE_PIXELS = [
  "OOKOOOOOKOO",
  "OKOKKKKKOKO",
  "KOOOWWWOOOK",
  "KOOKOWOKOOK",
  "KOOOOOOOOOK",
  "KKKKKKKKKKK",
] as const;
export const CHARACTER_COLORS = { O: "#ff8a00", K: "#080b07", W: "#fffdf0" };
export function portraitMarkup() {
  return `<span class="pixel-portrait" role="img" aria-label="주황색 픽셀 캐릭터 히나냥">${FACE_PIXELS.flatMap((row) => [...row].map((pixel) => `<i style="background:${CHARACTER_COLORS[pixel as keyof typeof CHARACTER_COLORS]}"></i>`)).join("")}</span>`;
}

export class ForestCharacter {
  root = new THREE.Group();
  body = new THREE.Group();
  leftFoot = new THREE.Group();
  rightFoot = new THREE.Group();
  tail = new THREE.Group();
  heading = 0.55;
  state: "idle" | "walk" | "run" | "jump" = "idle";
  gait = 0;
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private orange = new THREE.MeshLambertMaterial({
    color: "#ff8a00",
    emissive: "#a94700",
    emissiveIntensity: 0.12,
  });
  private dark = new THREE.MeshLambertMaterial({ color: "#171b13" });
  private cream = new THREE.MeshLambertMaterial({ color: "#fff1d4" });

  constructor() {
    this.root.name = "Hinanyang";
    this.root.add(this.body, this.leftFoot, this.rightFoot);
    this.root.rotation.y = this.heading;
    // Keep the sticker's broad rectangular silhouette, with small paws and a tail.
    this.box(this.body, this.orange, [0, 0.43, 0], [0.51, 0.38, 0.4]);
    this.box(this.body, this.cream, [0, 0.4, 0.205], [0.27, 0.23, 0.015]);
    this.box(this.body, this.orange, [0, 0.88, 0], [0.99, 0.54, 0.53]);
    this.box(this.body, this.dark, [0, 0.655, 0], [0.99, 0.09, 0.55]);
    // Back markings make the character recognizable while the camera follows it.
    for (const x of [-0.27, 0, 0.27]) {
      this.box(
        this.body,
        this.dark,
        [x, 0.995, -0.272],
        [0.09, x === 0 ? 0.3 : 0.18, 0.012],
      );
    }
    const pixelGeometry = new THREE.BoxGeometry(0.09, 0.09, 0.018);
    const matrix = new THREE.Matrix4();
    for (const [symbol, color] of Object.entries(CHARACTER_COLORS)) {
      const cells = FACE_PIXELS.flatMap((row, y) =>
        [...row].flatMap((p, x) => (p === symbol ? [[x, y]] : [])),
      );
      const pixels = new THREE.InstancedMesh(
        pixelGeometry,
        new THREE.MeshBasicMaterial({ color }),
        cells.length,
      );
      cells.forEach(([x, y], i) => {
        matrix.makeTranslation((x - 5) * 0.09, 1.105 - y * 0.09, 0.275);
        pixels.setMatrixAt(i, matrix);
      });
      pixels.instanceMatrix.needsUpdate = true;
      this.body.add(pixels);
    }
    this.leftFoot.position.set(-0.19, 0.16, 0);
    this.rightFoot.position.set(0.19, 0.16, 0);
    for (const foot of [this.leftFoot, this.rightFoot]) {
      this.box(foot, this.orange, [0, 0.01, 0], [0.2, 0.29, 0.26]);
      this.box(foot, this.dark, [0, -0.11, 0.035], [0.21, 0.08, 0.33]);
    }
    this.tail.position.set(0.15, 0.34, -0.21);
    this.body.add(this.tail);
    this.box(this.tail, this.orange, [0, 0.03, -0.14], [0.16, 0.16, 0.3]);
    this.box(this.tail, this.orange, [0.08, 0.13, -0.32], [0.16, 0.3, 0.16]);
    this.box(this.tail, this.dark, [0.08, 0.3, -0.32], [0.16, 0.12, 0.16]);
  }
  private box(
    group: THREE.Group,
    material: THREE.Material,
    position: number[],
    size: number[],
  ) {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  update(
    dt: number,
    time: number,
    position: THREE.Vector3,
    motion: THREE.Vector3,
    grounded: boolean,
  ) {
    this.root.position.copy(position);
    const speed = Math.hypot(motion.x, motion.z);
    this.state = !grounded
      ? "jump"
      : speed > 5
        ? "run"
        : speed > 0.15
          ? "walk"
          : "idle";
    if (speed > 0.15) {
      const desired = Math.atan2(motion.x, motion.z);
      const delta = Math.atan2(
        Math.sin(desired - this.heading),
        Math.cos(desired - this.heading),
      );
      this.heading += delta * (1 - Math.exp(-15 * dt));
    }
    this.root.rotation.y = this.heading;
    this.gait += speed * dt * 3.7;
    const walking = grounded && speed > 0.15;
    const stride = walking ? Math.sin(this.gait) * 0.58 : 0;
    this.leftFoot.rotation.x = stride;
    this.rightFoot.rotation.x = -stride;
    this.body.position.y = walking
      ? Math.abs(Math.sin(this.gait)) * 0.045
      : Math.sin(time * 2.3) * 0.013;
    this.body.rotation.z = walking ? Math.sin(this.gait) * 0.035 : 0;
    this.body.rotation.x = !grounded ? -0.09 : walking ? 0.06 : 0;
    this.tail.rotation.z = Math.sin(time * 4 + this.gait * 0.3) * 0.2;
    this.tail.rotation.x = Math.sin(time * 3) * 0.15;
  }
}
