export const tarotSpread = /** @type {const} */ ([
  { id: 'situation', label: '现状' },
  { id: 'focus', label: '需要留意' },
  { id: 'next-step', label: '下一步' },
]);

const majorArcana = [
  '愚者', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车', '力量', '隐士', '命运之轮',
  '正义', '倒吊人', '死神', '节制', '恶魔', '高塔', '星星', '月亮', '太阳', '审判', '世界',
];

const suits = [
  { id: 'wands', name: '权杖' },
  { id: 'cups', name: '圣杯' },
  { id: 'swords', name: '宝剑' },
  { id: 'pentacles', name: '星币' },
];

const ranks = [
  { id: 'ace', name: '王牌' },
  { id: '2', name: '二' },
  { id: '3', name: '三' },
  { id: '4', name: '四' },
  { id: '5', name: '五' },
  { id: '6', name: '六' },
  { id: '7', name: '七' },
  { id: '8', name: '八' },
  { id: '9', name: '九' },
  { id: '10', name: '十' },
  { id: 'page', name: '侍从' },
  { id: 'knight', name: '骑士' },
  { id: 'queen', name: '王后' },
  { id: 'king', name: '国王' },
];

/** @type {readonly Readonly<{ id: string; name: string }>[] } */
export const tarotDeck = [
  ...majorArcana.map((name, number) => ({ id: `major-${number}`, name })),
  ...suits.flatMap((suit) => ranks.map((rank) => ({
    id: `${suit.id}-${rank.id}`,
    name: `${suit.name}${rank.name}`,
  }))),
];
