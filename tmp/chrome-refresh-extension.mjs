import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

const TARGET_ID_PREFIX = process.argv[2] || 'BF741DAC'
const EXTENSION_NAME = process.argv[3] || '太空饭否'
const FANFOU_URL = 'https://fanfou.com/home'

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
  if (!portFile) {
    throw new Error('No DevToolsActivePort found')
  }

  const [ port, browserPath ] = readFileSync(portFile, 'utf8').trim().split('\n')
  if (!port || !browserPath) {
    throw new Error(`Invalid DevToolsActivePort file: ${portFile}`)
  }

  return `ws://127.0.0.1:${port}${browserPath}`
}

class CdpClient {
  #socket
  #id = 0
  #pending = new Map()
  #events = new Map()

  async connect(wsUrl) {
    await new Promise((resolvePromise, rejectPromise) => {
      this.#socket = new WebSocket(wsUrl)
      this.#socket.onopen = () => resolvePromise()
      this.#socket.onerror = event => rejectPromise(new Error(`WebSocket error: ${event.message || event.type}`))
      this.#socket.onmessage = event => {
        const message = JSON.parse(event.data)
        if (message.id && this.#pending.has(message.id)) {
          const { resolve: resolvePending, reject } = this.#pending.get(message.id)
          this.#pending.delete(message.id)

          if (message.error) {
            reject(new Error(message.error.message))
          } else {
            resolvePending(message.result)
          }
          return
        }

        if (!message.method) return
        const handlers = this.#events.get(message.method)
        if (!handlers) return
        handlers.forEach(handler => handler(message.params || {}, message))
      }
    })
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#id

    return new Promise((resolvePromise, rejectPromise) => {
      this.#pending.set(id, {
        resolve: resolvePromise,
        reject: rejectPromise,
      })

      const payload = { id, method, params }
      if (sessionId) payload.sessionId = sessionId
      this.#socket.send(JSON.stringify(payload))

      setTimeout(() => {
        if (!this.#pending.has(id)) return
        this.#pending.delete(id)
        rejectPromise(new Error(`Timeout: ${method}`))
      }, 15000)
    })
  }

  on(method, handler) {
    const handlers = this.#events.get(method) || new Set()
    handlers.add(handler)
    this.#events.set(method, handlers)

    return () => {
      handlers.delete(handler)
      if (!handlers.size) {
        this.#events.delete(method)
      }
    }
  }

  async waitFor(method, sessionId, timeoutMs = 15000) {
    return await new Promise((resolvePromise, rejectPromise) => {
      const off = this.on(method, (params, message) => {
        if (sessionId && message.sessionId !== sessionId) return
        off()
        clearTimeout(timer)
        resolvePromise(params)
      })

      const timer = setTimeout(() => {
        off()
        rejectPromise(new Error(`Timeout waiting for ${method}`))
      }, timeoutMs)
    })
  }

  close() {
    this.#socket?.close()
  }
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId)

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'Runtime.evaluate failed')
  }

  return result.result?.value
}

async function navigate(client, sessionId, url) {
  const waitForLoad = client.waitFor('Page.loadEventFired', sessionId, 30000)
  const result = await client.send('Page.navigate', { url }, sessionId)
  await waitForLoad
  return result
}

const wsUrl = resolveDevToolsWsUrl()
const client = new CdpClient()
await client.connect(wsUrl)

const targets = await client.send('Target.getTargets')
const resolvedTarget = (targets.targetInfos || []).find(targetInfo => (
  targetInfo.type === 'page'
  && targetInfo.targetId.toUpperCase().startsWith(TARGET_ID_PREFIX.toUpperCase())
))

if (!resolvedTarget) {
  throw new Error(`No page target matching prefix ${TARGET_ID_PREFIX}`)
}

const attachResult = await client.send('Target.attachToTarget', {
  targetId: resolvedTarget.targetId,
  flatten: true,
})
const sessionId = attachResult.sessionId

await client.send('Page.enable', {}, sessionId)
await client.send('Runtime.enable', {}, sessionId)

await navigate(client, sessionId, 'chrome://extensions/')
await new Promise(resolvePromise => setTimeout(resolvePromise, 2500))

const reloadResult = await evaluate(client, sessionId, `
(() => {
  if (globalThis.chrome?.developerPrivate?.autoUpdate) {
    chrome.developerPrivate.autoUpdate();
    return {
      ok: true,
      stage: 'auto-update-fired',
    };
  }

  const manager = document.querySelector('extensions-manager');
  if (!manager) return { ok: false, stage: 'no-manager', title: document.title };

  const itemList = manager.shadowRoot?.querySelector('extensions-item-list');
  if (!itemList) return { ok: false, stage: 'no-item-list' };

  const items = [...(itemList.shadowRoot?.querySelectorAll('extensions-item') || [])];
  const names = items
    .map(item => item.shadowRoot?.querySelector('#name')?.textContent?.trim())
    .filter(Boolean);

  const target = items.find(item => (
    item.shadowRoot?.querySelector('#name')?.textContent || ''
  ).includes(${JSON.stringify(EXTENSION_NAME)}));
  if (!target) return { ok: false, stage: 'not-found', names };

  const root = target.shadowRoot;
  const reloadButton = root.querySelector('#dev-reload-button')
    || [...root.querySelectorAll('button, cr-button, cr-icon-button')]
      .find(button => {
        const text = [
          button.id,
          button.textContent,
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
        ].filter(Boolean).join(' ');
        return /刷新|reload/i.test(text);
      });

  if (!reloadButton) {
    return {
      ok: false,
      stage: 'no-reload-button',
      names,
      buttons: [...root.querySelectorAll('button, cr-button, cr-icon-button')].map(button => ({
        id: button.id || '',
        text: (button.textContent || '').trim(),
        ariaLabel: button.getAttribute('aria-label') || '',
        title: button.getAttribute('title') || '',
      })),
    };
  }

  reloadButton.click();
  return {
    ok: true,
    stage: 'reloaded',
    name: root.querySelector('#name')?.textContent?.trim() || '',
  };
})()
`)

console.log(JSON.stringify({
  step: 'reload-extension',
  result: reloadResult,
}, null, 2))

await new Promise(resolvePromise => setTimeout(resolvePromise, 1200))
await navigate(client, sessionId, FANFOU_URL)

console.log(JSON.stringify({
  step: 'navigate-fanfou',
  url: FANFOU_URL,
}, null, 2))

client.close()
setTimeout(() => process.exit(0), 50)
