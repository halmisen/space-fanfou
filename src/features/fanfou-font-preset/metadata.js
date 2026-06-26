import { CONTROL_PLACEHOLDER } from '@constants'

export const options = {
  _: {
    defaultValue: true,
    label: '使用饭否页面字体预设',
    comment: '为饭否页面套用更稳定的字体组合；关闭后保留扩展现有基础样式。',
  },

  preset: {
    defaultValue: 1,
    label: `字体预设 ${CONTROL_PLACEHOLDER} (1 - 4)`,
    comment: '1 现代无衬线 / 2 中文系统优先 / 3 饭否原味 / 4 阅读感增强',
    controlOptions: {
      step: 1,
      min: 1,
      max: 4,
    },
  },
}
