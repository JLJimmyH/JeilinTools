# 自然場景圖片 Gallery 設計

**日期**：2026-05-06
**範圍**：`eis_generate.html` + `eis_generate_src/`

## 背景與目的

`eis_generate` 目前的背景僅支援 `solid` / `gradient` / `checker` / `image`（單張上傳）。當搭配 gcsv ground truth 驗證光流法或 MMD 時，過於單一的背景缺乏紋理特徵，會出現 aperture problem 或稀疏匹配。本功能讓使用者方便地累積多張紋理豐富的自然場景照片作為背景測試集，並能在 session 內快速切換比較。

## 範圍

### 包含
- 整頁 drag-drop 圖片載入
- Session 內多圖 gallery（縮圖列表，點擊切換）
- 預設載入 `nature_default.jpg` 作為第一張
- 縮圖刪除（hover 顯示 ×）
- 既有 `+` 按鈕保留為檔案選取後備入口

### 不包含
- 圖片永久化（refresh 即清空，不寫入 IndexedDB）
- 紋理品質自動檢測（不分析圖片，使用者自行判斷）
- 程序生成紋理
- 圖片裁切 / 縮放模式選擇（沿用既有 `drawImage(img, 0, 0, w, h)` 拉伸到場景大小）

## 架構

### 檔案分工

| 檔案 | 變動類型 | 內容 |
|---|---|---|
| `eis_generate_src/scene/imageRegistry.js` | **新檔** | Map<id, {name, image, thumbDataUrl}>，提供 `add(file 或 img, name)` / `get(id)` / `list()` / `remove(id)`；`add` 內部產生 64×40 縮圖回傳 id |
| `eis_generate_src/scene/background.js` | 修改 | `image` case 改為從外部接收 resolved `Image` 參數（不再依賴 `loadedImage` 單一變數） |
| `eis_generate_src/render/scene2d.js` | 修改 | `renderScene` 增加 `activeImage` 參數並傳給 `drawBackground` |
| `eis_generate_src/main.js` | 修改 | 接 registry、drag-drop handler、初始化 `nature_default.jpg`、縮圖點擊 / 刪除事件 |
| `eis_generate_src/ui.js` | 修改 | `STR_FIELDS` 加入 `activeImageId` |
| `eis_generate.html` | 修改 | 加 drop overlay、隱藏 `<input id="activeImageId">`、縮圖 CSS、載入 `imageRegistry.js` script tag |

### 資料模型

**State 增加欄位**：
- `activeImageId: string | ""` — 當前選中的圖片 ID。`bgType="image"` 時生效

**Registry（不入 state，view-side data）**：
```
imageRegistry: Map<string, {
  name: string,         // 檔名（顯示用、無 ID 衝突避免邏輯）
  image: HTMLImageElement,
  thumbDataUrl: string  // 64×40 PNG dataURL，給縮圖按鈕的 background-image
}>
```

**ID 產生**：session 內單調遞增 counter，格式 `img_1`, `img_2`…

### 既有耦合點

- `main.js:22-27` `SCENE_FIELDS` 集合：要把 `activeImageId` 加進去，dirty 機制才會正確觸發 `warpGL.uploadSource()`
- `main.js:105-115` `bgImage change` handler：保留，作為 `+` 按鈕的後備入口；handler 內部改為 `registry.add(file)` 而非設定 `loadedImage`
- 移除 `main.js:19` 的 `let loadedImage = null;`（被 registry 取代）
- `renderScene` 簽名改變：所有呼叫點（`refreshScene` in main.js）需同步調整

## 資料流

### 啟動
```
DOMContentLoaded
  → reallocCanvases()
  → renderAt(0)              // bgType 預設 "checker"，畫面有東西
  → fetch("nature_default.jpg")
      → success: img.onload → registry.add(img, "nature_default.jpg")
                            → renderThumbs()
                            → 若使用者尚未手動切過背景（bgType 仍為初始 "checker" 且 activeImageId 為空）：
                                設 bgType="image" + activeImageId=newId
                                onChange 觸發 → sceneDirty → renderAt(0)
                              否則僅加入 gallery，不搶當前選擇
      → fail: console.warn，gallery 留空，bgType 維持 checker
```

### Drag-drop
```
document dragenter/dragover (有檔案)
  → preventDefault + 顯示 overlay
document dragleave (離開頁面)
  → 隱藏 overlay
document drop
  → preventDefault + 隱藏 overlay
  → 過濾 file.type.startsWith("image/")
  → 對每個檔：registry.add(file)
  → 全部加完後：選最後一張為 active（bgType="image" + activeImageId）
  → onChange → sceneDirty → renderAt(0)
```

### 縮圖點擊
```
click .thumb[data-image-id="img_N"]
  → 寫 activeImageId input.value = "img_N"
  → 寫 bgType select.value = "image"
  → dispatchEvent("input", bubbles)
  → 既有 onChange → sceneDirty → renderAt(0)
```

### 縮圖刪除
```
click .thumb-remove (× button)
  → stopPropagation
  → registry.remove(id)
  → 重新 renderThumbs()
  → 若刪到 active：
      list 還有圖 → activeImageId = list[0].id
      list 空    → bgType="checker", activeImageId=""
  → onChange → sceneDirty → renderAt(0)
```

## UI 細節

### Drop overlay
- 全螢幕 `position: fixed; inset: 0; z-index: 9999; background: rgba(0,255,136,0.1); border: 2px dashed var(--accent);`
- 中央文字「拖放圖片以新增背景」
- `pointer-events: none` 避免擋住 drop event 冒泡（drop 監聽在 document 上）
- `dragenter` 顯示，`dragleave`（target === document）+ `drop` 隱藏

### 縮圖按鈕
- 插入位置：`.bg-presets` 內，原 `+` 按鈕之前，依 registry insertion order 渲染
- 樣式：`width:36px; height:36px; background-size: cover; background-position: center; border: 1px solid var(--border); border-radius: 4px;`（顯示 36×36，dataURL 內部 64×40 以適應 retina）
- Active 時：套用既有 `.bg-preset.active` 樣式（綠光邊框）
- `data-image-id` attribute 帶 ID，data-bg="image" 沿用既有切換邏輯
- × 按鈕：`position: absolute; top: -4px; right: -4px;` 預設 `display:none`，hover 縮圖父層才顯示

### `+` 按鈕行為
- 點擊觸發 `<input type=file id="bgImage">.click()`，選檔後走 `bgImage change` handler → `registry.add(file)` → 自動 select 為 active
- 不再切到「上傳圖片」label 欄位（因為現在由 registry 接管）；可移除 `<label data-bg-param="image">上傳圖片 ...</label>`

### 隱藏 input
- `<input type="hidden" id="activeImageId" value="">` 放在 `<select id="bgType">` 旁邊
- 由 `ui.js` 的 `readState()` 讀取（加進 `STR_FIELDS`）

## 錯誤與邊界

| 情境 | 處理 |
|---|---|
| `nature_default.jpg` fetch 失敗 | `console.warn`，gallery 空，bgType 維持初始 `checker` |
| 拖入非圖片檔（PDF, txt…） | 靜默忽略（不彈 alert） |
| 圖片解碼失敗 | `img.onerror` → 不加入 registry，`console.warn` |
| 多檔同時拖 | 全部加入，最後一張變 active |
| 重複拖同一張圖 | 不去重（簡單），依然產生新 ID 與新 thumbnail |
| MP4 匯出中拖新圖 | 在 `btnExportMp4` disabled 期間，drop handler 早退（檢查旗標）；避免幀間 scene 突變 |
| 刪到當前 active 且 list 空 | bgType 退回 `checker`，activeImageId="" |

## 測試

專案無自動化測試框架。交付時提供手動 smoke checklist：

1. 開啟 `eis_generate.html` → 看到 `nature_default.jpg` 縮圖，背景是該圖
2. 從檔案管理員拖一張 `.jpg` 進頁面任意位置 → overlay 顯示 → drop 後新縮圖出現 → 自動切換為背景
3. 點原本的 `nature_default` 縮圖 → 背景切回去
4. Hover 縮圖 → 右上 × 出現；點 × → 該縮圖消失；若是 active 則切到下一張
5. 刪光所有圖 → 背景變棋盤格
6. 拖入 `.txt` → 沒反應（console 也沒 error）
7. F5 重整 → gallery 重置為只有 `nature_default`
8. 點 `+` 按鈕 → 跳出檔案選取對話框 → 選圖後行為同 drag
9. 匯出 MP4：選一張圖、按匯出 → 匯出期間嘗試拖新圖（應被忽略）→ MP4 與 gcsv 內容對齊（背景就是當下選中那張）

## 風險與後續

- **Registry 與 state 雙源**：`activeImageId` 在 state、實際 image 在 registry，需確保兩者同步（registry 移除一個 ID 時 state 也要清掉）。透過 main.js 統一管理刪除流程降低風險
- **OVERSCAN 拉伸品質**：圖會被 stretch 到 `outW * 1.6` × `outH * 1.6`，原始解析度低的圖會糊。建議使用者上傳 ≥ 1080p 且接近 16:9 的圖（README 可補一段提示，但本次不寫）
- **未來 IndexedDB 持久化**：本次不做，但 registry 抽出成獨立 module 後，未來只要加 `persist()` / `restore()` 兩個 method 即可，不影響其他模組
