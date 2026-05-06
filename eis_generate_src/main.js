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
  let state = readState();

  const SCENE_FIELDS = new Set([
    "width", "height",
    "bgType", "bgColor1", "bgColor2", "bgCheckerSize",
    "ballShow", "ballR", "ballCx", "ballCy", "ballColor",
    "markersShow",
    "activeImageId",
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
    let activeImage = null;
    if (state.bgType === "image" && state.activeImageId) {
      const entry = APP.scene.imageRegistry.get(state.activeImageId);
      if (entry) activeImage = entry.image;
    }
    renderScene(sceneCanvas, state.width, state.height, state, activeImage);
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
    if (prev.bgType !== state.bgType) renderThumbs();
    if (!playing) renderAt(0);
  });

  // Sets the active image, switches bgType to "image", and triggers re-render.
  // Writes through the hidden input + select so the UI's onChange path runs.
  function selectImage(id) {
    document.getElementById("activeImageId").value = id;
    const sel = document.getElementById("bgType");
    sel.value = "image";
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    renderThumbs();
  }

  // Re-renders the thumbnail buttons inside .bg-presets, just before the "+" preset.
  // Also marks the current activeImageId thumb as .active.
  function renderThumbs() {
    const presets = document.querySelector(".bg-presets");
    if (!presets) return;
    // Remove existing thumb buttons
    presets.querySelectorAll(".bg-preset--thumb").forEach(function (el) { el.remove(); });
    const plusBtn = presets.querySelector(".bg-preset--image");
    const items = APP.scene.imageRegistry.list();
    items.forEach(function (it) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bg-preset bg-preset--thumb";
      btn.dataset.bg = "image";
      btn.dataset.imageId = it.id;
      btn.title = it.name;
      btn.style.backgroundImage = "url(" + it.thumbDataUrl + ")";
      if (state.activeImageId === it.id && state.bgType === "image") {
        btn.classList.add("active");
      }
      const x = document.createElement("button");
      x.type = "button";
      x.className = "thumb-remove";
      x.textContent = "×";
      x.title = "刪除";
      x.addEventListener("click", function (e) {
        e.stopPropagation();
        removeImage(it.id);
      });
      btn.appendChild(x);
      btn.addEventListener("click", function () {
        selectImage(it.id);
      });
      presets.insertBefore(btn, plusBtn);
    });
  }

  function removeImage(id) {
    const wasActive = state.activeImageId === id;
    APP.scene.imageRegistry.remove(id);
    if (wasActive) {
      const remaining = APP.scene.imageRegistry.list();
      if (remaining.length > 0) {
        selectImage(remaining[0].id);
      } else {
        document.getElementById("activeImageId").value = "";
        const sel = document.getElementById("bgType");
        sel.value = "checker";
        sel.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    renderThumbs();
  }

  document.getElementById("bgImage").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    APP.scene.imageRegistry.add(file).then(function (id) {
      selectImage(id);
    }).catch(function (err) {
      console.warn("圖片載入失敗:", err);
    });
  });

  // ---------- Export MP4 ----------
  let exportInProgress = false;
  const mp4Overlay = document.getElementById("exportOverlay");
  const mp4BarFill = document.getElementById("mp4BarFill");
  const mp4Status = document.getElementById("mp4Status");

  // Build a descriptive filename from the active shake + key params so the
  // saved pair is self-describing (e.g. eis_fps60_d3s_x8A2Hz_y5A1.5Hz_z0A0Hz).
  function buildOutputBaseName(s) {
    function n(v) {
      if (v == null || !isFinite(v)) return "0";
      return (Math.round(v * 100) / 100).toString().replace(".", "p");
    }
    const parts = ["eis"];
    parts.push("fps" + n(s.fps));
    parts.push("d" + n(s.duration) + "s");
    parts.push("x" + n(s.sinAx) + "A" + n(s.sinFx) + "Hz");
    parts.push("y" + n(s.sinAy) + "A" + n(s.sinFy) + "Hz");
    parts.push("z" + n(s.sinAz) + "A" + n(s.sinFz) + "Hz");
    parts.push("g" + n(s.gyroRate));
    return parts.join("_");
  }

  document.getElementById("btnCancelMp4").addEventListener("click", function () {
    cancelMp4();
  });

  document.getElementById("btnExportMp4").addEventListener("click", async function () {
    const btn = document.getElementById("btnExportMp4");
    playing = false;

    const fps2 = state.fps;
    const baseName = buildOutputBaseName(state);
    const mp4FileName = baseName + ".mp4";
    const gcsvFileName = baseName + ".gcsv";

    // Let user pick a directory; both files are written there with the
    // auto-generated base name. Fallback to download links if API missing.
    const hasDirApi = typeof window.showDirectoryPicker === "function";
    let dirHandle = null, mp4Handle = null, gcsvHandle = null;
    if (hasDirApi) {
      try {
        dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      } catch (e) {
        if (e && e.name === "AbortError") return; // user cancelled
        console.warn("Directory picker unavailable, falling back to download:", e);
      }
      if (dirHandle) {
        try {
          mp4Handle = await dirHandle.getFileHandle(mp4FileName, { create: true });
          gcsvHandle = await dirHandle.getFileHandle(gcsvFileName, { create: true });
        } catch (e) {
          console.warn("Failed to create output handles, falling back to download:", e);
          mp4Handle = null;
          gcsvHandle = null;
        }
      }
    }

    exportInProgress = true;
    btn.disabled = true;
    mp4Overlay.classList.add("visible");
    mp4BarFill.style.width = "0%";
    mp4Status.textContent = "準備中...";

    try {
      if (sceneDirty) refreshScene();
      const N = Math.round(state.duration * fps2);
      const Rfn = buildTrajectory(state);

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
        fileName: mp4FileName,
        fileHandle: mp4Handle,
      });

      // --- Write gcsv ---
      if (gcsvHandle) {
        const writable = await gcsvHandle.createWritable();
        await writable.write(gcsvText);
        await writable.close();
      } else {
        const gcsvBlob = new Blob([gcsvText], { type: "text/csv" });
        const gcsvUrl = URL.createObjectURL(gcsvBlob);
        const gcsvA = document.createElement("a");
        gcsvA.href = gcsvUrl;
        gcsvA.download = gcsvFileName;
        gcsvA.click();
        setTimeout(function () { URL.revokeObjectURL(gcsvUrl); }, 3000);
      }

      mp4Status.textContent = "完成！MP4 + gcsv 已輸出";
      await new Promise(function (r) { setTimeout(r, 1200); });
    } catch (e) {
      if (e.message !== "已取消匯出") {
        console.error("MP4 export error:", e);
        alert("MP4 匯出失敗：\n" + e.message);
      }
      mp4Status.textContent = "";
    } finally {
      exportInProgress = false;
      mp4Overlay.classList.remove("visible");
      btn.disabled = false;
      renderAt(0);
    }
  });

  // ---------- Drag & Drop ----------
  const dropOverlay = document.getElementById("dropOverlay");
  let dragDepth = 0; // counter to handle nested dragenter/leave

  function hasFiles(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
      if (types[i] === "Files") return true;
    }
    return false;
  }

  document.addEventListener("dragenter", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth += 1;
    dropOverlay.classList.add("visible");
  });
  document.addEventListener("dragover", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  document.addEventListener("dragleave", function (e) {
    if (!hasFiles(e)) return;
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      dropOverlay.classList.remove("visible");
    }
  });
  document.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    if (exportInProgress) {
      e.preventDefault();
      dragDepth = 0;
      dropOverlay.classList.remove("visible");
      return;
    }
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.remove("visible");
    const files = Array.from(e.dataTransfer.files).filter(function (f) {
      return f.type && f.type.startsWith("image/");
    });
    if (files.length === 0) return;
    let lastIdPromise = Promise.resolve(null);
    files.forEach(function (f) {
      lastIdPromise = APP.scene.imageRegistry.add(f).then(function (id) {
        renderThumbs();
        return id;
      }).catch(function (err) {
        console.warn("圖片載入失敗:", err);
        return null;
      });
    });
    lastIdPromise.then(function (lastId) {
      if (lastId) selectImage(lastId);
    });
  });

  // ---------- Init ----------
  reallocCanvases();
  renderAt(0);

  // Auto-load default natural scene image from a hidden <img> tag.
  // Using <img> instead of fetch() so it works on file:// origins.
  (function loadDefaultImage() {
    const img = document.getElementById("natureDefaultImg");
    if (!img) return;
    function attempt() {
      APP.scene.imageRegistry.add(img, "nature_default.jpg").then(function (id) {
        renderThumbs();
        // Only auto-select if user hasn't touched the bg yet
        if (state.bgType === "checker" && !state.activeImageId) {
          selectImage(id);
        }
      }).catch(function (err) {
        console.warn("nature_default.jpg 載入失敗:", err);
      });
    }
    if (img.complete && img.naturalWidth > 0) {
      attempt();
    } else if (img.complete) {
      console.warn("nature_default.jpg 載入失敗: image element reports not loaded");
    } else {
      img.addEventListener("load", attempt, { once: true });
      img.addEventListener("error", function () {
        console.warn("nature_default.jpg 載入失敗: image error event");
      }, { once: true });
    }
  })();
})();
