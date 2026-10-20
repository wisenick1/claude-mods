import type { Register } from 'claude-code'

const TOAST_MS = 6000
const MAX_REASON = 80

// 차단 이유에서 훅 이름을 찾는다.
//  - 이유가 "[secret-guard] ..." 처럼 이름표로 시작하면 그 이름
//  - 아니면 이유 안의 스크립트 이름. 예) ".../.claude/hooks/secret-guard.js" → secret-guard
const LABEL = /^\s*\[([\w.-]+)\]\s/
const SCRIPT = /([\w.-]+)\.(?:js|mjs|cjs|ts|sh|py|ps1)\b/

function hookName(reason: string): string | null {
  return reason.match(LABEL)?.[1] ?? reason.match(SCRIPT)?.[1] ?? null
}

// 이유의 첫 줄만, 너무 길면 자른다. 앞에 붙은 "[명령]: " 꼬리표와 "[이름] " 이름표는 뗀다
function summary(reason: string): string {
  const first = reason.trim().split('\n')[0].replace(/^.*?\]:\s*/, '').replace(LABEL, '').trim()
  return first.length > MAX_REASON ? `${first.slice(0, MAX_REASON - 1)}…` : first
}

export const register: Register = on => {
  // settings 훅(PreToolUse)들의 결정을 받아 본 뒤, 막혔으면 토스트를 띄우고 결정은 그대로 돌려준다
  on('classic.PreToolUse', async ($, e, next) => {
    const result = await next(e)
    if (result.deny) {
      const name = hookName(result.deny) ?? `${e.tool} 훅`
      $.ui.toast(`🛡 ${name}: ${summary(result.deny)}`, { timeoutMs: TOAST_MS })
    }
    return result
  })
    // 알림에서 문제가 나도 훅들의 결정은 그대로 돌려준다 (이 mod 가 없던 것처럼)
    .catch(($, e, next) => next(e))
}
