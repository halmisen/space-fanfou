import { isHomePage } from '@libs/pageDetect'

const CLASSNAME_GRID = 'sf-sidebar-panels-grid'
const CLASSNAME_LIST = 'sf-sidebar-panels-list'

export default ({ readOptionValue }) => {
  function applyLayout() {
    const useListLayout = readOptionValue('useListLayout')

    document.body.classList.toggle(CLASSNAME_LIST, useListLayout)
    document.body.classList.toggle(CLASSNAME_GRID, !useListLayout)
  }

  function removeLayout() {
    document.body.classList.remove(CLASSNAME_GRID, CLASSNAME_LIST)
  }

  return {
    applyWhen: () => isHomePage(),

    onLoad: applyLayout,
    onSettingsChange: applyLayout,
    onUnload: removeLayout,
  }
}
