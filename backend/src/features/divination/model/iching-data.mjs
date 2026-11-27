// Trigram order and elements follow 梅花易数卷一. Inner and outer branches follow 增删卜易第四章.
// https://zh.wikisource.org/wiki/梅花易數/卷一
// https://zh.wikisource.org/wiki/增刪卜易/4
/** @type {readonly import('./iching').Trigram[]} */
export const trigrams = [
  { name: '乾', image: '天', element: '金', pattern: 7, inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  { name: '兑', image: '泽', element: '金', pattern: 3, inner: ['巳', '卯', '丑'], outer: ['亥', '酉', '未'] },
  { name: '离', image: '火', element: '火', pattern: 5, inner: ['卯', '丑', '亥'], outer: ['酉', '未', '巳'] },
  { name: '震', image: '雷', element: '木', pattern: 1, inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  { name: '巽', image: '风', element: '木', pattern: 6, inner: ['丑', '亥', '酉'], outer: ['未', '巳', '卯'] },
  { name: '坎', image: '水', element: '水', pattern: 2, inner: ['寅', '辰', '午'], outer: ['申', '戌', '子'] },
  { name: '艮', image: '山', element: '土', pattern: 4, inner: ['辰', '午', '申'], outer: ['戌', '子', '寅'] },
  { name: '坤', image: '地', element: '土', pattern: 0, inner: ['未', '巳', '卯'], outer: ['丑', '亥', '酉'] },
];

// The eight palace sequences follow 增删卜易第二章. The themes are plain-language readings for the app.
// https://zh.wikisource.org/wiki/增刪卜易/2
/** @type {Readonly<Record<import('./iching').TrigramName, readonly (readonly [string, import('./iching').ReadingDirection, string])[]>>} */
export const palaceHexagrams = {
  乾: [
    ['乾', 'advance', '主动定下方向，持续推进'],
    ['姤', 'verify', '留意突然出现的人或条件'],
    ['遁', 'adjust', '暂时退一步，保存余地'],
    ['否', 'adjust', '上下难以沟通，先疏通阻隔'],
    ['观', 'verify', '先观察全局再作决定'],
    ['剥', 'adjust', '外层条件正在削弱，先保住基础'],
    ['晋', 'advance', '条件逐步明朗，可以有序推进'],
    ['大有', 'advance', '已有可用资源，集中用于最重要的事'],
  ],
  坎: [
    ['坎', 'verify', '反复遇到阻力，先摸清风险与路径'],
    ['节', 'verify', '用明确边界安排投入'],
    ['屯', 'adjust', '起步多阻，先理顺最基本的安排'],
    ['既济', 'verify', '事情初步到位，留意收尾和后续维护'],
    ['革', 'adjust', '旧做法需要更换，先确认改变的条件'],
    ['丰', 'advance', '机会集中时把握重点，及时处理'],
    ['明夷', 'adjust', '外部条件不利时，先保护手头已有的基础'],
    ['师', 'verify', '组织人手之前先明确规则和职责'],
  ],
  艮: [
    ['艮', 'adjust', '知道在哪里停下，给判断留出空间'],
    ['贲', 'verify', '把外在呈现与实际内容分开看'],
    ['大畜', 'adjust', '先积累能力与资源，等待合适时机'],
    ['损', 'adjust', '减去次要负担，把资源用在要紧处'],
    ['睽', 'verify', '看清差异，先找可以合作的一小部分'],
    ['履', 'verify', '照着明确的分寸一步一步走'],
    ['中孚', 'verify', '用一致的承诺与行动建立信任'],
    ['渐', 'advance', '循序推进，用每一步的反馈确定节奏'],
  ],
  震: [
    ['震', 'adjust', '遇到突发变化先稳住，再恢复行动'],
    ['豫', 'advance', '用已有动力和准备推动下一步'],
    ['解', 'advance', '阻力松开后及时处理可以解决的事'],
    ['恒', 'advance', '用能持续的节奏落实承诺'],
    ['升', 'advance', '积累小进展，逐级向上'],
    ['井', 'adjust', '维护长期可用的资源与支持'],
    ['大过', 'adjust', '压力超过承载时先减轻负担'],
    ['随', 'advance', '根据形势与合适的协作机会行动'],
  ],
  巽: [
    ['巽', 'advance', '通过持续沟通和小调整逐步推动'],
    ['小畜', 'adjust', '小幅积累，等待条件更充分'],
    ['家人', 'adjust', '先理顺内部角色与分工'],
    ['益', 'advance', '把增长的资源用来改善重要环节'],
    ['无妄', 'verify', '按事实行事，避免被未经核实的预期带动'],
    ['噬嗑', 'verify', '识别挡在中间的具体障碍'],
    ['颐', 'adjust', '检查时间、精力与支持如何补给'],
    ['蛊', 'adjust', '整理积累已久的问题，逐项修复'],
  ],
  离: [
    ['离', 'verify', '把事情看清楚，确认依靠的条件'],
    ['旅', 'verify', '身处过渡环境，先了解当地规则与边界'],
    ['鼎', 'advance', '重组现有资源，试出新的做法'],
    ['未济', 'verify', '接近完成时，检查还有哪一步未落实'],
    ['蒙', 'verify', '先学习和求证，补齐还不明白的部分'],
    ['涣', 'adjust', '重新聚拢分散的资源与共识'],
    ['讼', 'verify', '有争议时先核对事实与边界'],
    ['同人', 'advance', '围绕共同目标找到可以同行的人'],
  ],
  坤: [
    ['坤', 'adjust', '承接眼下的任务，先把基础稳住'],
    ['复', 'advance', '找回有效的节奏，从小处重新开始'],
    ['临', 'advance', '机会接近时主动了解并准备应对'],
    ['泰', 'advance', '沟通顺畅时把共识变成实际行动'],
    ['大壮', 'verify', '力量增加时留意边界和用力的分寸'],
    ['夬', 'advance', '关键条件清楚后，把决定说清并落实'],
    ['需', 'verify', '等待要紧条件成熟，并做好可控的准备'],
    ['比', 'advance', '与可信的人协作，建立相互支持'],
  ],
  兑: [
    ['兑', 'advance', '通过坦诚交流促成合作'],
    ['困', 'adjust', '资源受限时先保住最重要的部分'],
    ['萃', 'advance', '聚集能参与的人和资源，再做共同的事'],
    ['咸', 'verify', '观察彼此的实际回应与影响'],
    ['蹇', 'adjust', '遇到阻碍时改走可行的路，必要时求助'],
    ['谦', 'adjust', '收敛过高预期，调整彼此的空间'],
    ['小过', 'verify', '用小步试错，关注容易被忽略的细节'],
    ['归妹', 'verify', '进入新安排前核对角色、承诺与时机'],
  ],
};
