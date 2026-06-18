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

  window.TCExport = {
    columns: COLUMNS,
    stepsToText: stepsToText,
    toCSV: toCSV,
    toMarkdown: toMarkdown,
    downloadCSV: function (cases) {
      download("testcases_" + timestamp() + ".csv", toCSV(cases), "text/csv;charset=utf-8");
    },
    downloadMarkdown: function (cases) {
      download("testcases_" + timestamp() + ".md", toMarkdown(cases), "text/markdown;charset=utf-8");
    }
  };
})();
