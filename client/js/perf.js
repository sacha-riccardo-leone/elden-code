// Keeps the frame rate up on any screen. The 3D view is drawn into at most MAX_PIXELS and the
// browser stretches it over the window: a pixel-art world loses next to nothing, while a big or
// high-DPI screen would otherwise multiply the cost of every bloom, blur and grading pass.
// If frames still run long, quality steps down: multisampling goes first (on integrated GPUs it
// costs more than everything else together), then resolution. With headroom it steps back up,
// never to a step that already proved too slow. `?quality=full` draws at the screen's own
// resolution with multisampling and never adapts. P shows the numbers.

const MAX_PIXELS = 1.6e6;
// [share of the pixel budget, multisampling]
const STEPS = [[1, 4], [1, 0], [0.72, 0], [0.52, 0], [0.37, 0], [0.27, 0]];
const WINDOW = 1.5; // seconds of frames judged together
const SLOW = 20; // ms: below 50 fps, step down
const EASY = 18; // ms: keeping up with a 60 Hz screen (or better), may step up

export class Perf {
  constructor(renderer, post, apply) {
    this.renderer = renderer;
    this.post = post;
    this.apply = apply; // re-lays out the canvas at the current ratio
    this.full = new URLSearchParams(location.search).get('quality') === 'full';
    this.step = 0;
    this.tooSlow = new Set(); // steps that already proved too slow here
    this.sum = 0;
    this.count = 0;
    this.calm = 0;
    this.fps = 0;
    this.warmup = 4000; // ms: the first frames compile shaders and load art; don't judge them
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    this.software = /swiftshader|basic render|llvmpipe|software/i.test(this.gpu);
    this.el = document.createElement('div');
    this.el.id = 'perf';
    this.el.hidden = !new URLSearchParams(location.search).has('perf');
    document.body.append(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyP' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.el.hidden = !this.el.hidden;
      if (!this.el.hidden) this.show();
    });
  }

  get scale() {
    return STEPS[this.step][0];
  }

  // Device pixels per CSS pixel to draw the scene at, for a w x h CSS-pixel window.
  ratio(w, h) {
    const native = Math.min(window.devicePixelRatio || 1, 2);
    if (this.full) return native;
    return Math.min(native, Math.sqrt((MAX_PIXELS * this.scale) / (w * h)));
  }

  setStep(i) {
    this.step = i;
    this.post.setSamples(STEPS[i][1]);
    this.apply();
  }

  // Called every frame with the real time since the last one (ms).
  frame(ms) {
    if (ms > 250) return; // the tab was hidden or the machine paused; not a real frame
    if (this.warmup > 0) { this.warmup -= ms; return; }
    if (ms > 100) return; // a one-off hitch (a new area's shaders), not the steady pace
    this.sum += ms;
    this.count += 1;
    if (this.sum < WINDOW * 1000) return;
    const avg = this.sum / this.count;
    this.fps = 1000 / avg;
    this.sum = 0;
    this.count = 0;
    if (!this.full) this.adapt(avg);
    if (!this.el.hidden) this.show();
  }

  adapt(avg) {
    if (avg > SLOW && this.step < STEPS.length - 1) {
      this.tooSlow.add(this.step);
      this.calm = 0;
      this.setStep(this.step + 1);
    } else if (avg < EASY) {
      this.calm += WINDOW;
      // try one step better after a while, unless that step was already too slow
      if (this.calm >= 12 && this.step > 0 && !this.tooSlow.has(this.step - 1)) {
        this.calm = 0;
        this.setStep(this.step - 1);
      }
    } else {
      this.calm = 0;
    }
  }

  show() {
    const c = this.renderer.domElement;
    const [share, samples] = STEPS[this.step];
    const lines = [
      `${Math.round(this.fps)} fps`,
      `window ${innerWidth}×${innerHeight} (×${(window.devicePixelRatio || 1).toFixed(2)}), drawn at ${c.width}×${c.height}`,
      this.full ? 'full quality (fixed)' : `quality step ${this.step + 1}/${STEPS.length}: ${Math.round(share * 100)}% of the pixel budget, ${samples ? `${samples}× MSAA` : 'no MSAA'}`,
      `GPU: ${this.gpu}`,
    ];
    if (this.software) lines.push('⚠ Software rendering: turn on hardware acceleration in the browser settings');
    this.el.textContent = lines.join('\n');
  }
}
