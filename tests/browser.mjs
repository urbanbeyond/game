import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const url = process.env.TEST_URL || "http://127.0.0.1:4173";
const server = process.env.TEST_URL
  ? null
  : spawn(
      "node",
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "4173",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
let browser, page;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server && server.exitCode !== null)
      throw new Error("Test server exited before becoming ready");
    try {
      if ((await fetch(url)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, "Vite server is ready");
  const executablePath =
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__brickland?.triangles > 1000);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector('#hero-character').naturalWidth > 0);
  assert.match(await page.title(), /HINANYANG LAND/);
  await mkdir(".artifacts", { recursive: true });
  await page.screenshot({ path: ".artifacts/welcome.png" });
  assert.ok((await page.evaluate(() => window.__brickland.blockCount)) > 10000);
  assert.equal(
    await page.evaluate(() => window.__brickland.character.visible),
    false,
  );
  assert.equal(
    await page.evaluate(() => window.__brickland.cameraMode),
    "third",
  );
  console.log("PASS: WebGL scene renders the generated world");

  await page.getByRole("button", { name: "조작 방법", exact: true }).click();
  await page.getByText("모험을 위한 작은 안내서").waitFor();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page
    .getByRole("button", { name: "숲으로 출발하기", exact: true })
    .click();
  await page.waitForFunction(() => window.__brickland.playing);
  await page.waitForFunction(() => window.__brickland.grounded);
  assert.equal(
    await page.evaluate(() => window.__brickland.character.visible),
    true,
  );
  const initial = await page.evaluate(() => window.__brickland.player);
  await page.keyboard.down("w");
  await page.waitForFunction((p) => {
    const current = window.__brickland.player;
    return Math.hypot(current[0] - p[0], current[2] - p[2]) > 0.3;
  }, initial);
  assert.equal(
    await page.evaluate(() => window.__brickland.character.state),
    "walk",
  );
  await page.keyboard.up("w");
  const moved = await page.evaluate(() => window.__brickland.player);
  assert.ok(
    Math.hypot(moved[0] - initial[0], moved[2] - initial[2]) > 0.2,
    "W moves the player",
  );
  await page.waitForFunction(() => window.__brickland.grounded);
  const y = await page.evaluate(() => window.__brickland.player[1]);
  await page.keyboard.down("Space");
  await page.waitForFunction((y) => window.__brickland.player[1] > y + 0.15, y);
  await page.keyboard.up("Space");
  assert.ok(
    (await page.evaluate(() => window.__brickland.player[1])) > y + 0.15,
    "Space jumps",
  );
  await page.waitForFunction(() => window.__brickland.grounded);
  assert.deepEqual(
    await page.evaluate(() => window.__brickland.character.position),
    await page.evaluate(() => window.__brickland.player),
  );
  await page.screenshot({ path: ".artifacts/forest-exploration.png" });
  console.log(
    "PASS: third-person character, animated walking, following camera, gravity, landing, and jumping",
  );

  await page.keyboard.press("7");
  assert.equal(await page.evaluate(() => window.__brickland.selected), 6);
  // Dispatch relative motion through the same handler used by pointer lock.
  await page.evaluate(() =>
    document.dispatchEvent(
      new MouseEvent("mousemove", { movementX: 250, movementY: 220 }),
    ),
  );
  await page.waitForFunction(() => window.__brickland.target !== null);
  const before = await page.evaluate(() => window.__brickland.blockCount);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(
    (count) => window.__brickland.blockCount === count + 1,
    before,
  );
  assert.equal(
    await page.evaluate(() => window.__brickland.edits.at(-1)[3]),
    7,
  );
  await page.mouse.down({ button: "left" });
  await page.mouse.up({ button: "left" });
  await page.waitForFunction(
    (count) => window.__brickland.blockCount === count,
    before,
  );
  // Leave a real placed block in the world to verify restoration, not just a no-op edit.
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(
    (count) => window.__brickland.blockCount === count + 1,
    before,
  );
  await page.waitForTimeout(700);
  const edits = await page.evaluate(() => window.__brickland.edits);
  assert.ok(edits.length > 0);
  await page.screenshot({ path: ".artifacts/playing.png" });
  console.log(
    "PASS: third-person material selection, right-click placement, left-click mining, autosave",
  );

  const beforeSwitch = await page.evaluate(() => window.__brickland.player);
  await page.keyboard.press("v");
  await page.waitForFunction(
    () =>
      window.__brickland.cameraMode === "first" &&
      !window.__brickland.character.visible,
  );
  assert.deepEqual(
    await page.evaluate(() => window.__brickland.player),
    beforeSwitch,
  );
  await page.keyboard.press("v");
  await page.waitForFunction(
    () =>
      window.__brickland.cameraMode === "third" &&
      window.__brickland.character.visible,
  );
  console.log("PASS: first-/third-person toggle preserves player position");

  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByLabel("그림자 · 고화질").uncheck();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.__brickland?.triangles > 1000);
  assert.deepEqual(await page.evaluate(() => window.__brickland.edits), edits);
  assert.equal(
    await page.evaluate(() => window.__brickland.blockCount),
    before + 1,
  );
  console.log("PASS: saved block edits are restored after reload");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".artifacts/mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, [], "no uncaught browser errors");
  console.log("PASS: narrow-screen layout and no browser runtime errors");
} catch (error) {
  if (page) {
    console.error(
      "Game state at failure:",
      await page.evaluate(() => window.__brickland),
    );
    await page.screenshot({ path: ".artifacts/failure.png" });
  }
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
