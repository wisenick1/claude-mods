import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 },
} as const

const HEAD = 'a'.repeat(40)

// reviewedSha: null = .reviewed-sha 파일 없음(리뷰 기록 안 씀), '' = 빈 파일(쓰기로 했지만 기록 전)
type Repo = { branch: string; ahead: number; dirty: number; reviewedSha: string | null }

// 엔진 대신 git 결과·파일 읽기·세션 시작을 흉내 낸다. 반환된 repo 를 바꾸면 checkout·commit 을 흉내 낸다.
function fakeRepo(on: On, initial: Partial<Repo> = {}) {
  const repo: Repo = { branch: 'dev', ahead: 0, dirty: 0, reviewedSha: null, ...initial }
  const ok = (stdout: string) => ({ value: { exitCode: 0, stdout: `${stdout}\n`, stderr: '' } })

  on('process.run', (_$, e) => {
    const args = e.argv.slice(1).join(' ')
    if (args.startsWith('status')) {
      const files = Array.from({ length: repo.dirty }, (_, i) => `? new-file-${i}.txt`)
      return ok([`# branch.oid ${HEAD}`, `# branch.head ${repo.branch}`, ...files].join('\n'))
    }
    if (args === 'rev-parse --abbrev-ref origin/HEAD') return ok('origin/dev')
    if (args.startsWith('rev-list --count')) return ok(String(repo.ahead))
    if (args === 'rev-parse --git-dir') return ok('.git')
    return { value: { exitCode: 1, stdout: '', stderr: 'unexpected' } }
  })
  on('fs.read', () => {
    if (repo.reviewedSha === null) return { deny: 'ENOENT' }
    return { value: `${repo.reviewedSha}\n` }
  })
  on('session.start', () => ({ cwd: '.' }))
  on('ui.render', () => null)
  return repo
}

async function band($, surface: 'terminal' | 'desktop' = 'desktop') {
  return $.ui.mount({ plugin: 'branch-band', surface, ...BAND })
}

test('브랜치 이름에서 Jira 키를 찾아 띠에 보여준다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, { branch: 'feature/back/PROJ-12-login-api' })
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await band($, surface)
    expect(await ui.find({ type: 'Text', text: /feature\/back\/PROJ-12-login-api/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /PROJ-12$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('이슈 키가 없는 브랜치는 "이슈 키 없음"으로 표시하고, 변경이 없으면 상태 칸을 숨긴다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, { branch: 'dev' })
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: /이슈 키 없음/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /커밋|미커밋|리뷰/ })).toBeUndefined()
  await ui.unmount()
})

test('기준 브랜치 대비 커밋 수와 미커밋 파일 수를 보여준다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, { branch: 'feature/back/PROJ-12-login-api', ahead: 3, dirty: 2 })
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: /dev 대비 커밋 3/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /미커밋 2/ })).toBeDefined()
  await ui.unmount()
})

test('.reviewed-sha 파일이 없는 저장소에서는 리뷰 상태를 표시하지 않는다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, { branch: 'feature/back/PROJ-12-login-api', ahead: 3, reviewedSha: null })
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: /dev 대비 커밋 3/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /리뷰/ })).toBeUndefined()
  await ui.unmount()
})

test('리뷰 기록을 쓰는 저장소에서 push 할 커밋이 있으면 기록과 HEAD 를 비교해 리뷰 상태를 보여준다', async ($, on) => {
  const clock = mock.clock(on)
  // 빈 .reviewed-sha = 리뷰 기록을 쓰기로 했지만 아직 기록 전
  const repo = fakeRepo(on, { branch: 'feature/back/PROJ-12-login-api', ahead: 1, reviewedSha: '' })
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  let ui = await band($)
  expect(await ui.find({ type: 'Text', text: /리뷰 필요/ })).toBeDefined()
  await ui.unmount()

  // 리뷰를 마치고 HEAD 를 기록하면 5초 안에 "리뷰됨"으로 바뀐다
  repo.reviewedSha = HEAD
  await clock.advance(5000)
  ui = await band($)
  expect(await ui.find({ type: 'Text', text: /리뷰됨/ })).toBeDefined()
  await ui.unmount()

  // 리뷰 후 기록과 다른 SHA 면 다시 "리뷰 필요"
  repo.reviewedSha = 'b'.repeat(40)
  await clock.advance(5000)
  ui = await band($)
  expect(await ui.find({ type: 'Text', text: /리뷰 필요/ })).toBeDefined()
  await ui.unmount()
})

test('터미널에서 checkout 하면 5초 안에 띠가 바뀐다', async ($, on) => {
  const clock = mock.clock(on)
  const repo = fakeRepo(on, { branch: 'dev' })
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  repo.branch = 'feature/front/ABC-345-alarm-sound'
  await clock.advance(5000)

  const ui = await band($)
  expect(await ui.find({ type: 'Text', text: /ABC-345$/ })).toBeDefined()
  await ui.unmount()
})
