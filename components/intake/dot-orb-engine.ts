// The dot-matrix orb's canvas engine, matched to the reference (orb-reference/orb-reference-notes.md):
// a sphere of latitude rows that re-forms for each status. Plain canvas 2D, no dependencies.
// `still` (reduced motion) draws one settled frame per state instead of running the loop.
export type OrbState = "thinking" | "working" | "success" | "stuck";
export type OrbOptions = { color?: string; glow?: string; state?: OrbState; still?: boolean };

type P = [number, number, number];

const ROWS = 17; // latitude rows on the sphere
const GRID = 8; // dots per cube-face edge
const N = 6 * GRID * GRID; // 384: the same dots make the sphere and the cube

/** Largest-remainder split of `total` dots over rows weighted by their circumference. */
function rowCounts(total: number): number[] {
  const w = Array.from({ length: ROWS }, (_, r) => Math.cos(-Math.PI / 2 + ((r + 0.5) / ROWS) * Math.PI));
  const sum = w.reduce((a, b) => a + b, 0);
  const raw = w.map((x) => (x / sum) * total);
  const out = raw.map(Math.floor);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  const missing = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < missing; k++) out[order[k][1]]++;
  return out;
}

export function createDotOrb(canvas: HTMLCanvasElement, opts: OrbOptions = {}) {
  const color = opts.color ?? "#16201d";
  const glowColor = opts.glow ?? "#1d6a56";
  const still = opts.still ?? false;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  let R = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = canvas.width = r.width * dpr;
    H = canvas.height = r.height * dpr;
    R = Math.min(W, H) * 0.32;
    if (still) frame();
  };

  // Sphere: latitude rows, evenly spaced around each row, alternate rows offset half a step.
  const base: P[] = [];
  const lon: number[] = [];
  rowCounts(N).forEach((count, r) => {
    const lat = -Math.PI / 2 + ((r + 0.5) / ROWS) * Math.PI;
    for (let j = 0; j < count; j++) {
      const a = ((j + (r % 2) * 0.5) / count) * Math.PI * 2;
      base.push([Math.cos(lat) * Math.cos(a), Math.sin(lat), Math.cos(lat) * Math.sin(a)]);
      lon.push(a);
    }
  });
  // Cube: an 8×8 grid on each of six faces.
  const S = 0.72;
  const cube: P[] = [];
  for (let f = 0; f < 6; f++) {
    const s = f < 3 ? 1 : -1;
    for (let j = 0; j < GRID * GRID; j++) {
      const u = ((j % GRID) / (GRID - 1)) * 2 - 1;
      const v = (Math.floor(j / GRID) / (GRID - 1)) * 2 - 1;
      cube.push(([[s, u, v], [u, s, v], [u, v, s]] as P[])[f % 3].map((c) => c * S) as P);
    }
  }
  // Morph each sphere dot to the cube dot in the same direction, so the change reads as a reshape.
  const cubeFor: P[] = (() => {
    const free = cube.map((c, i) => ({ c, i, n: Math.hypot(...c) }));
    const used = new Set<number>();
    return base.map((b) => {
      let best = -1;
      let bestDot = -Infinity;
      for (const { c, i, n } of free) {
        if (used.has(i)) continue;
        const d = (b[0] * c[0] + b[1] * c[1] + b[2] * c[2]) / n;
        if (d > bestDot) {
          bestDot = d;
          best = i;
        }
      }
      used.add(best);
      return cube[best];
    });
  })();
  const cur: P[] = base.map((p) => [...p] as P);

  let state: OrbState = opts.state ?? "success";
  let t = 0;
  let raf = 0;
  let rotY = 0;
  let tiltX = 0.3;
  let rollZ = 0;
  let glow = 0.45;
  let scan = 0; // strength of the working scan band, eased
  const spin: Record<OrbState, number> = { thinking: 0.5, working: 3.2, success: 0.3, stuck: 0 }; // rad/s

  const target = (i: number): P => {
    const [x, y, z] = base[i];
    if (state === "thinking") {
      // Whole rows push outward as a wave climbs the sphere (one wave about every 1.8 s).
      const k = 1 + 0.13 * Math.max(0, Math.sin(t * 3.5 - y * 5)) ** 2;
      return [x * k, y * k, z * k];
    }
    if (state === "stuck") return cubeFor[i];
    return [x, y, z];
  };

  const hexA = (h: string, a: number) => {
    const n = parseInt(h.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const toward = (v: number, goal: number, rate: number) => v + (goal - v) * (still ? 1 : rate);

  function frame() {
    if (!ctx) return;
    t += 1 / 60;
    // Orientation per state: working tumbles on a shifting axis; stuck turns to corner-on and holds.
    if (state === "stuck") {
      const goal = Math.round((rotY - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
      rotY = toward(rotY, goal, 0.03);
      // Isometric: a corner-on hexagon. (Steeper, 0.8, turned it into columns; see orb-reference notes.)
      tiltX = toward(tiltX, 0.615, 0.03);
      rollZ = toward(rollZ, 0, 0.05);
    } else if (state === "working") {
      rotY += spin.working / 60;
      tiltX = toward(tiltX, 0.3 + 0.75 * Math.sin(t * 0.9), 0.05);
      rollZ = toward(rollZ, 0.45 * Math.sin(t * 0.6), 0.05);
    } else {
      rotY += spin[state] / 60;
      tiltX = toward(tiltX, 0.3, 0.04);
      rollZ = toward(rollZ, 0, 0.04);
    }
    glow = toward(glow, state === "success" ? 1 : 0.45, 0.04);
    scan = toward(scan, state === "working" ? 1 : 0, 0.08);

    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    // A soft halo behind the orb in every state, stronger and wider on success.
    const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * (1.5 + 0.2 * glow));
    g.addColorStop(0, hexA(glowColor, 0.26 * glow));
    g.addColorStop(1, hexA(glowColor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cY = Math.cos(rotY);
    const sY = Math.sin(rotY);
    const cX = Math.cos(tiltX);
    const sX = Math.sin(tiltX);
    const cZ = Math.cos(rollZ);
    const sZ = Math.sin(rollZ);
    const band = t * 4.2; // the scan band's longitude
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const tg = target(i);
      const c = cur[i];
      for (let k = 0; k < 3; k++) c[k] = toward(c[k], tg[k], 0.085);
      let [x, y, z] = c;
      [x, z] = [x * cY - z * sY, x * sY + z * cY];
      [y, z] = [y * cX - z * sX, y * sX + z * cX];
      [x, y] = [x * cZ - y * sZ, x * sZ + y * cZ];
      // Working: one longitude line glows as it sweeps round.
      const d = Math.abs(Math.atan2(Math.sin(lon[i] - band), Math.cos(lon[i] - band)));
      const hot = scan * Math.max(0, 1 - d / 0.22);
      pts.push([x, y, z, hot]);
    }
    pts.sort((a, b) => a[2] - b[2]);
    ctx.fillStyle = color;
    for (const [x, y, z, hot] of pts) {
      const d = Math.max(0, Math.min(1, (z + 1.15) / 2.3)); // 0 = far, 1 = near
      // Far dots fade to a faint texture and near dots are about 3× wider, as in the reference.
      ctx.globalAlpha = Math.min(1, 0.07 + 0.93 * d ** 2 + hot * 0.5);
      ctx.beginPath();
      ctx.arc(cx + x * R, cy + y * R, R * (0.01 + 0.035 * d) * (1 + hot * 0.6), 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!still) raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  if (!still) frame();

  return {
    setState(s: OrbState) {
      if (spin[s] === undefined) return;
      state = s;
      if (still) frame();
    },
    get state() {
      return state;
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}
