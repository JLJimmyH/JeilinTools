window.APP = window.APP || {};
APP.scene = APP.scene || {};
APP.scene.drawBall = function drawBall(ctx, w, h, state) {
  if (!state.ballShow) return;
  const cx = state.ballCx * w;
  const cy = state.ballCy * h;
  const r = state.ballR;
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.3, state.ballColor);
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
};
