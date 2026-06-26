const BODY_CLASSNAME = 'sf-fanfou-font-preset-enabled'
const FONT_FAMILY_PROPERTY = '--sf-fanfou-font-family'
const DEFAULT_PRESET = 1
const FONT_PRESETS = {
  1: '"Segoe UI Emoji", "Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, sans-serif',
  2: '"Segoe UI Emoji", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", "Helvetica Neue", Arial, sans-serif',
  3: '"Lucida Grande", "Helvetica Neue", Helvetica, Tahoma, "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  4: '"Segoe UI Emoji", "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
}

function normalizePreset(value) {
  const preset = Number(value)

  return FONT_PRESETS[preset] ? preset : DEFAULT_PRESET
}

export default ({ readOptionValue }) => {
  function applyFontPreset() {
    const preset = normalizePreset(readOptionValue('preset'))

    document.body.classList.add(BODY_CLASSNAME)
    document.body.style.setProperty(FONT_FAMILY_PROPERTY, FONT_PRESETS[preset])
  }

  function removeFontPreset() {
    document.body.classList.remove(BODY_CLASSNAME)
    document.body.style.removeProperty(FONT_FAMILY_PROPERTY)
  }

  return {
    onLoad: applyFontPreset,
    onSettingsChange: applyFontPreset,
    onUnload: removeFontPreset,
  }
}
