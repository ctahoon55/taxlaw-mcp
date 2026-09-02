// HTML → 평문. 표는 행=줄바꿈, 칸=탭으로 살린다. 외부 라이브러리 없이 정규식만 쓴다.

const NAMED = { nbsp: "\u00a0", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", middot: "·", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", times: "×", won: "₩" }

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m))
}

export function htmlToText(html) {
  if (!html) return ""
  let s = String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\r/g, "")
    // 원본 HTML 의 줄바꿈(태그 사이 들여쓰기)은 서식이 아니다 — 태그 사이는 지우고 글 안에서는 공백 1개
    .replace(/>\s*\n\s*</g, "><")
    .replace(/\s*\n\s*/g, " ")
    // 표: 칸 사이 탭, 행 끝 줄바꿈
    .replace(/<\/t[dh]\s*>/gi, "\t")
    .replace(/<\/tr\s*>/gi, "\n")
    .replace(/<\/?(table|thead|tbody|tfoot)\b[^>]*>/gi, "\n")
    // 블록 요소는 줄바꿈
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|section|article)\s*>/gi, "\n") // 블록 닫힘 = 줄바꿈
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    // 나머지 태그 제거
    .replace(/<[^>]+>/g, "")
  s = decodeEntities(s)
  return s
    .replace(/\n{2,}/g, "\n")             // 태그가 연달아 만든 줄바꿈은 하나로 (빈 문단 <p>&nbsp;</p> 은 아래에서 빈 줄로 남는다)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")           // 줄 끝 공백
    .replace(/\t{2,}/g, "\t")             // 연속 탭 축약
    .replace(/\n[ ]+(?=\S)/g, "\n")       // 줄 앞 공백 (표의 탭은 유지)
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** 공백을 뺀 글자 수. '문서 없음' 판정(20자 미만)에 쓴다. */
export function compactLength(...parts) {
  return parts.map((p) => (p || "").replace(/\s+/g, "")).join("").length
}
