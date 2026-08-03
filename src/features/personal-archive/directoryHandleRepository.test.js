import createDirectoryHandleRepository from './directoryHandleRepository'

function createFakeIndexedDb() {
  const values = new Map()
  let storeCreated = false

  const database = {
    objectStoreNames: {
      contains: () => storeCreated,
    },
    createObjectStore() {
      storeCreated = true
    },
    close: () => undefined,
    transaction() {
      const listeners = {}
      const transaction = {
        addEventListener(type, listener) {
          listeners[type] = listener
        },
        objectStore() {
          return {
            put(value, key) {
              values.set(key, value)
              const request = { result: key }
              Promise.resolve().then(() => listeners.complete())
              return request
            },
            get(key) {
              const request = { result: values.get(key) }
              Promise.resolve().then(() => listeners.complete())
              return request
            },
            delete(key) {
              values.delete(key)
              const request = { result: undefined }
              Promise.resolve().then(() => listeners.complete())
              return request
            },
          }
        },
      }
      return transaction
    },
  }

  return {
    open() {
      const listeners = {}
      const request = {
        result: database,
        addEventListener(type, listener) {
          listeners[type] = listener
        },
      }
      Promise.resolve().then(() => {
        if (!storeCreated) listeners.upgradeneeded()
        listeners.success()
      })
      return request
    },
  }
}

test('the selected directory handle survives save, load and clear operations', async () => {
  const repository = createDirectoryHandleRepository(createFakeIndexedDb())
  const directoryHandle = {
    kind: 'directory',
    name: '我的饭否备份',
    queryPermission: () => Promise.resolve('prompt'),
  }

  await repository.save(directoryHandle)
  expect(await repository.load()).toBe(directoryHandle)

  await repository.clear()
  expect(await repository.load()).toBeUndefined()
})
