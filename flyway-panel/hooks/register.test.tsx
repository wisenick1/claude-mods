import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const DIR = 'backend/src/main/resources/db/migration'
const PANE = {
  component: 'Pane',
  requestId: 'flyway-panel',
  props: {
    title: 'Flyway', isFocused: false, bodyColumns: 60, placement: 'dock',
    scroll: { top: 0, bodyRows: 40 },
  },
} as const

type Repo = {
  merged: string[] // origin/dev 에 있는 파일 이름
  local: string[] // 내 작업 트리에만 있는 파일 이름
  branches: { name: string; author: string; files: string[] }[] // 머지 안 된 원격 브랜치
  fetches: number
}

// 엔진 대신 git 을 흉내 낸다. 반환된 repo 를 바꾸면 팀원 push·내 작업을 흉내 낸다.
function fakeRepo(on: On, initial: Partial<Repo> = {}) {
  const repo: Repo = { merged: [], local: [], branches: [], fetches: 0, ...initial }
  const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } })
  const paths = (names: string[]) => names.map(n => `${DIR}/${n}`).concat('README.md').join('\n')
  const toasts: string[] = []
  const opens: string[] = []

  on('process.run', (_$, e) => {
    const [, cmd, ...rest] = e.argv
    if (cmd === 'rev-parse') return ok('origin/dev\n')
    if (cmd === 'fetch') { repo.fetches++; return ok('') }
    if (cmd === 'ls-files') return ok(paths([...repo.merged, ...repo.local]))
    if (cmd === 'branch') return ok(repo.branches.map(b => `origin/${b.name}\t${b.author}`).join('\n'))
    if (cmd === 'ls-tree') {
      const ref = rest[2]
      if (ref === 'origin/dev') return ok(paths(repo.merged))
      const b = repo.branches.find(x => `origin/${x.name}` === ref)
      return ok(paths(b ? [...repo.merged.filter(n => !n.startsWith('V4')), ...b.files] : []))
    }
    return { value: { exitCode: 1, stdout: '', stderr: 'unexpected' } }
  })
  on('session.start', () => ({ cwd: '.' }))
  on('command.register', () => ({ value: undefined }))
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  on('ui.open', (_$, e) => { opens.push(e.id); return { value: { isPlaced: true } } })
  on('ui.toast', (_$, e) => { toasts.push(e.text); return { value: undefined } })
  on('ui.render', () => null)
  return { repo, toasts, opens }
}

const MERGED = ['V1__init_schema.sql', 'V2__seed_dummy_user.sql', 'V3__remove_math_quiz.sql', 'V4__restore_math_quiz.sql']

async function start($) {
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })
}

test('머지된 마이그레이션과 다음 번호를 보여준다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, { merged: MERGED })
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'flyway-panel', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /머지됨 \(4\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /V4\s+restore_math_quiz/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /다음 번호: V5/ })).toBeDefined()
    await ui.unmount()
  }
})

test('팀원이 push 한 머지 전 브랜치의 마이그레이션을 작성자와 함께 보여주고 다음 번호에 반영한다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, {
    merged: MERGED,
    branches: [{ name: 'feature/front/PROJ-48-alarm', author: '팀원A', files: ['V5__add_alarm_table.sql'] }],
  })
  await start($)

  const ui = await $.ui.mount({ plugin: 'flyway-panel', surface: 'desktop', ...PANE })
  expect(await ui.find({ type: 'Text', text: /V5\s+add_alarm_table/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /feature\/front\/PROJ-48-alarm · 팀원A/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /다음 번호: V6/ })).toBeDefined()
  await ui.unmount()
})

test('내 작업과 팀원 작업이 같은 번호를 쓰면 충돌로 표시하고 알림을 띄운다', async ($, on) => {
  const clock = mock.clock(on)
  const { repo, toasts } = fakeRepo(on, { merged: MERGED, local: ['V5__add_share.sql'] })
  await start($)
  expect(toasts).toHaveLength(0)

  // 팀원이 같은 V5 를 쓴 브랜치를 push → 다음 fetch(3분) 때 감지
  repo.branches = [{ name: 'feature/front/PROJ-48-alarm', author: '팀원A', files: ['V5__add_alarm_table.sql'] }]
  await clock.advance(180_000)

  const ui = await $.ui.mount({ plugin: 'flyway-panel', surface: 'desktop', ...PANE })
  expect(await ui.find({ type: 'Text', text: /⚠ V5 번호가 겹쳐요/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /다음 번호: V6/ })).toBeDefined()
  expect(toasts.some(t => /V5/.test(t))).toBe(true)
  await ui.unmount()
})

test('/migrations 는 패널을 열고 원격을 다시 받아온 뒤 다음 번호를 알려준다', async ($, on) => {
  mock.clock(on)
  const { repo } = fakeRepo(on, { merged: MERGED })
  await start($)
  const before = repo.fetches

  const result = await $.command.run({ command: 'migrations', args: '' })
  expect(result.text).toMatch(/V5/)
  expect(repo.fetches).toBeGreaterThan(before)
})

test('세션 시작 뒤에 화면이 붙으면 패널을 다시 연다', async ($, on) => {
  mock.clock(on)
  const { opens } = fakeRepo(on, { merged: MERGED })
  await start($)
  const before = opens.length

  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })

  expect(opens.length).toBe(before + 1)
  expect(opens.at(-1)).toBe('flyway-panel')
})

test('Flyway 마이그레이션이 없는 저장소에서는 패널에 안내만 보여준다', async ($, on) => {
  mock.clock(on)
  fakeRepo(on, { merged: [] })
  await start($)

  const ui = await $.ui.mount({ plugin: 'flyway-panel', surface: 'desktop', ...PANE })
  expect(await ui.find({ type: 'Text', text: /찾지 못했어요/ })).toBeDefined()
  await ui.unmount()
})
