import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BranchInfo } from '../types'

// 브랜치 이름에서 Jira 이슈 키(대문자 프로젝트 키-번호)를 찾는다. 예) feature/back/PROJ-12-login-api → PROJ-12
const ISSUE_KEY = /[A-Z][A-Z0-9]+-\d+/
const POLL_MS = 5000

const info = atom({ plugin: 'branch-band', key: 'info' } as const, null)

async function git($: EngineInterface, ...args: string[]): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', ...args], { timeoutMs: 3000 })
    return exitCode === 0 ? stdout.trim() : null
  } catch {
    return null
  }
}

// 브랜치·기준 브랜치 대비 커밋 수·미커밋 파일 수·리뷰 기록을 한 번에 읽는다
async function readInfo($: EngineInterface): Promise<BranchInfo | null> {
  // porcelain v2: "# branch.oid <sha>", "# branch.head <name>", 그 뒤로 변경 파일 한 줄씩
  const status = await git($, 'status', '--porcelain=v2', '--branch')
  if (status === null) return null // git 이 없거나 저장소가 아니면 띠를 숨긴다

  const lines = status.split('\n').filter(Boolean)
  const header = (key: string) => lines.find(l => l.startsWith(`# branch.${key} `))?.slice(`# branch.${key} `.length)
  const branch = header('head')
  const head = header('oid')
  if (!branch) return null
  const dirty = lines.filter(l => !l.startsWith('#')).length

  // 기준 브랜치는 원격 기본 브랜치(origin/HEAD)로 정한다. 이 저장소에선 origin/dev
  const base = await git($, 'rev-parse', '--abbrev-ref', 'origin/HEAD')
  const aheadText = base ? await git($, 'rev-list', '--count', `${base}..HEAD`) : null
  const ahead = aheadText === null ? null : Number(aheadText)

  // 리뷰 상태는 <git-dir>/.reviewed-sha 파일이 있는 저장소(리뷰 기록을 쓰기로 한 곳)에서,
  // push 할 커밋이 있을 때만 본다. HEAD 가 파일에 적힌 SHA 와 같으면 리뷰 완료 (빈 파일 = 아직 기록 없음)
  let reviewed: boolean | null = null
  if (ahead) {
    const gitDir = await git($, 'rev-parse', '--git-dir')
    let recorded: string | null = null
    try {
      recorded = gitDir ? (await $.fs.read(`${gitDir}/.reviewed-sha`)).trim() : null
    } catch {
      // 파일 없음: 이 저장소는 리뷰 기록을 쓰지 않는다
    }
    reviewed = recorded === null ? null : recorded !== '' && recorded === head
  }

  return {
    branch,
    issueKey: branch.match(ISSUE_KEY)?.[0] ?? null,
    base,
    ahead,
    dirty,
    reviewed,
  }
}

// 값이 바뀌었을 때만 저장한다 (같은 값이면 다시 그리지 않음)
async function refresh($: EngineInterface) {
  const current = await readInfo($)
  const prev = await read($, info)
  if (JSON.stringify(prev) !== JSON.stringify(current)) {
    await update($, info, () => current)
  }
}

export const register: Register = on => {
  // 세션 시작 때 한 번 읽고, 터미널에서 직접 checkout·commit 해도 반영되도록 주기적으로 다시 읽는다
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    $.clock.every(POLL_MS, () => refresh($))
    return result
  })

  // Claude 가 checkout·commit 했을 때 바로 반영
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
    const sep = <Text dimColor>  │  </Text>
    const baseName = current.base?.replace(/^origin\//, '')

    return (
      <Box>
        <Text dimColor>⎇ {current.branch}</Text>
        {current.issueKey
          ? <Text color="cyan">  {current.issueKey}</Text>
          : <Text dimColor>  (이슈 키 없음)</Text>}
        {current.ahead !== null && current.ahead > 0 && sep}
        {current.ahead !== null && current.ahead > 0 && <Text>{baseName} 대비 커밋 {current.ahead}</Text>}
        {current.dirty > 0 && sep}
        {current.dirty > 0 && <Text color="yellow">미커밋 {current.dirty}</Text>}
        {current.reviewed !== null && sep}
        {current.reviewed === true && <Text color="green">✓ 리뷰됨</Text>}
        {current.reviewed === false && <Text color="red" bold>🔍 리뷰 필요</Text>}
      </Box>
    )
  })
}
