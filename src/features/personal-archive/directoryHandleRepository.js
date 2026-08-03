const DATABASE_NAME = 'space-fanfou-personal-archive'
const STORE_NAME = 'directory-handles'
const DATABASE_VERSION = 1
const ACTIVE_HANDLE_KEY = 'active'

function openDatabase(indexedDb) {
  if (!indexedDb) throw new Error('IndexedDB is not available')

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

function runTransaction(indexedDb, mode, operation) {
  return openDatabase(indexedDb).then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    let result

    try {
      result = operation(transaction.objectStore(STORE_NAME))
    } catch (error) {
      database.close()
      reject(error)
      return
    }

    transaction.addEventListener('complete', () => {
      database.close()
      resolve(result?.result)
    })
    transaction.addEventListener('error', () => {
      database.close()
      reject(transaction.error)
    })
    transaction.addEventListener('abort', () => {
      database.close()
      reject(transaction.error || new Error('IndexedDB transaction aborted'))
    })
  }))
}

export default function createDirectoryHandleRepository(indexedDb = window.indexedDB) {
  return {
    save(handle) {
      return runTransaction(indexedDb, 'readwrite', store => store.put(handle, ACTIVE_HANDLE_KEY))
    },

    load() {
      return runTransaction(indexedDb, 'readonly', store => store.get(ACTIVE_HANDLE_KEY))
    },

    clear() {
      return runTransaction(indexedDb, 'readwrite', store => store.delete(ACTIVE_HANDLE_KEY))
    },
  }
}
