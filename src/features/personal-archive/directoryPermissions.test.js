import {
  queryDirectoryWritePermission,
  requestDirectoryWritePermission,
} from './directoryPermissions'

test('a restored prompt state remains visible until a user gesture requests access', async () => {
  const calls = []
  const handle = {
    queryPermission(options) {
      calls.push([ 'query', options ])
      return Promise.resolve('prompt')
    },
    requestPermission(options) {
      calls.push([ 'request', options ])
      return Promise.resolve('granted')
    },
  }

  expect(await queryDirectoryWritePermission(handle)).toBe('prompt')
  expect(await requestDirectoryWritePermission(handle)).toBe('granted')
  expect(calls).toEqual([
    [ 'query', { mode: 'readwrite' } ],
    [ 'request', { mode: 'readwrite' } ],
  ])
})

test('a denied write request stays denied so the caller can stop before disk access', async () => {
  const handle = {
    requestPermission: () => Promise.resolve('denied'),
  }

  expect(await requestDirectoryWritePermission(handle)).toBe('denied')
})
