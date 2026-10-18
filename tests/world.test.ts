import test from "node:test";
import assert from "node:assert/strict";
import {
  World,
  SIZE,
  MAX_HEIGHT,
  collides,
  intersectsPlayer,
  trace,
} from "../src/world.ts";

test("terrain is deterministic and the spawn has standing room", () => {
  const a = new World(),
    b = new World();
  assert.deepEqual(a.blocks, b.blocks);
  assert.ok(a.blocks.size > 10000);
  const y = a.surface(12, 17);
  assert.equal(collides(a, 12.5, y, 17.5), false);
  assert.equal(collides(a, 12.5, y - 0.1, 17.5), true);
});
test("block edits survive serialization, including mined blocks", () => {
  const a = new World();
  const height = a.surface(12, 17);
  assert.ok(a.edit(12, height, 17, 7));
  assert.ok(a.edit(13, 2, 17, 0));
  const b = new World();
  assert.ok(b.restore(JSON.parse(a.serialize())));
  assert.equal(b.get(12, height, 17), 7);
  assert.equal(b.get(13, 2, 17), 0);
  assert.deepEqual(a.blocks, b.blocks);
});
test("world borders, bedrock, heights, and invalid block types cannot be edited", () => {
  const w = new World();
  for (const cell of [
    [0, 0, 0, 0],
    [SIZE + 1, 3, 0, 1],
    [0, MAX_HEIGHT, 0, 1],
    [0, 2, 0, 8],
    [0.1, 2, 0, 1],
    [0, NaN, 0, 1],
  ]) {
    assert.equal(w.edit(cell[0], cell[1], cell[2], cell[3]), false);
  }
  assert.equal(collides(w, SIZE + 1, 20, 0), true);
});
test("malformed saves are rejected atomically", () => {
  const w = new World();
  const count = w.blocks.size;
  for (const raw of [
    null,
    {},
    { version: 2, edits: [] },
    {
      version: 1,
      edits: [
        [0, 20, 0, 7],
        [0, 20, 1, 100],
      ],
    },
    { version: 1, edits: ["bad"] },
  ])
    assert.equal(w.restore(raw), false);
  assert.equal(w.blocks.size, count);
  assert.equal(w.edits.size, 0);
});
test("ray traversal returns the hit block and face-adjacent placement cell", () => {
  const w = new World();
  w.blocks.clear();
  w.set(0, 5, 0, 3);
  assert.deepEqual(trace(w, { x: 0.5, y: 5.5, z: 4 }, { x: 0, y: 0, z: -1 }), {
    cell: [0, 5, 0],
    adjacent: [0, 5, 1],
  });
  assert.deepEqual(trace(w, { x: 0.5, y: 9, z: 0.5 }, { x: 0, y: -1, z: 0 }), {
    cell: [0, 5, 0],
    adjacent: [0, 6, 0],
  });
  assert.equal(
    trace(w, { x: 0.5, y: 5.5, z: 12 }, { x: 0, y: 0, z: -1 }),
    null,
  );
  assert.equal(trace(w, { x: 0.5, y: 5.5, z: 4 }, { x: 0, y: 0, z: 0 }), null);
});
test("blocks cannot be placed through the player", () => {
  assert.equal(intersectsPlayer([1, 5, 1], { x: 1.5, y: 5, z: 1.5 }), true);
  assert.equal(intersectsPlayer([1, 4, 1], { x: 1.5, y: 5, z: 1.5 }), false);
  assert.equal(intersectsPlayer([3, 5, 1], { x: 1.5, y: 5, z: 1.5 }), false);
});
