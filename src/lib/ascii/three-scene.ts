import * as THREE from "three";
import type { ShapeKind, StudioState } from "./types";

export type OrbitState = { azimuth: number; polar: number; radius: number };

/**
 * Off-screen Three.js layer. Renders the selected primitive into a low
 * resolution render target matching the ASCII grid, then reads the lit
 * luminance back so it can drive the character ramp directly.
 */
export class ThreeLayer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private target: THREE.WebGLRenderTarget;
  private light = new THREE.DirectionalLight(0xffffff, 2);
  private group = new THREE.Group();
  private mesh: THREE.Object3D | null = null;
  private shapeKind: ShapeKind | null = null;
  private pixels = new Uint8Array(4);
  private w = 1;
  private h = 1;

  constructor() {
    const canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.renderer.setClearColor(0x000000, 0);
    this.target = new THREE.WebGLRenderTarget(1, 1);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    this.scene.add(this.light);
    this.scene.add(this.group);
  }

  setSize(w: number, h: number, displayAspect: number) {
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.renderer.setSize(w, h, false);
      this.target.setSize(w, h);
      this.pixels = new Uint8Array(w * h * 4);
    }
    if (this.camera.aspect !== displayAspect) {
      this.camera.aspect = displayAspect;
      this.camera.updateProjectionMatrix();
    }
  }

  private buildShape(kind: ShapeKind) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.08,
    });
    let obj: THREE.Object3D;
    if (kind === "torusKnot") {
      obj = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.34, 180, 28), material);
    } else if (kind === "sphere") {
      obj = new THREE.Mesh(new THREE.SphereGeometry(1.35, 64, 48), material);
    } else {
      const blobs = new THREE.Group();
      const offsets: [number, number, number, number][] = [
        [0, 0, 0, 1],
        [0.95, 0.35, 0.2, 0.72],
        [-0.85, -0.3, 0.35, 0.66],
        [0.2, -0.9, -0.3, 0.6],
        [-0.25, 0.85, -0.4, 0.55],
      ];
      offsets.forEach(([x, y, z, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 32), material);
        m.position.set(x, y, z);
        blobs.add(m);
      });
      obj = blobs;
    }
    this.group.add(obj);
    this.mesh = obj;
    this.shapeKind = kind;
  }

  /** Renders a frame and writes luminance (0..1) + coverage mask into the buffers. */
  render(
    lum: Float32Array,
    mask: Uint8Array,
    s: StudioState,
    orbit: OrbitState,
    time: number,
  ) {
    if (this.shapeKind !== s.shape) this.buildShape(s.shape);
    const obj = this.mesh;
    if (!obj) return;

    obj.rotation.z = time * s.zRotation;
    obj.rotation.x = Math.sin(time * 0.35 * s.waveFrequency) * 0.35;
    if (this.shapeKind === "metaballs") {
      obj.children.forEach((child, i) => {
        const p = 0.6 + i * 0.4;
        child.position.x = Math.sin(time * p + i) * 0.9;
        child.position.y = Math.cos(time * p * 0.8 + i * 1.7) * 0.85;
        child.position.z = Math.sin(time * p * 0.6 + i * 2.3) * 0.7;
      });
    }

    const { azimuth, polar, radius } = orbit;
    const sp = Math.max(0.05, Math.min(Math.PI - 0.05, polar));
    this.camera.position.set(
      radius * Math.sin(sp) * Math.sin(azimuth),
      radius * Math.cos(sp),
      radius * Math.sin(sp) * Math.cos(azimuth),
    );
    this.camera.lookAt(0, 0, 0);

    this.light.position.set(s.lightX, s.lightY, s.lightZ);
    this.light.intensity = s.lightIntensity;

    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, this.w, this.h, this.pixels);
    this.renderer.setRenderTarget(null);

    const px = this.pixels;
    for (let y = 0; y < this.h; y++) {
      // WebGL reads bottom-up; flip into grid order.
      const src = (this.h - 1 - y) * this.w;
      const dst = y * this.w;
      for (let x = 0; x < this.w; x++) {
        const i = (src + x) * 4;
        const a = px[i + 3]!;
        mask[dst + x] = a > 8 ? 1 : 0;
        lum[dst + x] =
          a > 8 ? (px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114) / 255 : 0;
      }

    }
  }

  dispose() {
    this.target.dispose();
    this.renderer.dispose();
  }
}
