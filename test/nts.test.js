import { test } from "node:test"
import assert from "node:assert/strict"
import { parseSearchXml, extractDocument, normalizeId, renderDocument, FOOTER } from "../src/sources/nts-interpretation.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?><CgmExpc><target>ntsCgmExpc</target><totalCnt>2</totalCnt><page>1</page>` +
  `<cgmExpc id="1"><법령해석일련번호>99974</법령해석일련번호><안건명><![CDATA[10년 이상 경작을 직접 한 경우 양도소득세의 비과세 여부]]></안건명>` +
  `<안건번호><![CDATA[재산01254-3031]]></안건번호><해석기관명>국세청</해석기관명><해석일자>1988.10.24</해석일자>` +
  `<법령해석상세링크>https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=010000000000101257</법령해석상세링크></cgmExpc></CgmExpc>`

test("검색 XML: 안건번호·ntstDcmId 추출", () => {
  const r = parseSearchXml(XML)
  assert.equal(r.totalCnt, 2)
  assert.equal(r.items[0].안건번호, "재산01254-3031")
  assert.equal(r.items[0].ntstDcmId, "010000000000101257")
  assert.equal(r.items[0].안건명, "10년 이상 경작을 직접 한 경우 양도소득세의 비과세 여부")
})

test("검색 XML: 오류 응답은 예외", () => {
  assert.throws(() => parseSearchXml("<Law><result>사용자 정보 검증에 실패하였습니다</result></Law>"), /예상 형식이 아닙니다/)
})

test("normalizeId: 18자리 또는 URL", () => {
  assert.equal(normalizeId("010000000000101257"), "010000000000101257")
  assert.equal(normalizeId("https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=010000000000101257"), "010000000000101257")
  assert.throws(() => normalizeId("99974"), /18자리/)
})

test("extractDocument: 정상 문서", () => {
  const json = { data: { ASIQTB002PR01: {
    dcmDVO: { ntstDcmTtl: "제목", ntstDcmDscmCntn: "재산01254-3031", ntstDcmRgtDt: "19881024", ntstDcmGistCntn: "요지입니다 요지입니다 요지입니다", ntstDcmCntn: "회신" },
    dcmHwpEditorDVOList: [{ dcmFleByte: "" }, { dcmFleByte: "<p>1. 질의</p><table><tr><td>a</td><td>b</td></tr></table>" }],
  } } }
  const d = extractDocument(json, "010000000000101257")
  assert.equal(d.생산일자, "1988.10.24")
  assert.equal(d.본문, "1. 질의\na\tb")
  const out = renderDocument(d)
  assert.ok(out.endsWith(FOOTER("010000000000101257")))
  assert.match(out, /출처: https:\/\/taxlaw\.nts\.go\.kr\/qt\/USEQTA002P\.do\?ntstDcmId=010000000000101257/)
})

test("extractDocument: 없는 번호(빈 필드)는 null", () => {
  const json = { data: { ASIQTB002PR01: { dcmDVO: { ntstDcmTtl: null, ntstDcmGistCntn: null, ntstDcmCntn: null }, dcmHwpEditorDVOList: [] } } }
  assert.equal(extractDocument(json, "100000000000000001"), null)
})
