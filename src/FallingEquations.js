import React, { useEffect, useRef } from 'react';

// Ambient background: math expressions drifting gently downward on a full-window
// canvas, sitting behind all app content (pointer-events: none, fixed, -z-10).
// Deliberately low-contrast so it reads as texture, not noise. Honors
// prefers-reduced-motion by painting a single static frame instead of animating.
const EXPRESSIONS = [
  'E = mc²', 'a² + b² = c²', 'eⁱᵖ + 1 = 0', '∫₀^∞ e^{-x²} dx = √π⁄2',
  '∑ 1⁄n² = π²⁄6', '∇·E = ρ⁄ε₀', 'Δ = b² − 4ac', 'sin²θ + cos²θ = 1',
  'f′(x) = lim_{h→0} Δf⁄h', 'x = (−b ± √Δ) ⁄ 2a', '∂u⁄∂t = α∇²u', 'det(A − λI) = 0',
  'φ = (1 + √5) ⁄ 2', 'PV = nRT', 'F = ma', 'lim_{x→∞} 1⁄x = 0',
  'n! = n·(n−1)!', '∮ E·dl = −dΦ⁄dt', 'log(xy) = log x + log y', 'π ≈ 3.14159',
  '∀ε>0 ∃δ>0', 'i² = −1', '∇×B = μ₀J', 'ζ(s) = ∑ n^{−s}',
  'cosθ + i·sinθ', '√2 ≈ 1.41421', 'dy⁄dx', 'θ = τ⁄4',
  'H = −∑ p·log p', 'AᵀA = I', 'x → x²', '∆x·∆p ≥ ℏ⁄2',
];

const COLORS = [
  'rgba(96, 165, 250, ALPHA)',   // blue-400
  'rgba(167, 139, 250, ALPHA)',  // purple-400
  'rgba(244, 114, 182, ALPHA)',  // pink-400
  'rgba(45, 212, 191, ALPHA)',   // teal-400
];

export default function FallingEquations() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let items = [];
    let rafId = null;
    let running = true;

    const rand = (min, max) => min + Math.random() * (max - min);

    const makeItem = (seedTop) => {
      const size = rand(13, 30);
      // Bigger glyphs drift faster and sit slightly more opaque -> depth.
      const depth = (size - 13) / 17;
      const base = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        text: EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)],
        x: rand(0, width),
        y: seedTop ? rand(-height * 0.3, height) : rand(-160, -20),
        size,
        speed: rand(0.12, 0.35) + depth * 0.35,
        drift: rand(-0.18, 0.18),
        phase: rand(0, Math.PI * 2),
        sway: rand(0.0006, 0.0016),
        alpha: rand(0.06, 0.13) + depth * 0.06,
        color: base,
        rot: rand(-0.06, 0.06),
      };
    };

    const seedItems = () => {
      const density = Math.round((width * height) / 46000);
      const count = Math.max(14, Math.min(46, density));
      items = Array.from({ length: count }, () => makeItem(true));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedItems();
      if (reduceMotion) draw(0);
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, width, height);
      ctx.textBaseline = 'middle';
      for (const it of items) {
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot + Math.sin(t * it.sway + it.phase) * 0.04);
        ctx.font = `${it.size}px "Patrick Hand", ui-monospace, "SFMono-Regular", Menlo, monospace`;
        ctx.fillStyle = it.color.replace('ALPHA', it.alpha.toFixed(3));
        ctx.fillText(it.text, 0, 0);
        ctx.restore();
      }
    };

    const step = (t) => {
      if (!running) return;
      for (const it of items) {
        it.y += it.speed;
        it.x += it.drift + Math.sin(t * it.sway + it.phase) * 0.25;
        if (it.y - it.size > height + 40) {
          Object.assign(it, makeItem(false));
        }
        if (it.x > width + 260) it.x = -260;
        else if (it.x < -260) it.x = width + 260;
      }
      draw(t);
      rafId = requestAnimationFrame(step);
    };

    resize();
    window.addEventListener('resize', resize);

    if (!reduceMotion) {
      rafId = requestAnimationFrame(step);
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      } else if (!reduceMotion && !running) {
        running = true;
        rafId = requestAnimationFrame(step);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
