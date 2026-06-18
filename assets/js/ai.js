/*
 * ai.js — AI 모드: 사용자의 Anthropic API 키로 브라우저에서 Claude를 직접 호출
 *
 * 정적 구조 유지(백엔드 없음). 키는 사용자 브라우저에만 존재하며
 * Anthropic API(api.anthropic.com) 외 어디에도 전송되지 않습니다.
 *
 * window.TCAI.generate(prdText, apiKey, options) → Promise<{ cases, truncated }>
 */
(function () {
  "use strict";

  var ENDPOINT = "https://api.anthropic.com/v1/messages";
  var MODEL = "claude-opus-4-8";

  // 표준 QA 양식 구조화 출력 스키마
  var SCHEMA = {
    type: "object",
    properties: {
      cases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            major: { type: "string", description: "대분류(기능 영역)" },
            minor: { type: "string", description: "중분류(세부 기능)" },
            scenario: { type: "string", description: "테스트 시나리오 한 줄 요약" },
            precondition: { type: "string", description: "사전조건" },
            steps: { type: "array", items: { type: "string" }, description: "테스트 단계(순서대로)" },
            expected: { type: "string", description: "기대결과" },
            priority: { type: "string", enum: ["높음", "보통", "낮음"] },
            type: { type: "string", enum: ["정상", "예외", "경계"] }
          },
          required: ["major", "minor", "scenario", "precondition", "steps", "expected", "priority", "type"],
          additionalProperties: false
        }
      }
    },
    required: ["cases"],
    additionalProperties: false
  };

  var SYSTEM = [
    "당신은 숙련된 QA 엔지니어입니다. 주어진 기획서(PRD)를 분석해 실무에서 바로 쓸 수 있는 테스트 케이스를 한국어로 작성합니다.",
    "원칙:",
    "- 각 기능/요구사항에 대해 정상 케이스를 우선 작성하고, 입력·검증·권한·결제 등에는 예외/경계 케이스도 추가합니다.",
    "- 테스트 단계(steps)는 구체적인 사용자 행동 순서로 작성합니다.",
    "- 기대결과(expected)는 명확하고 검증 가능하게 작성합니다.",
    "- 우선순위(priority)는 핵심/보안/결제 기능은 '높음', 부가 기능은 '낮음', 그 외 '보통'으로 판단합니다.",
    "- 유형(type)은 정상/예외/경계 중 하나로 분류합니다.",
    "- 반드시 정의된 JSON 스키마 형식으로만 출력합니다."
  ].join("\n");

  function buildUserPrompt(prd, options) {
    var lines = ["다음 기획서를 분석해 테스트 케이스를 생성하세요.", ""];
    lines.push("옵션:");
    lines.push("- 예외 케이스 포함: " + (options.includeNegative !== false ? "예" : "아니오"));
    lines.push("- 경계 케이스 포함: " + (options.includeBoundary !== false ? "예" : "아니오"));
    lines.push("");
    lines.push("=== 기획서 시작 ===");
    lines.push(prd);
    lines.push("=== 기획서 끝 ===");
    return lines.join("\n");
  }

  function pad3(n) {
    var s = String(n);
    while (s.length < 3) s = "0" + s;
    return s;
  }

  function normalizeCases(rawCases, prefix) {
    prefix = prefix || "TC";
    var arr = Array.isArray(rawCases) ? rawCases : [];
    return arr.map(function (c, i) {
      var steps = c.steps;
      if (typeof steps === "string") steps = steps.split(/\n+/);
      if (!Array.isArray(steps)) steps = [];
      return {
        id: prefix + "-" + pad3(i + 1),
        major: c.major || "일반",
        minor: c.minor || "",
        scenario: c.scenario || "",
        precondition: c.precondition || "없음",
        steps: steps.filter(function (s) { return s && String(s).trim(); }),
        expected: c.expected || "",
        priority: ["높음", "보통", "낮음"].indexOf(c.priority) >= 0 ? c.priority : "보통",
        type: ["정상", "예외", "경계"].indexOf(c.type) >= 0 ? c.type : "정상"
      };
    });
  }

  function extractJson(data) {
    var text = "";
    (data.content || []).forEach(function (b) {
      if (b.type === "text" && b.text) text += b.text;
    });
    try {
      return JSON.parse(text);
    } catch (e) {
      var m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error("AI 응답을 해석하지 못했습니다.");
    }
  }

  function generate(prd, apiKey, options) {
    options = options || {};
    if (!apiKey) return Promise.reject(new Error("API 키가 필요합니다."));
    if (!prd || !prd.trim()) return Promise.reject(new Error("기획서 내용이 비어 있습니다."));

    var body = {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: buildUserPrompt(prd, options) }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } }
    };

    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            throw new Error("서버 응답을 받지 못했습니다 (" + res.status + ").");
          })
          .then(function (data) {
            if (!res.ok) {
              var em = (data && data.error && data.error.message) || "";
              if (res.status === 401) throw new Error("API 키가 올바르지 않습니다. (401)");
              if (res.status === 429) throw new Error("요청 한도를 초과했습니다. 잠시 후 다시 시도하세요. (429)");
              if (res.status === 400 && /credit|balance/i.test(em)) throw new Error("API 크레딧/잔액을 확인해 주세요.");
              throw new Error(em || "AI 요청 실패 (" + res.status + ")");
            }
            return data;
          });
      })
      .then(function (data) {
        if (data.stop_reason === "refusal") {
          throw new Error("AI가 요청을 거부했습니다(안전 정책). 기획서 내용을 확인해 주세요.");
        }
        var parsed = extractJson(data);
        var cases = normalizeCases(parsed.cases, options.idPrefix);
        return { cases: cases, truncated: data.stop_reason === "max_tokens" };
      });
  }

  window.TCAI = { generate: generate, MODEL: MODEL };
})();
