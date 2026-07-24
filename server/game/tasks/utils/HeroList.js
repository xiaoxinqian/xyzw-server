/**
 * 英雄列表
 * 从参考项目 HeroList.js 移植
 */

const HERO_DICT = {
  101: { name: '关羽', type: 1, avatar: 'guanyu' },
  102: { name: '张飞', type: 1, avatar: 'zhangfei' },
  103: { name: '赵云', type: 1, avatar: 'zhaoyun' },
  104: { name: '马超', type: 1, avatar: 'machao' },
  105: { name: '黄忠', type: 1, avatar: 'huangzhong' },
  106: { name: '诸葛亮', type: 2, avatar: 'zhugeliang' },
  107: { name: '庞统', type: 2, avatar: 'pangtong' },
  108: { name: '徐庶', type: 2, avatar: 'xushu' },
  109: { name: '祝融', type: 3, avatar: 'zhurong' },
  110: { name: '关银屏', type: 3, avatar: 'guanyinping' },
  111: { name: '马云禄', type: 3, avatar: 'mayunlu' },
  112: { name: '蔡文姬', type: 4, avatar: 'caiwenji' },
  113: { name: '甄姬', type: 4, avatar: 'zhenji' },
  114: { name: '大乔', type: 4, avatar: 'daqiao' },
  115: { name: '小乔', type: 4, avatar: 'xiaoqiao' },
  116: { name: '孙尚香', type: 4, avatar: 'sunshangxiang' },
  117: { name: '黄月英', type: 4, avatar: 'huangyueying' },
  118: { name: '王元姬', type: 4, avatar: 'wangyuanji' },
  119: { name: '张春华', type: 4, avatar: 'zhangchunhua' },
  120: { name: '蔡邕', type: 2, avatar: 'caiyong' },
  121: { name: '鲁肃', type: 2, avatar: 'lushu' },
  201: { name: '吕布', type: 1, avatar: 'lvbu' },
  202: { name: '貂蝉', type: 4, avatar: 'diaochan' },
  203: { name: '华佗', type: 4, avatar: 'huatuo' },
  204: { name: '左慈', type: 2, avatar: 'zuoci' },
  205: { name: '于吉', type: 2, avatar: 'yuji' },
  206: { name: '华雄', type: 1, avatar: 'huaxiong' },
  207: { name: '董卓', type: 1, avatar: 'dongzhuo' },
  208: { name: '袁绍', type: 1, avatar: 'yuanshao' },
  209: { name: '颜良', type: 1, avatar: 'yanliang' },
};

module.exports = { HERO_DICT };
