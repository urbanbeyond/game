import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const url = "http://127.0.0.1:4174";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4174", "--strictPort"], { stdio: "pipe" });
let browser, page;
try {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Mobile test server failed");
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    // A phone with no pointer-lock API must still enter gameplay.
    Element.prototype.requestPointerLock = undefined;
    if (!localStorage.getItem("hinanyang-inventory-v1"))
      localStorage.setItem("hinanyang-inventory-v1", JSON.stringify({
        counts: [0, 0, 0, 0, 0, 0, 0],
        drops: [{ id: 2, count: 1, position: [12.5, 6.5, 17.5] }],
      }));
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__brickland?.triangles > 1000);
  await page.getByRole("button", { name: "숲으로 출발하기", exact: true }).tap();
  await page.waitForFunction(() => window.__brickland.playing && window.__brickland.grounded);
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  await page.waitForFunction(() => window.__brickland.inventory[1] === 1);
  const client = await context.newCDPSession(page);
  let points = [];
  const send = (type) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const down = async (id, x, y) => { points.push({ id, x, y }); await send("touchStart"); };
  const move = async (id, x, y) => { Object.assign(points.find(p => p.id === id), { x, y }); await send("touchMove"); };
  const up = async id => { points = points.filter(p => p.id !== id); await send("touchEnd"); };
  const pad = await page.locator("#joystick").boundingBox();
  const px = pad.x + pad.width / 2, py = pad.y + pad.height / 2;
  const before = await page.evaluate(() => window.__brickland.player);
  await down(1, px, py);
  await move(1, px, py - 40);
  await page.waitForFunction(before => Math.hypot(window.__brickland.player[0] - before[0], window.__brickland.player[2] - before[2]) > 0.3, before);
  const yaw = await page.evaluate(() => window.__brickland.yaw);
  await down(2, 250, 350);
  await move(2, 290, 380);
  await page.waitForFunction(yaw => window.__brickland.yaw !== yaw, yaw, { timeout: 5000 });
  const jump = await page.locator("#touch-jump").boundingBox();
  await down(3, jump.x + 35, jump.y + 35);
  await page.waitForFunction(() => window.__brickland.character.state === "jump");
  await up(3); await up(2); await up(1);
  assert.equal(await page.evaluate(() => window.__brickland.touch.forward), 0);
  console.log("PASS: no pointer lock, real multi-touch walking, looking, jumping and pickup");

  // Verify the 350ms gesture without software-WebGL / protocol latency between moves.
  await down(1, px, py);
  await page.evaluate(({ x, y }) => {
    const pad = document.querySelector("#joystick");
    // Capture the real active pointer ID on its next move.
    window.testPadMove = event => {
      pad.removeEventListener("pointermove", window.testPadMove);
      for (const offset of [-40, 0, -40])
        pad.dispatchEvent(new PointerEvent("pointermove", {
          pointerId: event.pointerId, pointerType: "touch", clientX: x, clientY: y + offset,
        }));
    };
    pad.addEventListener("pointermove", window.testPadMove);
  }, { x: px, y: py });
  await move(1, px + 2, py);
  await page.waitForFunction(() => window.__brickland.touch.sprint, null, { timeout: 5000 });
  await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); points = [];
  await page.waitForFunction(() => window.__brickland.touch.forward === 0);

  // Respawn for a deterministic reachable target. Camera drag itself must not edit.
  await page.getByRole("button", { name: "설정", exact: true }).tap();
  await page.getByRole("button", { name: "시작 지점으로 이동" }).tap();
  await page.waitForFunction(() => window.__brickland.playing);
  const editsBefore = await page.evaluate(() => window.__brickland.edits.length);
  await down(1, 60, 300);
  await move(1, 310, 520);
  await up(1);
  assert.equal(await page.evaluate(() => window.__brickland.edits.length), editsBefore);
  await page.waitForFunction(() => window.__brickland.target !== null);
  const count = await page.evaluate(() => window.__brickland.blockCount);
  await page.touchscreen.tap(195, 422);
  await page.waitForFunction(n => window.__brickland.blockCount === n + 1, count);
  await down(1, 195, 422);
  await page.waitForFunction(n => window.__brickland.blockCount === n, count);
  await up(1);
  assert.equal(await page.evaluate(() => window.__brickland.blockCount), count);
  await down(1, 195, 422);
  await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); points = [];
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__brickland.blockCount), count, "cancelled hold must not mine");
  console.log("PASS: short tap places, hold breaks, drag does not edit, cancel stops movement");

  await page.getByRole("button", { name: "인벤토리 열기" }).tap();
  assert.equal(await page.evaluate(() => window.__brickland.playing), false);
  assert.match(await page.locator(".inventory-grid").textContent(), /습득 1개/);
  await page.getByRole("button", { name: "나무 선택", exact: true }).tap();
  await page.waitForFunction(() => window.__brickland.playing && window.__brickland.selected === 3);
  assert.match(await page.locator("#touch-selected").textContent(), /나무/);
  await mkdir(".artifacts", { recursive: true });
  await page.screenshot({ path: ".artifacts/mobile-touch.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: ".artifacts/mobile-landscape.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await page.evaluate(() => window.__brickland.playing), false);
  await page.getByRole("button", { name: "이어서 탐험하기", exact: true }).tap();
  await page.getByRole("button", { name: "일시 정지", exact: true }).tap();
  assert.equal(await page.evaluate(() => window.__brickland.playing), false);
  await page.getByRole("button", { name: "이어서 탐험하기", exact: true }).tap();
  await page.getByRole("button", { name: "세계 저장", exact: true }).tap();
  await page.reload();
  await page.waitForFunction(() => window.__brickland?.inventory[1] >= 1);
  assert.deepEqual(errors, []);
  console.log("PASS: inventory selection/resume, portrait/landscape, pause, persistence, no runtime errors");
} catch (error) {
  if (page) {
    console.error(await page.evaluate(() => window.__brickland));
    await mkdir(".artifacts", { recursive: true });
    await page.screenshot({ path: ".artifacts/mobile-failure.png" });
  }
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
