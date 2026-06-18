/* export.js — TC 결과를 CSV / Markdown 로 변환 및 다운로드 */
(function () {
  "use strict";

  var COLUMNS = [
    { key: "id", label: "TC ID" },
    { key: "major", label: "대분류" },
    { key: "minor", label: "중분류" },
    { key: "scenario", label: "시나리오" },
    { key: "precondition", label: "사전조건" },
    { key: "steps", label: "테스트 단계" },
    { key: "expected", label: "기대결과" },
    { key: "priority", label: "우선순위" },
    { key: "type", label: "유형" }
  ];

  function stepsToText(steps, sep) {
    if (!steps || !steps.length) return "";
    return steps
      .map(function (s, i) {
        return i + 1 + ". " + s;
      })
      .join(sep || "\n");
  }

  // ── CSV ───────────────────────────────────────────────
  function csvEscape(value) {
    var v = value == null ? "" : String(value);
    if (/[",\n\r]/.test(v)) {
      v = '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  function toCSV(cases) {
    var rows = [];
    rows.push(
      COLUMNS.map(function (c) {
        return csvEscape(c.label);
      }).join(",")
    );
    cases.forEach(function (tc) {
      var row = COLUMNS.map(function (c) {
        var val = c.key === "steps" ? stepsToText(tc.steps, "\n") : tc[c.key];
        return csvEscape(val);
      });
      rows.push(row.join(","));
    });
    // 엑셀 한글 깨짐 방지용 BOM
    return "﻿" + rows.join("\r\n");
  }

  // ── Markdown ──────────────────────────────────────────
  function mdEscape(value) {
    return (value == null ? "" : String(value)).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  }

  function toMarkdown(cases) {
    var header =
      "| " +
      COLUMNS.map(function (c) {
        return c.label;
      }).join(" | ") +
      " |";
    var divider =
      "| " +
      COLUMNS.map(function () {
        return "---";
      }).join(" | ") +
      " |";
    var body = cases.map(function (tc) {
      return (
        "| " +
        COLUMNS.map(function (c) {
          var val = c.key === "steps" ? stepsToText(tc.steps, "<br>") : tc[c.key];
          return mdEscape(val);
        }).join(" | ") +
        " |"
      );
    });
    return [header, divider].concat(body).join("\n");
  }

  // ── 다운로드 ──────────────────────────────────────────
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function timestamp() {
    var d = new Date();
    function p(n) {
      return n < 10 ? "0" + n : "" + n;
    }
    return (
      d.getFullYear() +
      p(d.getMonth() + 1) +
      p(d.getDate()) +
      "_" +
      p(d.getHours()) +
      p(d.getMinutes())
    );
  }

  // ── XLSX (SheetJS, 실제 엑셀 파일) ────────────────────
  function buildWorkbook(cases) {
    if (!window.XLSX) throw new Error("SheetJS(XLSX) 라이브러리를 불러오지 못했습니다.");
    var XLSX = window.XLSX;
    var aoa = [
      COLUMNS.map(function (c) {
        return c.label;
      })
    ];
    cases.forEach(function (tc) {
      aoa.push(
        COLUMNS.map(function (c) {
          return c.key === "steps" ? stepsToText(tc.steps, "\n") : tc[c.key] == null ? "" : String(tc[c.key]);
        })
      );
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    // 보기 좋은 열 너비
    ws["!cols"] = [
      { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 26 },
      { wch: 44 }, { wch: 34 }, { wch: 8 }, { wch: 8 }
    ];
    // 헤더 행 고정
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TestCases");
    return wb;
  }

  function downloadXLSX(cases) {
    var wb = buildWorkbook(cases);
    window.XLSX.writeFile(wb, "testcases_" + timestamp() + ".xlsx");
  }

  window.TCExport = {
    columns: COLUMNS,
    stepsToText: stepsToText,
    toCSV: toCSV,
    toMarkdown: toMarkdown,
    buildWorkbook: buildWorkbook,
    downloadCSV: function (cases) {
      download("testcases_" + timestamp() + ".csv", toCSV(cases), "text/csv;charset=utf-8");
    },
    downloadMarkdown: function (cases) {
      download("testcases_" + timestamp() + ".md", toMarkdown(cases), "text/markdown;charset=utf-8");
    },
    downloadXLSX: downloadXLSX
  };
})();
