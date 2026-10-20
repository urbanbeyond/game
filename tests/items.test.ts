import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DroppedItems } from "../src/items.ts";
import { World } from "../src/world.ts";

test("nearby dropped blocks are picked up exactly once and persist", () => {
  const world = new World();
  world.blocks.clear();
  const items = new DroppedItems(new THREE.Scene());
  items.spawn(2, 5, 3, 5, 3);
  assert.equal(items.update(0.01, { x: 0, y: 3, z: 0 }, world), 0);
  assert.equal(items.update(0.01, { x: 5, y: 2.4, z: 5 }, world), 3);
  assert.equal(items.counts[1], 3);
  assert.equal(items.update(0.01, { x: 5, y: 2.4, z: 5 }, world), 0);
  items.spawn(4, 10, 4, 10);
  const restored = new DroppedItems(new THREE.Scene());
  restored.restore(items.serialize());
  assert.equal(restored.counts[1], 3);
  assert.equal(restored.drops[0].id, 4);
  assert.deepEqual(restored.drops[0].mesh.position.toArray(), [10, 4, 10]);
  restored.restore('{"counts":[0,0,0,0,0,0,0],"drops":[null]}');
  assert.equal(restored.counts[1], 3);
  restored.clear();
  assert.equal(restored.drops.length, 0);
  assert.ok(restored.counts.every(n => n === 0));
});

test("drops settle on blocks instead of falling through the ground", () => {
  const world = new World();
  world.blocks.clear();
  world.set(2, 0, 2, 3);
  const items = new DroppedItems(new THREE.Scene());
  items.spawn(1, 2.5, 3, 2.5);
  for (let i = 0; i < 120; i++) items.update(1 / 60, { x: 20, y: 5, z: 20 }, world);
  assert.ok(Math.abs(items.drops[0].mesh.position.y - 1.12) < 0.001);
});
