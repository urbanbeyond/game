import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ForestCharacter, FACE_PIXELS } from "../src/character.ts";
import { PlayerCamera } from "../src/camera.ts";
import {
  World,
  cameraClearance,
  interactionTarget,
  collides,
  PLAYER_HEIGHT,
  intersectsPlayer,
} from "../src/world.ts";

test("character keeps the supplied pixel face and animates actual movement", () => {
  assert.equal(FACE_PIXELS.length, 6);
  assert.ok(FACE_PIXELS.every((row) => row.length === 11));
  const character = new ForestCharacter();
  const position = new THREE.Vector3(2, 6, 3);
  character.update(0.1, 1, position, new THREE.Vector3(), true);
  assert.equal(character.state, "idle");
  assert.deepEqual(character.root.position.toArray(), [2, 6, 3]);
  character.update(0.1, 2, position, new THREE.Vector3(4, 0, 0), true);
  assert.equal(character.state, "walk");
  assert.notEqual(character.leftFoot.rotation.x, 0);
  assert.equal(character.leftFoot.rotation.x, -character.rightFoot.rotation.x);
  assert.ok(character.heading > 0.55);
  character.update(0.1, 3, position, new THREE.Vector3(7, 0, 0), true);
  assert.equal(character.state, "run");
  character.update(0.1, 4, position, new THREE.Vector3(0, 4, 0), false);
  assert.equal(character.state, "jump");
});

test("camera volume stops before walls and overhead leaves, and restores its distance", () => {
  const world = new World();
  world.blocks.clear();
  const origin = { x: 0.5, y: 2.5, z: 0.5 };
  const direction = { x: 0, y: 0, z: 1 };
  assert.equal(cameraClearance(world, origin, direction, 5), 5);
  assert.equal(cameraClearance(world, origin, direction, 0), 0);
  world.set(0, 2, 3, 4);
  const safe = cameraClearance(world, origin, direction, 5);
  assert.ok(safe > 2 && safe < 2.4);
  world.blocks.clear();
  world.set(0, 3, 2, 5);
  assert.ok(cameraClearance(world, { ...origin, y: 2.9 }, direction, 5) < 1.5);
  world.blocks.clear();
  assert.equal(cameraClearance(world, origin, direction, 5), 5);
});

test("third-person targeting cannot reach through a wall or beyond the character's reach", () => {
  const world = new World();
  world.blocks.clear();
  world.set(0, 2, 0, 3);
  const camera = { x: 0.5, y: 2.5, z: 5 };
  const direction = { x: 0, y: 0, z: -1 };
  const eye = { x: 0.5, y: 2.5, z: 3 };
  assert.deepEqual(
    interactionTarget(world, camera, direction, eye)?.cell,
    [0, 2, 0],
  );
  assert.equal(
    interactionTarget(world, camera, direction, { x: 0.5, y: 2.5, z: 12 }),
    null,
  );
  world.set(1, 2, 0, 4);
  assert.equal(
    interactionTarget(world, camera, direction, { x: 2.5, y: 2.5, z: 0.5 }),
    null,
  );
});

test("first-person view hides the follow distance without changing player position", () => {
  const world = new World();
  world.blocks.clear();
  const rig = new PlayerCamera();
  const camera = new THREE.PerspectiveCamera();
  const player = { x: 0.5, y: 3, z: 0.5 };
  rig.update(camera, world, player, 0, -0.2, 0.1);
  assert.equal(rig.mode, "third");
  assert.ok(camera.position.z > 5);
  rig.toggle();
  rig.update(camera, world, player, 0, -0.2, 0.1);
  assert.equal(rig.mode, "first");
  assert.deepEqual(camera.position.toArray(), [
    player.x,
    player.y + PLAYER_HEIGHT - 0.15,
    player.z,
  ]);
  rig.toggle();
  rig.update(camera, world, player, 0, -0.2, 0.1);
  assert.ok(camera.position.z > 5);
});

test("collision and placement protect the broad character silhouette", () => {
  const world = new World();
  world.blocks.clear();
  world.set(1, 2, 0, 3);
  assert.equal(collides(world, 0.6, 2, 0.5), true);
  assert.equal(collides(world, 0.5, 2, 0.5), false);
  assert.equal(intersectsPlayer([1, 2, 0], { x: 0.6, y: 2, z: 0.5 }), true);
});
