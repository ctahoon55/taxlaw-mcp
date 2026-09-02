#!/usr/bin/env node
// taxlaw-mcp — 법제처 OPEN API 가 못 주는 세무 자료를 보완하는 작은 MCP 서버.
// 자료원 하나 = src/sources/ 파일 하나. 새 자료원을 추가하면 아래 registerTool 만 늘리면 된다.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { searchNtsInterpretation, renderSearch, getNtsInterpretation } from "./sources/nts-interpretation.js"

const OC = process.env.LAW_OC || ""

const server = new McpServer({ name: "taxlaw-mcp", version: "0.1.0" })

function text(s, isError = false) {
  return { content: [{ type: "text", text: s }], ...(isError ? { isError: true } : {}) }
}

server.registerTool(
  "search_tax_interpretation",
  {
    title: "국세청 예규 검색",
    description:
      "[국세청 예규·법령해석 검색] 법제처 OPEN API(target=ntsCgmExpc)로 국세청이 직접 회신한 예규(서면·재산·법인·부가 등)를 검색한다. " +
      "결과마다 안건명·안건번호·해석일자·ntstDcmId 를 보여준다. 본문은 ntstDcmId 로 get_tax_interpretation 을 호출한다. " +
      "korean-law 의 search_decisions(domain='nts') 와 같은 목록이지만 본문 조회용 ntstDcmId 를 바로 준다.",
    inputSchema: {
      query: z.string().min(1).describe("검색어 (예: '1세대 1주택 비과세', '접대비 한도')"),
      page: z.number().int().min(1).optional().describe("페이지 (기본 1)"),
      display: z.number().int().min(1).max(100).optional().describe("페이지당 건수 (기본 20, 최대 100)"),
      explYd: z.string().optional().describe("해석일자 범위 YYYYMMDD~YYYYMMDD (예: '20200101~20251231')"),
      sort: z.string().optional().describe("정렬: lasc(안건명↑) ldes(안건명↓) dasc(해석일자↑) ddes(해석일자↓)"),
      search: z.number().int().min(1).max(2).optional().describe("검색범위 1=안건명(기본) 2=본문"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async (args) => {
    try {
      const r = await searchNtsInterpretation(args, { oc: OC })
      return text(renderSearch(r))
    } catch (e) {
      return text(`[검색 실패] ${e.message}`, true)
    }
  },
)

server.registerTool(
  "get_tax_interpretation",
  {
    title: "국세청 예규 본문",
    description:
      "[국세청 예규 본문 조회] ntstDcmId(숫자 18자리, 또는 taxlaw.nts.go.kr 링크)로 예규 전문을 받아 HTML 을 지운 평문으로 돌려준다(표는 줄바꿈·탭 유지). " +
      "제목·문서번호·생산일자·요지·회신·본문 순. 법제처 OPEN API 는 국세청 예규 본문을 제공하지 않으므로 국세법령정보시스템 공개 페이지에서 가져온다. " +
      "끝에 출처 링크와 '원문 대조' 경고가 붙는다 — 인용 시 그대로 전달할 것.",
    inputSchema: {
      ntstDcmId: z.string().min(1).describe("숫자 18자리 (search_tax_interpretation 결과의 ntstDcmId) 또는 상세 링크 URL"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ ntstDcmId }) => {
    try {
      return text(await getNtsInterpretation(ntstDcmId))
    } catch (e) {
      return text(`[본문 조회 실패] ${e.message}`, true)
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
