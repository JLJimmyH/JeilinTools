window.APP = window.APP || {};
APP.scene = APP.scene || {};
APP.scene.drawBackground = function drawBackground(ctx, w, h, state, loadedImage) {
  switch (state.bgType) {
    case "solid":
      ctx.fillStyle = state.bgColor1;
      ctx.fillRect(0, 0, w, h);
      break;
    case "gradient": {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, state.bgColor1);
      g.addColorStop(1, state.bgColor2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "image":
      if (loadedImage) {
        ctx.drawImage(loadedImage, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#888";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("未載入圖片", w / 2, h / 2);
      }
      break;
    case "checker":
    default: {
      const size = Math.max(2, state.bgCheckerSize | 0);
      ctx.fillStyle = state.bgColor1;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = state.bgColor2;
      for (let y = 0; y < h; y += size) {
        for (let x = ((y / size) & 1) * size; x < w; x += size * 2) {
          ctx.fillRect(x, y, size, size);
        }
      }
      break;
    }
  }
};
