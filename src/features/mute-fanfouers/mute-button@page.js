import select from 'select-dom'
import { on, off } from 'delegated-events'
import { createMutedUsersReader, createMutedUsersWriter } from './shared'
import { getStatusAuthor, extractUserIdFromUrl } from './matchers'
import { isTimelinePage } from '@libs/pageDetect'
import isStatusElement from '@libs/isStatusElement'
import getLoggedInUserProfilePageUrl from '@libs/getLoggedInUserProfilePageUrl'

const CLASSNAME_OP_LINK = 'sf-mute-op-link'

export default context => {
  const { requireModules } = context
  const { storage, timelineElementObserver } = requireModules([ 'storage', 'timelineElementObserver' ])

  const readMutedUsers = createMutedUsersReader(storage)
  const writeMutedUsers = createMutedUsersWriter(storage)

  function getLoggedInUserId() {
    try {
      return extractUserIdFromUrl(getLoggedInUserProfilePageUrl())
    } catch (error) {
      return null
    }
  }

  function injectMuteLink(li) {
    const op = select(':scope > .op', li)
    const author = getStatusAuthor(li)

    if (!op || !author) return
    if (author.userId === getLoggedInUserId()) return
    if (select.exists(`.${CLASSNAME_OP_LINK}`, op)) return

    const muteLink = document.createElement('a')

    muteLink.className = CLASSNAME_OP_LINK
    muteLink.textContent = '静音'
    muteLink.title = `静音 ${author.nickname} 的消息`

    op.append(muteLink)
  }

  function mutationObserverCallback(mutationRecords) {
    for (const { addedNodes } of mutationRecords) {
      for (const addedNode of addedNodes) {
        if (isStatusElement(addedNode)) {
          injectMuteLink(addedNode)
        }
      }
    }
  }

  async function onClickMute(event) {
    event.preventDefault()

    const li = event.target.closest('li')

    if (!li) return

    const author = getStatusAuthor(li)

    if (!author) return

    const avatarImage = select('.avatar img', li)

    if (avatarImage) {
      author.avatarUrl = avatarImage.getAttribute('src')
    }

    const mutedUsers = await readMutedUsers()

    if (!mutedUsers.some(mutedUser => mutedUser.userId === author.userId)) {
      mutedUsers.push(author)
      await writeMutedUsers(mutedUsers)
    }
  }

  function removeAllMuteLinks() {
    for (const muteLink of select.all(`.${CLASSNAME_OP_LINK}`)) {
      muteLink.remove()
    }
  }

  return {
    applyWhen: () => isTimelinePage(),

    onLoad() {
      on('click', `#stream .op .${CLASSNAME_OP_LINK}`, onClickMute)
      timelineElementObserver.addCallback(mutationObserverCallback)
    },

    onUnload() {
      timelineElementObserver.removeCallback(mutationObserverCallback)
      off('click', `#stream .op .${CLASSNAME_OP_LINK}`, onClickMute)
      removeAllMuteLinks()
    },
  }
}
