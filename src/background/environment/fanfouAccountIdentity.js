/**
 * 授权账号是谁，只能自己查一次。
 *
 * 饭否的 `/oauth/access_token` 只返回 token 本身，不像 Twitter 老式 OAuth 那样附带
 * `user_id` 和 `screen_name`。早先的代码直接读这两个字段，于是设置页永远显示「未知」，
 * 而备份流程另走 `/users/show.json`，账号判定其实一直是对的——两边不一致把用户吓到了。
 *
 * 这里只放不依赖 chrome 与 webpack 的部分，网络请求由调用方注入，便于单测。
 */

/**
 * 从 `/users/show.json` 的返回里挑出要显示的账号身份。
 * 显示名的优先级与 `personal-archive/checkpoint.js` 一致，
 * 免得同一个账号在设置页和备份 meta.json 里显示成两个名字。
 */
export function pickAccountIdentity(user) {
  const userId = user?.id || null
  const screenName = user?.name || user?.screen_name || null

  if (!userId && !screenName) return null

  return { userId, screenName }
}

/**
 * 已有 token 但不知道账号是谁时补查一次并落盘。
 *
 * 老版本存下来的 token 记录没有账号字段，走这条路可以不重新授权就恢复显示。
 * 查不到就维持原样：这只影响一行显示文字，不该让授权或备份失败。
 * 失败后本次不再重试，避免每次读状态都打一次网络；`reset()` 由换 token 时调用。
 */
export default function createAccountIdentityResolver({ fetchUser, saveTokens, onError }) {
  let attempted = false

  return {
    reset() {
      attempted = false
    },

    async ensure(tokens, context) {
      if (!tokens?.oauthToken || !tokens?.oauthTokenSecret) return tokens
      if (tokens.screenName || tokens.userId) return tokens
      if (attempted) return tokens

      attempted = true

      try {
        const identity = pickAccountIdentity(await fetchUser(tokens, context))
        if (!identity) return tokens

        const updatedTokens = { ...tokens, ...identity }
        await saveTokens(updatedTokens)

        return updatedTokens
      } catch (error) {
        if (onError) onError(error)

        return tokens
      }
    },
  }
}
