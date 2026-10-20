import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 },
} as const

// 엔진 대신 git 결과와 세션 시작을 흉내 낸다. 반환된 setBranch 로 checkout 을 흉내 낸다.
function fakeSession(on: On, initial: string) {
  let branch = initial
  on('process.run', () => ({ value: { exitCode: 0, stdout: `${branch}\n`, stderr: '' } }))
  on('session.start', () => ({ cwd: '.' }))
  on('ui.render', () => null)
  return (next: string) => { branch = next }
}

test('브랜치 이름에서 Jira 키를 찾아 띠에 보여준다', async ($, on) => {
  mock.clock(on)
  fakeSession(on, 'feature/back/PROJ-12-login-api')
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'branch-band', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /feature\/back\/PROJ-12-login-api/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /PROJ-12$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('이슈 키가 없는 브랜치는 "이슈 키 없음"으로 표시한다', async ($, on) => {
  mock.clock(on)
  fakeSession(on, 'dev')
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'branch-band', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /이슈 키 없음/ })).toBeDefined()
  await ui.unmount()
})

test('터미널에서 checkout 하면 5초 안에 띠가 바뀐다', async ($, on) => {
  const clock = mock.clock(on)
  const setBranch = fakeSession(on, 'dev')
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true })

  setBranch('feature/front/ABC-345-alarm-sound')
  await clock.advance(5000)

  const ui = await $.ui.mount({ plugin: 'branch-band', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /ABC-345$/ })).toBeDefined()
  await ui.unmount()
})
