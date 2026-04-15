(function () {
  const { readState, onChange, initSliderPairs } = APP.ui;
  initSliderPairs();
  const buildTrajectory = APP.motion.buildTrajectory;
  const { createSceneCanvas, renderScene } = APP.render;
  const WarpGL = APP.render.WarpGL;
  const { intrinsic } = APP.mat3;
  const buildGcsv = APP.exports.buildGcsv;
  const { pickDirectory, writeFramesAndScripts } = APP.exports;

  const previewCanvas = document.getElementById("preview");
  const previewCtx = previewCanvas.getContext("2d");
  const timeLabel = document.getElementById("previewTime");
  const progressEl = document.getElementById("exportProgress");

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

  // ---------- Exports ----------
  document.getElementById("btnExportFrames").addEventListener("click", async function () {
    const btn = document.getElementById("btnExportFrames");
    playing = false;
    let dirHandle;
    try {
      dirHandle = await pickDirectory();
    } catch (e) {
      if (e.name === "AbortError") return;
      progressEl.textContent = "無法選擇資料夾: " + e.message;
      return;
    }

    btn.disabled = true;
    try {
      const fps = state.fps;
      const N = Math.round(state.duration * fps);
      if (sceneDirty) refreshScene();

      const Rfn = buildTrajectory(state);
      const gcsvText = buildGcsv(Rfn, state);

      await writeFramesAndScripts({
        dirHandle,
        frameCount: N,
        fps,
        getFrameBlob: async function (i) {
          const t = i / fps;
          renderAt(t);
          progressEl.textContent = "渲染 + 寫入影格 " + (i + 1) + "/" + N;
          return await new Promise(function (res) {
            previewCanvas.toBlob(res, "image/jpeg", 0.92);
          });
        },
        gcsvText,
        progress: function (msg) { progressEl.textContent = msg; },
      });

      progressEl.textContent = "完成:JPG + output.gcsv + encode.bat";
    } catch (e) {
      progressEl.textContent = "匯出失敗: " + e.message;
      console.error(e);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Init ----------
  reallocCanvases();
  renderAt(0);
})();
