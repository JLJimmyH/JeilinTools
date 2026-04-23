// Browser-side MP4 export using WebCodecs VideoEncoder + mp4-muxer.
// Requires Chrome/Edge 94+.
window.APP = window.APP || {};
APP.exports = APP.exports || {};
(function () {
  var _cancelled = false;

  APP.exports.cancelMp4 = function () { _cancelled = true; };

  /**
   * Encode canvas frames into an MP4 and trigger download.
   *
   * opts:
   *   canvas        – source canvas (already sized to output resolution)
   *   frameCount    – total frames to encode
   *   fps           – frames per second
   *   renderFrame   – async function(frameIndex) that draws onto `canvas`
   *   progress      – function(pct, msg) called with 0-100 and status text
   *   fileName      – base name for the mp4 file (fallback download only)
   *   fileHandle    – optional FileSystemFileHandle; writes directly when given
   *
   * Returns: Promise<void>  (rejects on error / cancel)
   */
  APP.exports.exportMp4 = async function exportMp4(opts) {
    var canvas = opts.canvas;
    var frameCount = opts.frameCount;
    var fps = opts.fps;
    var renderFrame = opts.renderFrame;
    var progress = opts.progress || function () {};
    var fileName = opts.fileName || "output.mp4";
    var fileHandle = opts.fileHandle || null;

    _cancelled = false;

    // --- Check browser support ---
    if (typeof VideoEncoder === "undefined") {
      throw new Error(
        "您的瀏覽器不支援 VideoEncoder API。\n請使用 Chrome 94+ 或 Edge 94+。"
      );
    }

    progress(0, "載入 MP4 編碼器...");

    // --- Load mp4-muxer from CDN ---
    var MuxerLib;
    try {
      MuxerLib = await import("https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm");
    } catch (e) {
      throw new Error(
        "無法載入 MP4 編碼器。\n" +
        "請確認有網路連線。若從 file:// 開啟，請改用本機伺服器。"
      );
    }

    var Muxer = MuxerLib.Muxer;
    var ArrayBufferTarget = MuxerLib.ArrayBufferTarget;

    var w = canvas.width;
    var h = canvas.height;
    // H.264 requires even dimensions
    if (w % 2 !== 0) w -= 1;
    if (h % 2 !== 0) h -= 1;

    // --- Muxer ---
    var target = new ArrayBufferTarget();
    var muxer = new Muxer({
      target: target,
      video: { codec: "avc", width: w, height: h },
      fastStart: "in-memory",
    });

    // --- Encoder ---
    var encoderError = null;
    var encoder = new VideoEncoder({
      output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); },
      error: function (e) { encoderError = e; },
    });

    // --- Find supported codec ---
    var bitrate = Math.max(4000000, Math.min(20000000, w * h * 5));
    var codecs = [
      "avc1.640033", // High Profile, Level 5.1
      "avc1.4d0033", // Main Profile, Level 5.1
      "avc1.640032", // High Profile, Level 5.0
      "avc1.640028", // High Profile, Level 4.0
    ];
    var cfg = null;
    for (var ai = 0; ai < 2 && !cfg; ai++) {
      var accel = ai === 0 ? "no-preference" : "prefer-software";
      for (var ci = 0; ci < codecs.length && !cfg; ci++) {
        var test = {
          codec: codecs[ci],
          width: w,
          height: h,
          bitrate: bitrate,
          framerate: fps,
          hardwareAcceleration: accel,
          latencyMode: "quality",
        };
        try {
          var sup = await VideoEncoder.isConfigSupported(test);
          if (sup.supported) cfg = test;
        } catch (e) { /* try next */ }
      }
    }
    if (!cfg) {
      throw new Error(
        "找不到支援 " + w + "x" + h + " 的 H.264 編碼設定。\n" +
        "請嘗試降低解析度再匯出。"
      );
    }
    encoder.configure(cfg);

    progress(0, "編碼中... 0/" + frameCount + " 幀 (" + w + "x" + h + ")");

    // --- Encode loop ---
    // For large resolutions (4K), keep the queue very shallow to avoid
    // overwhelming the encoder and to keep memory under control.
    var maxQueue = (w * h > 4000000) ? 2 : 5;
    var keyInterval = Math.max(1, Math.round(fps));
    var BACKPRESSURE_TIMEOUT = 30000; // 30s per frame max wait

    try {
      for (var f = 0; f < frameCount; f++) {
        if (_cancelled) break;
        if (encoderError) throw encoderError;

        await renderFrame(f);

        var vf = new VideoFrame(canvas, {
          timestamp: Math.round(f * 1000000 / fps),
          duration: Math.round(1000000 / fps),
        });
        var keyFrame = f % keyInterval === 0;
        encoder.encode(vf, { keyFrame: keyFrame });
        vf.close();

        // Backpressure — wait for encoder to drain, with timeout
        var bpStart = performance.now();
        while (encoder.encodeQueueSize > maxQueue) {
          if (_cancelled) break;
          if (encoderError) throw encoderError;
          if (performance.now() - bpStart > BACKPRESSURE_TIMEOUT) {
            throw new Error(
              "編碼器在第 " + f + " 幀卡住超過 30 秒。\n" +
              "4K 編碼可能超出瀏覽器硬體編碼能力，請嘗試降低解析度。"
            );
          }
          await new Promise(function (r) { setTimeout(r, 10); });
        }

        // Periodic flush to prevent internal buffer buildup on large frames
        if (f > 0 && f % (keyInterval * 2) === 0) {
          await encoder.flush();
        }

        var pct = (f + 1) / frameCount * 100;
        progress(pct, "編碼中... " + (f + 1) + "/" + frameCount + " 幀 (" + pct.toFixed(1) + "%)");

        // Yield to UI every frame
        await new Promise(function (r) { setTimeout(r, 0); });
      }

      if (_cancelled) {
        encoder.close();
        throw new Error("已取消匯出");
      }

      progress(99, "封裝 MP4...");
      await encoder.flush();
      encoder.close();
      muxer.finalize();

      // --- Write MP4 ---
      var blob = new Blob([target.buffer], { type: "video/mp4" });
      if (fileHandle) {
        var writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      }

      progress(100, "匯出完成！");

    } catch (e) {
      try { encoder.close(); } catch (_) {}
      throw e;
    }
  };
})();
