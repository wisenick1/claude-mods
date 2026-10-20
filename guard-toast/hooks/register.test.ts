import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// 엔진 대신: settings 훅의 결정(decide)과 도구 실행, 토스트를 흉내 낸다
function fakeEngine(on: On, decide: () => object) {
  const toasts: string[] = []
  on('classic.PreToolUse', () => decide())
  on('tool.call', () => ({ result: { text: 'ok' } }))
  on('ui.toast', (_$, e) => { toasts.push(e.text); return { value: undefined } })
  return toasts
}

const READ_ENV = { tool: 'Read', tool_use_id: 'toolu_1', input: { file_path: 'backend/.env' } }

test('settings 훅이 막으면 훅 이름과 이유 첫 줄을 토스트로 띄운다', async ($, on) => {
  const toasts = fakeEngine(on, () => ({
    deny: '[node "$CLAUDE_PROJECT_DIR/.claude/hooks/secret-guard.js"]: 비밀값 파일 \'.env\'은(는) 읽거나 수정할 수 없습니다.\n'
      + '필요한 변수 이름은 \'.env.example\'을 참고하세요.',
  }))

  await $.tool.call(READ_ENV)

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toBe('🛡 secret-guard: 비밀값 파일 \'.env\'은(는) 읽거나 수정할 수 없습니다.')
})

test('이유가 [이름] 이름표로 시작하면 그 이름을 쓰고 이름표는 뗀다', async ($, on) => {
  const toasts = fakeEngine(on, () => ({ deny: '[review-gate] push 전에 origin/dev...HEAD 를 리뷰하세요.\n리뷰 기록이 없습니다.' }))

  await $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_3', input: { command: 'git status' } })

  expect(toasts).toEqual(['🛡 review-gate: push 전에 origin/dev...HEAD 를 리뷰하세요.'])
})

test('이유에 훅 스크립트 이름이 없으면 도구 이름으로 알려준다', async ($, on) => {
  const toasts = fakeEngine(on, () => ({ deny: '보호 브랜치 \'dev\'에 직접 push 할 수 없습니다.' }))

  await $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_2', input: { command: 'git status' } })

  expect(toasts).toEqual(['🛡 Bash 훅: 보호 브랜치 \'dev\'에 직접 push 할 수 없습니다.'])
})

test('긴 이유는 잘라서 보여준다', async ($, on) => {
  const toasts = fakeEngine(on, () => ({ deny: '가'.repeat(200) }))

  await $.tool.call(READ_ENV)

  expect(toasts[0].length).toBeLessThan(100)
  expect(toasts[0].endsWith('…')).toBe(true)
})

test('토스트에서 에러가 나도 차단은 그대로 유지된다', async ($, on) => {
  on('classic.PreToolUse', () => ({ deny: '[secret-guard] 비밀값 파일입니다.' }))
  on('tool.call', () => ({ result: { text: 'ok' } }))
  on('ui.toast', () => { throw new Error('toast failed') })

  const result = await $.tool.call(READ_ENV)

  // settings 훅의 차단은 도구 결과의 에러로 모델에 전달된다
  expect(result.isError).toBe(true)
  expect(result.text).toBe('[secret-guard] 비밀값 파일입니다.')
})

test('막지 않으면 토스트를 띄우지 않는다', async ($, on) => {
  const toasts = fakeEngine(on, () => ({}))

  await $.tool.call(READ_ENV)

  expect(toasts).toHaveLength(0)
})
