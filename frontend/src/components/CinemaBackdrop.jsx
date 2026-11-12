import { useEffect, useRef } from 'react';

// Renders a full-screen, fixed canvas with slow-drifting glowing
// particles ("dust catching the projector light"), sitting behind every
// page of the app. Mounted once in App.jsx, outside the router, so it
// never unmounts or restarts as the user navigates between pages.
function CinemaBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    let frameId;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#e0318c', '#8b2fc9', '#f5f5f7'];
    const COUNT = Math.min(70, Math.floor((width * height) / 18000));

    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.6,
      speedY: Math.random() * 0.22 + 0.06,
      driftX: Math.random() * 0.3 - 0.15,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.01 + 0.003,
      alpha: Math.random() * 0.35 + 0.15,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.sway += p.swaySpeed;
        p.y -= p.speedY;
        p.x += p.driftX + Math.sin(p.sway) * 0.15;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frameId = requestAnimationFrame(draw);
    };

    if (prefersReducedMotion) {
      // Draw one static frame and stop, respecting the user's OS setting.
      draw();
      cancelAnimationFrame(frameId);
    } else {
      draw();
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}

export default CinemaBackdrop;
