# 自然場景圖片 Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 `eis_generate.html` 加入整頁 drag-drop 圖片載入與 session 內多圖縮圖 gallery，預設載入 `nature_default.jpg`。

**Architecture:** 新增 `imageRegistry.js` 管理 Map<id, {name, image, thumbDataUrl}>（不入 state，view-side data），`state.activeImageId` 指向當前選中的圖。`drawBackground` 改為從外部接收 resolved `Image`，由 `main.js` 統一查 registry 並傳入。

**Tech Stack:** 純 vanilla JS（IIFE 註冊到 `window.APP`）、Canvas 2D / WebGL、無自動化測試框架；驗證採瀏覽器手動 smoke test。

**Spec:** `docs/superpowers/specs/2026-05-06-natural-scene-image-gallery-design.md`

---

## 注意事項

- **無測試框架**：本專案沒有 unit test runner，所有「驗證」步驟都是開瀏覽器、看 console、操作 UI 確認。每個 Task 完成後在 commit 前執行驗證。
- **檔案編輯規範**：所有 `eis_generate_src/` 下的 JS 檔皆是 IIFE 註冊到 `window.APP`，遵循同樣模式
- **路徑**：所有絕對路徑以 `D:/_Work/Tools/JeilinTools/` 為根
- **瀏覽器**：用 file:// 直接開 `eis_generate.html` 即可，但 `fetch("nature_default.jpg")` 需要 http server。建議用 `python -m http.server 8000` 起服務後從 `http://localhost:8000/eis_generate.html` 開（開發者應在開始前確認這個本機 server 流程）

---

### Task 1: 新增 imageRegistry.js 模組

**Files:**
- Create: `D:/_Work/Tools/JeilinTools/eis_generate_src/scene/imageRegistry.js`

- [ ] **Step 1: 建立 imageRegistry.js**

寫入以下完整內容：

```javascript
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
      function register(img, label) {
        counter += 1;
        const id = "img_" + counter;
        const thumbDataUrl = makeThumb(img);
        entries.set(id, { name: label, image: img, thumbDataUrl: thumbDataUrl });
        resolve(id);
      }
      if (source instanceof HTMLImageElement) {
        if (source.complete && source.naturalWidth > 0) {
          register(source, name || "image");
        } else {
          source.addEventListener("load", function () { register(source, name || "image"); });
          source.addEventListener("error", function () { reject(new Error("image decode failed")); });
        }
        return;
      }
      // Treat as File / Blob
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = function () {
        register(img, name || (source.name || "image"));
        // keep object URL alive — img references it until page unload
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
  function remove(id) { return entries.delete(id); }

  return { add: add, get: get, list: list, remove: remove };
})();
```

- [ ] **Step 2: 在 HTML 載入此 script**

修改 `D:/_Work/Tools/JeilinTools/eis_generate.html`，在 `<script src="eis_generate_src/scene/background.js"></script>` 之前插入一行：

```html
<script src="eis_generate_src/scene/imageRegistry.js"></script>
```

- [ ] **Step 3: 瀏覽器驗證**

1. 開啟 `eis_generate.html`
2. F12 開 console，輸入：
   ```javascript
   APP.scene.imageRegistry.list()
   ```
   預期輸出：`[]`
3. 確認沒有任何 console error

- [ ] **Step 4: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate_src/scene/imageRegistry.js eis_generate.html
git commit -m "新增 imageRegistry 模組

session 內存放 background images 的 Map，提供 add/get/list/remove。
add() 內建縮圖產生（64x40 PNG dataURL）給後續 gallery UI 使用。"
```

---

### Task 2: background.js + scene2d.js 改為接收 resolved image 參數

**Files:**
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/scene/background.js`
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/render/scene2d.js`
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/main.js`

此 task 只改函式簽名，行為不變，確保既有 `+` 上傳圖片的流程仍正常。

- [ ] **Step 1: 修改 background.js 的 image case**

打開 `eis_generate_src/scene/background.js`，找到 `image` case：

```javascript
    case "image":
      if (loadedImage) {
        ctx.drawImage(loadedImage, 0, 0, w, h);
      } else {
```

`loadedImage` 改名為 `activeImage`（簽名也要改）。完整替換 function 為：

```javascript
window.APP = window.APP || {};
APP.scene = APP.scene || {};
APP.scene.drawBackground = function drawBackground(ctx, w, h, state, activeImage) {
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
      if (activeImage) {
        ctx.drawImage(activeImage, 0, 0, w, h);
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
```

- [ ] **Step 2: 修改 scene2d.js 中介層轉發**

打開 `eis_generate_src/render/scene2d.js`，找到 `renderScene` 函式，把 `loadedImage` 改名 `activeImage` 並轉傳：

```javascript
  APP.render.renderScene = function renderScene(sceneCanvas, outW, outH, state, activeImage) {
    const ctx = sceneCanvas.getContext("2d");
    const W = sceneCanvas.width;
    const H = sceneCanvas.height;
    APP.scene.drawBackground(ctx, W, H, state, activeImage);
    const offX = (W - outW) / 2;
    const offY = (H - outH) / 2;
    ctx.save();
    ctx.translate(offX, offY);
    APP.scene.drawBall(ctx, outW, outH, state);
    APP.scene.drawMarkers(ctx, outW, outH, state);
    APP.scene.drawRuler(ctx, outW, outH, state);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, outW, outH);
    ctx.restore();
  };
```

- [ ] **Step 3: 修改 main.js refreshScene 呼叫點**

打開 `eis_generate_src/main.js`，找 `refreshScene`：

```javascript
  function refreshScene() {
    renderScene(sceneCanvas, state.width, state.height, state, loadedImage);
    warpGL.uploadSource(sceneCanvas);
    sceneDirty = false;
  }
```

`loadedImage` 在這個 task 仍然存在（下個 task 才會被替換掉），所以這裡只要把參數名改一致即可（其實程式無變化，因為傳的還是 `loadedImage` 變數）。**保持不動**。

- [ ] **Step 4: 瀏覽器驗證**

1. 開 `eis_generate.html`
2. 點 `+` 按鈕 → 選一張圖 → 確認背景變成那張圖（既有行為不變）
3. console 無 error

- [ ] **Step 5: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate_src/scene/background.js eis_generate_src/render/scene2d.js
git commit -m "重構 drawBackground 改為接收 resolved image 參數

把 loadedImage 改名 activeImage 並從外部傳入，為後續多圖 gallery
鋪路（registry 之外無人持有 image 物件）。行為不變。"
```

---

### Task 3: 在 main.js 改用 registry，在 ui.js / html 加 activeImageId 欄位

**Files:**
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/main.js`
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/ui.js`
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate.html`

- [ ] **Step 1: 在 ui.js 加入 activeImageId 到 STR_FIELDS**

打開 `eis_generate_src/ui.js`，把：

```javascript
  const STR_FIELDS = ["bgType", "bgColor1", "bgColor2", "ballColor"];
```

改為：

```javascript
  const STR_FIELDS = ["bgType", "bgColor1", "bgColor2", "ballColor", "activeImageId"];
```

- [ ] **Step 2: 在 HTML 加入隱藏的 activeImageId input**

打開 `eis_generate.html`，找到：

```html
      <select id="bgType" style="display:none;">
```

在這行**之前**插入：

```html
      <input type="hidden" id="activeImageId" value="">
```

- [ ] **Step 3: 移除 main.js 的 loadedImage 並改用 registry**

打開 `eis_generate_src/main.js`：

A) 移除這行（約第 19 行）：
```javascript
  let loadedImage = null;
```

B) 把 `SCENE_FIELDS` 集合改為（加 `activeImageId`）：
```javascript
  const SCENE_FIELDS = new Set([
    "width", "height",
    "bgType", "bgColor1", "bgColor2", "bgCheckerSize",
    "ballShow", "ballR", "ballCx", "ballCy", "ballColor",
    "markersShow",
    "activeImageId",
  ]);
```

C) 把 `refreshScene` 改為查 registry：
```javascript
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
```

D) 把 `bgImage` change handler 改為加進 registry 並 select：
```javascript
  document.getElementById("bgImage").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    APP.scene.imageRegistry.add(file).then(function (id) {
      selectImage(id);
    }).catch(function (err) {
      console.warn("圖片載入失敗:", err);
    });
  });
```

E) 在 `bgImage` handler 之上，新增一個 helper（同 IIFE 內）：
```javascript
  // Sets the active image, switches bgType to "image", and triggers re-render.
  // Writes through the hidden input + select so the UI's onChange path runs.
  function selectImage(id) {
    document.getElementById("activeImageId").value = id;
    const sel = document.getElementById("bgType");
    sel.value = "image";
    sel.dispatchEvent(new Event("input", { bubbles: true }));
  }
```

- [ ] **Step 4: 瀏覽器驗證**

1. 開 `eis_generate.html`
2. F12 console 輸入 `APP.ui.readState().activeImageId`，預期空字串 `""`
3. 點 `+` → 選圖 → 背景變成該圖
4. console 再輸入 `APP.ui.readState().activeImageId`，預期 `"img_1"`
5. 再點 `+` 選另一張圖 → 背景變成新的；console `APP.ui.readState().activeImageId` 預期 `"img_2"`
6. F5 重整 → state 重置（registry 也會 reset）

- [ ] **Step 5: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate_src/main.js eis_generate_src/ui.js eis_generate.html
git commit -m "main.js 改用 imageRegistry + 新增 activeImageId state 欄位

移除單一 loadedImage 變數，改為 registry 多圖管理，state 用
activeImageId 引用當前選中圖。+ 按鈕改為 add 進 registry 並
auto-select。SCENE_FIELDS 加 activeImageId 以正確觸發 dirty。"
```

---

### Task 4: 加縮圖 gallery（render thumbs + click + 刪除）

**Files:**
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate.html`
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/main.js`

- [ ] **Step 1: 加縮圖 CSS**

打開 `eis_generate.html`，找到 `<style>` 區塊內任意位置（建議在現有 `.bg-preset` 樣式附近，可用 grep 搜尋 `bg-preset` 找位置）。在合適處插入：

```css
.bg-preset.bg-preset--thumb {
  position: relative;
  width: 36px;
  height: 36px;
  background-size: cover;
  background-position: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
.bg-preset.bg-preset--thumb .thumb-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(0,0,0,0.8);
  color: #fff;
  border: 1px solid var(--accent);
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  display: none;
  cursor: pointer;
  padding: 0;
}
.bg-preset.bg-preset--thumb:hover .thumb-remove {
  display: block;
}
```

- [ ] **Step 2: main.js 新增 renderThumbs() 與事件**

打開 `eis_generate_src/main.js`，在 `selectImage` 下方加入：

```javascript
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
```

- [ ] **Step 3: 在 selectImage 之後與每次 add 之後 call renderThumbs**

修改 `selectImage` 函式為（加最後一行 renderThumbs）：

```javascript
  function selectImage(id) {
    document.getElementById("activeImageId").value = id;
    const sel = document.getElementById("bgType");
    sel.value = "image";
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    renderThumbs();
  }
```

注意：`onChange` 觸發時 `state` 已更新，所以 `renderThumbs` 內讀 `state.activeImageId` 是新值。但 `selectImage` 同步呼叫 `dispatchEvent` 後 `onChange` 會立即跑（同步），所以順序是 OK 的。

- [ ] **Step 4: 瀏覽器驗證**

1. 開 `eis_generate.html`
2. 點 `+` 上傳一張 → 看到縮圖出現在 `+` 按鈕左邊，且該縮圖有綠光邊框（active）
3. 再上傳第二張 → 出現第二個縮圖；第二張變 active
4. 點第一張縮圖 → 背景切回去，active 框跟著移動
5. Hover 縮圖 → 右上角出現 ×
6. 點 × 刪除非 active 的圖 → 縮圖消失
7. 刪除 active 的圖 → 自動切到剩下的第一張
8. 全部刪光 → 背景變棋盤格

- [ ] **Step 5: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate.html eis_generate_src/main.js
git commit -m "加入縮圖 gallery 與點擊切換 / hover 刪除

renderThumbs 把 registry list 渲染成 .bg-preset--thumb 按鈕，
插在現有 + 按鈕之前。active 縮圖套用既有 .active 樣式。
刪除 active 時退回 list 第一張，list 空則退回 checker。"
```

---

### Task 5: 整頁 drag-drop overlay 與 handler

**Files:**
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate.html`
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/main.js`

- [ ] **Step 1: 加 overlay HTML 與 CSS**

打開 `eis_generate.html`，在 `</body>` 之前、其他 overlay（如 `exportOverlay`）之後加入：

```html
<div id="dropOverlay" class="drop-overlay">
  <div class="drop-overlay-text">拖放圖片以新增背景</div>
</div>
```

在 `<style>` 區塊適當處（例如 `.export-overlay` 樣式附近）加入：

```css
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 255, 136, 0.10);
  border: 4px dashed var(--accent);
  display: none;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.drop-overlay.visible { display: flex; }
.drop-overlay-text {
  font-family: 'Courier New', monospace;
  font-size: 1.4rem;
  color: var(--accent);
  text-shadow: 0 0 8px var(--accent);
  letter-spacing: 0.15em;
}
```

- [ ] **Step 2: 在 main.js 加 drag-drop handler**

打開 `eis_generate_src/main.js`，在 `// ---------- Init ----------` 之前新增：

```javascript
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
```

- [ ] **Step 3: 瀏覽器驗證**

1. 開 `eis_generate.html`
2. 從檔案管理員拖一張 .jpg 進頁面任意位置 → 出現綠色 dashed overlay
3. 放手 → overlay 消失，新縮圖出現，自動變 active
4. 一次拖兩張 → 兩個縮圖都加進去，最後一張變 active
5. 拖一個 .txt 進來 → overlay 短暫出現再消失，gallery 不變（console 無 error）
6. 拖到頁面外面再拖回來 → overlay 行為正常（不會卡住顯示）

- [ ] **Step 4: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate.html eis_generate_src/main.js
git commit -m "加入整頁 drag-drop 圖片載入與 overlay 提示

監聽 document 層級 dragenter/over/leave/drop，過濾 image MIME。
用 dragDepth counter 處理子元素間的 enter/leave 事件交織問題。
多檔同時拖時全部加入，最後一張 select 為 active。"
```

---

### Task 6: 啟動時自動載入 nature_default.jpg

**Files:**
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/main.js`

- [ ] **Step 1: 在 Init 區塊加入 fetch 邏輯**

打開 `eis_generate_src/main.js`，找到：

```javascript
  // ---------- Init ----------
  reallocCanvases();
  renderAt(0);
})();
```

替換為：

```javascript
  // ---------- Init ----------
  reallocCanvases();
  renderAt(0);

  // Auto-load default natural scene image. Failure is non-fatal.
  (function loadDefaultImage() {
    fetch("nature_default.jpg").then(function (res) {
      if (!res.ok) throw new Error("status " + res.status);
      return res.blob();
    }).then(function (blob) {
      return APP.scene.imageRegistry.add(blob, "nature_default.jpg");
    }).then(function (id) {
      renderThumbs();
      // Only auto-select if user hasn't touched the bg yet
      if (state.bgType === "checker" && !state.activeImageId) {
        selectImage(id);
      }
    }).catch(function (err) {
      console.warn("nature_default.jpg 載入失敗:", err);
    });
  })();
})();
```

- [ ] **Step 2: 啟動本機 server 驗證**

`fetch()` 走 file:// 在多數瀏覽器會被擋。終端執行：

```bash
cd D:/_Work/Tools/JeilinTools
python -m http.server 8000
```

在瀏覽器開 `http://localhost:8000/eis_generate.html`：

1. 開頁瞬間應看到背景是 `nature_default.jpg`，gallery 內有一張縮圖且為 active
2. 拖另一張圖進來 → 第二個縮圖出現並變 active；第一張 nature_default 仍在
3. 點 nature_default 縮圖 → 背景切回去
4. F5 重整 → 又只剩 nature_default（registry 重建）

驗證 fallback：
1. 暫時把 `nature_default.jpg` 改名為 `nature_default.bak`
2. 重整 → console 看到 `nature_default.jpg 載入失敗:` warning，背景是棋盤格，gallery 空
3. 改回原名

- [ ] **Step 3: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate_src/main.js
git commit -m "啟動時自動載入 nature_default.jpg 進 gallery

fetch 進 registry 並 auto-select；若使用者已在等待期間切過背景則
不搶。fetch 失敗 console.warn 不阻擋啟動，gallery 留空。"
```

---

### Task 7: MP4 匯出期間鎖定 drop

**Files:**
- Modify: `D:/_Work/Tools/JeilinTools/eis_generate_src/main.js`

- [ ] **Step 1: 加旗標並在 drop handler 早退**

打開 `eis_generate_src/main.js`：

A) 在 `// ---------- Drag & Drop ----------` 區塊頂部、`const dropOverlay` 那行**之前**加入：

```javascript
  let exportInProgress = false;
```

B) 在 `drop` event handler 開頭（`if (!hasFiles(e)) return;` **之後**）加入：

```javascript
    if (exportInProgress) {
      e.preventDefault();
      dragDepth = 0;
      dropOverlay.classList.remove("visible");
      return;
    }
```

完整 drop handler 變成：

```javascript
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
```

C) 在 `btnExportMp4` click handler 內，找到：

```javascript
    btn.disabled = true;
    mp4Overlay.classList.add("visible");
```

在這兩行**之前**加：
```javascript
    exportInProgress = true;
```

並在 handler 末尾，找到：
```javascript
    mp4Overlay.classList.remove("visible");
    btn.disabled = false;
    renderAt(0);
  });
```

在 `mp4Overlay.classList.remove(...)` **之前**加：
```javascript
    exportInProgress = false;
```

完整尾段變成：
```javascript
    exportInProgress = false;
    mp4Overlay.classList.remove("visible");
    btn.disabled = false;
    renderAt(0);
  });
```

- [ ] **Step 2: 瀏覽器驗證**

1. 開 `http://localhost:8000/eis_generate.html`
2. 設一個短一點的 duration（如 2 秒）方便測
3. 按「匯出 MP4 + gcsv」→ 在進度條跑的時候立刻拖一張新圖進來
4. 預期：overlay 短暫顯示但會立即收掉、registry 不增加、匯出順利完成
5. 匯出完成後再拖一次 → 正常加入

- [ ] **Step 3: Commit**

```bash
cd D:/_Work/Tools/JeilinTools
git add eis_generate_src/main.js
git commit -m "MP4 匯出期間禁用 drop 以保證輸出穩定

exportInProgress 旗標在 click handler 包住 try/finally 區段，
drop handler 看到旗標即早退並收 overlay。避免幀間 sceneCanvas
切換造成輸出錯亂。"
```

---

### Task 8: 完整 smoke test 對齊 spec

**Files:** 無

- [ ] **Step 1: 跑 spec 中的 9 項手動 smoke test**

依 `docs/superpowers/specs/2026-05-06-natural-scene-image-gallery-design.md` 的「測試」章節逐項驗證：

1. 開頁面 → 看到 nature_default.jpg 縮圖，背景是該圖 ✓
2. 拖 .jpg 進頁面 → overlay 顯示 → drop 後新縮圖出現 → 自動切換背景 ✓
3. 點原本的 nature_default 縮圖 → 背景切回去 ✓
4. Hover 縮圖 → × 出現；點 × → 該縮圖消失；若是 active 切到下一張 ✓
5. 刪光所有圖 → 背景變棋盤格 ✓
6. 拖入 .txt → 沒反應，console 無 error ✓
7. F5 重整 → gallery 重置為只有 nature_default ✓
8. 點 + 按鈕 → 跳出檔案選取對話框 → 選圖後行為同 drag ✓
9. 匯出 MP4：選一張圖、按匯出 → 匯出期間嘗試拖新圖（被忽略）→ MP4 與 gcsv 對齊 ✓

任何一項不過：回去修，重跑全部，直到全綠。

- [ ] **Step 2: 沒有額外 commit**

所有功能 commit 已分散在前面 7 個 task。如果 smoke test 中發現 bug 並修正，bug fix 自己一個 commit。

---

## Self-Review

**Spec coverage:**
- 拖曳上傳：Task 5 ✓
- 多圖 gallery + 點擊切換：Task 4 ✓
- Session 內存放：Task 1 (registry) ✓
- nature_default 預載：Task 6 ✓
- 縮圖刪除：Task 4 ✓
- + 按鈕保留：Task 3 (Step 3D) ✓
- MP4 匯出期間鎖 drop：Task 7 ✓
- bgType="image" + activeImageId 模型：Task 2 (背景簽名) + Task 3 (state 欄位) ✓
- Drop overlay：Task 5 ✓
- 9 項 smoke test：Task 8 ✓

**Type / 名稱一致性檢查：**
- `imageRegistry.add` 回傳 `Promise<id>` — 在 Task 3 的 `bgImage` handler 與 Task 5 的 drop handler 都正確以 `.then(function (id) {...})` 接收 ✓
- `imageRegistry.list()` 回傳 `[{id, name, thumbDataUrl}]` — Task 4 的 `renderThumbs` 用 `it.id / it.name / it.thumbDataUrl`，Task 4 `removeImage` 用 `remaining[0].id`，一致 ✓
- `selectImage(id)` / `removeImage(id)` / `renderThumbs()` 三個 helper 在 Task 4/5/6/7 都一致呼叫 ✓
- `state.activeImageId` 在 ui.js (STR_FIELDS)、HTML (隱藏 input)、main.js (SCENE_FIELDS / refreshScene / renderThumbs / removeImage) 名稱一致 ✓
- `exportInProgress` 在 Task 7 內定義並在同 IIFE 內使用 ✓

**Placeholder scan:** 無 TBD/TODO/「適當處理」等 ✓
