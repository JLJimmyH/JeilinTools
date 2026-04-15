window.APP = window.APP || {};
APP.ui = (function () {
  const NUM_FIELDS = [
    "width", "height", "fps", "duration",
    "fx", "fy", "cx", "cy",
    "gyroRate",
    "sinAx", "sinFx", "sinAy", "sinFy", "sinAz", "sinFz",
    "bgCheckerSize",
    "ballR", "ballCx", "ballCy",
  ];
  const STR_FIELDS = ["bgType", "bgColor1", "bgColor2", "ballColor"];
  const BOOL_FIELDS = ["ballShow", "markersShow"];

  function readState() {
    const s = {};
    for (const k of NUM_FIELDS) {
      const el = document.getElementById(k);
      const v = el.value.trim();
      s[k] = v === "" ? null : Number(v);
    }
    for (const k of STR_FIELDS) s[k] = document.getElementById(k).value;
    for (const k of BOOL_FIELDS) s[k] = document.getElementById(k).checked;

    const W = s.width, H = s.height;
    if (s.fx == null) s.fx = W;
    if (s.fy == null) s.fy = W;
    if (s.cx == null) s.cx = W / 2;
    if (s.cy == null) s.cy = H / 2;
    return s;
  }

  function onChange(callback) {
    const handler = function () { callback(); };
    document.querySelectorAll("#controls input, #controls select").forEach(function (el) {
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
  }

  // For each [data-pair] wrapper, create a range slider linked to the
  // embedded <input type="number">, with bidirectional sync.
  function initSliderPairs() {
    document.querySelectorAll(".slider-row[data-pair]").forEach(function (row) {
      const num = row.querySelector('input[type="number"]');
      if (!num) return;
      const min = row.dataset.min || "0";
      const max = row.dataset.max || "100";
      const step = row.dataset.step || "0.1";

      const range = document.createElement("input");
      range.type = "range";
      range.min = min;
      range.max = max;
      range.step = step;
      range.value = num.value;
      row.appendChild(range);

      // When user drags the slider → update number and dispatch its event
      // so the main onChange() listener re-renders the preview.
      range.addEventListener("input", function () {
        if (num.value !== range.value) {
          num.value = range.value;
          num.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      // When user types in the number → update slider (clamped visually only)
      num.addEventListener("input", function () {
        if (range.value !== num.value) {
          range.value = num.value;
        }
      });
    });
  }

  return { readState, onChange, initSliderPairs };
})();
