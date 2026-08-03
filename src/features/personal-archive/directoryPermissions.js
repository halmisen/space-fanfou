const WRITE_PERMISSION_OPTIONS = { mode: 'readwrite' }

export function queryDirectoryWritePermission(directoryHandle) {
  return directoryHandle.queryPermission(WRITE_PERMISSION_OPTIONS)
}

export function requestDirectoryWritePermission(directoryHandle) {
  return directoryHandle.requestPermission(WRITE_PERMISSION_OPTIONS)
}
