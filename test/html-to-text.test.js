import { test } from "node:test"
import assert from "node:assert/strict"
import { htmlToText, decodeEntities, compactLength } from "../src/lib/html-to-text.js"

test("표는 행=줄바꿈, 칸=탭", () => {
  const html = "<table><tr><td>구분</td><td>금액</td></tr><tr><td>매출</td><td>1,000</td></tr></table>"
  assert.equal(htmlToText(html), "구분\t금액\n매출\t1,000")
})

test("문단·줄바꿈·엔티티", () => {
  const html = '<html>\n <body>\n  <p><span class="bold">1. 질의내용 요약</span></p>\n  <p><span>&nbsp;○ 갑은 &amp; 을<br>끝</span></p>\n </body></html>'
  assert.equal(htmlToText(html), "1. 질의내용 요약\n○ 갑은 & 을\n끝")
})

test("빈 문단(<p>&nbsp;</p>)은 빈 줄 하나로 남는다", () => {
  const html = "<p>가</p><p>&nbsp;</p><p>나</p><p>다</p>"
  assert.equal(htmlToText(html), "가\n\n나\n다")
})

test("숫자·16진 엔티티", () => {
  assert.equal(decodeEntities("&#44032;&#x20;&quot;"), '가 "')
})

test("compactLength 는 공백 제외", () => {
  assert.equal(compactLength(" a b ", "c\n"), 3)
})
