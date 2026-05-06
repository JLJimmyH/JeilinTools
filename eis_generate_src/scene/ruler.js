// Pixel ruler overlay drawn on the inner output rect (0..outW, 0..outH).
// Origin (0, 0) is the top-left of the output frame; helps measure crop offsets.
window.APP = window.APP || {};
APP.scene = APP.scene || {};
APP.scene.drawRuler = function drawRuler(ctx, w, h, state) {
  if (!state.rulerShow) return;
  const major = Math.max(10, state.rulerMajor | 0);
  const minor = Math.max(2, state.rulerMinor | 0);

  ctx.save();

  // Backdrop strip on top + left for readability
  const strip = 26;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, w, strip);
  ctx.fillRect(0, 0, strip, h);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.textBaseline = "top";

  // ----- Top ruler (X axis) -----
  ctx.beginPath();
  for (let x = 0; x <= w; x += minor) {
    const isMajor = x % major === 0;
    const len = isMajor ? 12 : 6;
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, len);
  }
  ctx.stroke();

  ctx.textAlign = "left";
  for (let x = 0; x <= w; x += major) {
    const label = String(x);
    // Avoid clipping the last label off the right edge
    const tx = x === 0 ? x + 2 : (x + 2 > w - 28 ? x - 2 - ctx.measureText(label).width : x + 2);
    ctx.fillText(label, tx, 13);
  }

  // ----- Left ruler (Y axis) -----
  ctx.beginPath();
  for (let y = 0; y <= h; y += minor) {
    const isMajor = y % major === 0;
    const len = isMajor ? 12 : 6;
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(len, y + 0.5);
  }
  ctx.stroke();

  ctx.textAlign = "left";
  for (let y = 0; y <= h; y += major) {
    if (y < strip) continue; // skip overlap with corner badge
    ctx.fillText(String(y), 14, y + 2);
  }

  // ----- Origin badge "0,0" -----
  ctx.fillStyle = "#ffd24a";
  ctx.fillRect(0, 0, strip, strip);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("0,0", strip / 2, strip / 2);

  // ----- Faint full-frame grid lines on majors -----
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = major; x < w; x += major) {
    ctx.moveTo(x + 0.5, strip);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = major; y < h; y += major) {
    ctx.moveTo(strip, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();

  ctx.restore();
};
