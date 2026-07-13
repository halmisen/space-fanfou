import select from 'select-dom'
import { createMutedUsersReader, createMutedUsersWriter, createStorageChangeHandler } from './shared'
import { extractUserIdFromUrl } from './matchers'
import { isUserProfilePage, isLoggedInUserProfilePage } from '@libs/pageDetect'

const ID_TOGGLER = 'sf-mute-profile-toggler'
const MUTED_TEXT = '取消静音'
const UNMUTED_TEXT = '静音此人'
// 原生链接排：「他关注的消息 和他的对话 检查与他的关系」（兼容「她」）
const RE_NATIVE_OPS_LINK = /关注的消息|的对话|检查与/

export default context => {
  const {
    requireModules,
    registerBroadcastListener,
    unregisterBroadcastListener,
    elementCollection,
  } = context
  const { storage } = requireModules([ 'storage' ])

  const readMutedUsers = createMutedUsersReader(storage)
  const writeMutedUsers = createMutedUsersWriter(storage)

  let togglerElement

  elementCollection.add({
    info: '#info',
  })

  function getPageUserId() {
    return extractUserIdFromUrl(window.location.href)
  }

  function getPageUserNickname() {
    // #panel h1 里可能有其他扩展注入的空链接（如有爱饭友星标），textContent 仍是昵称本体
    return select('#panel h1').textContent.trim()
  }

  async function isMuted() {
    const userId = getPageUserId()
    const mutedUsers = await readMutedUsers()

    return mutedUsers.some(mutedUser => mutedUser.userId === userId)
  }

  async function refreshToggler() {
    if (!togglerElement) return

    togglerElement.textContent = await isMuted() ? MUTED_TEXT : UNMUTED_TEXT
  }

  const onStorageChange = createStorageChangeHandler(() => {
    refreshToggler()
  })

  async function onClickToggler(event) {
    event.preventDefault()

    const userId = getPageUserId()
    const mutedUsers = await readMutedUsers()
    const existingIndex = mutedUsers.findIndex(mutedUser => mutedUser.userId === userId)

    if (existingIndex === -1) {
      const avatarImage = select('#avatar img')

      mutedUsers.push({
        userId,
        nickname: getPageUserNickname(),
        avatarUrl: avatarImage ? avatarImage.getAttribute('src') : undefined,
      })
    } else {
      mutedUsers.splice(existingIndex, 1)
    }

    await writeMutedUsers(mutedUsers)
    await refreshToggler()
  }

  return {
    applyWhen: async () => (
      await isUserProfilePage() &&
      !isLoggedInUserProfilePage()
    ),

    waitReady: () => elementCollection.ready('info'),

    async onLoad() {
      const { info } = elementCollection.getAll()

      togglerElement = document.createElement('a')
      togglerElement.id = ID_TOGGLER
      togglerElement.addEventListener('click', onClickToggler)

      // 追加到原生链接排末尾（与「检查与他的关系」同排）；找不到则回退挂在 #info 底部
      const nativeOpsLinks = select.all('a', info)
        .filter(link => RE_NATIVE_OPS_LINK.test(link.textContent))
      const lastOpsLink = nativeOpsLinks[nativeOpsLinks.length - 1]

      if (lastOpsLink) {
        lastOpsLink.after(' ', togglerElement)
      } else {
        info.append(togglerElement)
      }

      registerBroadcastListener(onStorageChange)
      await refreshToggler()
    },

    onUnload() {
      unregisterBroadcastListener(onStorageChange)

      if (togglerElement) {
        togglerElement.remove()
        togglerElement = null
      }
    },
  }
}
