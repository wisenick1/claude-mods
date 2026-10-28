import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Migration, MigrationSnapshot } from '../types'

const PANE = 'flyway-panel'
const TITLE = 'Flyway'
// Flyway 버전 마이그레이션: .../db/migration/V{번호}__{설명}.sql
const MIGRATION = /(?:^|\/)db\/migration\/V(\d+)__([^/]+)\.sql$/
const SCAN_MS = 15_000 // 내 작업 트리 다시 읽기
const FETCH_MS = 180_000 // 원격 브랜치 받아오기 (팀원 작업 확인)

const snapshot = atom({ plugin: 'flyway-panel', key: 'snapshot' } as const, null)
const fetchedAt = atom({ plugin: 'flyway-panel', key: 'fetchedAt' } as const, null)
const fetchError = atom({ plugin: 'flyway-panel', key: 'fetchError' } as const, null)

async function git($: EngineInterface, args: string[], timeoutMs = 5000): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', ...args], { timeoutMs })
    return exitCode === 0 ? stdout : null
  } catch {
    return null
  }
}

function parse(paths: string, extra: Partial<Migration> = {}): Migration[] {
  return paths.split('\n').flatMap(p => {
    const m = p.trim().replace(/\\/g, '/').match(MIGRATION)
    return m ? [{ version: Number(m[1]), description: m[2], ...extra }] : []
  })
}

const byVersion = (a: Migration, b: Migration) => a.version - b.version

// 기준 브랜치·내 작업 트리·머지 안 된 원격 브랜치의 마이그레이션을 모은다 (fetch 는 하지 않음)
async function scan($: EngineInterface): Promise<MigrationSnapshot | null> {
  const base = (await git($, ['rev-parse', '--abbrev-ref', 'origin/HEAD']))?.trim()
  if (!base) return null

  const mergedFiles = await git($, ['ls-tree', '-r', '--name-only', base])
  const merged = parse(mergedFiles ?? '').sort(byVersion)
  if (merged.length === 0) return null // Flyway 를 쓰지 않는 저장소면 아무것도 보여주지 않는다
  const mergedNames = new Set(merged.map(m => `${m.version}__${m.description}`))
  const isNew = (m: Migration) => !mergedNames.has(`${m.version}__${m.description}`)

  // 커밋된 파일과 아직 커밋 안 한 새 파일까지
  const localFiles = await git($, ['ls-files', '--cached', '--others', '--exclude-standard'])
  const local = parse(localFiles ?? '').filter(isNew).sort(byVersion)

  // 내가 push 한 현재 브랜치(origin/{현재 브랜치})는 팀원 작업이 아니라 내 작업이라 뺀다
  const current = (await git($, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
  const mine = current ? `origin/${current}` : null

  const branches = await git($, [
    'branch', '-r', '--no-merged', base, '--format=%(refname:short)\t%(authorname)'])
  const remote: Migration[] = []
  for (const row of (branches ?? '').split('\n').filter(Boolean)) {
    const [branch, author] = row.split('\t')
    if (!branch.includes('/') || branch.endsWith('/HEAD') || branch === mine) continue
    const files = await git($, ['ls-tree', '-r', '--name-only', branch])
    remote.push(...parse(files ?? '', { branch: branch.replace(/^origin\//, ''), author }).filter(isNew))
  }
  remote.sort(byVersion)

  // 같은 번호가 서로 다른 파일로 쓰이면 충돌. 같은 파일이 여러 곳(내 작업·여러 브랜치)에 있는 건 충돌이 아니다
  const all = [...merged, ...local, ...remote]
  const names = new Map<number, Set<string>>()
  for (const m of all) names.set(m.version, (names.get(m.version) ?? new Set<string>()).add(m.description))
  const conflicts = [...names].filter(([, set]) => set.size > 1).map(([v]) => v)

  const nextVersion = Math.max(0, ...all.map(m => m.version)) + 1

  return { base: base.replace(/^origin\//, ''), merged, local, remote, nextVersion, conflicts }
}

// 다시 읽고, 값이 바뀌었을 때만 저장한다. 내 작업과 새로 충돌하면 알림을 띄운다
async function refresh($: EngineInterface) {
  const next = await scan($)
  const prev = await read($, snapshot)
  if (JSON.stringify(prev) === JSON.stringify(next)) return
  await update($, snapshot, () => next)

  const before = new Set(prev?.conflicts ?? [])
  const mine = new Set(next?.local.map(m => m.version) ?? [])
  const fresh = (next?.conflicts ?? []).filter(v => !before.has(v) && mine.has(v))
  if (fresh.length) {
    $.ui.toast(`⚠ Flyway V${fresh.join(', V')} 번호가 다른 브랜치와 겹쳐요. /migrations 로 확인하세요`)
  }
}

// 원격 브랜치를 받아온 뒤 다시 읽는다. 작업 트리는 건드리지 않는다 (git fetch 만)
async function fetchAndRefresh($: EngineInterface) {
  const out = await git($, ['fetch', '--prune', '--quiet', 'origin'], 30_000)
  await update($, fetchError, () => (out === null ? '원격 저장소를 받아오지 못했어요' : null))
  if (out !== null) {
    const now = await $.clock.now()
    await update($, fetchedAt, () => now)
  }
  await refresh($)
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  return `${Math.floor(s / 3600)}시간 전`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'migrations',
      description: 'Flyway 마이그레이션 패널을 열고 원격 브랜치를 다시 받아온다',
    })
    await refresh($)
    // Flyway 를 쓰는 저장소에서만 패널을 연다
    if (await read($, snapshot)) void $.ui.open({ id: PANE, title: TITLE })
    void fetchAndRefresh($)
    $.clock.every(SCAN_MS, () => refresh($))
    $.clock.every(FETCH_MS, () => fetchAndRefresh($))
    return result
  })

  // 데스크톱 앱은 session.start 뒤에 화면이 붙어서 그때 연 패널이 no-surface 로 안 뜰 수 있다.
  // 화면이 붙을 때 다시 연다 (이미 열려 있으면 제목만 다시 정해지고 그대로다)
  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    if (await read($, snapshot)) void $.ui.open({ id: PANE, title: TITLE })
    return result
  })

  // Claude 가 새 마이그레이션을 만들거나 브랜치를 바꿨을 때 바로 반영
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('command.run', { command: 'migrations' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await fetchAndRefresh($)
    const snap = await read($, snapshot)
    return { text: snap ? `다음 마이그레이션 번호는 V${snap.nextVersion} 예요.` : 'Flyway 마이그레이션을 찾지 못했어요.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    if (!snap) {
      return <Text dimColor>Flyway 마이그레이션(db/migration/V*.sql)을 찾지 못했어요.</Text>
    }

    const at = await read($, fetchedAt)
    const error = await read($, fetchError)
    const now = await $.clock.now()
    const conflicts = new Set(snap.conflicts)
    const row = (m: Migration, extra?: string) => (
      <Text color={conflicts.has(m.version) ? 'red' : undefined}>
        {conflicts.has(m.version) ? '⚠ ' : '  '}V{m.version}  {m.description}
        {extra ? <Text dimColor>  {extra}</Text> : null}
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Text dimColor>
          기준 {snap.base} · 팀원 브랜치 {error ? error : at ? `${ago(now - at)} 확인` : '확인 중…'}
        </Text>
        <Text> </Text>
        <Text bold>머지됨 ({snap.merged.length})</Text>
        {snap.merged.map(m => row(m))}
        <Text> </Text>
        <Text bold>내 작업</Text>
        {snap.local.length ? snap.local.map(m => row(m, '로컬')) : <Text dimColor>  없음</Text>}
        <Text> </Text>
        <Text bold>팀원 작업 (머지 전 원격 브랜치)</Text>
        {snap.remote.length
          ? snap.remote.map(m => row(m, `${m.branch}${m.author ? ` · ${m.author}` : ''}`))
          : <Text dimColor>  없음</Text>}
        <Text> </Text>
        <Text color="cyan" bold>다음 번호: V{snap.nextVersion}</Text>
        {snap.conflicts.length > 0 && (
          <Text color="red">⚠ V{snap.conflicts.join(', V')} 번호가 겹쳐요. 머지 순서를 팀원과 맞추세요.</Text>
        )}
        <Text> </Text>
        <Button key="refresh" label="원격 다시 확인" onPress={() => fetchAndRefresh($)} />
      </Box>
    )
  })
}
