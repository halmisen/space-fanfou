module.exports = {
  browser: true,
  resolver: 'jest-webpack-resolver',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.worktrees/',
    // Claude Code 的工作树落在 .claude/worktrees/，不匹配上面那条；漏掉会让同一批测试
    // 跑两遍（2026-08-03 实测 25 suites 变 50），而且只是数字翻倍不报错，很难发现。
    '/.claude/worktrees/',
    '/playwright/',
  ],
}
