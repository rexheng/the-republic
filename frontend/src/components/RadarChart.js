import React, { useRef, useEffect } from 'react';
import { DIMENSIONS } from '../utils/evaluation';

// Canvas-based radar chart — no extra dependencies needed
function RadarChart({ evaluations, aggregate, size = 280 }) {
  const canvasRef = useRef(null);
  const dims = DIMENSIONS;
  const center = size / 2;
  const radius = size / 2 - 40;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const angleStep = (2 * Math.PI) / dims.length;
    const startAngle = -Math.PI / 2; // Start from top

    // Helper: get point on radar for dimension index and value (0-100)
    const getPoint = (i, value) => {
      const angle = startAngle + i * angleStep;
      const r = (value / 100) * radius;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      };
    };

    // ─── Grid rings ───
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    [20, 40, 60, 80, 100].forEach(val => {
      ctx.beginPath();
      for (let i = 0; i <= dims.length; i++) {
        const p = getPoint(i % dims.length, val);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // ─── Axis lines ───
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    dims.forEach((_, i) => {
      const p = getPoint(i, 100);
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    // ─── Individual evaluations (transparent polygons) ───
    if (evaluations && evaluations.length > 0) {
      evaluations.forEach((ev, evIdx) => {
        const alpha = Math.max(0.08, 0.25 - evIdx * 0.05);
        ctx.beginPath();
        dims.forEach((d, i) => {
          const val = ev.scores[d.key]?.midpoint || 50;
          const p = getPoint(i, val);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = `rgba(102, 126, 234, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(102, 126, 234, ${alpha + 0.15})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // ─── Aggregate (bold polygon with CI band) ───
    if (aggregate) {
      // CI band (shaded area between low and high)
      ctx.beginPath();
      dims.forEach((d, i) => {
        const val = aggregate[d.key]?.high || 70;
        const p = getPoint(i, val);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      // Reverse for lower bound
      for (let i = dims.length - 1; i >= 0; i--) {
        const val = aggregate[dims[i].key]?.low || 30;
        const p = getPoint(i, val);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(72, 187, 120, 0.12)';
      ctx.fill();

      // Aggregate midpoint line
      ctx.beginPath();
      dims.forEach((d, i) => {
        const val = aggregate[d.key]?.midpoint || 50;
        const p = getPoint(i, val);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.strokeStyle = '#48BB78';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Dots at midpoints
      dims.forEach((d, i) => {
        const val = aggregate[d.key]?.midpoint || 50;
        const p = getPoint(i, val);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#48BB78';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // ─── Labels ───
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    dims.forEach((d, i) => {
      const p = getPoint(i, 118);
      ctx.fillStyle = d.color;
      ctx.fillText(d.short, p.x, p.y);
    });
  }, [evaluations, aggregate, size, center, radius, dims]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="radar-chart"
    />
  );
}

export default RadarChart;
