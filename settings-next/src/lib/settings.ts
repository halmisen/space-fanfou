import { postMessage } from './messaging'

const SETTINGS_READ_ALL = 'SETTINGS_READ_ALL'
const SETTINGS_WRITE_ALL = 'SETTINGS_WRITE_ALL'
const GET_OPTION_DEFS = 'GET_OPTION_DEFS'

export async function readAllSettings(): Promise<Record<string, any>> {
  return postMessage({ action: SETTINGS_READ_ALL })
}

export async function writeAllSettings(optionValues: Record<string, any>): Promise<void> {
  await postMessage({
    action: SETTINGS_WRITE_ALL,
    payload: { optionValues },
  })
}

export async function getOptionDefs(): Promise<Record<string, any>> {
  return postMessage({ action: GET_OPTION_DEFS })
}
