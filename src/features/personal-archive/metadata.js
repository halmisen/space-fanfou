export const options = {
  _: {
    defaultValue: true,
    label: '在饭否首页侧栏放一个「本地备份」面板',
    comment: '替换掉已经失效的「邀请朋友加入」。面板只显示上次备份进度并提供入口，'
      + '选择文件夹和同步仍然在本页进行——原因见 docs/spec-personal-archive.md。',
    // 备份摘要描述的是「这台电脑上的哪个文件夹」，跨设备同步没有意义。
    disableCloudSyncing: true,
  },
}
