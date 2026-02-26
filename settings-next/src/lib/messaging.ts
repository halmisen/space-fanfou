/**
 * Port-based messaging bridge for settings-next.
 *
 * This replicates the protocol used by the legacy settings page
 * (src/content/environment/messaging.js):
 *   - connect via chrome.runtime.connect()
 *   - send: { senderId: number, message: { action, payload? } }
 *   - receive: { senderId: number, message: responseData }
 *
 * The background listener (src/background/environment/messaging.js)
 * ONLY listens on chrome.runtime.onConnect — NOT onMessage.
 */

let port: chrome.runtime.Port | null = null
let nextId = 0
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()

function connect() {
  port = chrome.runtime.connect()
  port.onMessage.addListener(onMessage)
  port.onDisconnect.addListener(onDisconnect)
}

function onMessage(msg: { type?: string; senderId?: number; message?: any }) {
  if (msg.senderId != null && pending.has(msg.senderId)) {
    const deferred = pending.get(msg.senderId)!
    pending.delete(msg.senderId)
    if (msg.message?.__isError) {
      deferred.reject(new Error(msg.message.message))
    } else {
      deferred.resolve(msg.message)
    }
  }
}

function onDisconnect() {
  const err = chrome.runtime.lastError
  // Reject all in-flight requests
  for (const [, d] of pending) {
    d.reject(new Error(err?.message ?? 'Port disconnected'))
  }
  pending.clear()

  // Reconnect unless extension context is gone
  if (!err?.message?.includes('Extension context invalidated')) {
    setTimeout(() => {
      try { connect() } catch { /* will retry on next postMessage */ }
    }, 200)
  }
}

/**
 * Send a message to the background and wait for a response.
 */
export function postMessage<T = any>(message: { action: string; payload?: any }): Promise<T> {
  if (!port) connect()
  const senderId = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(senderId, { resolve, reject })
    try {
      port!.postMessage({ senderId, message })
    } catch (e) {
      pending.delete(senderId)
      reject(e)
    }
  })
}

/** Initialise the port eagerly. */
export function init() {
  if (!port) connect()
}
