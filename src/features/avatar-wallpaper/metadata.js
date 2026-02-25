import { CONTROL_PLACEHOLDER } from '@constants'

export const options = {
  _: {
    defaultValue: true,
    label: '显示关注者头像壁纸',
    comment: '自动读取关注用户头像并拼接为背景壁纸。首次加载可能需要几秒钟。',
  },

  opacity: {
    defaultValue: 0.22,
    label: `壁纸透明度 ${CONTROL_PLACEHOLDER} (0.08 - 0.65)`,
    controlOptions: {
      step: 0.02,
      min: 0.08,
      max: 0.65,
    },
  },
  fetchIntervalDays: {
    defaultValue: 7,
    label: `自动刷新缓存周期 ${CONTROL_PLACEHOLDER} 天`,
    controlOptions: {
      step: 1,
      min: 1,
      max: 30,
    },
  },
}
