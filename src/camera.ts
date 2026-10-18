import * as THREE from "three";
import {
  cameraClearance,
  PLAYER_HEIGHT,
  World,
  type Position,
} from "./world.ts";

export type CameraMode = "third" | "first";
export class PlayerCamera {
  mode: CameraMode = "third";
  distance = 5.4;
  private focus = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private backwards = new THREE.Vector3();

  toggle() {
    this.mode = this.mode === "third" ? "first" : "third";
  }
  update(
    camera: THREE.PerspectiveCamera,
    world: World,
    player: Position,
    yaw: number,
    pitch: number,
    dt: number,
  ) {
    this.focus.set(player.x, player.y + PLAYER_HEIGHT - 0.15, player.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    if (this.mode === "first") {
      camera.position.copy(this.focus);
      camera.updateMatrixWorld();
      return;
    }
    // A slight shoulder offset leaves the crosshair clear of the character.
    this.offset.set(
      Math.sin(yaw) * Math.cos(pitch) * 5.4 + Math.cos(yaw) * 0.65,
      -Math.sin(pitch) * 5.4,
      Math.cos(yaw) * Math.cos(pitch) * 5.4 - Math.sin(yaw) * 0.65,
    );
    const desired = this.offset.length();
    this.backwards.copy(this.offset).normalize();
    const safe = cameraClearance(world, this.focus, this.backwards, desired);
    // Snap inward to avoid clipping; ease back out after an obstruction clears.
    this.distance =
      safe < this.distance
        ? safe
        : THREE.MathUtils.lerp(this.distance, safe, 1 - Math.exp(-7 * dt));
    camera.position
      .copy(this.focus)
      .addScaledVector(this.backwards, this.distance);
    camera.updateMatrixWorld();
  }
}
