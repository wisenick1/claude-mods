export type Migration = {
  version: number
  // 파일 이름에서 V{n}__ 와 .sql 을 뺀 설명 부분
  description: string
  // 원격 브랜치 이름 (팀원 작업일 때)
  branch?: string
  // 그 브랜치의 마지막 커밋 작성자 (팀원 작업일 때)
  author?: string
}

export type MigrationSnapshot = {
  // 기준 브랜치 (origin/HEAD, 예: origin/dev)
  base: string
  // 기준 브랜치에 머지된 마이그레이션
  merged: Migration[]
  // 기준 브랜치엔 없고 내 작업 트리에 있는 마이그레이션
  local: Migration[]
  // 기준 브랜치에 머지되지 않은 원격 브랜치에만 있는 마이그레이션
  remote: Migration[]
  // 머지됨·내 작업·팀원 작업을 통틀어 가장 큰 번호 + 1
  nextVersion: number
  // 서로 다른 곳에서 같은 번호를 쓰는 버전들
  conflicts: number[]
}

declare module 'claude-code' {
  interface PluginState {
    'flyway-panel': {
      snapshot: MigrationSnapshot | null
      fetchedAt: number | null
      fetchError: string | null
    }
  }
}
