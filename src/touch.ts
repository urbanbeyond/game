export interface TouchActions {
  active(): boolean;
  look(dx: number, dy: number): void;
  edit(place: boolean, x: number, y: number): void;
  jump(): void;
}

/** Independent pointer ownership allows walking, looking and jumping together. */
export class TouchControls {
  forward = 0;
  strafe = 0;
  sprint = false;
  private padPointer: number | null = null;
  private lookPointer: number | null = null;
  private lastPush = -Infinity;
  private pushed = false;
  private timer = 0;
  private start = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private dragged = false;
  private held = false;

  constructor(
    canvas: HTMLElement,
    private pad: HTMLElement,
    private knob: HTMLElement,
    jump: HTMLElement,
    private actions: TouchActions,
  ) {
    pad.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" || !actions.active() || this.padPointer !== null) return;
      e.preventDefault();
      this.padPointer = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      this.movePad(e);
    });
    pad.addEventListener("pointermove", e => {
      if (e.pointerId === this.padPointer) this.movePad(e);
    });
    const releasePad = (e: PointerEvent) => {
      if (e.pointerId !== this.padPointer) return;
      this.padPointer = null;
      this.forward = this.strafe = 0;
      this.sprint = this.pushed = false;
      knob.style.transform = "";
      pad.classList.remove("sprinting");
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      pad.addEventListener(event, e => releasePad(e as PointerEvent));
    jump.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" || !actions.active()) return;
      e.preventDefault();
      actions.jump();
    });
    canvas.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" || !actions.active() || this.lookPointer !== null) return;
      e.preventDefault();
      this.lookPointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      this.start = this.last = { x: e.clientX, y: e.clientY };
      this.dragged = this.held = false;
      this.timer = window.setTimeout(() => {
        if (!actions.active() || this.dragged || this.lookPointer === null) return;
        this.held = true;
        actions.edit(false, this.start.x, this.start.y);
      }, 500);
    });
    canvas.addEventListener("pointermove", e => {
      if (e.pointerId !== this.lookPointer || !actions.active()) return;
      if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 12) {
        this.dragged = true;
        clearTimeout(this.timer);
      }
      if (this.dragged) actions.look(e.clientX - this.last.x, e.clientY - this.last.y);
      this.last = { x: e.clientX, y: e.clientY };
    });
    const releaseLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointer) return;
      clearTimeout(this.timer);
      if (e.type === "pointerup" && !this.dragged && !this.held && actions.active())
        actions.edit(true, e.clientX, e.clientY);
      this.lookPointer = null;
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(event, e => releaseLook(e as PointerEvent));
  }

  private movePad(e: PointerEvent) {
    const rect = this.pad.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const x = (e.clientX - rect.left - rect.width / 2) / radius;
    const y = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    this.strafe = x / length;
    this.forward = -y / length;
    if (Math.hypot(x, y) < 0.15) this.forward = this.strafe = 0;
    if (this.forward > 0.6 && !this.pushed) {
      const now = performance.now();
      this.sprint = now - this.lastPush < 350;
      this.lastPush = now;
      this.pushed = true;
    } else if (this.forward < 0.25) {
      this.pushed = this.sprint = false;
    }
    this.knob.style.transform = `translate(${this.strafe * radius}px, ${-this.forward * radius}px)`;
    this.pad.classList.toggle("sprinting", this.sprint);
  }

  reset() {
    clearTimeout(this.timer);
    this.padPointer = this.lookPointer = null;
    this.forward = this.strafe = 0;
    this.sprint = this.pushed = false;
    this.lastPush = -Infinity;
    this.knob.style.transform = "";
    this.pad.classList.remove("sprinting");
  }
}
