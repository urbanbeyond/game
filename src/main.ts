import "./style.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/dm-sans";
import * as THREE from "three";
import { BLOCKS, World, collides, intersectsPlayer, trace } from "./world.ts";
import { GameScene } from "./scene.ts";

const cubeIcon = `<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="m16 1 15 8.5L16 18 1 9.5Z" fill="currentColor"/><path d="M1 12.5 14.5 20v15L1 27.5Z" fill="currentColor" opacity=".6"/><path d="m17.5 20 13.5-7.5v15L17.5 35Z" fill="currentColor" opacity=".85"/></svg>`;
const icon = (name: string) => {
  const paths: Record<string, string> = {
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    save: '<path d="M5 3h12l4 4v14H3V3Zm2 0v6h10V3M7 21v-7h10v7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ""}</svg>`;
};
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div id="viewport"></div><div class="vignette"></div>
  <header class="topbar">
    <a class="brand" href="./" aria-label="브릭랜드 홈"><span class="brand-mark">${cubeIcon}</span><span>BRICKLAND<small>A LITTLE WORLD OF YOUR OWN</small></span></a>
    <div class="world-label"><span class="live-dot"></span>나의 첫 번째 세계<span class="divider"></span><span class="mode-label">크리에이티브</span></div>
    <nav aria-label="게임 메뉴"><button class="icon-button" id="help" aria-label="조작 방법">${icon("help")}</button><button class="icon-button" id="settings" aria-label="설정">${icon("settings")}</button><button class="save-button" id="save">${icon("save")}<span>세계 저장</span></button></nav>
  </header>
  <aside class="world-info"><span class="eyebrow">THE OVERWORLD</span><div>${icon("sun")} 햇살 가득한 초원</div><p><span class="live-dot"></span> <span id="save-status">로컬 자동 저장</span></p></aside>
  <div class="location"><span class="compass-icon">${icon("compass")}</span><span><b id="heading">N</b><small id="coordinates">12 / 8 / 17</small></span></div>
  <main class="welcome" id="welcome">
    <div class="welcome-tag"><span></span>상상하는 대로, 쌓아보세요</div>
    <h1>작은 블록,<br>무한한 <em>세계.</em></h1>
    <p class="intro">숲을 거닐고, 블록을 쌓고.<br>아무것도 정해지지 않은 이곳에서<br>당신만의 이야기를 만들어보세요.</p>
    <button class="play-button" id="play"><span id="play-label">세계에 들어가기</span>${icon("arrow")}</button>
    <p class="play-note"><span class="key-mini">W A S D</span> 이동 <span class="dot">·</span> 마우스로 둘러보기</p>
  </main>
  <div class="scene-caption" id="scene-caption"><span class="caption-line"></span>YOUR NEXT ADVENTURE<br><strong>STARTS WITH A BLOCK.</strong></div>
  <div id="crosshair" hidden><i></i><i></i></div><div id="target-label" hidden></div>
  <div class="toolbar-wrap"><div class="toolbar-title"><span>나만의 팔레트</span><span id="selected-name">잔디 블록</span><span class="infinite">∞</span></div><div class="toolbar" role="toolbar" aria-label="블록 선택">${BLOCKS.map((b, i) => `<button class="slot ${i === 0 ? "active" : ""}" data-block="${i}" aria-label="${b.name} 블록" aria-pressed="${i === 0}"><span class="slot-number">${i + 1}</span><span class="block-cube" style="--top:${b.top};--side:${b.side};--front:${b.color}"><i></i><i></i><i></i></span><span class="slot-name">${b.name}</span></button>`).join("")}</div><span class="toolbar-hint">숫자 1–7 또는 마우스 휠로 블록 선택</span></div>
  <footer><div><span class="footer-dot"></span>자유롭게 만들고, 느긋하게 즐기세요.</div><button id="controls-link">${icon("help")} 조작 가이드 <kbd>H</kbd></button></footer>
  <div class="play-hints" id="play-hints" hidden><span><kbd>좌클릭</kbd> 부수기</span><span><kbd>우클릭</kbd> 쌓기</span><span><kbd>Space</kbd> 점프</span><span><kbd>Esc</kbd> 메뉴</span></div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal"><button class="modal-close icon-button" aria-label="닫기">${icon("close")}</button><div id="modal-content"></div></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const world = new World();
const storageKey = "brickland-world-v1";
let storageAvailable = true;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved && !world.restore(JSON.parse(saved)))
    toast("저장 형식이 달라 기본 세계를 열었습니다.");
} catch {
  storageAvailable = false;
  toast("저장 데이터를 읽지 못했습니다. 현재 세션에서 플레이할 수 있습니다.");
}
let view: GameScene;
try {
  view = new GameScene($("#viewport"), world);
} catch {
  $("#welcome").innerHTML =
    "<h1>세계를 열 수 없어요.</h1><p>이 게임은 WebGL을 지원하는 브라우저가 필요합니다. 하드웨어 가속을 켜고 최신 Chrome, Edge 또는 Firefox에서 다시 열어주세요.</p>";
  throw new Error("WebGL initialization failed");
}
const camera = view.camera;
const player = new THREE.Vector3(12.5, world.surface(12, 17), 17.5);
const direction = new THREE.Vector3();
const velocity = new THREE.Vector3();
let yaw = 0.45,
  pitch = -0.16,
  selected = 0,
  grounded = false,
  playing = false,
  started = false;
let target: ReturnType<typeof trace> = null;
let sensitivity = 1;
let lastTime = performance.now(),
  elapsed = 0,
  uiTime = 0,
  saveTimer = 0;
const keys = new Set<string>();

function toast(message: string) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  // The first storage check runs before the rest of the game is initialized.
  window.setTimeout(() => el.classList.remove("visible"), 3500);
}
function save(notify = false) {
  try {
    localStorage.setItem(storageKey, world.serialize());
    storageAvailable = true;
    $("#save-status").textContent = "모든 변경 사항 저장됨";
    if (notify) toast("세계가 이 브라우저에 저장되었습니다.");
  } catch {
    storageAvailable = false;
    $("#save-status").textContent = "저장 공간 확인 필요";
    toast("저장할 수 없습니다. 브라우저의 저장 공간과 설정을 확인해 주세요.");
  }
}
function select(index: number) {
  selected = (index + BLOCKS.length) % BLOCKS.length;
  document.querySelectorAll<HTMLButtonElement>(".slot").forEach((slot, i) => {
    slot.classList.toggle("active", i === selected);
    slot.setAttribute("aria-pressed", String(i === selected));
  });
  $("#selected-name").textContent = `${BLOCKS[selected].name} 블록`;
}
function setPlaying(value: boolean) {
  playing = value;
  keys.clear();
  $("#welcome").hidden = value;
  $("#scene-caption").hidden = value || started;
  $("#crosshair").hidden = !value;
  $("#play-hints").hidden = !value;
  document.body.classList.toggle("playing", value);
  if (!value) {
    target = null;
    view.highlight();
    $("#target-label").hidden = true;
    if (started) {
      $("#play-label").textContent = "이어서 탐험하기";
      $(".welcome-tag").innerHTML = "<span></span>잠시 쉬어가도 괜찮아요";
    }
  }
}
async function play() {
  if ($("#modal").hasAttribute("open")) return;
  try {
    await view.renderer.domElement.requestPointerLock();
    started = true;
    setPlaying(true);
  } catch {
    toast(
      "마우스를 잠글 수 없습니다. 데스크톱 브라우저에서 게임 화면을 다시 클릭해 주세요.",
    );
  }
}
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === view.renderer.domElement) {
    started = true;
    setPlaying(true);
  } else setPlaying(false);
});
document.addEventListener("mousemove", (e) => {
  if (!playing) return;
  yaw -= e.movementX * 0.002 * sensitivity;
  pitch = Math.max(
    -1.5,
    Math.min(1.5, pitch - e.movementY * 0.002 * sensitivity),
  );
});
function edit(place: boolean) {
  if (!playing || !target) return;
  const cell = place ? target.adjacent : target.cell;
  if (place && intersectsPlayer(cell, player)) {
    toast("플레이어가 있는 곳에는 블록을 놓을 수 없어요.");
    return;
  }
  if (!world.edit(...cell, place ? BLOCKS[selected].id : 0)) {
    toast("월드 경계와 바닥 기반암은 바꿀 수 없어요.");
    return;
  }
  view.rebuild(world);
  updateTarget();
  $("#save-status").textContent = "저장 중…";
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => save(), 500);
}
view.renderer.domElement.addEventListener("mousedown", (e) => {
  if (!playing) return;
  if (e.button === 0 || e.button === 2) edit(e.button === 2);
});
view.renderer.domElement.addEventListener("contextmenu", (e) =>
  e.preventDefault(),
);
window.addEventListener(
  "wheel",
  (e) => {
    if ($("#modal").hasAttribute("open")) return;
    if (e.deltaY) select(selected + Math.sign(e.deltaY));
  },
  { passive: true },
);
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || $("#modal").hasAttribute("open"))
    return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (/^Digit[1-7]$/.test(e.code)) select(Number(e.code.slice(-1)) - 1);
  if (e.code === "KeyH" && !e.repeat) showHelp();
  if (playing) keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
});
window.addEventListener("pagehide", () => {
  if (world.edits.size) save();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    if (world.edits.size) save();
  }
  lastTime = performance.now();
});
$("#play").addEventListener("click", play);
$("#save").addEventListener("click", () => save(true));
document
  .querySelectorAll<HTMLButtonElement>(".slot")
  .forEach((button, i) => button.addEventListener("click", () => select(i)));
const modal = $("#modal") as HTMLDialogElement;
$(".modal-close").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.close();
});
function showModal(content: string) {
  if (document.pointerLockElement) document.exitPointerLock();
  setPlaying(false);
  $("#modal-content").innerHTML = content;
  if (!modal.open) modal.showModal();
}
function showHelp() {
  showModal(
    `<span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>모험을 위한 작은 안내서</h2><p>블록은 무제한이에요. 마음껏 부수고, 쌓고, 만들어보세요.</p><div class="control-list">${[
      ["W A S D / 방향키", "앞뒤, 좌우로 이동"],
      ["마우스", "주변 둘러보기"],
      ["Space", "점프"],
      ["Shift", "빠르게 달리기"],
      ["마우스 왼쪽", "바라보는 블록 부수기"],
      ["마우스 오른쪽", "선택한 블록 쌓기"],
      ["1 – 7 / 마우스 휠", "블록 종류 선택"],
      ["Esc", "일시 정지 · 마우스 해제"],
    ]
      .map(
        ([key, value]) => `<div><kbd>${key}</kbd><span>${value}</span></div>`,
      )
      .join(
        "",
      )}</div><p class="modal-note">키보드와 마우스가 있는 데스크톱 브라우저를 권장합니다. 변경 사항은 현재 브라우저에 자동 저장되며, 다른 기기와 동기화되지 않습니다.</p>`,
  );
}
$("#help").addEventListener("click", showHelp);
$("#controls-link").addEventListener("click", showHelp);
$("#settings").addEventListener("click", () => {
  showModal(
    `<span class="eyebrow">YOUR WORLD, YOUR WAY</span><h2>편안한 탐험을 위해</h2><label class="setting-row"><span>마우스 감도</span><input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="${sensitivity}"></label><label class="setting-row"><span>그림자 · 고화질</span><input id="quality" type="checkbox" ${view.renderer.shadowMap.enabled ? "checked" : ""}></label><p class="modal-note">화면이 느리면 고화질을 꺼보세요. 세계의 변경 사항은 자동 저장됩니다.</p><div class="settings-actions"><button class="secondary-button" id="respawn">시작 지점으로 이동</button><button class="danger-button" id="reset-world">세계 초기화</button></div>`,
  );
  $("#sensitivity").addEventListener("input", (e) => {
    sensitivity = Number((e.target as HTMLInputElement).value);
  });
  $("#quality").addEventListener("change", (e) =>
    view.quality((e.target as HTMLInputElement).checked),
  );
  $("#respawn").addEventListener("click", () => {
    respawn();
    modal.close();
    toast("시작 지점으로 돌아왔습니다.");
  });
  $("#reset-world").addEventListener("click", () => {
    showModal(
      '<span class="eyebrow">A FRESH START</span><h2>처음부터 다시 만들까요?</h2><p>직접 놓거나 부순 블록이 모두 초기화됩니다. 이 작업은 되돌릴 수 없습니다.</p><div class="settings-actions"><button class="secondary-button" id="cancel-reset">취소</button><button class="danger-button" id="confirm-reset">초기화하기</button></div>',
    );
    $("#cancel-reset").addEventListener("click", () => modal.close());
    $("#confirm-reset").addEventListener("click", () => {
      world.blocks.clear();
      world.edits.clear();
      world.generate();
      view.rebuild(world);
      respawn();
      save();
      modal.close();
      toast("새로운 세계가 준비되었습니다.");
    });
  });
});
function respawn() {
  player.set(12.5, world.surface(12, 17), 17.5);
  velocity.set(0, 0, 0);
  yaw = 0.45;
  pitch = -0.16;
}
function updateTarget() {
  camera.getWorldDirection(direction);
  target = trace(world, camera.position, direction);
  view.highlight(target?.cell);
  $("#target-label").hidden = !target;
  if (target)
    $("#target-label").textContent =
      BLOCKS[world.get(...target.cell) - 1]?.name ?? "";
}
function physics(dt: number) {
  const forward =
    Number(keys.has("KeyW") || keys.has("ArrowUp")) -
    Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const strafe =
    Number(keys.has("KeyD") || keys.has("ArrowRight")) -
    Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const norm = Math.hypot(forward, strafe) || 1;
  const speed =
    (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7 : 4.3) *
    (player.y < 3.5 ? 0.6 : 1);
  velocity.x =
    ((-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / norm) * speed;
  velocity.z =
    ((-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / norm) * speed;
  if (keys.has("Space") && grounded) {
    velocity.y = 8.3;
    grounded = false;
  }
  velocity.y = Math.max(-25, velocity.y - 23 * dt);
  // Small collision steps prevent tunnelling even after a slow frame.
  const steps =
    Math.ceil(
      (Math.max(
        Math.abs(velocity.x),
        Math.abs(velocity.y),
        Math.abs(velocity.z),
      ) *
        dt) /
        0.1,
    ) || 1;
  for (let i = 0; i < steps; i++)
    for (const axis of ["x", "z", "y"] as const) {
      const old = player[axis];
      player[axis] += (velocity[axis] * dt) / steps;
      if (collides(world, player.x, player.y, player.z)) {
        player[axis] = old;
        if (axis === "y") {
          grounded = velocity.y < 0;
          velocity.y = 0;
        }
      } else if (axis === "y") grounded = false;
    }
  grounded =
    velocity.y <= 0 && collides(world, player.x, player.y - 0.025, player.z);
  if (player.y < -10) respawn();
}
function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += dt;
  uiTime += dt;
  if (playing) {
    physics(dt);
    camera.position.set(player.x, player.y + 1.62, player.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    updateTarget();
  } else if (!started) {
    camera.position.set(37 + Math.sin(elapsed * 0.035) * 2, 28, 39);
    camera.lookAt(-8, 4, 0);
  } else {
    camera.position.set(player.x, player.y + 1.62, player.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }
  if (uiTime > 0.15) {
    uiTime = 0;
    $("#coordinates").textContent =
      `${Math.floor(player.x)} / ${Math.floor(player.y)} / ${Math.floor(player.z)}`;
    const bearing = ((((yaw * 180) / Math.PI) % 360) + 360) % 360;
    $("#heading").textContent = ["N", "W", "S", "E"][
      Math.round(bearing / 90) % 4
    ];
  }
  view.render(elapsed);
  requestAnimationFrame(frame);
}
if (!storageAvailable) $("#save-status").textContent = "자동 저장 사용 불가";
requestAnimationFrame(frame);
// Read-only development diagnostics for reproducible browser smoke checks.
if (import.meta.env.DEV)
  Object.defineProperty(window, "__brickland", {
    get: () => ({
      playing,
      selected,
      player: player.toArray(),
      grounded,
      target: target
        ? { cell: [...target.cell], adjacent: [...target.adjacent] }
        : null,
      edits: [...world.edits.values()],
      blockCount: world.blocks.size,
      triangles: view.renderer.info.render.triangles,
    }),
  });
