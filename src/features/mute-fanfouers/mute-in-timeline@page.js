import select from 'select-dom'
import { createMutedUsersReader, createStorageChangeHandler } from './shared'
import { getMuteMatch, extractUserIdFromUrl } from './matchers'
import { isTimelinePage } from '@libs/pageDetect'
import isStatusElement from '@libs/isStatusElement'
import getLoggedInUserProfilePageUrl from '@libs/getLoggedInUserProfilePageUrl'

const ATTRIBUTE_MARKER = 'sf-mute-checked'
const CLASSNAME_MUTED = 'sf-muted'

export default context => {
  const {
    requireModules,
    readOptionValue,
    registerBroadcastListener,
    unregisterBroadcastListener,
  } = context
  const { storage, timelineElementObserver } = requireModules([ 'storage', 'timelineElementObserver' ])

  const readMutedUsers = createMutedUsersReader(storage)

  let mutedUsers = []

  function getExemptUserIds() {
    // 自己发的消息永不静音
    try {
      const userId = extractUserIdFromUrl(getLoggedInUserProfilePageUrl())

      return userId ? [ userId ] : []
    } catch (error) {
      return []
    }
  }

  function isPageExempt() {
    // 被静音饭友本人的个人页时间线不过滤，主动到访视为想看
    const pageOwnerUserId = extractUserIdFromUrl(window.location.href)

    return Boolean(
      pageOwnerUserId &&
      mutedUsers.some(mutedUser => mutedUser.userId === pageOwnerUserId),
    )
  }

  function unmuteStatusElement(li) {
    li.classList.remove(CLASSNAME_MUTED)
    li.removeAttribute(ATTRIBUTE_MARKER)
  }

  function processStatus(li) {
    li.setAttribute(ATTRIBUTE_MARKER, '')

    const match = getMuteMatch(li, {
      mutedUsers,
      muteConversations: readOptionValue('muteConversations'),
      exemptUserIds: getExemptUserIds(),
    })

    if (match) {
      li.classList.add(CLASSNAME_MUTED)
    }
  }

  function getAllStatuses() {
    return select.all('#stream > ol > li')
  }

  function refilterAll() {
    for (const li of getAllStatuses()) {
      unmuteStatusElement(li)
    }

    if (isPageExempt()) return

    for (const li of getAllStatuses()) {
      if (isStatusElement(li)) processStatus(li)
    }
  }

  function mutationObserverCallback(mutationRecords) {
    if (isPageExempt()) return

    for (const { addedNodes } of mutationRecords) {
      for (const addedNode of addedNodes) {
        if (isStatusElement(addedNode) && !addedNode.hasAttribute(ATTRIBUTE_MARKER)) {
          processStatus(addedNode)
        }
      }
    }
  }

  const onStorageChange = createStorageChangeHandler(({ newValue }) => {
    mutedUsers = newValue || []
    refilterAll()
  })

  return {
    applyWhen: () => isTimelinePage(),

    async onLoad() {
      mutedUsers = await readMutedUsers()

      registerBroadcastListener(onStorageChange)
      // addCallback 会立即对存量消息触发一次回调
      timelineElementObserver.addCallback(mutationObserverCallback)
    },

    onSettingsChange() {
      refilterAll()
    },

    onUnload() {
      timelineElementObserver.removeCallback(mutationObserverCallback)
      unregisterBroadcastListener(onStorageChange)

      for (const li of getAllStatuses()) {
        unmuteStatusElement(li)
      }
    },
  }
}
