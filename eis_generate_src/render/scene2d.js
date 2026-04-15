window.APP = window.APP || {};
APP.render = APP.render || {};
(function () {
  // Oversize factor. A rotation around yaw can shift a pixel by up to fx·tan(θ);
  // 1.6 leaves headroom for moderate shakes without exposing black edges.
  const OVERSCAN = 1.6;
  APP.render.OVERSCAN = OVERSCAN;

  APP.render.createSceneCanvas = function createSceneCanvas(outW, outH) {
    const W = Math.round(outW * OVERSCAN);
    const H = Math.round(outH * OVERSCAN);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    return canvas;
  };

  APP.render.renderScene = function renderScene(sceneCanvas, outW, outH, state, loadedImage) {
    const ctx = sceneCanvas.getContext("2d");
    const W = sceneCanvas.width;
    const H = sceneCanvas.height;
    APP.scene.drawBackground(ctx, W, H, state, loadedImage);
    const offX = (W - outW) / 2;
    const offY = (H - outH) / 2;
    ctx.save();
    ctx.translate(offX, offY);
    APP.scene.drawBall(ctx, outW, outH, state);
    APP.scene.drawMarkers(ctx, outW, outH, state);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, outW, outH);
    ctx.restore();
  };
})();
