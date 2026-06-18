/* app.js — 화면과 엔진을 연결하는 메인 로직 */
(function () {
  "use strict";

  var $ = function (sel) {
    return document.querySelector(sel);
  };

  var state = { cases: [] };

  // 유형별 배지 색상 클래스
  function typeClass(type) {
    if (type === "예외") return "badge-exception";
    if (type === "경계") return "badge-boundary";
    return "badge-normal";
  }
  function priorityClass(p) {
    if (p === "높음") return "pri-high";
    if (p === "낮음") return "pri-low";
    return "pri-mid";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderTable() {
    var tbody = $("#tc-tbody");
    var cases = state.cases;
    if (!cases.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="empty-row">아직 생성된 테스트 케이스가 없습니다. 왼쪽에 기획서를 입력하고 🚀 변환 버튼을 눌러보세요.</td></tr>';
      return;
    }
    var html = cases
      .map(function (tc) {
        var steps = (tc.steps || [])
          .map(function (s, i) {
            return "<li>" + esc(s) + "</li>";
          })
          .join("");
        return (
          "<tr>" +
          '<td class="c-id">' + esc(tc.id) + "</td>" +
          "<td>" + esc(tc.major) + "</td>" +
          "<td>" + esc(tc.minor) + "</td>" +
          '<td class="c-scenario">' + esc(tc.scenario) + "</td>" +
          "<td>" + esc(tc.precondition) + "</td>" +
          '<td><ol class="steps">' + steps + "</ol></td>" +
          "<td>" + esc(tc.expected) + "</td>" +
          '<td><span class="pri ' + priorityClass(tc.priority) + '">' + esc(tc.priority) + "</span></td>" +
          '<td><span class="badge ' + typeClass(tc.type) + '">' + esc(tc.type) + "</span></td>" +
          "</tr>"
        );
      })
      .join("");
    tbody.innerHTML = html;
  }

  function renderStats(stats) {
    $("#stat-total").textContent = stats.total;
    $("#stat-normal").textContent = stats.normal;
    $("#stat-exception").textContent = stats.exception;
    $("#stat-boundary").textContent = stats.boundary;
    $("#result-meta").style.display = stats.total ? "flex" : "none";
  }

  function setToolbarEnabled(on) {
    ["#btn-csv", "#btn-md", "#btn-copy", "#btn-clear-result"].forEach(function (sel) {
      $(sel).disabled = !on;
    });
  }

  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove("show");
    }, 2200);
  }

  // ── 이벤트 ────────────────────────────────────────────
  function onGenerate() {
    var text = $("#input-prd").value;
    if (!text.trim()) {
      toast("먼저 기획서 내용을 입력해 주세요.");
      $("#input-prd").focus();
      return;
    }
    var options = {
      includeNegative: $("#opt-negative").checked,
      includeBoundary: $("#opt-boundary").checked,
      idPrefix: ($("#opt-prefix").value || "TC").trim() || "TC"
    };
    var result = window.TCGenerator.generate(text, options);
    state.cases = result.cases;
    renderTable();
    renderStats(result.stats);
    setToolbarEnabled(result.cases.length > 0);
    if (result.cases.length) {
      toast(result.cases.length + "개의 테스트 케이스를 생성했습니다.");
      $("#result-section").scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      toast("생성된 케이스가 없습니다. 기획서에 기능/요구사항을 더 구체적으로 작성해 보세요.");
    }
  }

  function onCopy() {
    if (!state.cases.length) return;
    var md = window.TCExport.toMarkdown(state.cases);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(
        function () {
          toast("표(Markdown)를 클립보드에 복사했습니다.");
        },
        function () {
          fallbackCopy(md);
        }
      );
    } else {
      fallbackCopy(md);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("클립보드에 복사했습니다.");
    } catch (e) {
      toast("복사에 실패했습니다.");
    }
    document.body.removeChild(ta);
  }

  function onClearInput() {
    $("#input-prd").value = "";
    $("#input-prd").focus();
  }

  function onClearResult() {
    state.cases = [];
    renderTable();
    renderStats({ total: 0, normal: 0, exception: 0, boundary: 0 });
    setToolbarEnabled(false);
  }

  function loadSample(key) {
    var s = window.TCSamples[key];
    if (s) {
      $("#input-prd").value = s;
      toast("예시 기획서를 불러왔습니다. 변환 버튼을 눌러보세요.");
      $("#input-prd").focus();
    }
  }

  function bind() {
    $("#btn-generate").addEventListener("click", onGenerate);
    $("#btn-csv").addEventListener("click", function () {
      window.TCExport.downloadCSV(state.cases);
    });
    $("#btn-md").addEventListener("click", function () {
      window.TCExport.downloadMarkdown(state.cases);
    });
    $("#btn-copy").addEventListener("click", onCopy);
    $("#btn-clear-input").addEventListener("click", onClearInput);
    $("#btn-clear-result").addEventListener("click", onClearResult);

    Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"), function (el) {
      el.addEventListener("click", function () {
        loadSample(el.getAttribute("data-sample"));
      });
    });

    // Ctrl/Cmd + Enter 로 변환
    $("#input-prd").addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onGenerate();
      }
    });

    setToolbarEnabled(false);
    renderTable();
    renderStats({ total: 0, normal: 0, exception: 0, boundary: 0 });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
