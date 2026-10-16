// Three.js world viewer: renders decoded voxel data as an instanced-mesh scene.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraKeyframe {
  tick: number;
  x: number; y: number; z: number;
  yaw: number; pitch: number;
}

const BLOCK_COLORS: Record<string, number> = {
  'minecraft:stone': 0x888888, 'minecraft:granite': 0x9c6d5c, 'minecraft:diorite': 0xc0c0c0,
  'minecraft:andesite': 0x7a7a7a, 'minecraft:grass_block': 0x5fa94a, 'minecraft:dirt': 0x8b5a2b,
  'minecraft:coarse_dirt': 0x7a4f2a, 'minecraft:podzol': 0x6b4423, 'minecraft:mud': 0x4a3a2a,
  'minecraft:cobblestone': 0x707070, 'minecraft:oak_planks': 0xb89a6b, 'minecraft:spruce_planks': 0x6b4f2a,
  'minecraft:birch_planks': 0xd4c9a8, 'minecraft:oak_log': 0x5a4a2a, 'minecraft:spruce_log': 0x3a2a1a,
  'minecraft:oak_leaves': 0x3a7a2a, 'minecraft:spruce_leaves': 0x2a5a1a, 'minecraft:birch_leaves': 0x5a9a3a,
  'minecraft:sand': 0xd8c898, 'minecraft:red_sand': 0xc87a4a, 'minecraft:gravel': 0x8a8078,
  'minecraft:glass': 0xaaccdd, 'minecraft:water': 0x3a5acc, 'minecraft:lava': 0xe84a1a,
  'minecraft:bedrock': 0x2a2a2a, 'minecraft:sandstone': 0xd8c898, 'minecraft:red_sandstone': 0xc87a4a,
  'minecraft:stone_bricks': 0x808080, 'minecraft:mossy_cobblestone': 0x5a7a4a, 'minecraft:obsidian': 0x1a0a2a,
  'minecraft:ice': 0x99ccee, 'minecraft:snow_block': 0xffffff, 'minecraft:clay': 0x9aa8b8,
  'minecraft:diamond_block': 0x4ad8d8, 'minecraft:gold_block': 0xf8d83a, 'minecraft:iron_block': 0xd8d8d8,
  'minecraft:netherrack': 0x7a1a1a, 'minecraft:nether_bricks': 0x3a1a1a, 'minecraft:deepslate': 0x3a3a42,
  'minecraft:cobbled_deepslate': 0x3a3a42, 'minecraft:polished_deepslate': 0x4a4a52,
  'minecraft:deepslate_bricks': 0x3a3a42, 'minecraft:deepslate_tiles': 0x4a4a52, 'minecraft:calcite': 0xd8d8d0,
  'minecraft:tuff': 0x6a6a6a, 'minecraft:dripstone_block': 0x8a7a6a, 'minecraft:amethyst_block': 0x9a6aaa,
  'minecraft:copper_block': 0xb8733a, 'minecraft:end_stone': 0xd8d8a8, 'minecraft:sculk': 0x1a3a3a,
  'minecraft:blackstone': 0x2a2a2a, 'minecraft:polished_blackstone': 0x3a3a3a,
  'minecraft:netherite_block': 0x4a4a5a, 'minecraft:packed_ice': 0x88bbd8, 'minecraft:blue_ice': 0x66aacc,
  'minecraft:moss_block': 0x4a8a3a, 'minecraft:chest': 0x9a7a4a, 'minecraft:crafting_table': 0x9a7a4a,
};

function colorFor(name: string): number {
  if (BLOCK_COLORS[name] !== undefined) return BLOCK_COLORS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return 0x505050 + ((h & 0x3f3f3f));
}

export class WorldViewer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  container: HTMLElement;
  voxelGroup: THREE.Group;
  cameraPath: CameraKeyframe[] = [];
  tick = 0;
  rafId = 0;
  disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 400);
    this.camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 80, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 200, 50);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);
    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  setChunks(chunks: any[], stateName: (id: number) => string, minY: number) {
    while (this.voxelGroup.children.length) {
      const c = this.voxelGroup.children.pop()!;
      (c as THREE.Mesh).geometry?.dispose?.();
    }
    const byBlock: Record<string, [number, number, number][]> = {};
    for (const c of chunks) {
      for (const s of c.sections) {
        if (!s.blocks) continue;
        const baseY = minY + s.sectionY * 16;
        for (let i = 0; i < 4096; i++) {
          const sid = s.blocks[i];
          if (sid === 0) continue;
          const name = stateName(sid);
          if (name === 'minecraft:air') continue;
          const x = i & 0xf, y = (i >> 8) & 0xf, z = (i >> 4) & 0xf;
          (byBlock[name] ||= []).push([c.chunkX * 16 + x, baseY + y, c.chunkZ * 16 + z]);
        }
      }
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const [name, positions] of Object.entries(byBlock)) {
      if (positions.length === 0) continue;
      const mat = new THREE.MeshLambertMaterial({ color: colorFor(name) });
      const mesh = new THREE.InstancedMesh(boxGeo, mat, positions.length);
      const m = new THREE.Matrix4();
      for (let i = 0; i < positions.length; i++) {
        const [x, y, z] = positions[i];
        m.setPosition(x + 0.5, y + 0.5, z + 0.5);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.voxelGroup.add(mesh);
    }
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const positions of Object.values(byBlock)) {
      for (const [x, y, z] of positions) { cx += x; cy += y; cz += z; n++; }
    }
    if (n > 0) {
      cx /= n; cy /= n; cz /= n;
      this.camera.position.set(cx + 30, cy + 40, cz + 30);
      this.controls.target.set(cx, cy, cz);
    }
  }

  setCameraPath(path: CameraKeyframe[]) { this.cameraPath = path; }

  setTick(tick: number) {
    this.tick = tick;
    if (this.cameraPath.length === 0) return;
    let best = this.cameraPath[0];
    for (const k of this.cameraPath) {
      if (Math.abs(k.tick - tick) < Math.abs(best.tick - tick)) best = k;
    }
    this.camera.position.set(best.x, best.y + 1.62, best.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = (best.yaw + 180) * Math.PI / 180;
    this.camera.rotation.x = -best.pitch * Math.PI / 180;
    this.controls.enabled = false;
  }

  loop = () => {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
