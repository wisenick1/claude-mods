export type BranchInfo = { branch: string; issueKey: string | null }

declare module 'claude-code' {
  interface PluginState {
    'branch-band': { info: BranchInfo | null }
  }
}
