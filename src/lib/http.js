// 공용 HTTP 도우미 — 호출 간격 제한(throttle), 바이트 상한, 재시도 1회.
// taxlaw.nts.go.kr 는 공식 API 가 아니므로 예의 규칙을 코드로 강제한다.

const lastCallAt = new Map() // host -> ms

/** 같은 호스트 연속 호출 사이 최소 간격을 보장한다. */
export async function politeWait(host, minGapMs) {
  const prev = lastCallAt.get(host) ?? 0
  const wait = prev + minGapMs - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt.set(host, Date.now())
}

/**
 * 응답 본문을 최대 maxBytes 까지만 읽는다. 넘으면 즉시 중단하고 에러를 던진다.
 * (국세청 응답은 2MB 안팎인데 그중 99%가 무관한 목록이라 상한이 꼭 필요하다.)
 */
export async function readTextCapped(response, maxBytes) {
  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new Error(`응답이 상한(${Math.round(maxBytes / 1024 / 1024)}MB)을 넘어 읽기를 중단했습니다`)
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.byteLength }
  return new TextDecoder("utf-8").decode(buf)
}

/**
 * fetch + 간격 제한 + 상한 + 재시도(최대 retries 회, 기본 1회).
 * 재시도 대상: 네트워크 오류, 5xx, 429. 4xx 는 재시도하지 않는다.
 */
export async function politeFetch(url, init = {}, { minGapMs = 400, maxBytes = 5 * 1024 * 1024, retries = 1, timeoutMs = 30000 } = {}) {
  const host = new URL(url).host
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeWait(host, minGapMs)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal })
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`)
        await res.body?.cancel().catch(() => {})
        continue
      }
      const text = await readTextCapped(res, maxBytes)
      return { status: res.status, ok: res.ok, contentType: res.headers.get("content-type") || "", text }
    } catch (e) {
      lastErr = e
      if (String(e?.message || "").includes("상한")) throw e // 상한 초과는 재시도 무의미
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`요청 실패(재시도 ${retries}회 포함): ${lastErr?.message || lastErr}`)
}
