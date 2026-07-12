module.exports = {
  browser: true,
  resolver: 'jest-webpack-resolver',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.worktrees/',
    '/playwright/',
  ],
}
