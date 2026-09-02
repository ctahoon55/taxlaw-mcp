// 실제 서버를 stdio 로 띄워 도구를 호출해 보는 수동 점검 스크립트 (LAW_OC 필요)
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
const client = new Client({ name: "live-check", version: "0" })
await client.connect(new StdioClientTransport({ command: "node", args: ["src/server.js"], env: { ...process.env } }))
const tools = (await client.listTools()).tools.map((t) => t.name)
console.log("도구:", tools.join(", "))
const call = async (name, args) => { const t0 = Date.now(); const r = await client.callTool({ name, arguments: args }); console.log(`\n### ${name} ${JSON.stringify(args)} — ${Date.now() - t0}ms${r.isError ? " [ERROR]" : ""}\n` + r.content[0].text.slice(0, 1800)); return r }
const s = await call("search_tax_interpretation", { query: process.argv[2] || "접대비 한도", display: 3 })
const id = s.content[0].text.match(/ntstDcmId: (\d{18})/)?.[1]
if (id) await call("get_tax_interpretation", { ntstDcmId: id })
await call("get_tax_interpretation", { ntstDcmId: "100000000000000001" })
await call("get_tax_interpretation", { ntstDcmId: "99974" })
await client.close()
