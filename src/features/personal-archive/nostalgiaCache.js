import { getStatusMonth } from './statusRecords'

const DATABASE_NAME = 'space-fanfou-nostalgia'
const STORE_NAME = 'statuses'
const DATABASE_VERSION = 1

function openDatabase(indexedDb) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('month', 'month', { unique: false })
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

function run(indexedDb, mode, operation) {
  return openDatabase(indexedDb).then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = operation(transaction.objectStore(STORE_NAME))
    transaction.addEventListener('complete', () => {
      database.close()
      resolve(request?.result)
    })
    transaction.addEventListener('error', () => {
      database.close()
      reject(transaction.error)
    })
    transaction.addEventListener('abort', () => {
      database.close()
      reject(transaction.error || new Error('Nostalgia cache transaction aborted'))
    })
  }))
}

export default function createNostalgiaCache(indexedDb = window.indexedDB) {
  return {
    writeStatuses(statuses, timeZone) {
      const records = (statuses || []).map(status => ({
        id: String(status.id),
        month: getStatusMonth(status, timeZone),
        status,
      })).filter(record => record.month)

      return run(indexedDb, 'readwrite', store => {
        records.forEach(record => store.put(record))
      })
    },

    readYear(year) {
      const range = IDBKeyRange.bound(`${year}-01`, `${year}-12`)
      return run(indexedDb, 'readonly', store => store.index('month').getAll(range))
        .then(records => (records || []).map(record => record.status))
    },
  }
}
