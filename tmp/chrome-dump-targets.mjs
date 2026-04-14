import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

function resolveDevToolsWsUrl() {
  const home = homedir()
  const base = process.env.LOCALAPPDATA || resolve(home, 'AppData/Local')
  const candidates = [
    resolve(base, 'Google/Chrome', 'User Data/DevToolsActivePort'),
    resolve(base, 'Google/Chrome', 'User Data/Default/DevToolsActivePort'),
    resolve(base, 'Microsoft/Edge', 'User Data/DevToolsActivePort'),
    resolve(base, 'BraveSoftware/Brave-Browser', 'User Data/DevToolsActivePort'),
  ]
  const portFile = candidates.find(candidate => existsSync(candidate))
  if (!portFile) throw new Error('No DevToolsActivePort found')
  const [ port, browserPath ] = readFileSync(portFile, 'utf8').trim().split('\n')
  return `ws://127.0.0.1:${port}${browserPath}`
}

class CdpClient {
  #socket
  #id = 0
  #pending = new Map()

  async connect(wsUrl) {
    await new Promise((resolvePromise, rejectPromise) => {
      this.#socket = new WebSocket(wsUrl)
      this.#socket.onopen = () => resolvePromise()
      this.#socket.onerror = event => rejectPromise(new Error(event.message || event.type))
      this.#socket.onmessage = event => {
        const message = JSON.parse(event.data)
        if (!message.id || !this.#pending.has(message.id)) return
        const { resolve: resolvePending, reject } = this.#pending.get(message.id)
        this.#pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message))
        else resolvePending(message.result)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.#id
    return new Promise((resolvePromise, rejectPromise) => {
      this.#pending.set(id, {
        resolve: resolvePromise,
        reject: rejectPromise,
      })
      this.#socket.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (!this.#pending.has(id)) return
        this.#pending.delete(id)
        rejectPromise(new Error(`Timeout: ${method}`))
      }, 15000)
    })
  }

  close() {
    this.#socket?.close()
  }
}

const client = new CdpClient()
await client.connect(resolveDevToolsWsUrl())
const result = await client.send('Target.getTargets')
console.log(JSON.stringify(result.targetInfos, null, 2))
client.close()
setTimeout(() => process.exit(0), 50)
