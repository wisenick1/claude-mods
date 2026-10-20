import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BranchInfo } from '../types'

// 브랜치 이름에서 Jira 이슈 키(대문자 프로젝트 키-번호)를 찾는다. 예) feature/back/PROJ-12-login-api → PROJ-12
const ISSUE_KEY = /[A-Z][A-Z0-9]+-\d+/
const POLL_MS = 5000

const info = atom({ plugin: 'branch-band', key: 'info' } as const, null)

// 현재 브랜치를 읽어 바뀌었을 때만 저장한다 (같은 값이면 다시 그리지 않음)
async function refresh($: EngineInterface) {
  let current: BranchInfo | null = null
  try {
    const { exitCode, stdout } = await $.process.run(
      ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 3000 })
    const branch = stdout.trim()
    if (exitCode === 0 && branch) {
      current = { branch, issueKey: branch.match(ISSUE_KEY)?.[0] ?? null }
    }
  } catch {
    // git 이 없거나 저장소가 아니면 띠를 숨긴다
  }

  const prev = await read($, info)
  if (prev?.branch !== current?.branch) {
    await update($, info, () => current)
  }
}

export const register: Register = on => {
  // 세션 시작 때 한 번 읽고, 터미널에서 직접 checkout 해도 반영되도록 주기적으로 다시 읽는다
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    $.clock.every(POLL_MS, () => refresh($))
    return result
  })

  // Claude 가 checkout 했을 때 바로 반영
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, info)
    if (e.props.hasSurvey || current === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>⎇ {current.branch}</Text>
        {current.issueKey
          ? <Text color="cyan">  {current.issueKey}</Text>
          : <Text dimColor>  (이슈 키 없음)</Text>}
      </Box>
    )
  })
}
