window.APP = window.APP || {};
APP.scene = APP.scene || {};
APP.scene.drawMarkers = function drawMarkers(ctx, w, h, state) {
  if (!state.markersShow) return;
  const cx = w / 2;
  const cy = h / 2;
  const L = Math.min(w, h) * 0.18;
  ctx.save();
  ctx.strokeStyle = "#ffdd00";
  ctx.fillStyle = "#ffdd00";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + L);
  ctx.lineTo(cx, cy - L);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - L - 8);
  ctx.lineTo(cx - L * 0.25, cy - L * 0.7);
  ctx.lineTo(cx + L * 0.25, cy - L * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const inset = Math.min(w, h) * 0.08;
  const size = Math.min(w, h) * 0.05;
  const corners = [
    { x: inset, y: inset, color: "#ff3030", num: "1" },
    { x: w - inset, y: inset, color: "#30ff30", num: "2" },
    { x: w - inset, y: h - inset, color: "#3080ff", num: "3" },
    { x: inset, y: h - inset, color: "#ff30ff", num: "4" },
  ];
  for (const c of corners) {
    ctx.save();
    ctx.strokeStyle = c.color;
    ctx.fillStyle = c.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(c.x - size, c.y);
    ctx.lineTo(c.x + size, c.y);
    ctx.moveTo(c.x, c.y - size);
    ctx.lineTo(c.x, c.y + size);
    ctx.stroke();
    ctx.font = "bold " + Math.round(size * 1.3) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.num, c.x + size * 1.6, c.y - size * 1.2);
    ctx.restore();
  }
};
