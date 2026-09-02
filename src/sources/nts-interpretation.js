// 자료원: 국세청 예규(법령해석) — 목록은 법제처 OPEN API, 본문은 국세법령정보시스템 공개 페이지.
//
// [검색] https://www.law.go.kr/DRF/lawSearch.do?OC=..&target=ntsCgmExpc&type=XML
//        결과의 '법령해석상세링크' 안에 ntstDcmId(숫자 18자리)가 그대로 들어 있다.
// [본문] POST https://taxlaw.nts.go.kr/action.do  (actionId=ASIQTB002PR01)
//        실측(2026-09-02): GET 이나 타 호스트 Referer 를 주면 404 가 아니라 200 + 홈페이지 HTML 이 온다.
//        → 상태코드가 아니라 "JSON 이 아니면 실패" 로 판정한다.
//        응답 2MB 안팎, 그중 99%가 무관한 목록(trilPsagList). 본문(dcmHwpEditorDVOList)은 그 뒤에 있으므로
//        읽기 상한을 2MB 로 두면 본문이 잘린다 → 5MB.

import { politeFetch } from "../lib/http.js"
import { htmlToText, decodeEntities, compactLength } from "../lib/html-to-text.js"

const LAW_SEARCH = "https://www.law.go.kr/DRF/lawSearch.do"
const TAXLAW_ACTION = "https://taxlaw.nts.go.kr/action.do"
const TAXLAW_PAGE = (id) => `https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=${id}`
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const MAX_OUTPUT_CHARS = 40000

export const FOOTER = (id) =>
  `출처: ${TAXLAW_PAGE(id)}\n` +
  `⚠️ 법제처 OPEN API 가 아닌 국세법령정보시스템 공개 페이지에서 가져온 본문입니다.\n` +
  `   인용 전 원문으로 대조하세요.`

// ---------- XML 파싱 (외부 라이브러리 없이) ----------
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  if (!m) return ""
  return decodeEntities(m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")).trim()
}

export function parseSearchXml(xml) {
  if (!/<CgmExpc>/.test(xml)) {
    const msg = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
    throw new Error(`법제처 검색 응답이 예상 형식이 아닙니다: ${msg || "(빈 응답)"}`)
  }
  const totalCnt = Number(tag(xml, "totalCnt") || 0)
  const page = Number(tag(xml, "page") || 1)
  const items = [...xml.matchAll(/<cgmExpc[^>]*>([\s\S]*?)<\/cgmExpc>/g)].map((m) => {
    const b = m[1]
    const link = tag(b, "법령해석상세링크")
    return {
      법령해석일련번호: tag(b, "법령해석일련번호"),
      안건명: tag(b, "안건명"),
      안건번호: tag(b, "안건번호"),
      해석기관명: tag(b, "해석기관명"),
      해석일자: tag(b, "해석일자"),
      ntstDcmId: link.match(/ntstDcmId=(\d+)/)?.[1] || "",
      링크: link,
    }
  })
  return { totalCnt, page, items }
}

// ---------- 검색 ----------
export async function searchNtsInterpretation({ query, page = 1, display = 20, explYd, sort, search }, { oc }) {
  if (!oc) throw new Error("법제처 인증키(LAW_OC 환경변수)가 없습니다")
  const p = new URLSearchParams({ OC: oc, target: "ntsCgmExpc", type: "XML", query, page: String(page), display: String(display) })
  if (explYd) p.set("explYd", explYd)
  if (sort) p.set("sort", sort)
  if (search) p.set("search", String(search))
  const res = await politeFetch(`${LAW_SEARCH}?${p}`, {
    headers: { "user-agent": UA, referer: "https://www.law.go.kr/" },
  }, { minGapMs: 200, maxBytes: 5 * 1024 * 1024, retries: 1 })
  const parsed = parseSearchXml(res.text)
  return { ...parsed, query, display }
}

export function renderSearch(r) {
  if (r.totalCnt === 0) return `국세청 예규 검색 결과 없음: "${r.query}"\n(검색어를 줄이거나 다른 세목명·용어로 다시 시도)`
  const lines = [`국세청 예규 검색 결과 — "${r.query}" (총 ${r.totalCnt}건, ${r.page}페이지, ${r.items.length}건 표시)`, ""]
  for (const it of r.items) {
    lines.push(`■ ${it.안건명 || "(안건명 없음)"}`)
    lines.push(`  안건번호: ${it.안건번호 || "N/A"} · 해석일자: ${it.해석일자 || "N/A"} · 해석기관: ${it.해석기관명 || "N/A"}`)
    lines.push(`  ntstDcmId: ${it.ntstDcmId || "(링크에 없음)"}  ← 본문은 get_tax_interpretation(ntstDcmId)`)
    lines.push("")
  }
  lines.push(`※ 법제처 OPEN API 목록 기준. 본문은 ntstDcmId 로 get_tax_interpretation 을 호출해야 합니다.`)
  return lines.join("\n")
}

// ---------- 본문 ----------
export function normalizeId(input) {
  const s = String(input || "").trim()
  const fromUrl = s.match(/ntstDcmId=(\d+)/)?.[1]
  const id = fromUrl || s
  if (!/^\d{18}$/.test(id)) throw new Error(`ntstDcmId 는 숫자 18자리여야 합니다 (받은 값: "${s.slice(0, 40)}")`)
  return id
}

export async function fetchNtsInterpretationRaw(id) {
  const body = new URLSearchParams({ actionId: "ASIQTB002PR01", paramData: JSON.stringify({ dcmDVO: { ntstDcmId: id } }) })
  const res = await politeFetch(TAXLAW_ACTION, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": UA,
      origin: "https://taxlaw.nts.go.kr",
      referer: TAXLAW_PAGE(id),           // 법제처용 Referer 를 재사용하면 홈페이지 HTML 이 온다
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json, text/javascript, */*",
    },
    body: body.toString(),
  }, { minGapMs: 400, maxBytes: 5 * 1024 * 1024, retries: 1 })

  const text = res.text.trimStart()
  if (!res.ok || !text.startsWith("{")) {
    throw new Error(`국세법령정보시스템이 JSON 이 아닌 응답을 보냈습니다 (HTTP ${res.status}, ${res.contentType || "type 미상"}). 점검 중이거나 요청 형식이 막힌 경우입니다.`)
  }
  return JSON.parse(text)
}

/** 원시 JSON → 정리된 문서 객체. 문서가 없으면 null. */
export function extractDocument(json, id) {
  const a = json?.data?.ASIQTB002PR01
  const d = a?.dcmDVO || {}
  const editors = Array.isArray(a?.dcmHwpEditorDVOList) ? a.dcmHwpEditorDVOList : []
  const bodyHtml = editors.map((e) => (typeof e?.dcmFleByte === "string" ? e.dcmFleByte : "")).filter((s) => s.trim()).join("\n")
  const doc = {
    ntstDcmId: id,
    제목: (d.ntstDcmTtl || "").trim(),
    문서번호: (d.ntstDcmDscmCntn || "").trim(),
    생산일자: formatDate(d.ntstDcmRgtDt),
    요지: (d.ntstDcmGistCntn || "").trim(),
    회신: (d.ntstDcmCntn || "").trim(),
    본문: htmlToText(bodyHtml),
  }
  if (compactLength(doc.요지, doc.회신, doc.본문) < 20) return null
  return doc
}

function formatDate(s) {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : (s || "")
}

export function renderDocument(doc) {
  const parts = [
    `=== ${doc.제목 || "(제목 없음)"} ===`,
    `문서번호: ${doc.문서번호 || "N/A"} · 생산일자: ${doc.생산일자 || "N/A"} · ntstDcmId: ${doc.ntstDcmId}`,
    "",
  ]
  if (doc.요지) parts.push("[요지]", doc.요지, "")
  if (doc.회신) parts.push("[회신]", doc.회신, "")
  if (doc.본문) parts.push("[본문]", doc.본문, "")
  let out = parts.join("\n").trimEnd()
  if (out.length > MAX_OUTPUT_CHARS) out = out.slice(0, MAX_OUTPUT_CHARS) + `\n\n…(본문이 길어 ${MAX_OUTPUT_CHARS.toLocaleString()}자에서 잘랐습니다. 전체는 아래 출처 링크에서 확인)`
  return out + "\n\n" + FOOTER(doc.ntstDcmId)
}

export function renderMissing(id) {
  return `[문서 없음] ntstDcmId ${id} 에 해당하는 예규를 국세법령정보시스템에서 찾지 못했습니다.\n` +
    `번호를 검색 결과(search_tax_interpretation)의 ntstDcmId 에서 다시 확인하세요.\n\n` + FOOTER(id)
}

export async function getNtsInterpretation(input) {
  const id = normalizeId(input)
  const json = await fetchNtsInterpretationRaw(id)
  const doc = extractDocument(json, id)
  return doc ? renderDocument(doc) : renderMissing(id)
}
