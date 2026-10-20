import * as THREE from "three";
import { BLOCKS, hash, World, type Cell } from "./world.ts";
import { ForestCharacter } from "./character.ts";

const faces = [
  {
    n: [1, 0, 0],
    c: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    n: [-1, 0, 0],
    c: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
    ],
  },
  {
    n: [0, 1, 0],
    c: [
      [0, 1, 1],
      [1, 1, 1],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
  {
    n: [0, -1, 0],
    c: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
  },
  {
    n: [0, 0, 1],
    c: [
      [0, 0, 1],
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
  },
  {
    n: [0, 0, -1],
    c: [
      [1, 0, 0],
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
];
function texture(type: number) {
  const block = BLOCKS[type - 1];
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  for (let tile = 0; tile < 3; tile++) {
    const color = new THREE.Color(tile === 1 ? block.top : block.side);
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        let c = color.clone();
        if (type === 1 && tile === 0 && y < 3 + Math.floor(hash(x, 3) * 3))
          c = new THREE.Color(block.top);
        c.multiplyScalar(0.85 + hash(x + type * 10, y + tile * 20) * 0.25);
        if (type === 4 && tile !== 1 && x % 4 === 0) c.multiplyScalar(0.8);
        if (type === 7 && (y % 8 === 0 || (x + (y < 8 ? 0 : 8)) % 16 === 0))
          c = new THREE.Color("#d4bc98");
        ctx.fillStyle = `#${c.getHexString()}`;
        ctx.fillRect(tile * 16 + x, y, 1, 1);
      }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestMipmapLinearFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
export class GameScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 300);
  terrain = new THREE.Group();
  clouds = new THREE.Group();
  character = new ForestCharacter();
  forestDetails = new THREE.Group();
  private detailCube = new THREE.BoxGeometry(1, 1, 1);
  private detailMaterials = ["#6f9346", "#eae9cc", "#ffc25c", "#c3704f"].map(
    (color) => new THREE.MeshLambertMaterial({ color }),
  );
  materials = BLOCKS.map(
    (b) =>
      new THREE.MeshLambertMaterial({ map: texture(b.id), vertexColors: true }),
  );
  outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
    new THREE.LineBasicMaterial({ color: "#fff9db", depthTest: true }),
  );
  water: THREE.Mesh;
  sun: THREE.DirectionalLight;
  constructor(container: HTMLElement, world: World) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !matchMedia("(pointer: coarse)").matches,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#bcd9dd");
    this.renderer.domElement.setAttribute(
      "aria-label",
      "브릭랜드 3D 블록 월드",
    );
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color("#bcd9dd");
    this.scene.fog = new THREE.Fog("#bcd9dd", 38, 115);
    this.scene.add(new THREE.HemisphereLight("#f3f7e8", "#6c765a", 2.4));
    this.sun = new THREE.DirectionalLight("#fff0cf", 2.7);
    this.sun.position.set(-20, 45, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -45,
      right: 45,
      top: 45,
      bottom: -45,
      near: 1,
      far: 120,
    });
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.bias = -0.0001;
    this.scene.add(this.sun);
    this.scene.add(
      this.terrain,
      this.outline,
      this.clouds,
      this.character.root,
      this.forestDetails,
    );
    this.outline.visible = false;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshPhongMaterial({
        color: "#6bb6bf",
        transparent: true,
        opacity: 0.78,
        shininess: 90,
        specular: "#d0ecdf",
      }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 3.36;
    this.scene.add(this.water);
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: "#fffbed" });
    const cube = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 12; i++) {
      const group = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const mesh = new THREE.Mesh(cube, cloudMaterial);
        mesh.position.set(j * 2.7, (j % 2) * 0.4, (j % 2) * 1.8);
        mesh.scale.set(4, 1.1 + hash(i, j), 3);
        group.add(mesh);
      }
      group.position.set(
        (hash(i, 4) - 0.5) * 150,
        25 + hash(i, 5) * 12,
        (hash(i, 6) - 0.5) * 140,
      );
      this.clouds.add(group);
    }
    this.camera.rotation.order = "YXZ";
    this.rebuild(world);
    window.addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }
  rebuild(world: World) {
    for (const mesh of [...this.terrain.children] as THREE.Mesh[]) {
      mesh.geometry.dispose();
      this.terrain.remove(mesh);
    }
    const data = BLOCKS.map(() => ({
      positions: [] as number[],
      normals: [] as number[],
      uvs: [] as number[],
      colors: [] as number[],
    }));
    for (const [k, type] of world.blocks) {
      const [x, y, z] = k.split(",").map(Number);
      const d = data[type - 1];
      for (const { n, c } of faces) {
        if (world.get(x + n[0], y + n[1], z + n[2])) continue;
        const tile = n[1] === 1 ? 1 : n[1] === -1 ? 2 : 0;
        const brightness = 0.94 + hash(x + y, z) * 0.06;
        for (const i of [0, 1, 2, 2, 1, 3]) {
          d.positions.push(x + c[i][0], y + c[i][1], z + c[i][2]);
          d.normals.push(...n);
          d.uvs.push(
            (tile + (i % 2 ? 0.995 : 0.005)) / 3,
            i < 2 ? 0.005 : 0.995,
          );
          d.colors.push(brightness, brightness, brightness);
        }
      }
    }
    data.forEach((d, i) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(d.positions, 3),
      );
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(d.normals, 3),
      );
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(d.uvs, 2));
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(d.colors, 3),
      );
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.materials[i]);
      mesh.castShadow = mesh.receiveShadow = true;
      this.terrain.add(mesh);
    });
    this.rebuildForest(world);
  }
  private rebuildForest(world: World) {
    for (const child of [
      ...this.forestDetails.children,
    ] as THREE.InstancedMesh[]) {
      child.dispose();
      this.forestDetails.remove(child);
    }
    const batches = this.detailMaterials.map(() => [] as THREE.Matrix4[]);
    const add = (
      material: number,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      const matrix = new THREE.Matrix4().makeScale(sx, sy, sz);
      matrix.setPosition(x, y, z);
      batches[material].push(matrix);
    };
    // Cosmetic growth only: it neither changes saved blocks nor blocks movement.
    for (const [key, type] of world.blocks) {
      if (type !== 1) continue;
      const [x, y, z] = key.split(",").map(Number);
      if (world.get(x, y + 1, z) || world.get(x, y + 2, z)) continue;
      const chance = hash(x * 3 + 8, z * 3 - 7);
      if (chance < 0.69) continue;
      const px = x + 0.3 + hash(x, z + 1) * 0.4,
        pz = z + 0.3 + hash(z, x - 1) * 0.4;
      const ground = y + 1;
      if (chance > 0.95) {
        add(1, px, ground + 0.1, pz, 0.09, 0.2, 0.09);
        add(3, px, ground + 0.22, pz, 0.27, 0.1, 0.27);
        add(1, px + 0.04, ground + 0.275, pz - 0.03, 0.065, 0.015, 0.065);
      } else if (chance > 0.84) {
        add(0, px, ground + 0.14, pz, 0.035, 0.28, 0.035);
        add(1, px, ground + 0.29, pz, 0.28, 0.045, 0.09);
        add(1, px, ground + 0.29, pz, 0.09, 0.045, 0.28);
        add(2, px, ground + 0.32, pz, 0.085, 0.05, 0.085);
      } else {
        add(0, px, ground + 0.13, pz, 0.045, 0.26, 0.045);
        add(0, px - 0.09, ground + 0.08, pz, 0.045, 0.16, 0.045);
        add(0, px + 0.09, ground + 0.1, pz, 0.045, 0.2, 0.045);
      }
    }
    batches.forEach((matrices, i) => {
      const mesh = new THREE.InstancedMesh(
        this.detailCube,
        this.detailMaterials[i],
        matrices.length,
      );
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.forestDetails.add(mesh);
    });
  }
  highlight(cell?: Cell) {
    this.outline.visible = !!cell;
    if (cell)
      this.outline.position.set(cell[0] + 0.5, cell[1] + 0.5, cell[2] + 0.5);
  }
  render(time: number) {
    this.clouds.position.x = Math.sin(time * 0.012) * 6;
    this.water.position.y = 3.36 + Math.sin(time * 0.7) * 0.025;
    this.renderer.render(this.scene, this.camera);
  }
  quality(high: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.75 : 1));
    this.renderer.shadowMap.enabled = high;
    this.materials.forEach((m) => {
      m.needsUpdate = true;
    });
  }
}
