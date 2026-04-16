/**
 * VS Design System — helper.js
 * ~200 lines vanilla JS. Runs inside iframe sandbox.
 * Handles: select, check, slider, ranking (drag), matrix (drag), submit.
 */
(function () {
  "use strict";

  const COMMENTABLE_SELECTOR =
    ".bk-option, .bk-card, .bk-code-option, .bk-mockup-item, .bk-check-item";

  /* ── i18n ── */
  const UI_TEXT = {
    ko: {
      submit: "확인",
      submitted: "✓ 제출됨",
      selected: "{n}개 선택됨",
      detailsLabel: "추가 요청사항",
      detailsPlaceholder: "선택 이유나 보완 요청을 적어주세요",
      required: "필수",
      requiredComment: "선택한 항목에 대한 코멘트를 입력해 주세요",
      requiredField: "필수 입력 항목을 채워 주세요",
    },
    en: {
      submit: "Submit",
      submitted: "✓ Submitted",
      selected: "{n} selected",
      detailsLabel: "Additional details",
      detailsPlaceholder: "Add your reasoning or requested changes",
      required: "Required",
      requiredComment: "Add a comment for the selected option",
      requiredField: "Fill in the required fields",
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
    bindFields();
    bindOptionComments();

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
    syncConditionalFields();
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
        syncConditionalFields();
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
    syncConditionalFields();
    updateSubmitState();
  }

  function bindFields() {
    document.querySelectorAll(".bk-textarea").forEach(function (container) {
      if (container.querySelector("textarea")) return;
      var textarea = document.createElement("textarea");
      textarea.className = "bk-textarea-control";
      textarea.name = container.dataset.name || "";
      textarea.placeholder = container.dataset.placeholder || "";
      textarea.rows = Number(container.dataset.rows || 4);
      textarea.maxLength = container.dataset.maxlength
        ? Number(container.dataset.maxlength)
        : -1;
      mountField(container, textarea);
    });

    document.querySelectorAll(".bk-input").forEach(function (container) {
      if (container.querySelector("input")) return;
      var input = document.createElement("input");
      input.className = "bk-input-control";
      input.name = container.dataset.name || "";
      input.type = container.dataset.type || "text";
      input.placeholder = container.dataset.placeholder || "";
      input.maxLength = container.dataset.maxlength
        ? Number(container.dataset.maxlength)
        : -1;
      mountField(container, input);
    });
  }

  function mountField(container, control) {
    container.classList.add("bk-field");

    if (container.dataset.label) {
      var label = document.createElement("label");
      label.className = "bk-field-label";
      label.textContent = container.dataset.label;
      if (container.hasAttribute("data-required")) {
        var required = document.createElement("span");
        required.className = "required";
        required.textContent = "*";
        label.appendChild(required);
      }
      container.appendChild(label);
    }

    if (container.dataset.help) {
      var help = document.createElement("div");
      help.className = "bk-field-help";
      help.textContent = container.dataset.help;
      container.appendChild(help);
    }

    control.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    control.addEventListener("input", function () {
      hasInteracted = true;
      updateSubmitState();
    });

    container.appendChild(control);
  }

  function bindOptionComments() {
    document.querySelectorAll(COMMENTABLE_SELECTOR).forEach(function (item) {
      var needsComment =
        item.hasAttribute("data-requires-comment") ||
        !!item.dataset.commentName;
      if (!needsComment || item.querySelector(".bk-option-comment")) return;

      var wrapper = document.createElement("div");
      wrapper.className = "bk-option-comment";
      wrapper.hidden = true;

      var label = document.createElement("label");
      label.className = "bk-field-label";
      label.textContent = item.dataset.commentLabel || t.detailsLabel;
      if (item.hasAttribute("data-requires-comment")) {
        var required = document.createElement("span");
        required.className = "required";
        required.textContent = "*";
        label.appendChild(required);
      }
      wrapper.appendChild(label);

      var textarea = document.createElement("textarea");
      textarea.className = "bk-textarea-control";
      textarea.placeholder =
        item.dataset.commentPlaceholder || t.detailsPlaceholder;
      textarea.rows = Number(item.dataset.commentRows || 3);
      textarea.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      textarea.addEventListener("input", function () {
        hasInteracted = true;
        updateSubmitState();
      });
      wrapper.appendChild(textarea);

      item.appendChild(wrapper);
    });

    syncConditionalFields();
  }

  function syncConditionalFields() {
    document.querySelectorAll(COMMENTABLE_SELECTOR).forEach(function (item) {
      var comment = item.querySelector(".bk-option-comment");
      if (!comment) return;
      var selected =
        item.classList.contains("selected") ||
        item.classList.contains("checked");
      comment.hidden = !selected;
    });
  }

  function readControlValue(container) {
    var control = container.querySelector("input, textarea");
    if (!control) return "";
    return String(control.value || "").trim();
  }

  function collectStandaloneFields(state) {
    var fields = {};
    var hasFields = false;

    document.querySelectorAll(".bk-textarea, .bk-input").forEach(function (el) {
      var name = el.dataset.name;
      if (!name) return;
      var value = readControlValue(el);
      if (!value) return;
      if (el.dataset.responseKey === "comment" || name === "comment") {
        state.comment = value;
        return;
      }
      fields[name] = value;
      hasFields = true;
    });

    if (hasFields) state.fields = fields;
  }

  function collectOptionComments(state) {
    var optionComments = {};
    var optionCommentCount = 0;
    var fields = state.fields || {};
    var hasFields = !!state.fields;

    document.querySelectorAll(COMMENTABLE_SELECTOR).forEach(function (item) {
      var selected =
        item.classList.contains("selected") ||
        item.classList.contains("checked");
      if (!selected) return;
      var commentWrap = item.querySelector(".bk-option-comment");
      if (!commentWrap) return;
      var textarea = commentWrap.querySelector("textarea");
      var value = textarea ? String(textarea.value || "").trim() : "";
      if (!value) return;
      if (item.dataset.value) {
        optionComments[item.dataset.value] = value;
        optionCommentCount += 1;
      }
      if (item.dataset.commentName) {
        fields[item.dataset.commentName] = value;
        hasFields = true;
      }
    });

    if (optionCommentCount > 0) state.option_comments = optionComments;
    if (hasFields) state.fields = fields;
  }

  function getValidationError() {
    var requiredFieldMissing = false;
    document.querySelectorAll(".bk-textarea, .bk-input").forEach(function (el) {
      if (!el.hasAttribute("data-required")) return;
      if (!readControlValue(el)) requiredFieldMissing = true;
    });
    if (requiredFieldMissing) return t.requiredField;

    var requiredCommentMissing = false;
    document.querySelectorAll(COMMENTABLE_SELECTOR).forEach(function (item) {
      var selected =
        item.classList.contains("selected") ||
        item.classList.contains("checked");
      if (!selected || !item.hasAttribute("data-requires-comment")) return;
      var commentWrap = item.querySelector(".bk-option-comment");
      if (!commentWrap || !readControlValue(commentWrap)) {
        requiredCommentMissing = true;
      }
    });
    if (requiredCommentMissing) return t.requiredComment;

    return "";
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

    collectStandaloneFields(state);
    collectOptionComments(state);

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
    var status = document.querySelector(".bk-vs-status");
    var validationError = getValidationError();
    var hasRequiredFields = !!document.querySelector(
      ".bk-input[data-required], .bk-textarea[data-required]",
    );
    var hasInteractable = document.querySelector(
      ".bk-options, .bk-cards, .bk-checklist, .bk-code-compare, .bk-slider, .bk-ranking, .bk-matrix, .bk-mockup-gallery, .bk-mockup-item, .bk-textarea, .bk-input",
    );
    // Required fields present → validation error alone gates the button.
    // No required fields → require at least one interaction before enabling.
    if (hasRequiredFields) {
      btn.disabled = !!validationError;
    } else {
      btn.disabled = !(hasInteractable && hasInteracted);
    }
    if (status) status.textContent = validationError;
  }

  /* ── Boot ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVS);
  } else {
    initVS();
  }
})();
