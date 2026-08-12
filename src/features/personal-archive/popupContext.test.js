import isPopupContext from './popupContext'

test('a browser action popup is detected because it has no own tab', async () => {
  expect(await isPopupContext({ getCurrent: () => Promise.resolve(undefined) })).toBe(true)
})

test('a settings page opened as a real tab is not treated as a popup', async () => {
  expect(await isPopupContext({
    getCurrent: () => Promise.resolve({ id: 7, url: 'chrome-extension://x/settings.html' }),
  })).toBe(false)
})

test('an unavailable tabs API falls back to the tab case instead of blocking the feature', async () => {
  expect(await isPopupContext({
    getCurrent: () => Promise.reject(new Error('no permission')),
  })).toBe(false)
})
