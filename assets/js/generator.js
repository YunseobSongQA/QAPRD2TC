/*
 * generator.js — 기획서(PRD) → 테스트 케이스(TC) 규칙 기반 변환 엔진
 *
 * 외부 의존성 없음. 브라우저에서 바로 동작.
 * window.TCGenerator.generate(text, options) 로 사용.
 *
 * 표준 QA 양식 컬럼:
 *   id / major(대분류) / minor(중분류) / scenario(시나리오)
 *   precondition(사전조건) / steps(테스트 단계[]) / expected(기대결과)
 *   priority(우선순위) / type(유형: 정상/예외/경계)
 */
(function () {
  "use strict";

  // ── 우선순위 판정 키워드 ───────────────────────────────
  var HIGH_WORDS = ["필수", "반드시", "must", "중요", "핵심", "보안", "결제", "인증", "로그인"];
  var LOW_WORDS = ["선택", "옵션", "optional", "권장", "부가", "참고"];

  function detectPriority(text) {
    var t = (text || "").toLowerCase();
    for (var i = 0; i < HIGH_WORDS.length; i++) {
      if (t.indexOf(HIGH_WORDS[i].toLowerCase()) !== -1) return "높음";
    }
    for (var j = 0; j < LOW_WORDS.length; j++) {
      if (t.indexOf(LOW_WORDS[j].toLowerCase()) !== -1) return "낮음";
    }
    return "보통";
  }

  // ── 키워드 기반 표준 케이스 템플릿 ──────────────────────
  // 각 항목: { match:[키워드], cases:[부분TC...] }
  // 부분TC: { scenario, precondition, steps:[], expected, type }
  var TEMPLATES = [
    {
      keys: ["로그인", "login", "sign in", "사인인"],
      cases: [
        { scenario: "정상 계정으로 로그인", precondition: "가입된 계정이 존재한다", steps: ["로그인 화면으로 이동한다", "올바른 아이디와 비밀번호를 입력한다", "로그인 버튼을 클릭한다"], expected: "정상적으로 로그인되어 메인 화면으로 이동한다", type: "정상" },
        { scenario: "잘못된 비밀번호로 로그인", precondition: "가입된 계정이 존재한다", steps: ["로그인 화면으로 이동한다", "올바른 아이디와 틀린 비밀번호를 입력한다", "로그인 버튼을 클릭한다"], expected: "로그인이 거부되고 오류 메시지가 노출된다", type: "예외" },
        { scenario: "미가입 계정으로 로그인", precondition: "없음", steps: ["로그인 화면으로 이동한다", "존재하지 않는 아이디를 입력한다", "로그인 버튼을 클릭한다"], expected: "로그인이 거부되고 안내 메시지가 노출된다", type: "예외" },
        { scenario: "아이디/비밀번호 미입력 후 로그인 시도", precondition: "없음", steps: ["로그인 화면으로 이동한다", "입력값을 비워둔 채 로그인 버튼을 클릭한다"], expected: "필수 입력 안내 메시지가 노출되고 로그인이 진행되지 않는다", type: "예외" }
      ]
    },
    {
      keys: ["로그아웃", "logout", "sign out"],
      cases: [
        { scenario: "정상 로그아웃", precondition: "로그인 상태이다", steps: ["로그아웃 버튼을 클릭한다"], expected: "로그아웃되어 로그인 화면 또는 메인 화면으로 이동한다", type: "정상" }
      ]
    },
    {
      keys: ["회원가입", "가입", "sign up", "register", "회원 가입"],
      cases: [
        { scenario: "정상 정보로 회원가입", precondition: "없음", steps: ["회원가입 화면으로 이동한다", "모든 필수 항목을 올바르게 입력한다", "가입 버튼을 클릭한다"], expected: "회원가입이 완료되고 완료 안내가 노출된다", type: "정상" },
        { scenario: "이미 가입된 이메일로 가입 시도", precondition: "동일 이메일로 가입된 계정이 존재한다", steps: ["회원가입 화면으로 이동한다", "이미 사용 중인 이메일을 입력한다", "가입 버튼을 클릭한다"], expected: "중복 안내 메시지가 노출되고 가입이 진행되지 않는다", type: "예외" },
        { scenario: "비밀번호 규칙 위반", precondition: "없음", steps: ["회원가입 화면으로 이동한다", "규칙에 맞지 않는 비밀번호를 입력한다", "가입 버튼을 클릭한다"], expected: "비밀번호 규칙 안내 메시지가 노출된다", type: "예외" },
        { scenario: "필수 항목 누락", precondition: "없음", steps: ["회원가입 화면으로 이동한다", "일부 필수 항목을 비워둔다", "가입 버튼을 클릭한다"], expected: "필수 항목 입력 안내가 노출되고 가입이 진행되지 않는다", type: "예외" }
      ]
    },
    {
      keys: ["비밀번호 찾기", "비밀번호 재설정", "비번 재설정", "reset password", "패스워드"],
      cases: [
        { scenario: "정상 비밀번호 재설정", precondition: "가입된 계정이 존재한다", steps: ["비밀번호 찾기 화면으로 이동한다", "가입된 이메일을 입력하고 인증을 완료한다", "새 비밀번호를 입력한다"], expected: "비밀번호가 변경되고 새 비밀번호로 로그인된다", type: "정상" },
        { scenario: "미가입 이메일로 재설정 시도", precondition: "없음", steps: ["비밀번호 찾기 화면으로 이동한다", "가입되지 않은 이메일을 입력한다"], expected: "안내 메시지가 노출되고 인증 메일이 발송되지 않는다", type: "예외" }
      ]
    },
    {
      keys: ["검색", "search", "조회"],
      cases: [
        { scenario: "결과가 있는 키워드로 검색", precondition: "검색 대상 데이터가 존재한다", steps: ["검색창에 결과가 있는 키워드를 입력한다", "검색을 실행한다"], expected: "키워드에 해당하는 결과 목록이 표시된다", type: "정상" },
        { scenario: "결과가 없는 키워드로 검색", precondition: "없음", steps: ["검색창에 결과가 없는 키워드를 입력한다", "검색을 실행한다"], expected: "'검색 결과 없음' 안내가 표시된다", type: "예외" },
        { scenario: "특수문자/공백만 입력 후 검색", precondition: "없음", steps: ["검색창에 특수문자 또는 공백만 입력한다", "검색을 실행한다"], expected: "오류 없이 적절히 처리된다(안내 또는 빈 결과)", type: "경계" }
      ]
    },
    {
      keys: ["결제", "구매", "payment", "checkout", "주문"],
      cases: [
        { scenario: "정상 결제 완료", precondition: "결제 가능한 상품과 유효한 결제수단이 있다", steps: ["상품을 선택하고 결제 화면으로 이동한다", "결제수단을 선택한다", "결제를 진행한다"], expected: "결제가 완료되고 주문/결제 완료 화면이 표시된다", type: "정상" },
        { scenario: "결제 실패", precondition: "결제 가능한 상품이 있다", steps: ["결제 화면으로 이동한다", "한도 초과 등 실패하는 결제수단으로 결제한다"], expected: "결제 실패 안내가 표시되고 주문이 생성되지 않는다", type: "예외" },
        { scenario: "결제 중 취소", precondition: "결제 화면 진입 상태이다", steps: ["결제 진행 중 취소 버튼을 클릭한다"], expected: "결제가 취소되고 결제 전 상태로 복귀한다", type: "예외" }
      ]
    },
    {
      keys: ["장바구니", "cart", "담기"],
      cases: [
        { scenario: "상품 장바구니 담기", precondition: "상품 상세 화면이다", steps: ["수량을 선택한다", "장바구니 담기 버튼을 클릭한다"], expected: "장바구니에 상품이 추가된다", type: "정상" },
        { scenario: "장바구니 수량 변경", precondition: "장바구니에 상품이 있다", steps: ["장바구니에서 수량을 변경한다"], expected: "변경된 수량과 금액이 반영된다", type: "정상" },
        { scenario: "장바구니 상품 삭제", precondition: "장바구니에 상품이 있다", steps: ["장바구니에서 삭제 버튼을 클릭한다"], expected: "선택한 상품이 장바구니에서 제거된다", type: "정상" }
      ]
    },
    {
      keys: ["업로드", "첨부", "upload", "파일 등록"],
      cases: [
        { scenario: "허용 형식 파일 업로드", precondition: "업로드 화면이다", steps: ["허용된 형식의 파일을 선택한다", "업로드를 실행한다"], expected: "파일이 정상적으로 업로드된다", type: "정상" },
        { scenario: "허용되지 않은 형식 업로드", precondition: "업로드 화면이다", steps: ["허용되지 않은 형식의 파일을 선택한다", "업로드를 실행한다"], expected: "형식 오류 안내가 표시되고 업로드되지 않는다", type: "예외" },
        { scenario: "용량 초과 파일 업로드", precondition: "업로드 화면이다", steps: ["허용 용량을 초과하는 파일을 선택한다", "업로드를 실행한다"], expected: "용량 초과 안내가 표시되고 업로드되지 않는다", type: "경계" }
      ]
    },
    {
      keys: ["다운로드", "download", "내려받기"],
      cases: [
        { scenario: "정상 다운로드", precondition: "다운로드 가능한 항목이 있다", steps: ["다운로드 버튼을 클릭한다"], expected: "파일이 정상적으로 다운로드된다", type: "정상" }
      ]
    },
    {
      keys: ["삭제", "delete", "제거"],
      cases: [
        { scenario: "삭제 확인 후 삭제", precondition: "삭제 대상 항목이 있다", steps: ["삭제 버튼을 클릭한다", "확인 팝업에서 확인을 클릭한다"], expected: "대상 항목이 삭제된다", type: "정상" },
        { scenario: "삭제 취소", precondition: "삭제 대상 항목이 있다", steps: ["삭제 버튼을 클릭한다", "확인 팝업에서 취소를 클릭한다"], expected: "삭제되지 않고 기존 상태가 유지된다", type: "예외" }
      ]
    },
    {
      keys: ["수정", "편집", "변경", "edit", "update"],
      cases: [
        { scenario: "정상 수정/저장", precondition: "수정 대상 항목이 있다", steps: ["수정 화면으로 이동한다", "값을 변경한다", "저장 버튼을 클릭한다"], expected: "변경 내용이 저장되어 반영된다", type: "정상" },
        { scenario: "수정 후 취소", precondition: "수정 화면 진입 상태이다", steps: ["값을 변경한다", "취소 버튼을 클릭한다"], expected: "변경이 반영되지 않고 기존 값이 유지된다", type: "예외" }
      ]
    },
    {
      keys: ["등록", "저장", "작성", "추가", "create", "save", "submit", "신청"],
      cases: [
        { scenario: "정상 등록/저장", precondition: "등록 화면이다", steps: ["필수 항목을 올바르게 입력한다", "등록/저장 버튼을 클릭한다"], expected: "정상적으로 등록되고 완료 안내가 표시된다", type: "정상" },
        { scenario: "필수값 누락 후 등록", precondition: "등록 화면이다", steps: ["일부 필수 항목을 비워둔다", "등록/저장 버튼을 클릭한다"], expected: "필수 입력 안내가 표시되고 등록되지 않는다", type: "예외" }
      ]
    },
    {
      keys: ["목록", "리스트", "list", "페이징", "페이지네이션"],
      cases: [
        { scenario: "목록 조회", precondition: "데이터가 존재한다", steps: ["목록 화면으로 이동한다"], expected: "데이터가 목록 형태로 표시된다", type: "정상" },
        { scenario: "빈 목록 표시", precondition: "데이터가 없다", steps: ["목록 화면으로 이동한다"], expected: "'데이터 없음' 안내가 표시된다", type: "경계" },
        { scenario: "페이지 이동", precondition: "여러 페이지 분량의 데이터가 있다", steps: ["다음 페이지로 이동한다"], expected: "다음 페이지의 데이터가 표시된다", type: "정상" }
      ]
    },
    {
      keys: ["필터", "정렬", "filter", "sort"],
      cases: [
        { scenario: "필터/정렬 적용", precondition: "목록 데이터가 있다", steps: ["필터 또는 정렬 조건을 선택한다", "적용한다"], expected: "선택한 조건에 맞게 목록이 갱신된다", type: "정상" }
      ]
    },
    {
      keys: ["알림", "푸시", "notification", "push"],
      cases: [
        { scenario: "알림 수신", precondition: "알림 설정이 켜져 있다", steps: ["알림 발생 조건을 충족시킨다"], expected: "알림이 정상적으로 수신/표시된다", type: "정상" },
        { scenario: "알림 끔 상태", precondition: "알림 설정이 꺼져 있다", steps: ["알림 발생 조건을 충족시킨다"], expected: "알림이 발송/표시되지 않는다", type: "예외" }
      ]
    },
    {
      keys: ["권한", "인증", "authorization", "permission", "접근"],
      cases: [
        { scenario: "권한 있는 사용자 접근", precondition: "해당 기능 권한이 있는 계정으로 로그인되어 있다", steps: ["해당 기능에 접근한다"], expected: "정상적으로 기능을 사용할 수 있다", type: "정상" },
        { scenario: "권한 없는 사용자 접근", precondition: "권한이 없는 계정으로 로그인되어 있다", steps: ["해당 기능에 접근을 시도한다"], expected: "접근이 차단되고 권한 안내가 표시된다", type: "예외" }
      ]
    }
  ];

  // ── 입력/검증 성격 키워드 (일반 요구사항의 예외 케이스 생성용) ──
  var INPUT_HINT = ["입력", "폼", "양식", "값", "검증", "유효", "필드", "form"];

  // ── 문서 제목성 단어 (이런 최상위 제목은 대분류로만 쓰고 케이스 생성은 건너뜀) ──
  var DOC_TITLE_RE = /(기획서|기획|정의서|요구사항|스펙|명세|문서|prd|spec|requirement)/i;

  // ── 줄 분류 헬퍼 ───────────────────────────────────────
  function stripBullet(line) {
    return line.replace(/^\s*([-*•·▪▶◦※o]|[0-9]+[.)]|\([0-9]+\)|[가-힣][.)])\s*/, "").trim();
  }

  // 제목 레벨 판정: 0이면 제목 아님, 1=대분류, 2이상=중분류
  function headingLevel(line) {
    var m;
    // 마크다운 #
    m = line.match(/^(#{1,6})\s+\S/);
    if (m) return m[1].length;
    // 숫자 위계: 1.  /  1.1  /  1.1.1
    m = line.match(/^\s*(\d+(?:\.\d+)*)[.)]?\s+\S/);
    if (m) {
      var depth = m[1].split(".").length;
      return depth;
    }
    // 콜론으로 끝나는 짧은 제목
    if (/[:：]\s*$/.test(line) && line.length <= 40) return 2;
    return 0;
  }

  function headingText(line) {
    return line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, "")
      .replace(/[:：]\s*$/, "")
      .trim();
  }

  // 요구사항처럼 보이는 줄인지(내용 줄)
  function looksLikeRequirement(line) {
    if (!line) return false;
    if (line.length < 2) return false;
    return true;
  }

  // 키워드 매칭되는 템플릿 모음 반환
  function matchTemplates(text) {
    var low = text.toLowerCase();
    var matched = [];
    for (var i = 0; i < TEMPLATES.length; i++) {
      var tpl = TEMPLATES[i];
      for (var k = 0; k < tpl.keys.length; k++) {
        if (low.indexOf(tpl.keys[k].toLowerCase()) !== -1) {
          matched.push(tpl);
          break;
        }
      }
    }
    return matched;
  }

  function hasInputHint(text) {
    var low = text.toLowerCase();
    for (var i = 0; i < INPUT_HINT.length; i++) {
      if (low.indexOf(INPUT_HINT[i].toLowerCase()) !== -1) return true;
    }
    return false;
  }

  // ── 메인 변환 ──────────────────────────────────────────
  function generate(text, options) {
    options = options || {};
    var includeNegative = options.includeNegative !== false; // 기본 true
    var includeBoundary = options.includeBoundary !== false; // 기본 true
    var prefix = options.idPrefix || "TC";

    var lines = String(text || "").split(/\r?\n/);
    var cases = [];
    var seq = 0;

    var major = "";
    var minor = "";

    function nextId() {
      seq += 1;
      var n = String(seq);
      while (n.length < 3) n = "0" + n;
      return prefix + "-" + n;
    }

    function pushCase(partial, scope, sourceText) {
      if (!includeNegative && partial.type === "예외") return;
      if (!includeBoundary && partial.type === "경계") return;
      cases.push({
        id: nextId(),
        major: scope.major || "일반",
        minor: scope.minor || "",
        scenario: partial.scenario,
        precondition: partial.precondition || "없음",
        steps: partial.steps || [],
        expected: partial.expected,
        priority: partial.priority || detectPriority((sourceText || "") + " " + partial.scenario),
        type: partial.type || "정상"
      });
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw || !raw.trim()) continue;
      var line = raw.replace(/\t/g, " ").trimRight();
      var lvl = headingLevel(line);

      if (lvl > 0) {
        var htext = headingText(line);
        if (lvl === 1) {
          major = htext;
          minor = "";
        } else {
          minor = htext;
        }
        // 최상위 문서 제목(예: "...기획서")은 대분류로만 쓰고 케이스 생성은 건너뜀
        if (lvl === 1 && DOC_TITLE_RE.test(htext)) {
          continue;
        }
        // 제목 자체가 키워드 기능이면, 그 제목으로도 케이스 생성
        var hTpls = matchTemplates(htext);
        var hScope = { major: major || htext, minor: lvl === 1 ? "" : htext };
        for (var h = 0; h < hTpls.length; h++) {
          for (var hc = 0; hc < hTpls[h].cases.length; hc++) {
            pushCase(hTpls[h].cases[hc], hScope, htext);
          }
        }
        continue;
      }

      // 내용 줄 처리
      var content = stripBullet(line);
      if (!looksLikeRequirement(content)) continue;

      var scope = { major: major || "일반", minor: minor || content.slice(0, 24) };
      var tpls = matchTemplates(content);

      if (tpls.length > 0) {
        for (var t = 0; t < tpls.length; t++) {
          for (var c = 0; c < tpls[t].cases.length; c++) {
            pushCase(tpls[t].cases[c], scope, content);
          }
        }
      } else {
        // 일반 요구사항: 정상 케이스 1개 (+ 입력성이면 예외 1개)
        var feature = minor || content.slice(0, 24);
        pushCase(
          {
            scenario: content + " 정상 동작 확인",
            precondition: "해당 기능 진입 가능 상태",
            steps: ["기획서에 정의된 대로 '" + content + "' 동작을 수행한다"],
            expected: "기획서 정의대로 정상 동작한다",
            type: "정상"
          },
          scope,
          content
        );
        if (includeNegative && hasInputHint(content)) {
          pushCase(
            {
              scenario: content + " - 잘못된 입력/예외 처리 확인",
              precondition: "해당 기능 진입 가능 상태",
              steps: ["잘못된 값 또는 빈 값을 입력한다", "동작을 수행한다"],
              expected: "적절한 검증/오류 안내가 표시되고 비정상 처리가 차단된다",
              type: "예외"
            },
            scope,
            content
          );
        }
      }
    }

    // 중복 시나리오 제거(동일 major+scenario)
    var seen = {};
    var deduped = [];
    for (var d = 0; d < cases.length; d++) {
      var key = cases[d].major + "|" + cases[d].scenario;
      if (seen[key]) continue;
      seen[key] = true;
      deduped.push(cases[d]);
    }
    // 재부여 ID
    for (var r = 0; r < deduped.length; r++) {
      var rn = String(r + 1);
      while (rn.length < 3) rn = "0" + rn;
      deduped[r].id = prefix + "-" + rn;
    }

    var stats = { total: deduped.length, normal: 0, exception: 0, boundary: 0 };
    for (var s = 0; s < deduped.length; s++) {
      if (deduped[s].type === "정상") stats.normal++;
      else if (deduped[s].type === "예외") stats.exception++;
      else if (deduped[s].type === "경계") stats.boundary++;
    }

    return { cases: deduped, stats: stats };
  }

  window.TCGenerator = { generate: generate };
})();
