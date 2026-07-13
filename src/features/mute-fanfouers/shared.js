import { STORAGE_CHANGED } from '@constants'

export const STORAGE_KEY_MUTED_USERS = 'mute-fanfouers/mutedUsers'
// 插件本地安装使用，名单不做云同步
export const STORAGE_AREA_NAME_MUTED_USERS = 'local'

// 数据结构：[ { userId, nickname, avatarUrl? } ]
export const createMutedUsersReader = storage => async () => {
  return await storage.read(STORAGE_KEY_MUTED_USERS, STORAGE_AREA_NAME_MUTED_USERS) || []
}

export const createMutedUsersWriter = storage => async data => {
  await storage.write(STORAGE_KEY_MUTED_USERS, data, STORAGE_AREA_NAME_MUTED_USERS)
}

export const createStorageChangeHandler = callback => message => {
  if (
    message.action === STORAGE_CHANGED &&
    message.payload?.key === STORAGE_KEY_MUTED_USERS
  ) {
    callback(message.payload)
  }
}
