// Session-scoped registry of background images.
// Stores HTMLImageElement plus a small thumbnail dataURL for the gallery UI.
// Not part of state — state only references entries by `id`.
window.APP = window.APP || {};
APP.scene = APP.scene || {};
APP.scene.imageRegistry = (function () {
  const entries = new Map(); // id -> {name, image, thumbDataUrl}
  let counter = 0;

  function makeThumb(image) {
    const W = 64, H = 40;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0, W, H);
    return c.toDataURL("image/png");
  }

  // Accepts either a File (from drop / file input) or a ready HTMLImageElement
  // (from fetch+decode). Returns a Promise<id>.
  function add(source, name) {
    return new Promise(function (resolve, reject) {
      function register(img, label, url) {
        counter += 1;
        const id = "img_" + counter;
        const thumbDataUrl = makeThumb(img);
        entries.set(id, { name: label, image: img, thumbDataUrl: thumbDataUrl, url: url });
        resolve(id);
      }
      if (source instanceof HTMLImageElement) {
        if (source.complete && source.naturalWidth > 0) {
          register(source, name || "image", null);
        } else {
          source.addEventListener("load", function () { register(source, name || "image", null); });
          source.addEventListener("error", function () { reject(new Error("image decode failed")); });
        }
        return;
      }
      // Treat as File / Blob
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = function () {
        register(img, name || (source.name || "image"), url);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });
  }

  function get(id) { return entries.get(id) || null; }
  function list() {
    const out = [];
    entries.forEach(function (v, k) { out.push({ id: k, name: v.name, thumbDataUrl: v.thumbDataUrl }); });
    return out;
  }
  function remove(id) {
    const entry = entries.get(id);
    if (!entry) return false;
    if (entry.url) URL.revokeObjectURL(entry.url);
    return entries.delete(id);
  }

  return { add: add, get: get, list: list, remove: remove };
})();
