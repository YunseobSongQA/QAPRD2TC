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
    ["#btn-xlsx", "#btn-csv", "#btn-md", "#btn-copy", "#btn-clear-result"].forEach(function (sel) {
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

  // ── 파일 업로드(드래그앤드롭) ─────────────────────────
  function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var status = $("#file-status");
    status.style.display = "block";
    status.className = "file-status loading";
    status.textContent = "⏳ 파일에서 내용을 추출하는 중...";

    window.TCFileParser.parseFiles(fileList).then(function (res) {
      var okList = res.results.filter(function (r) {
        return r.ok;
      });
      var failList = res.results.filter(function (r) {
        return !r.ok;
      });

      if (res.text) {
        var cur = $("#input-prd").value.trim();
        $("#input-prd").value = cur ? cur + "\n\n" + res.text : res.text;
      }

      var msg = "✅ " + okList.length + "개 파일 추출 완료";
      if (failList.length) {
        msg += " · ⚠️ 실패 " + failList.length + "개 (" + failList[0].error + ")";
        status.className = "file-status warn";
      } else {
        status.className = "file-status done";
      }
      status.textContent = msg;

      if (res.text) {
        toast("파일에서 내용을 불러왔습니다. 자동으로 변환합니다.");
        onGenerate();
      } else {
        toast("추출된 텍스트가 없습니다. 파일 내용을 확인해 주세요.");
      }
    }, function (err) {
      status.className = "file-status warn";
      status.textContent = "⚠️ 파일 처리 실패: " + ((err && err.message) || err);
    });
  }

  function bindDropzone() {
    var dz = $("#dropzone");
    var fi = $("#file-input");
    if (!dz || !fi) return;

    dz.addEventListener("click", function () {
      fi.click();
    });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fi.click();
      }
    });
    fi.addEventListener("change", function () {
      handleFiles(fi.files);
      fi.value = ""; // 같은 파일 재선택 가능하도록 초기화
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("dragover");
      });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove("dragover");
      });
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });

    // 페이지 전체에서 파일이 다른 곳에 드롭돼 새 창으로 열리는 것 방지
    window.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    window.addEventListener("drop", function (e) {
      e.preventDefault();
    });
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
    $("#btn-xlsx").addEventListener("click", function () {
      try {
        window.TCExport.downloadXLSX(state.cases);
        toast("엑셀(xlsx) 파일을 내려받았습니다.");
      } catch (e) {
        toast((e && e.message) || "엑셀 내보내기에 실패했습니다.");
      }
    });
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

    bindDropzone();
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
