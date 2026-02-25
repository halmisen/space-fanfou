import { CONTROL_PLACEHOLDER } from '@constants'

export const options = {
  _: {
    defaultValue: true,
    label: '显示关注者头像壁纸',
  },
  opacity: {
    defaultValue: 0.15,
    label: `壁纸透明度 ${CONTROL_PLACEHOLDER} (0.05 - 0.5)`,
    controlOptions: {
      step: 0.05,
      min: 0.05,
      max: 0.5,
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
