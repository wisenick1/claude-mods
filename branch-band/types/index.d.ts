export type BranchInfo = {
  branch: string
  issueKey: string | null
  // 기준 브랜치(origin/HEAD, 예: origin/dev). 없으면 null
  base: string | null
  // 기준 브랜치 대비 앞선 커밋 수. 기준 브랜치를 모르면 null
  ahead: number | null
  // 커밋 안 된 파일 수 (untracked 포함)
  dirty: number
  // HEAD 가 <git-dir>/.reviewed-sha 와 같은지. push 할 커밋이 없으면 null
  reviewed: boolean | null
}

declare module 'claude-code' {
  interface PluginState {
    'branch-band': { info: BranchInfo | null }
  }
}
