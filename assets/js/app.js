/* app.js — 화면과 엔진을 연결하는 메인 로직 */
(function () {
  "use strict";

  var $ = function (sel) {
    return document.querySelector(sel);
  };

  var state = { cases: [] };

  // ── 인라인 라인 아이콘(이모지 대체) ─────────────────────
  function svg(paths, cls) {
    return (
      '<svg class="ico' +
      (cls ? " " + cls : "") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      "</svg>"
    );
  }
  var ICON = {
    sparkles:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    wand:
      '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
    spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    check:
      '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
    alert:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    sun:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
  };

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
    var wrap = $("#table-wrap");
    var empty = $("#result-empty");
    var cases = state.cases;
    if (!cases.length) {
      tbody.innerHTML = "";
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.hidden = false;
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

  // ── 공통 ──────────────────────────────────────────────
  function getOptions() {
    return {
      includeNegative: $("#opt-negative").checked,
      includeBoundary: $("#opt-boundary").checked,
      idPrefix: ($("#opt-prefix").value || "TC").trim() || "TC"
    };
  }

  function computeStats(cases) {
    var s = { total: cases.length, normal: 0, exception: 0, boundary: 0 };
    cases.forEach(function (c) {
      if (c.type === "정상") s.normal++;
      else if (c.type === "예외") s.exception++;
      else if (c.type === "경계") s.boundary++;
    });
    return s;
  }

  function showResult(cases, label) {
    state.cases = cases;
    renderTable();
    renderStats(computeStats(cases));
    setToolbarEnabled(cases.length > 0);
    if (cases.length) {
      toast((label || "") + cases.length + "개의 테스트 케이스를 생성했습니다.");
      $("#result-section").scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      toast("생성된 케이스가 없습니다. 기획서를 더 구체적으로 작성해 보세요.");
    }
  }

  // ── 이벤트 ────────────────────────────────────────────
  function onGenerate() {
    var text = $("#input-prd").value;
    if (!text.trim()) {
      toast("먼저 기획서 내용을 입력해 주세요.");
      $("#input-prd").focus();
      return;
    }
    if ($("#opt-ai").checked) {
      onGenerateAI(text);
      return;
    }
    var result = window.TCGenerator.generate(text, getOptions());
    showResult(result.cases, "");
  }

  // ── AI 모드 ───────────────────────────────────────────
  var KEY_STORE = "tcai_key";

  function setGenerating(on) {
    var btn = $("#btn-generate");
    btn.disabled = on;
    if (on) btn.innerHTML = svg(ICON.spinner, "ico-spin") + "AI 생성 중...";
    else syncGenerateLabel();
  }

  function onGenerateAI(text) {
    if (!window.TCAI) {
      toast("AI 모듈을 불러오지 못했습니다.");
      return;
    }
    var key = ($("#ai-key").value || "").trim();
    if (!key) {
      toast("Anthropic API 키를 입력해 주세요.");
      $("#ai-key").focus();
      return;
    }
    saveKeyMaybe(key);
    setGenerating(true);
    toast("Claude가 테스트 케이스를 생성하는 중입니다... (최대 1분)");
    window.TCAI.generate(text, key, getOptions()).then(
      function (res) {
        setGenerating(false);
        showResult(res.cases, "AI · ");
        if (res.truncated) {
          toast("결과가 길어 일부가 잘렸을 수 있습니다. 기획서를 나눠 시도해 보세요.");
        }
      },
      function (err) {
        setGenerating(false);
        toast((err && err.message) || "AI 생성에 실패했습니다.");
      }
    );
  }

  function syncGenerateLabel() {
    $("#btn-generate").innerHTML = $("#opt-ai").checked
      ? svg(ICON.sparkles) + "AI로 테스트 케이스 변환"
      : svg(ICON.wand) + "테스트 케이스 변환";
  }

  function toggleAiPanel() {
    $("#ai-panel").hidden = !$("#opt-ai").checked;
    syncGenerateLabel();
  }

  function saveKeyMaybe(key) {
    try {
      if ($("#ai-remember").checked) sessionStorage.setItem(KEY_STORE, key);
      else sessionStorage.removeItem(KEY_STORE);
    } catch (e) {
      /* sessionStorage 사용 불가 환경 무시 */
    }
  }

  function restoreKey() {
    try {
      var k = sessionStorage.getItem(KEY_STORE);
      if (k) {
        $("#ai-key").value = k;
        $("#ai-remember").checked = true;
        $("#opt-ai").checked = true;
        toggleAiPanel();
      }
    } catch (e) {
      /* 무시 */
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
    status.innerHTML = svg(ICON.spinner, "ico-spin") + "파일에서 내용을 추출하는 중...";

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

      var msg;
      if (failList.length) {
        msg =
          svg(ICON.alert) +
          okList.length +
          "개 파일 추출 완료 · 실패 " +
          failList.length +
          "개 (" +
          esc(failList[0].error) +
          ")";
        status.className = "file-status warn";
      } else {
        msg = svg(ICON.check) + okList.length + "개 파일 추출 완료";
        status.className = "file-status done";
      }
      status.innerHTML = msg;

      if (res.text) {
        toast("파일에서 내용을 불러왔습니다. 자동으로 변환합니다.");
        onGenerate();
      } else {
        toast("추출된 텍스트가 없습니다. 파일 내용을 확인해 주세요.");
      }
    }, function (err) {
      status.className = "file-status warn";
      status.innerHTML = svg(ICON.alert) + "파일 처리 실패: " + esc((err && err.message) || err);
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

  // ── 테마(다크/일반) · 홈 이동 · 네비 활성 ───────────────
  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
  function applyThemeIcon() {
    var btn = $("#theme-toggle");
    if (!btn) return;
    var icon = btn.querySelector(".theme-icon") || btn;
    var dark = getTheme() === "dark";
    // 다크 모드일 땐 해(밝게 전환), 라이트 모드일 땐 달(어둡게 전환)
    icon.innerHTML = svg(dark ? ICON.sun : ICON.moon, "theme-svg");
    btn.setAttribute("aria-label", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
    btn.setAttribute("title", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
  }
  function toggleTheme() {
    var next = getTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("tc_theme", next);
    } catch (e) {
      /* 무시 */
    }
    applyThemeIcon();
  }

  function bindThemeAndNav() {
    applyThemeIcon();
    var toggle = $("#theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);

    var brand = $("#brand-home");
    if (brand) {
      var goHome = function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      brand.addEventListener("click", goHome);
      brand.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goHome();
        }
      });
    }

    // 스크롤 위치에 따라 네비 항목 활성 표시
    var navMap = {};
    Array.prototype.forEach.call(document.querySelectorAll(".site-nav a[data-nav]"), function (a) {
      navMap[a.getAttribute("data-nav")] = a;
    });
    var sections = ["tool", "how"]
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);

    if (window.IntersectionObserver && sections.length) {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var active = navMap[en.target.id];
            if (!active) return;
            Object.keys(navMap).forEach(function (k) {
              navMap[k].classList.remove("active");
            });
            active.classList.add("active");
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
      );
      sections.forEach(function (s) {
        obs.observe(s);
      });
    }
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

    // AI 모드
    $("#opt-ai").addEventListener("change", toggleAiPanel);
    $("#ai-key-clear").addEventListener("click", function () {
      $("#ai-key").value = "";
      $("#ai-remember").checked = false;
      try {
        sessionStorage.removeItem(KEY_STORE);
      } catch (e) {
        /* 무시 */
      }
      $("#ai-key").focus();
    });
    $("#ai-remember").addEventListener("change", function () {
      if (!$("#ai-remember").checked) {
        try {
          sessionStorage.removeItem(KEY_STORE);
        } catch (e) {
          /* 무시 */
        }
      } else if ($("#ai-key").value.trim()) {
        saveKeyMaybe($("#ai-key").value.trim());
      }
    });

    bindDropzone();
    bindThemeAndNav();
    restoreKey();
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
