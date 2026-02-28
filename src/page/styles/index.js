import './00-variables.less'

function loadStyles() {
  const context = require.context('./', false, /\.(css|less)$/)

  for (const key of context.keys()) {
    if (key !== './00-variables.less') {
      context(key)
    }
  }
}
loadStyles()
