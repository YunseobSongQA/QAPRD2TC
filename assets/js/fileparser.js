/*
 * fileparser.js — 업로드한 기획서 파일에서 텍스트 추출
 *
 * 지원: .pptx / .docx / .xlsx / .xls / .csv / .txt / .md
 * 외부 라이브러리: JSZip(window.JSZip), SheetJS(window.XLSX) — 저장소에 self-host
 *
 * window.TCFileParser.parseFiles(FileList|File[]) → Promise<{ text, results:[{name, ok, error, lines}] }>
 */
(function () {
  "use strict";

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  // XML 엔티티 디코드
  function decodeXml(s) {
    return String(s)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) {
        return String.fromCharCode(parseInt(d, 10));
      })
      .replace(/&amp;/g, "&");
  }

  function readArrayBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        resolve(r.result);
      };
      r.onerror = function () {
        reject(r.error);
      };
      r.readAsArrayBuffer(file);
    });
  }

  function readText(file) {
    if (file.text) return file.text();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        resolve(r.result);
      };
      r.onerror = function () {
        reject(r.error);
      };
      r.readAsText(file, "utf-8");
    });
  }

  // ── PPTX: 슬라이드별 텍스트 추출 ──────────────────────
  function parsePptx(file) {
    if (!window.JSZip) return Promise.reject(new Error("JSZip 라이브러리를 불러오지 못했습니다."));
    return readArrayBuffer(file)
      .then(function (buf) {
        return window.JSZip.loadAsync(buf);
      })
      .then(function (zip) {
        var slideNames = Object.keys(zip.files).filter(function (n) {
          return /^ppt\/slides\/slide\d+\.xml$/.test(n);
        });
        // slide1, slide2 ... 숫자 순 정렬
        slideNames.sort(function (a, b) {
          var na = parseInt(a.replace(/\D+/g, ""), 10);
          var nb = parseInt(b.replace(/\D+/g, ""), 10);
          return na - nb;
        });
        return Promise.all(
          slideNames.map(function (n) {
            return zip.files[n].async("string");
          })
        );
      })
      .then(function (xmls) {
        var out = [];
        xmls.forEach(function (xml, idx) {
          // 문단(<a:p>) 단위로 분리, 각 문단의 <a:t> 합치기
          var paras = xml.split(/<a:p[ >]/);
          var lines = [];
          paras.forEach(function (p) {
            var texts = [];
            var re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
            var m;
            while ((m = re.exec(p)) !== null) {
              texts.push(decodeXml(m[1]));
            }
            var line = texts.join("").trim();
            if (line) lines.push(line);
          });
          if (lines.length) {
            // 슬라이드 첫 줄은 제목(중분류)으로, 나머지는 항목으로 구조화
            out.push("## " + lines[0]);
            for (var i = 1; i < lines.length; i++) out.push("- " + lines[i]);
            out.push(""); // 슬라이드 구분
          }
        });
        return out.join("\n").trim();
      });
  }

  // ── DOCX: 문단별 텍스트 추출 (제목 스타일 인식) ────────
  function parseDocx(file) {
    if (!window.JSZip) return Promise.reject(new Error("JSZip 라이브러리를 불러오지 못했습니다."));
    return readArrayBuffer(file)
      .then(function (buf) {
        return window.JSZip.loadAsync(buf);
      })
      .then(function (zip) {
        var doc = zip.files["word/document.xml"];
        if (!doc) throw new Error("DOCX 본문(document.xml)을 찾을 수 없습니다.");
        return doc.async("string");
      })
      .then(function (xml) {
        var paras = xml.split(/<w:p[ >]/);
        var lines = [];
        paras.forEach(function (p) {
          var texts = [];
          var re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
          var m;
          while ((m = re.exec(p)) !== null) {
            texts.push(decodeXml(m[1]));
          }
          var line = texts.join("").trim();
          if (!line) return;
          // 제목 스타일 감지 → 마크다운 헤딩으로
          var hm = /<w:pStyle[^>]*w:val="(?:Heading|제목)?\s*(\d)"/i.exec(p);
          if (hm) {
            var lvl = Math.min(parseInt(hm[1], 10) || 1, 3);
            lines.push(new Array(lvl + 1).join("#") + " " + line);
          } else if (/<w:numPr[ >]/.test(p)) {
            lines.push("- " + line); // 목록 문단
          } else {
            lines.push(line);
          }
        });
        return lines.join("\n").trim();
      });
  }

  // ── XLSX / XLS / CSV: 시트의 행을 텍스트로 ─────────────
  function parseSpreadsheet(file) {
    if (!window.XLSX) return Promise.reject(new Error("SheetJS(XLSX) 라이브러리를 불러오지 못했습니다."));
    return readArrayBuffer(file).then(function (buf) {
      var wb = window.XLSX.read(new Uint8Array(buf), { type: "array" });
      var out = [];
      wb.SheetNames.forEach(function (sheetName) {
        var ws = wb.Sheets[sheetName];
        var rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
        if (!rows.length) return;
        if (wb.SheetNames.length > 1) out.push("# " + sheetName);
        rows.forEach(function (row) {
          var cells = (row || [])
            .map(function (c) {
              return c == null ? "" : String(c).trim();
            })
            .filter(function (c) {
              return c !== "";
            });
          if (!cells.length) return;
          out.push("- " + cells.join(" | "));
        });
        out.push("");
      });
      return out.join("\n").trim();
    });
  }

  // ── 단일 파일 파싱 ────────────────────────────────────
  function parseOne(file) {
    var ext = extOf(file.name);
    switch (ext) {
      case "pptx":
        return parsePptx(file);
      case "docx":
        return parseDocx(file);
      case "xlsx":
      case "xls":
      case "csv":
        return parseSpreadsheet(file);
      case "txt":
      case "md":
      case "markdown":
        return readText(file);
      default:
        // 알 수 없는 형식은 텍스트로 시도
        return readText(file).then(function (t) {
          if (/�/.test(t)) {
            throw new Error("지원하지 않는 파일 형식입니다 (." + ext + "). PPTX·DOCX·XLSX·CSV·TXT를 사용하세요.");
          }
          return t;
        });
    }
  }

  // ── 여러 파일 파싱 ────────────────────────────────────
  function parseFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var results = [];
    var chain = Promise.resolve("");

    files.forEach(function (file) {
      chain = chain.then(function (acc) {
        return parseOne(file).then(
          function (text) {
            var t = (text || "").trim();
            results.push({ name: file.name, ok: true, lines: t ? t.split(/\n/).length : 0 });
            var header = files.length > 1 ? "# [" + file.name + "]\n" : "";
            return acc + (acc ? "\n\n" : "") + header + t;
          },
          function (err) {
            results.push({ name: file.name, ok: false, error: (err && err.message) || "추출 실패" });
            return acc;
          }
        );
      });
    });

    return chain.then(function (text) {
      return { text: text.trim(), results: results };
    });
  }

  window.TCFileParser = {
    parseFiles: parseFiles,
    parseOne: parseOne,
    supported: ["pptx", "docx", "xlsx", "xls", "csv", "txt", "md"]
  };
})();
