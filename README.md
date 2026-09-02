# taxlaw-mcp — 국세청 예규 본문 보완 MCP

법제처 OPEN API(korean-law MCP)는 **국세청 예규(법령해석)를 목록만 주고 본문은 주지 않습니다.**
이 작은 MCP 서버는 그 빈칸을 메웁니다. 목록은 법제처에서, 본문은 국세법령정보시스템(taxlaw.nts.go.kr) 공개 페이지에서 가져옵니다.

> 원칙: korean-law MCP 를 그대로 쓰고, **국세청 예규 본문이 필요할 때만** 이 서버의 도구를 부릅니다.

## 도구 2개

| 도구 | 하는 일 |
|---|---|
| `search_tax_interpretation` | 검색어로 국세청 예규 목록 조회. 결과마다 안건명·안건번호·해석일자·**ntstDcmId** |
| `get_tax_interpretation` | ntstDcmId(숫자 18자리)로 본문을 받아 HTML 을 지운 평문으로 반환. 표는 줄바꿈·탭으로 유지 |

본문 끝에는 항상 두 줄이 붙습니다.
```
출처: https://taxlaw.nts.go.kr/qt/USEQTA002P.do?ntstDcmId=<18자리>
⚠️ 법제처 OPEN API 가 아닌 국세법령정보시스템 공개 페이지에서 가져온 본문입니다. 인용 전 원문으로 대조하세요.
```

## 설치 (Node.js 20 이상)

```bash
git clone https://github.com/ctahoon55/taxlaw-mcp.git && cd taxlaw-mcp && npm install --omit=dev
```

Claude Code 에 등록 (인증키는 법제처 OPEN API 신청 시 받은 ID):
```bash
claude mcp add -s user taxlaw -e LAW_OC=<법제처_인증키> -- node /절대경로/taxlaw-mcp/src/server.js
```

Claude Desktop 은 설정 파일의 `mcpServers` 에 같은 내용을 넣으면 됩니다:
```json
"taxlaw": { "command": "node", "args": ["/절대경로/taxlaw-mcp/src/server.js"], "env": { "LAW_OC": "<법제처_인증키>" } }
```

## 점검

```bash
npm test                      # 단위 테스트 (네트워크 불필요)
LAW_OC=<키> npm run check:live  # 실제 서버 띄워 검색→본문→없는 번호 순서로 호출
```

## 예의 규칙 (공식 API 가 아니므로 코드로 강제)

- 국세청 서버 연속 호출 사이 **0.4초 이상** 간격, 재시도 **1회**까지
- 응답 읽기 상한 **5MB** (실측 2MB 중 99%는 무관한 목록이고 본문은 그 뒤에 있어 2MB 로 두면 잘림)
- GET 이나 잘못된 Referer 는 404 가 아니라 **200 + 홈페이지 HTML** 로 옴 → "JSON 이 아니면 실패"로 판정
- 요지·회신·본문을 공백 빼고 이어 20자 미만이면 **문서 없음**

## 구조 — 자료원 하나 = 파일 하나

```
src/server.js                    도구 등록 (여기에 registerTool 추가)
src/sources/nts-interpretation.js 국세청 예규 (검색 + 본문)
src/lib/http.js                  간격 제한·상한·재시도
src/lib/html-to-text.js          HTML → 평문 (표 유지)
test/                            단위 테스트
```

법제처가 못 주는 다른 자료를 발견하면 `src/sources/` 에 파일을 하나 추가하고 `server.js` 에 도구를 등록하면 됩니다.

## 실측 기록 (2026-09-02)

- 검색 XML 의 `법령해석상세링크` 안에 ntstDcmId 가 그대로 들어 있음 (변환 불필요)
- 본문: `POST https://taxlaw.nts.go.kr/action.do` · `actionId=ASIQTB002PR01` · `paramData={"dcmDVO":{"ntstDcmId":"…"}}`
- 본문 위치: `data.ASIQTB002PR01.dcmHwpEditorDVOList[].dcmFleByte` (HTML), 메타는 `dcmDVO` (`ntstDcmTtl`·`ntstDcmDscmCntn`·`ntstDcmRgtDt`·`ntstDcmGistCntn`·`ntstDcmCntn`)
- 오래된 예규는 HTML 본문이 비어 있고 요지·회신만 있는 경우가 있음 (정상)
