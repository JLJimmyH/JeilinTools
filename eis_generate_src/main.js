(function () {
  const { readState, onChange, initSliderPairs } = APP.ui;
  initSliderPairs();
  const buildTrajectory = APP.motion.buildTrajectory;
  const { createSceneCanvas, renderScene } = APP.render;
  const WarpGL = APP.render.WarpGL;
  const { intrinsic } = APP.mat3;
  const buildGcsv = APP.exports.buildGcsv;
  const { exportMp4, cancelMp4 } = APP.exports;

  const previewCanvas = document.getElementById("preview");
  const previewCtx = previewCanvas.getContext("2d");
  const timeLabel = document.getElementById("previewTime");
  const glCanvas = document.createElement("canvas");
  const warpGL = new WarpGL(glCanvas);

  let sceneCanvas = null;
  let sceneDirty = true;
  let loadedImage = null;
  let state = readState();

  const SCENE_FIELDS = new Set([
    "width", "height",
    "bgType", "bgColor1", "bgColor2", "bgCheckerSize",
    "ballShow", "ballR", "ballCx", "ballCy", "ballColor",
    "markersShow",
  ]);

  function reallocCanvases() {
    const { width, height } = state;
    previewCanvas.width = width;
    previewCanvas.height = height;
    if (!sceneCanvas || sceneCanvas.width !== Math.round(width * APP.render.OVERSCAN)) {
      sceneCanvas = createSceneCanvas(width, height);
    }
    warpGL.resize(width, height);
    sceneDirty = true;
  }

  function refreshScene() {
    renderScene(sceneCanvas, state.width, state.height, state, loadedImage);
    warpGL.uploadSource(sceneCanvas);
    sceneDirty = false;
  }

  function renderAt(t) {
    if (sceneDirty) refreshScene();
    const Rfn = buildTrajectory(state);
    const R = Rfn(t);
    const K = intrinsic(state.fx, state.fy, state.cx, state.cy);
    const W = state.width, H = state.height;
    const sW = sceneCanvas.width, sH = sceneCanvas.height;

    warpGL.draw(R, K, W, H, sW, sH);
    previewCtx.clearRect(0, 0, W, H);
    previewCtx.drawImage(glCanvas, 0, 0);
    timeLabel.textContent = "t = " + t.toFixed(3) + " s";
    document.dispatchEvent(new CustomEvent("previewframe", { detail: { t: t, duration: state.duration } }));
  }

  // ---------- Playback ----------
  let playing = false;
  let playStartWall = 0;
  let playStartT = 0;

  function loop() {
    if (!playing) return;
    const wall = (performance.now() - playStartWall) / 1000;
    let t = playStartT + wall;
    if (t >= state.duration) {
      t = 0;
      playStartWall = performance.now();
      playStartT = 0;
    }
    renderAt(t);
    requestAnimationFrame(loop);
  }

  document.getElementById("btnPlay").addEventListener("click", function () {
    if (playing) return;
    playing = true;
    playStartWall = performance.now();
    playStartT = 0;
    loop();
  });
  document.getElementById("btnStop").addEventListener("click", function () {
    playing = false;
    renderAt(0);
  });

  // ---------- UI reactivity ----------
  onChange(function () {
    const prev = state;
    state = readState();
    if (prev.width !== state.width || prev.height !== state.height) {
      reallocCanvases();
    } else {
      for (const k of SCENE_FIELDS) {
        if (prev[k] !== state[k]) { sceneDirty = true; break; }
      }
    }
    if (!playing) renderAt(0);
  });

  document.getElementById("bgImage").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = function () {
      loadedImage = img;
      sceneDirty = true;
      if (!playing) renderAt(0);
    };
    img.src = URL.createObjectURL(file);
  });

  // ---------- Export MP4 ----------
  const mp4Overlay = document.getElementById("exportOverlay");
  const mp4BarFill = document.getElementById("mp4BarFill");
  const mp4Status = document.getElementById("mp4Status");

  document.getElementById("btnCancelMp4").addEventListener("click", function () {
    cancelMp4();
  });

  document.getElementById("btnExportMp4").addEventListener("click", async function () {
    const btn = document.getElementById("btnExportMp4");
    playing = false;
    btn.disabled = true;
    mp4Overlay.classList.add("visible");
    mp4BarFill.style.width = "0%";
    mp4Status.textContent = "準備中...";

    try {
      if (sceneDirty) refreshScene();
      const fps2 = state.fps;
      const N = Math.round(state.duration * fps2);
      const Rfn = buildTrajectory(state);

      // Build gcsv and trigger its download alongside the mp4
      const gcsvText = buildGcsv(Rfn, state);

      await exportMp4({
        canvas: previewCanvas,
        frameCount: N,
        fps: fps2,
        renderFrame: async function (i) {
          const t = i / fps2;
          renderAt(t);
        },
        progress: function (pct, msg) {
          mp4BarFill.style.width = pct + "%";
          mp4Status.textContent = msg;
        },
        fileName: "eis_output_" + state.width + "x" + state.height + "_" + fps2 + "fps.mp4",
      });

      // Also download gcsv
      const gcsvBlob = new Blob([gcsvText], { type: "text/csv" });
      const gcsvUrl = URL.createObjectURL(gcsvBlob);
      const gcsvA = document.createElement("a");
      gcsvA.href = gcsvUrl;
      gcsvA.download = "output.gcsv";
      gcsvA.click();
      setTimeout(function () { URL.revokeObjectURL(gcsvUrl); }, 3000);

      mp4Status.textContent = "完成！MP4 + gcsv 已下載";
      await new Promise(function (r) { setTimeout(r, 1200); });
    } catch (e) {
      if (e.message !== "已取消匯出") {
        console.error("MP4 export error:", e);
        alert("MP4 匯出失敗：\n" + e.message);
      }
      mp4Status.textContent = "";
    }

    mp4Overlay.classList.remove("visible");
    btn.disabled = false;
    renderAt(0);
  });

  // ---------- Init ----------
  reallocCanvases();
  renderAt(0);
})();
