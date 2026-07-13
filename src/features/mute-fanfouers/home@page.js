import { h, Component } from 'preact'
import cx from 'classnames'
import { createMutedUsersReader, createMutedUsersWriter, createStorageChangeHandler } from './shared'
import { isHomePage } from '@libs/pageDetect'
import preactRender from '@libs/preactRender'

const STORAGE_KEY_COLLAPSED_STATE = 'mute-fanfouers/isCollapsed'
const STORAGE_AREA_NAME_COLLAPSED_STATE = 'local'
const EMPTY_TIP = '在消息或个人页点「静音」即可添加。'

export default context => {
  const {
    requireModules,
    registerBroadcastListener,
    unregisterBroadcastListener,
    elementCollection,
  } = context
  const { storage } = requireModules([ 'storage' ])

  let unmount
  const readMutedUsers = createMutedUsersReader(storage)
  const writeMutedUsers = createMutedUsersWriter(storage)

  elementCollection.add({
    friends: '#friends',
  })

  async function readCollapsedState() {
    const value = await storage.read(STORAGE_KEY_COLLAPSED_STATE, STORAGE_AREA_NAME_COLLAPSED_STATE)

    // 默认折叠
    return value == null ? true : value
  }

  async function writeCollapsedState(newValue) {
    await storage.write(STORAGE_KEY_COLLAPSED_STATE, newValue, STORAGE_AREA_NAME_COLLAPSED_STATE)
  }

  function getProfilePageUrl(userId) {
    return `${window.location.protocol}//fanfou.com/${userId}`
  }

  class MuteFanfouers extends Component {
    constructor(...args) {
      super(...args)

      this.state = {
        isReady: false,
        isCollapsed: true,
        mutedUsers: [],
      }

      this.loadData()
    }

    async loadData() {
      this.setState({
        isReady: true,
        isCollapsed: await readCollapsedState(),
        mutedUsers: await readMutedUsers(),
      })
    }

    onStorageChange = createStorageChangeHandler(() => {
      this.loadData()
    })

    onClickTitle = event => {
      // 饭否也监听了 click 事件，并且会尝试修改 <b /> 的类名
      // 所以阻止冒泡避免类名错乱
      event.stopImmediatePropagation()

      const newState = !this.state.isCollapsed
      this.setState({ isCollapsed: newState })
      writeCollapsedState(newState)
    }

    onClickRemove = async (event, mutedUser) => {
      event.preventDefault()

      const mutedUsers = (await readMutedUsers())
        .filter(({ userId }) => userId !== mutedUser.userId)

      this.setState({ mutedUsers })
      await writeMutedUsers(mutedUsers)
    }

    render() {
      const classNames = cx({
        'colltab': true,
        'sf-is-ready': this.state.isReady,
      })

      return (
        <div id="sf-mute-fanfouers-list" className={classNames}>
          <b className={cx({ collapse: this.state.isCollapsed })} />
          <h2 onClick={this.onClickTitle}>无爱饭友</h2>
          {this.renderBody()}
        </div>
      )
    }

    renderBody() {
      if (this.state.isCollapsed) {
        return null
      }

      if (!this.state.mutedUsers.length) {
        return (
          <div className="sf-mute-fanfouers-empty">
            还没有被静音的饭友。{EMPTY_TIP}
          </div>
        )
      }

      return (
        <ul className="sf-mute-fanfouers-items">
          { this.state.mutedUsers.map(mutedUser => (
            <li key={mutedUser.userId} className="sf-mute-fanfouer-item">
              <a href={getProfilePageUrl(mutedUser.userId)} title={mutedUser.nickname}>
                { mutedUser.avatarUrl && (
                  <img src={mutedUser.avatarUrl} alt={`@${mutedUser.nickname} 的头像`} />
                ) }
                <span>{mutedUser.nickname}</span>
              </a>
              <a
                className="sf-mute-remove"
                title={`取消静音 ${mutedUser.nickname}`}
                onClick={event => this.onClickRemove(event, mutedUser)}
              >×</a>
            </li>
          )) }
        </ul>
      )
    }

    componentDidMount() {
      registerBroadcastListener(this.onStorageChange)
    }

    componentWillUnmount() {
      unregisterBroadcastListener(this.onStorageChange)
    }
  }

  return {
    applyWhen: () => isHomePage(),

    waitReady: () => elementCollection.ready('friends'),

    onLoad() {
      const { friends } = elementCollection.getAll()

      unmount = preactRender(<MuteFanfouers />, rendered => {
        // 静音管理是低频操作，放在「我关注的人」(#friends) 下方
        friends.after(rendered)
      })
    },

    onUnload() {
      unmount()
      unmount = null
    },
  }
}
