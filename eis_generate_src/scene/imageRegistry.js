// Session-scoped registry of background images.
// Stores ImageBitmap (decoded with EXIF orientation applied) plus a small
// thumbnail dataURL for the gallery UI.
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

  // Accepts a File, Blob, or HTMLImageElement. Returns Promise<id>.
  // Internally decodes via createImageBitmap so EXIF orientation is honored.
  function add(source, name) {
    const label = name || (source && source.name) || "image";
    return createImageBitmap(source, { imageOrientation: "from-image" })
      .then(function (bitmap) {
        counter += 1;
        const id = "img_" + counter;
        const thumbDataUrl = makeThumb(bitmap);
        entries.set(id, { name: label, image: bitmap, thumbDataUrl: thumbDataUrl });
        return id;
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
    if (entry.image && typeof entry.image.close === "function") {
      try { entry.image.close(); } catch (_) {}
    }
    return entries.delete(id);
  }

  return { add: add, get: get, list: list, remove: remove };
})();
