/**
 * VS Design System — helper.js
 * ~200 lines vanilla JS. Runs inside iframe sandbox.
 * Handles: select, check, slider, ranking (drag), matrix (drag), submit.
 */
(function () {
  "use strict";

  /* ── i18n ── */
  const UI_TEXT = {
    ko: { submit: "확인", submitted: "✓ 제출됨", selected: "{n}개 선택됨" },
    en: {
      submit: "Submit",
      submitted: "✓ Submitted",
      selected: "{n} selected",
    },
  };
  const lang = document.documentElement.dataset.lang || "en";
  const t = UI_TEXT[lang] || UI_TEXT.en;

  /* ── State ── */
  let hasInteracted = false;

  /* ── Init ── */
  function initVS() {
    bindSelectables(".bk-options", ".bk-option");
    bindSelectables(".bk-cards", ".bk-card");
    bindSelectables(".bk-code-compare", ".bk-code-option");
    bindSelectables(".bk-mockup-gallery", ".bk-mockup-item");
    bindOrphanMockupItems();
    bindChecklist();
    bindSliders();
    bindRanking();
    bindMatrix();

    const btn = document.querySelector(".bk-vs-submit");
    if (btn) {
      btn.textContent = t.submit;
      btn.addEventListener("click", handleSubmit);
    }

    updateSubmitState();
  }

  /* ── Single-select toggle ── */
  function bindSelectables(containerSel, itemSel) {
    document.querySelectorAll(containerSel).forEach(function (container) {
      container.querySelectorAll(itemSel).forEach(function (item) {
        item.addEventListener("click", function () {
          toggleSelect(container, item, itemSel);
        });
      });
    });
  }

  function toggleSelect(container, item, itemSel) {
    var wasSelected = item.classList.contains("selected");
    container.querySelectorAll(itemSel).forEach(function (el) {
      el.classList.remove("selected");
    });
    if (!wasSelected) item.classList.add("selected");
    hasInteracted = true;
    updateSubmitState();
  }

  /* ── bk-mockup-item without .bk-mockup-gallery wrapper ── */
  function bindOrphanMockupItems() {
    var orphans = [];
    document.querySelectorAll(".bk-mockup-item").forEach(function (item) {
      if (!item.closest(".bk-mockup-gallery")) orphans.push(item);
    });
    if (orphans.length === 0) return;
    orphans.forEach(function (item) {
      item.addEventListener("click", function () {
        var wasSelected = item.classList.contains("selected");
        orphans.forEach(function (el) {
          el.classList.remove("selected");
        });
        if (!wasSelected) item.classList.add("selected");
        hasInteracted = true;
        updateSubmitState();
      });
    });
  }

  /* ── Multi-select checklist ── */
  function bindChecklist() {
    document.querySelectorAll(".bk-checklist").forEach(function (list) {
      list.querySelectorAll(".bk-check-item").forEach(function (item) {
        /* Apply defaults */
        if (item.hasAttribute("data-checked")) item.classList.add("checked");
        item.addEventListener("click", function () {
          toggleCheck(item);
        });
      });
    });
  }

  function toggleCheck(item) {
    item.classList.toggle("checked");
    hasInteracted = true;
    updateSubmitState();
  }

  /* ── Sliders ── */
  function bindSliders() {
    document.querySelectorAll(".bk-slider").forEach(function (container) {
      var min = Number(container.dataset.min || 0);
      var max = Number(container.dataset.max || 100);
      var val = Number(container.dataset.value || Math.round((min + max) / 2));
      var unit = container.dataset.unit || "";

      var controls = document.createElement("div");
      controls.className = "bk-slider-controls";

      var input = document.createElement("input");
      input.type = "range";
      input.min = min;
      input.max = max;
      input.value = val;

      var display = document.createElement("span");
      display.className = "bk-slider-value";
      display.textContent = val + unit;

      input.addEventListener("input", function () {
        display.textContent = input.value + unit;
        container.dataset.value = input.value;
        hasInteracted = true;
        updateSubmitState();
      });

      controls.appendChild(input);
      controls.appendChild(display);
      container.appendChild(controls);
    });
  }

  /* ── Ranking (HTML5 drag-and-drop) ── */
  function bindRanking() {
    document.querySelectorAll(".bk-ranking").forEach(function (list) {
      var items = list.querySelectorAll(".bk-rank-item");
      items.forEach(function (item, i) {
        /* Add rank number */
        var num = document.createElement("span");
        num.className = "bk-rank-number";
        num.textContent = String(i + 1);
        item.insertBefore(num, item.firstChild);

        /* Add grip icon */
        var grip = document.createElement("span");
        grip.className = "bk-rank-grip";
        grip.textContent = "\u2261";
        item.appendChild(grip);

        item.setAttribute("draggable", "true");

        item.addEventListener("dragstart", function (e) {
          item.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "");
        });

        item.addEventListener("dragend", function () {
          item.classList.remove("dragging");
          list.querySelectorAll(".bk-rank-item").forEach(function (el) {
            el.classList.remove("drag-over");
          });
          renumberRanking(list);
          hasInteracted = true;
          updateSubmitState();
        });

        item.addEventListener("dragover", function (e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          var dragging = list.querySelector(".dragging");
          if (dragging && dragging !== item) {
            item.classList.add("drag-over");
            var rect = item.getBoundingClientRect();
            var mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
              list.insertBefore(dragging, item);
            } else {
              list.insertBefore(dragging, item.nextSibling);
            }
          }
        });

        item.addEventListener("dragleave", function () {
          item.classList.remove("drag-over");
        });
      });
    });
  }

  function renumberRanking(list) {
    list.querySelectorAll(".bk-rank-item").forEach(function (item, i) {
      var num = item.querySelector(".bk-rank-number");
      if (num) num.textContent = String(i + 1);
    });
  }

  /* ── Matrix (mouse/touch drag placement) ── */
  function bindMatrix() {
    document.querySelectorAll(".bk-matrix").forEach(function (container) {
      /* Build grid overlay */
      var grid = document.createElement("div");
      grid.className = "bk-matrix-grid";
      container.appendChild(grid);

      /* Add axis labels */
      var xLabel = document.createElement("div");
      xLabel.className = "bk-matrix-x-label";
      xLabel.textContent = container.dataset.xLabel || "X";
      container.appendChild(xLabel);

      var yLabel = document.createElement("div");
      yLabel.className = "bk-matrix-y-label";
      yLabel.textContent = container.dataset.yLabel || "Y";
      container.appendChild(yLabel);

      /* Position items */
      var items = container.querySelectorAll(".bk-matrix-item");
      var n = items.length;
      items.forEach(function (item, i) {
        /* Default spread: distribute items in center area */
        var dx =
          item.dataset.x !== undefined
            ? Number(item.dataset.x)
            : 0.3 + 0.4 * (i / Math.max(n - 1, 1));
        var dy =
          item.dataset.y !== undefined
            ? Number(item.dataset.y)
            : 0.3 + 0.4 * (i / Math.max(n - 1, 1));
        placeMatrixItem(item, container, dx, dy);
        makeMatrixDraggable(item, container);
      });
    });
  }

  function placeMatrixItem(item, container, x, y) {
    item.dataset.x = String(Math.max(0, Math.min(1, x)).toFixed(2));
    item.dataset.y = String(Math.max(0, Math.min(1, y)).toFixed(2));
    /* CSS uses left/bottom but we need top offset (y inverted: 1=top, 0=bottom) */
    var pad = 40; /* px padding for labels */
    item.style.left = pad + x * (container.clientWidth - 2 * pad) + "px";
    item.style.top = pad + (1 - y) * (container.clientHeight - 2 * pad) + "px";
    item.style.transform = "translate(-50%, -50%)";
  }

  function makeMatrixDraggable(item, container) {
    function onStart(e) {
      e.preventDefault();
      item.classList.add("dragging");
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    }

    function onMove(e) {
      e.preventDefault();
      var pt = e.touches ? e.touches[0] : e;
      var rect = container.getBoundingClientRect();
      var pad = 40;
      var x = Math.max(
        0,
        Math.min(1, (pt.clientX - rect.left - pad) / (rect.width - 2 * pad)),
      );
      var y = Math.max(
        0,
        Math.min(
          1,
          1 - (pt.clientY - rect.top - pad) / (rect.height - 2 * pad),
        ),
      );
      placeMatrixItem(item, container, x, y);
    }

    function onEnd() {
      item.classList.remove("dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      hasInteracted = true;
      updateSubmitState();
    }

    item.addEventListener("mousedown", onStart);
    item.addEventListener("touchstart", onStart, { passive: false });
  }

  /* ── Collect State ── */
  function collectState() {
    var state = {};

    /* selections: bk-options, bk-cards, bk-code-compare (single select) */
    var selections = [];
    document
      .querySelectorAll(
        ".bk-option.selected, .bk-card.selected, .bk-code-option.selected, .bk-mockup-item.selected",
      )
      .forEach(function (el) {
        if (el.dataset.value) selections.push(el.dataset.value);
      });
    /* bk-checklist (multi select) */
    document.querySelectorAll(".bk-check-item.checked").forEach(function (el) {
      if (el.dataset.value) selections.push(el.dataset.value);
    });
    if (selections.length > 0) state.selections = selections;

    /* values: bk-slider */
    var values = {};
    var hasValues = false;
    document.querySelectorAll(".bk-slider").forEach(function (el) {
      if (el.dataset.name && el.dataset.value !== undefined) {
        values[el.dataset.name] = Number(el.dataset.value);
        hasValues = true;
      }
    });
    if (hasValues) state.values = values;

    /* ranking: bk-ranking */
    document.querySelectorAll(".bk-ranking").forEach(function (list) {
      var order = [];
      list.querySelectorAll(".bk-rank-item").forEach(function (item) {
        if (item.dataset.value) order.push(item.dataset.value);
      });
      if (order.length > 0) state.ranking = order;
    });

    /* matrix: bk-matrix */
    var matrix = {};
    var hasMatrix = false;
    document.querySelectorAll(".bk-matrix-item").forEach(function (item) {
      if (item.dataset.value) {
        matrix[item.dataset.value] = {
          x: Number(Number(item.dataset.x).toFixed(2)),
          y: Number(Number(item.dataset.y).toFixed(2)),
        };
        hasMatrix = true;
      }
    });
    if (hasMatrix) state.matrix = matrix;

    return state;
  }

  /* ── Submit ── */
  function handleSubmit() {
    var btn = document.querySelector(".bk-vs-submit");
    if (!btn || btn.disabled) return;
    var data = collectState();
    window.parent.postMessage({ type: "bk_visual_submit", data: data }, "*");
    btn.disabled = true;
    btn.classList.add("submitted");
    btn.textContent = t.submitted;
    var status = document.querySelector(".bk-vs-status");
    if (status) status.textContent = t.submitted;
  }

  /* ── Submit State ── */
  function updateSubmitState() {
    var btn = document.querySelector(".bk-vs-submit");
    if (!btn || btn.classList.contains("submitted")) return;
    /* Enable if user has interacted with any interactable component */
    var hasInteractable = document.querySelector(
      ".bk-options, .bk-cards, .bk-checklist, .bk-code-compare, .bk-slider, .bk-ranking, .bk-matrix, .bk-mockup-gallery, .bk-mockup-item",
    );
    btn.disabled = !(hasInteractable && hasInteracted);
  }

  /* ── Boot ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVS);
  } else {
    initVS();
  }
})();
