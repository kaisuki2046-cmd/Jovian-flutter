// Traditional meanings are Chinese paraphrases of Rider–Waite–Smith imagery and Waite's text.
// https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_2
// https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3
// The everyday explanations and directions adapt those themes for this app.

/** @typedef {Readonly<{ traditional: string, plain: string, direction: 'advance' | 'verify' | 'adjust' }>} TarotMeaning */

/** @type {Readonly<Record<string, Readonly<{ upright: TarotMeaning, reversed: TarotMeaning }>>>} */
export const tarotMeanings = {
  'major-0': {
    upright: {
      traditional: '愚者立于崖边，象征未知旅程与自发行动。',
      plain: '你可能已经对一个新方向产生兴趣。现在能做的是先试一点，从实际体验里看看它适不适合你。',
      direction: 'advance',
    },
    reversed: {
      traditional: '愚者逆位侧重轻忽、疏漏和准备不足。',
      plain: '你也许很想立刻动身。先想清最坏会付出什么，以及遇到意外时还有哪些退路。',
      direction: 'verify',
    },
  },
  'major-1': {
    upright: {
      traditional: '魔术师以桌上器具代表技艺、意志与资源的运用。',
      plain: '先盘点手头已经有的人脉、时间和技能，挑一样真正用起来。一个做出来的小样，比光想更容易看出问题。',
      direction: 'advance',
    },
    reversed: {
      traditional: '魔术师逆位侧重意图与手段脱节，技艺难以发挥。',
      plain: '你可能同时准备了很多东西，却说不清要解决什么。先选一个目标，再留下最有用的工具。',
      direction: 'adjust',
    },
  },
  'major-2': {
    upright: {
      traditional: '女祭司守于双柱之间，象征隐秘、静默与内在知识。',
      plain: '你或许已经觉得哪里不太对，却还说不出原因。记下具体发生了什么，再看看哪些感受有事实支持。',
      direction: 'verify',
    },
    reversed: {
      traditional: '女祭司逆位提示知识尚浅，强烈感受可能遮住细节。',
      plain: '越急着下结论，越容易把听来的消息当真。把你亲眼看到的和别人告诉你的分开，再核实一件事。',
      direction: 'verify',
    },
  },
  'major-3': {
    upright: {
      traditional: '皇后象征丰饶、孕育与主动培育。',
      plain: '如果有件事刚露出苗头，给它一点时间和稳定的支持。持续投入，比一次把所有力气用完更容易看到成长。',
      direction: 'advance',
    },
    reversed: {
      traditional: '皇后逆位提示培育失衡，反复顾虑让事情难以滋长。',
      plain: '当你一直照顾别人，自己的时间和体力也会见底。先留出一点空间给自己，再看看能承担多少。',
      direction: 'adjust',
    },
  },
  'major-4': {
    upright: {
      traditional: '皇帝象征秩序、权威与有形的落实。',
      plain: '把谁来决定、什么时候交付、哪些事可以拒绝讲清楚。只要边界明确，下一步就容易落实。',
      direction: 'advance',
    },
    reversed: {
      traditional: '皇帝逆位常涉及阻碍、失序或权威运用失衡。',
      plain: '如果流程太死，试着改掉一个已经妨碍做事的规定。如果大家各做各的，先约定一条都能遵守的规则。',
      direction: 'adjust',
    },
  },
  'major-5': {
    upright: {
      traditional: '教皇关联传统、共同规范与向导师求教。',
      plain: '遇到一件陌生的事时，可以问有经验的人一般怎么处理，再看看这条经验适不适合你眼下的情况。',
      direction: 'verify',
    },
    reversed: {
      traditional: '教皇逆位可见随和与过度迁就，适合重新检视成规。',
      plain: '先问问自己遵守这条规矩的原因。它如果只是习惯，就试着和相关的人讨论有没有更合适的做法。',
      direction: 'verify',
    },
  },
  'major-6': {
    upright: {
      traditional: '恋人象征吸引、结合，以及在考验中作出的选择。',
      plain: '如果两边都很吸引你，先想清哪个选择符合你真正看重的事，以及你愿意为它作出怎样的承诺。',
      direction: 'advance',
    },
    reversed: {
      traditional: '恋人逆位提示失和、选择失准或承诺难以兑现。',
      plain: '看看你想要的和你实际答应的是否一致。涉及别人时，把双方理解的条件说出来，确认是在谈同一件事。',
      direction: 'verify',
    },
  },
  'major-7': {
    upright: {
      traditional: '战车象征意志驾驭相反力量，并以明确方向克服阻力。',
      plain: '手上的事情可能朝不同方向拉扯。先挑一个最值得达成的目标，把时间和精力集中到同一个方向。',
      direction: 'advance',
    },
    reversed: {
      traditional: '战车逆位侧重纷争、失去驾驭与推进受阻。',
      plain: '忙了一圈还在原地时，先停下来看看力气花在哪儿。砍掉一件分散注意力的事，再重新安排节奏。',
      direction: 'adjust',
    },
  },
  'major-8': {
    upright: {
      traditional: '力量描绘人与狮子的温和接触，象征勇气和克制。',
      plain: '面对让你焦虑的人或事，试着稳住语气，明确说出自己的要求。耐心和一致的行动也能推动改变。',
      direction: 'advance',
    },
    reversed: {
      traditional: '力量逆位涉及软弱、力量失衡与用力过度。',
      plain: '如果你在自我怀疑和硬撑之间来回摆动，先找一个自己能完成的小目标，重新建立对行动的信心。',
      direction: 'adjust',
    },
  },
  'major-9': {
    upright: {
      traditional: '隐士举灯独行，象征审慎、反观与内在指引。',
      plain: '给自己一点安静时间，想清楚真正困扰你的是什么。先形成自己的判断，再决定要听谁的意见。',
      direction: 'verify',
    },
    reversed: {
      traditional: '隐士逆位提示隐遁、畏缩或过度防备。',
      plain: '独处太久可能让同一个念头不断打转。找一个愿意说实话的人，听听他从外面看到的情况。',
      direction: 'adjust',
    },
  },
  'major-10': {
    upright: {
      traditional: '命运之轮象征循环、转折与时机的变动。',
      plain: '当外部条件发生变化时，回头看看原来行不通的选项。现在也许能用更小的成本试一次。',
      direction: 'advance',
    },
    reversed: {
      traditional: '命运之轮逆位可读作周期受阻或重复失衡。',
      plain: '如果同样的问题又出现了，比较这一次和上一次哪些做法一样。找到重复发生的原因，再调整策略。',
      direction: 'verify',
    },
  },
  'major-11': {
    upright: {
      traditional: '正义以天平与剑象征公正、权衡与责任。',
      plain: '给所有选项用同一套标准，例如时间、成本和承担的责任。把这些标准写下来，看看结论还能不能站住。',
      direction: 'verify',
    },
    reversed: {
      traditional: '正义逆位涉及偏私、尺度失衡与过于严苛的判断。',
      plain: '你可能在用不同标准评价自己和别人。挑一条最影响结论的标准，确认它能公平地用在每个选项上。',
      direction: 'verify',
    },
  },
  'major-12': {
    upright: {
      traditional: '倒吊人以悬置象征暂停、牺牲与视角转换。',
      plain: '卡住时可以暂停原来的做法。换到另一个人的位置想想，他看到的阻碍和你看到的是否一样。',
      direction: 'verify',
    },
    reversed: {
      traditional: '倒吊人逆位可读作悬置失效，付出与收获脱节。',
      plain: '如果已经等了很久，问问自己到底在等什么。为等待设一个期限，并决定到时可以改动哪一步。',
      direction: 'adjust',
    },
  },
  'major-13': {
    upright: {
      traditional: '死神象征阶段终结与形态转化。',
      plain: '有些安排已经完成了它的作用。把还值得留下的部分留下，再为新的做法腾出时间和精力。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '死神逆位侧重停滞、惯性与转化迟缓。',
      plain: '你也许知道旧办法行不通，仍然习惯沿用。先替换一个最小的环节，看看改变的代价是否比想象中低。',
      direction: 'adjust',
    },
  },
  'major-14': {
    upright: {
      traditional: '节制以杯间调和象征适度、管理与平衡。',
      plain: '试着调小投入的幅度或把时间分开安排，让几件重要的事都能有一点进展。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '节制逆位提示失和、利益冲突与配合失衡。',
      plain: '如果两边的节奏一直碰撞，先明确各自最在乎什么，再商量一件彼此都能配合的小调整。',
      direction: 'adjust',
    },
  },
  'major-15': {
    upright: {
      traditional: '恶魔以束缚的意象呈现欲望、依附与牵制。',
      plain: '看看你反复做的那件事，眼下给了你什么好处，又让你付出了什么。先把这个交换看清楚。',
      direction: 'verify',
    },
    reversed: {
      traditional: '恶魔逆位可读作看见束缚中的弱点，开始松动旧依附。',
      plain: '先找一个你能自己控制的习惯，减少一次重复。观察少做一次以后，真正让你难受的是什么。',
      direction: 'adjust',
    },
  },
  'major-16': {
    upright: {
      traditional: '高塔象征突发冲击与原有结构的瓦解。',
      plain: '如果原来的计划突然失效，先处理最紧急的影响。等局面稳住，再看哪些基础需要重新搭起来。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '高塔逆位侧重冲击减弱后的余波，或结构仍在承压。',
      plain: '问题变小了也值得留意。先处理已经看得见的裂缝，给后面留出调整的余地。',
      direction: 'adjust',
    },
  },
  'major-17': {
    upright: {
      traditional: '星星可象征希望、前景与恢复后的指引。',
      plain: '情绪缓下来以后，找一个可以继续相信的具体迹象，比如有人愿意支持，或者事情确实比之前好了一点。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星星逆位提示希望受挫、信念或自我评价失衡。',
      plain: '灰心的时候，试着把进展缩小到可以看见的程度。确认最近做成的一件小事，再决定是否继续。',
      direction: 'adjust',
    },
  },
  'major-18': {
    upright: {
      traditional: '月亮象征昏暗、迷惑与尚未辨明的信息。',
      plain: '先把你知道的事实和自己补上的故事写在两列。挑一条能问到答案的事去查证。',
      direction: 'verify',
    },
    reversed: {
      traditional: '月亮逆位侧重摇摆不定与逐渐减轻的误解。',
      plain: '如果原先最担心的事开始有答案，接着核实哪一部分已经解开，哪一部分还没有证据。',
      direction: 'verify',
    },
  },
  'major-19': {
    upright: {
      traditional: '太阳象征光明、满足与可以看见的成果。',
      plain: '把已经做成的事摆出来和相关的人说清楚，趁信息明确时推进一件具体的事。',
      direction: 'advance',
    },
    reversed: {
      traditional: '太阳逆位保留明朗与喜悦的主题，程度有所减弱。',
      plain: '方向也许不错，进展可能还没有想象中大。找一个实际指标检查，看看事情已经做到哪一步。',
      direction: 'verify',
    },
  },
  'major-20': {
    upright: {
      traditional: '审判象征召唤、复苏与回顾后的重新决定。',
      plain: '回头看最近一段经历给了你什么反馈。把这些经验用在这次选择里，作一个有依据的新决定。',
      direction: 'advance',
    },
    reversed: {
      traditional: '审判逆位涉及犹疑、迟疑与对决定的反复审议。',
      plain: '如果你一直在责怪自己，先把当时知道什么、现在知道什么分开。让新信息帮助你判断眼下的选择。',
      direction: 'verify',
    },
  },
  'major-21': {
    upright: {
      traditional: '世界象征圆满、整合与一个周期的完成。',
      plain: '把已经做完的部分收好，记录哪种做法值得带去下一阶段。需要开始下一件事时，手上会更有底。',
      direction: 'advance',
    },
    reversed: {
      traditional: '世界逆位侧重停顿、固着与周期难以收束。',
      plain: '事情可能只剩一个没交代清楚的环节。先把该确认或交付的部分补上，再结束这一阶段。',
      direction: 'adjust',
    },
  },

  'wands-ace': {
    upright: {
      traditional: '权杖王牌以云中伸出的新杖象征创生与事业的开端。',
      plain: '刚冒出的点子可以先做一个小版本。用一次尝试判断你对它的兴趣能不能持续。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖王牌逆位侧重生发受挫，开端缺乏支撑。',
      plain: '想开始却迟迟动不了时，找出最缺的是时间、资源还是明确目标。先补其中一样。',
      direction: 'adjust',
    },
  },
  'wands-2': {
    upright: {
      traditional: '权杖二以手持地球、眺望远方的形象呈现已有基础与外部可能。',
      plain: '把现在握在手里的条件写下来，再列一个可以向外探索的选项。看清两边的代价会更容易选。',
      direction: 'verify',
    },
    reversed: {
      traditional: '权杖二逆位涉及意外、忧虑与对未知的犹豫。',
      plain: '对新方向心里没底很常见。先弄清最让你犹豫的那件事有没有办法验证。',
      direction: 'verify',
    },
  },
  'wands-3': {
    upright: {
      traditional: '权杖三以远眺船队象征经营、拓展与合作。',
      plain: '手头的事已经做了开头，可以去找合作机会或等第一批反馈。让反馈告诉你该在哪里多投入一点。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖三逆位可读作阻力消退，或远行的节奏需要重新安排。',
      plain: '如果之前卡住的条件开始松动，先确认现在能做的范围。把计划改到手头资源能支撑的程度。',
      direction: 'adjust',
    },
  },
  'wands-4': {
    upright: {
      traditional: '权杖四的花环与庆典象征和谐、安定与阶段成果。',
      plain: '如果一个阶段已经做完，和参与的人一起确认做成了什么。把有效的安排保留下来，方便接着做。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖四逆位仍保有和谐与繁荣的传统主题，着重巩固成果。',
      plain: '哪怕场面不像想象中热闹，已有的支持仍然可以利用。把一项好的合作习惯固定下来。',
      direction: 'advance',
    },
  },
  'wands-5': {
    upright: {
      traditional: '权杖五呈现竞逐和模拟交锋，涉及竞争与立场碰撞。',
      plain: '听听争执里每个人到底想争取什么。分清需求以后，才知道是目标不同，还是只在争做法。',
      direction: 'verify',
    },
    reversed: {
      traditional: '权杖五逆位提示争执加深、矛盾难解或角力变形。',
      plain: '如果大家开始猜对方动机，先暂停争论。把能确认的分歧写下来，从一件具体的事谈起。',
      direction: 'adjust',
    },
  },
  'wands-6': {
    upright: {
      traditional: '权杖六以桂冠与归来的骑者象征胜利、肯定与消息。',
      plain: '已经收到的好反馈可以成为下一步的依据。找出别人认可的是哪项具体成果，把它继续做好。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖六逆位涉及担忧、认可延迟与不确定的支持。',
      plain: '别人还没有表态时，试着问清评价标准和时间。判断尽量建立在已确认的反馈上。',
      direction: 'verify',
    },
  },
  'wands-7': {
    upright: {
      traditional: '权杖七象征据守有利位置，应对挑战、竞争和辩论。',
      plain: '当不同意见都挤过来时，先说清自己最想守住的一个条件。其他条件可以留给讨论。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖七逆位提示压力、困惑与迟疑。',
      plain: '如果你已经疲于应对，先决定哪些要求需要回应，哪些可以交给别人。把有限的精力留给最重要的一条。',
      direction: 'adjust',
    },
  },
  'wands-8': {
    upright: {
      traditional: '权杖八以飞行中的杖象征快速推进、消息传递与趋近目标。',
      plain: '进展变快时，把当前决定和时间点及时告诉相关的人。让大家知道下一步各自要做什么。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖八逆位涉及纷争、消息失序与速度带来的冲突。',
      plain: '越忙越值得确认消息是不是同一版。先统一关键信息，再决定哪些任务真的需要加速。',
      direction: 'verify',
    },
  },
  'wands-9': {
    upright: {
      traditional: '权杖九象征防御、逆境中的韧性与延缓。',
      plain: '你已经靠经验避开过麻烦。检查现在守着的底线还有没有必要，同时给自己留一点休息时间。',
      direction: 'verify',
    },
    reversed: {
      traditional: '权杖九逆位侧重障碍加重，防守能力受到消耗。',
      plain: '一直保持警惕会很累。把可以停止、延后或交给别人的事分出来，先恢复能量。',
      direction: 'adjust',
    },
  },
  'wands-10': {
    upright: {
      traditional: '权杖十以负杖者象征责任重压与成果附带的负担。',
      plain: '盘点你手上的事，分出必须自己做的和可以请别人帮忙的。先卸下一项，看看重要的事能否做得更好。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '权杖十逆位涉及负担造成的困难、牵制与冲突。',
      plain: '如果每件事都堆在你身上，明确说出你只能完成哪几项。请相关的人一起改优先顺序。',
      direction: 'adjust',
    },
  },
  'wands-page': {
    upright: {
      traditional: '权杖侍从是传讯与热忱的形象，常指新消息和探索意愿。',
      plain: '碰到让你好奇的机会，可以先问一个问题或做一次试用。把好奇心变成能收集信息的行动。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖侍从逆位涉及消息不稳、犹豫与难以持续的热情。',
      plain: '消息听起来不错时，先找可靠的人确认细节。等确认手上的条件，再决定投入多少。',
      direction: 'verify',
    },
  },
  'wands-knight': {
    upright: {
      traditional: '权杖骑士象征出发、迁移与积极行动。',
      plain: '如果方向已经大致明白，挑一件可以立即开始的事。给它设个检查点，方便中途根据实际情况调整。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖骑士逆位常涉及行动中断、冲突与冲劲失去方向。',
      plain: '发现自己越赶越容易返工时，先把速度降下来。重新定好任务范围，再开始下一段。',
      direction: 'adjust',
    },
  },
  'wands-queen': {
    upright: {
      traditional: '权杖王后象征有吸引力的热忱、友善与主动参与。',
      plain: '可以坦率说出你对什么感兴趣，并邀请愿意参与的人一起做。别人看到你的具体想法才容易回应。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖王后逆位的传统读法兼有热心与竞争，提示审视认可的来源。',
      plain: '如果你一直在等别人肯定，问问自己即使没人表态还愿不愿意做。分清你自己的动力。',
      direction: 'verify',
    },
  },
  'wands-king': {
    upright: {
      traditional: '权杖国王象征行动意志、经营能力与领引方向。',
      plain: '把你想做到的事说成一个清楚的目标，再给参与的人留出自己的做法。先推进一件能看到成果的事。',
      direction: 'advance',
    },
    reversed: {
      traditional: '权杖国王逆位侧重严厉、要求过高与意志失衡。',
      plain: '如果身边的人跟不上你的节奏，先问他们卡在哪儿。试着把目标和期限分开协商。',
      direction: 'adjust',
    },
  },

  'cups-ace': {
    upright: {
      traditional: '圣杯王牌以满溢的杯象征情感丰沛、滋养与喜悦。',
      plain: '刚出现的好感、感激或创意可以用很小的方式表达。看看得到的回应，再决定怎么继续。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯王牌逆位涉及情感容器不稳，满足感易受波动。',
      plain: '有些感受积得太久时，可以先承认自己到底在意什么。等心情稳一点，再选合适的时机表达。',
      direction: 'adjust',
    },
  },
  'cups-2': {
    upright: {
      traditional: '圣杯二以互举杯盏象征联结、亲和与互相回应。',
      plain: '如果双方都有意愿，找一个简单的约定开始。清楚说出自己能给什么、希望得到什么。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯二逆位可读作关系中的失和、误会或互惠失衡。',
      plain: '有时两个人都觉得自己已经说清楚了。对照一下彼此期待的回应，看看是哪一点没有对上。',
      direction: 'verify',
    },
  },
  'cups-3': {
    upright: {
      traditional: '圣杯三以举杯庆祝象征团聚、慰藉与共同成果。',
      plain: '有些事可以和愿意支持你的人一起做。先找一位靠谱同伴，把你真正需要的帮助说出来。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯三逆位也涉及感官享受过度与群体节奏失衡。',
      plain: '聚在一起可能让人轻松，也可能让你勉强配合。留出退出或单独休息的空间，看看压力会不会减轻。',
      direction: 'adjust',
    },
  },
  'cups-4': {
    upright: {
      traditional: '圣杯四象征倦怠、疏离以及难以回应眼前的邀约。',
      plain: '你可能对所有选项都提不起劲。先休息一下，再看是这些选项确实不合适，还是你暂时没有精力。',
      direction: 'verify',
    },
    reversed: {
      traditional: '圣杯四逆位关联新事物、新关系和重新接收机会。',
      plain: '回头看看一件你之前顺手跳过的事。重新了解一点细节，也许能判断它是不是值得考虑。',
      direction: 'advance',
    },
  },
  'cups-5': {
    upright: {
      traditional: '圣杯五呈现失落与余存，倾倒的杯之外仍有资源可用。',
      plain: '允许自己为失去的东西难过。等缓一点，列出还有谁能帮你、还有哪条路能走。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '圣杯五逆位涉及消息、重联与旧关系重新出现。',
      plain: '试着联系一个仍能提供帮助的人，或把一件搁置的小事重新做起来。看清手里还剩什么。',
      direction: 'adjust',
    },
  },
  'cups-6': {
    upright: {
      traditional: '圣杯六以旧园和童年象征记忆、往事与熟悉的慰藉。',
      plain: '过去给你的安全感可以成为参考。想想你怀念的是那个人、那种环境，还是被支持的感受。',
      direction: 'verify',
    },
    reversed: {
      traditional: '圣杯六逆位在韦特体系中也指未来、更新与临近的新情境。',
      plain: '选一项从过去学到的东西带到现在试试。你可以保留经验，同时给新情况留出空间。',
      direction: 'advance',
    },
  },
  'cups-7': {
    upright: {
      traditional: '圣杯七以云中幻景象征想象、多重诱惑与尚未落地的愿景。',
      plain: '选项太多时，给每个选项加一个实际条件，例如花费多少或谁会参与。这样比较起来更容易。',
      direction: 'verify',
    },
    reversed: {
      traditional: '圣杯七逆位侧重意志、决断与把想象化为计划。',
      plain: '从眼前选项里挑出一个最值得验证的，写清要做的第一步。暂时把其他选项收起来。',
      direction: 'advance',
    },
  },
  'cups-8': {
    upright: {
      traditional: '圣杯八以离开杯阵的行者象征抽离旧投入与重新辨认价值。',
      plain: '以前很重要的事现在可能不再值得投入同样多的时间。算算继续下去的成本，再决定要不要调整。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '圣杯八逆位传统上也有喜悦与留恋，可读作重新审视离开的理由。',
      plain: '当你一边想离开、一边舍不得时，分别写下留下和离开的理由。看看什么条件会改变你的决定。',
      direction: 'verify',
    },
  },
  'cups-9': {
    upright: {
      traditional: '圣杯九象征满足、舒适与获得所期待的成果。',
      plain: '先承认眼下已经得到的好处。确认哪一部分值得保留，再考虑还想争取什么。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯九逆位的传统读法包括欠缺与判断误差。',
      plain: '得到想要的东西以后仍觉得空时，问问自己真正想改善的是哪一部分。把这一点当成下次选择的标准。',
      direction: 'verify',
    },
  },
  'cups-10': {
    upright: {
      traditional: '圣杯十以彩虹下的家庭象征归属、圆满与共享的安宁。',
      plain: '和你在乎的人聊聊大家认为什么状态算过得好。找到一个共同目标，再讨论各自能做什么。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯十逆位涉及表面安宁、愤懑与关系中的摩擦。',
      plain: '如果你们都在维持表面的和气，选一件相对好谈的事情，把真实感受说得具体一点。',
      direction: 'adjust',
    },
  },
  'cups-page': {
    upright: {
      traditional: '圣杯侍从以杯中鱼象征想象成形、消息与感受的萌芽。',
      plain: '可以先用一句简单的话表达自己的感受，看看对方怎么接。交流可以从很小的地方开始。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯侍从逆位涉及迷恋、诱引与不易辨明的讯息。',
      plain: '感受很强时容易替别人补上动机。先问清楚对方实际说了什么、答应了什么。',
      direction: 'verify',
    },
  },
  'cups-knight': {
    upright: {
      traditional: '圣杯骑士象征靠近、提议、邀约与想象驱动的行动。',
      plain: '如果有件事想邀请别人参加，把提议说具体一点。约个时间谈，比反复猜对方态度更容易得到答案。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯骑士逆位提示巧饰、言行不一与承诺的真实性。',
      plain: '好听的承诺可以先记下，接着看看有没有明确的安排和行动。判断时把两者放在一起。',
      direction: 'verify',
    },
  },
  'cups-queen': {
    upright: {
      traditional: '圣杯王后象征有洞察的关怀、情感理解与想象力。',
      plain: '先听清对方在感受什么，再说自己能帮到哪里。认真听和明确边界可以一起做到。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯王后逆位的传统说法分歧较多，可留意情感判断与信任的失衡。',
      plain: '如果别人的情绪让你很累，先分清哪些感受属于对方，哪些是你自己的。再决定你愿意帮多少。',
      direction: 'verify',
    },
  },
  'cups-king': {
    upright: {
      traditional: '圣杯国王象征责任、公平与对情感的稳健驾驭。',
      plain: '事情让你生气时，给自己一点时间再回应。等能说清事实、感受和请求时再谈。',
      direction: 'advance',
    },
    reversed: {
      traditional: '圣杯国王逆位提示情感处理失衡，判断可能受私心牵动。',
      plain: '如果你一会儿压住感受、一会儿突然发作，可以先记下触发点。找一个双方都比较平静的时机交流。',
      direction: 'adjust',
    },
  },

  'swords-ace': {
    upright: {
      traditional: '宝剑王牌以出云之剑象征决断、力量与辨明是非。',
      plain: '把问题写成一句清楚的话。列出你用来作判断的证据，再找一个最可能改变决定的事实。',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑王牌逆位提示决断失准或力量使用过度。',
      plain: '当你很想直接下结论时，先确认关键用词和信息。漏看一条条件，就可能把事情想成了另一回事。',
      direction: 'verify',
    },
  },
  'swords-2': {
    upright: {
      traditional: '宝剑二以蒙眼者平举双剑象征脆弱的平衡与僵持。',
      plain: '如果两个选择看起来差不多，先找出是哪条信息让你分不出好坏。只查这一条也有帮助。',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑二逆位涉及失信、误导与平衡受到破坏。',
      plain: '别人给出的消息互相矛盾时，先找原始记录或亲自问当事人。减少凭印象选边的机会。',
      direction: 'verify',
    },
  },
  'swords-3': {
    upright: {
      traditional: '宝剑三以穿心之剑象征分离、失望与情感创痛。',
      plain: '有件事让你失望时，先把具体是哪句话或哪件事说清楚。知道自己伤在哪里，才知道需要什么帮助。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '宝剑三逆位涉及纷乱、误解与创痛留下的干扰。',
      plain: '如果旧事反复影响眼下的判断，先找个安全的方式把它说出来。把过去的感受和今天发生的事分开。',
      direction: 'adjust',
    },
  },
  'swords-4': {
    upright: {
      traditional: '宝剑四以静卧祈祷的骑士象征退处、休息与沉静。',
      plain: '忙到想不清楚的时候，给自己留一段明确的休息时间。回来后先做一件最要紧的事。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '宝剑四逆位的传统含义包括审慎管理、节用与预防。',
      plain: '准备重新开始前，核对自己恢复了多少精力。把工作量调到接下来几天能承担的程度。',
      direction: 'verify',
    },
  },
  'swords-5': {
    upright: {
      traditional: '宝剑五呈现争斗后的失落与代价。',
      plain: '即使你在争论里占了上风，也可以想想这场争执消耗了什么。先决定有没有一件事值得修复。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '宝剑五逆位延续冲突的余波，侧重事后收束。',
      plain: '争执已经过去时，选一项能修补的具体问题，比如重新约定交付时间。关系可以慢慢处理。',
      direction: 'adjust',
    },
  },
  'swords-6': {
    upright: {
      traditional: '宝剑六以渡船象征路径、过渡与从一处前往另一处。',
      plain: '改变可以分段进行。先找一条能让你离开最消耗环节的路，走稳了再考虑更大的变化。',
      direction: 'advance',
    },
    reversed: {
      traditional: '宝剑六逆位的传统读法涉及公开陈述与难以回避的议题。',
      plain: '如果还有话没说清楚，换环境也可能把同样的问题带过去。先把关键条件谈清楚。',
      direction: 'verify',
    },
  },
  'swords-7': {
    upright: {
      traditional: '宝剑七象征谋划、尝试与策略可能落空。',
      plain: '先想想你的计划有哪些地方别人还不知道。涉及协作时，把需要对方配合的部分说清楚。',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑七逆位涉及忠告、议论与隐情逐渐被指出。',
      plain: '可以请一个了解情况的人帮你看计划，找出一处容易忽略的风险。听到传言时先找证据。',
      direction: 'verify',
    },
  },
  'swords-8': {
    upright: {
      traditional: '宝剑八以蒙眼受缚者象征受限、危机与暂时的束缚。',
      plain: '把你认为做不到的事分开看。哪一条是现实规定，哪一条只是自己以前没有试过？',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑八逆位涉及障碍变动与尚未解决的不安。',
      plain: '如果有一条限制已经松动，先用很小的动作试一试。看清楚现在的自由度，再决定要不要多走一步。',
      direction: 'adjust',
    },
  },
  'swords-9': {
    upright: {
      traditional: '宝剑九以夜间忧思象征焦虑、失望与反复困扰。',
      plain: '有些担忧会在脑子里越滚越大。写下最具体的一条，再和可信的人一起看看它实际有多可能。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '宝剑九逆位涉及疑虑、顾忌与难辨轻重的恐惧。',
      plain: '害怕时可以先核实一件最容易查到的小事。拿到答案之后，再判断其他担忧有多大的现实根据。',
      direction: 'verify',
    },
  },
  'swords-10': {
    upright: {
      traditional: '宝剑十呈现耗竭、痛苦与一个阶段的终结。',
      plain: '如果一件事已经消耗到难以继续，先减少损失并留出恢复的时间。再选还值得保留的一部分。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '宝剑十逆位有暂时缓解、短期优势与恢复迹象的读法。',
      plain: '刚缓过来时，先把有效的做法保留下来。慢一点增加投入，看看恢复是否能持续。',
      direction: 'adjust',
    },
  },
  'swords-page': {
    upright: {
      traditional: '宝剑侍从象征警觉、考察、消息与观察。',
      plain: '多问一个具体问题，或者找一份原始记录。新线索有价值，核实后才知道怎么用。',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑侍从逆位侧重准备不足与消息失真。',
      plain: '听到新消息先确认谁看到了什么。可以等事实清楚后再转述或作决定。',
      direction: 'verify',
    },
  },
  'swords-knight': {
    upright: {
      traditional: '宝剑骑士象征迅疾、勇敢与直面阻力的力量。',
      plain: '想推动一件事时，把要做什么和为什么说清楚。出发前给参与的人留一个提出异议的机会。',
      direction: 'advance',
    },
    reversed: {
      traditional: '宝剑骑士逆位涉及冒进、轻率与能力尚未配合速度。',
      plain: '着急做完时很容易跳过关键条件。先找一项容易引发返工的事检查，再继续行动。',
      direction: 'verify',
    },
  },
  'swords-queen': {
    upright: {
      traditional: '宝剑王后以高举的剑和经历过哀伤的神情象征清醒与界限。',
      plain: '试着把事实和感受一起说清楚。语气可以平和，要求仍然可以明确。',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑王后逆位提示刻薄、偏见与清晰判断被情绪扭曲。',
      plain: '想用一句狠话结束争执时，先改成对具体行为的描述。给对方一个能实际回应的问题。',
      direction: 'adjust',
    },
  },
  'swords-king': {
    upright: {
      traditional: '宝剑国王象征判断、权威与以理性行使责任。',
      plain: '在重要决定前，先把判断标准和需要的信息写出来。让相关的人知道结论是怎么得出的。',
      direction: 'verify',
    },
    reversed: {
      traditional: '宝剑国王逆位涉及权威失衡、严厉与不公。',
      plain: '当某个人的说法被默认正确时，检查它有没有证据支持。你也可以找一个相对独立的意见来对照。',
      direction: 'verify',
    },
  },

  'pentacles-ace': {
    upright: {
      traditional: '星币王牌象征物质条件、可用资源与丰足的起点。',
      plain: '手头如果有一个实际机会，找一种成本不高的方式试试。先确认它能带来什么，再决定投入多少。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币王牌逆位提示物质好处的另一面与条件未明。',
      plain: '机会看起来很划算时，算一遍需要自己付出的时间、金钱和责任。把说得清楚的条件留作比较依据。',
      direction: 'verify',
    },
  },
  'pentacles-2': {
    upright: {
      traditional: '星币二以无穷环中的两枚币象征往复、变动与资源的周转。',
      plain: '手上同时有几件事时，可以重新排一下先后顺序。给临时变化留一点余地。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '星币二逆位提示忙乱中维持表面从容，周转可能吃紧。',
      plain: '如果计划表已经没有空隙，选一件可以延期或缩小的事。先给最重要的任务腾出空间。',
      direction: 'adjust',
    },
  },
  'pentacles-3': {
    upright: {
      traditional: '星币三以工匠和建造工作象征专业技艺与协作。',
      plain: '看看谁擅长哪一部分，分好工，再用一次交付检查合作是否顺畅。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币三逆位涉及技艺发挥不足与协作质量下降。',
      plain: '遇到返工时，先问问大家理解的交付标准是不是一样。把其中一个模糊条件写清楚。',
      direction: 'adjust',
    },
  },
  'pentacles-4': {
    upright: {
      traditional: '星币四象征持守已有资源、占有与物质安全。',
      plain: '留一部分资源应对意外很实际。也可以检查你保留的东西里，哪些用一点就能改善现状。',
      direction: 'verify',
    },
    reversed: {
      traditional: '星币四逆位涉及延迟、僵持与守成带来的阻碍。',
      plain: '如果你因为担心失去而迟迟不动，先定一个可以接受的试错范围。只在这个范围里尝试。',
      direction: 'adjust',
    },
  },
  'pentacles-5': {
    upright: {
      traditional: '星币五以风雪中的行人象征物质匮乏与处境艰难。',
      plain: '资源不足时，先把最紧急的需要列出来。找一个能实际帮忙的人或渠道，直接提出具体请求。',
      direction: 'adjust',
    },
    reversed: {
      traditional: '星币五逆位提示资源失序与困境中的重新安排。',
      plain: '先检查哪些支出或义务可以暂缓。把得到的支持用在最需要稳定下来的那件事上。',
      direction: 'adjust',
    },
  },
  'pentacles-6': {
    upright: {
      traditional: '星币六以秤量后施予钱币象征给予、分配与互助。',
      plain: '在帮别人或接受帮助时，先说清资源怎么分、责任由谁承担。这样合作容易持续。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币六逆位涉及贪求、失衡与给予背后的动机。',
      plain: '接受帮助前，可以问清楚对方是否期待你之后做什么。也给自己留一个能拒绝的选择。',
      direction: 'verify',
    },
  },
  'pentacles-7': {
    upright: {
      traditional: '星币七以驻足凝视果实的形象象征经营中的投入与回顾。',
      plain: '做了一段时间后，给自己一个检查点。看看哪些投入已经产生效果，哪些部分需要改做法。',
      direction: 'verify',
    },
    reversed: {
      traditional: '星币七逆位涉及对资源投入及回报的忧虑。',
      plain: '如果越投入越没底，先比较实际收获和原来的目标。设一个停止追加的条件。',
      direction: 'verify',
    },
  },
  'pentacles-8': {
    upright: {
      traditional: '星币八象征工作、手艺与通过练习积累技能。',
      plain: '挑一个会影响成果的能力练起来，给自己设一个能看出进步的小目标。练完后拿具体作品来比较。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币八逆位提示虚耗的抱负或技艺用在了偏离目标的地方。',
      plain: '你可能把很多力气花在细节上。选一个最影响结果的环节，把时间先用在那里。',
      direction: 'adjust',
    },
  },
  'pentacles-9': {
    upright: {
      traditional: '星币九象征审慎经营后的安全、自主与成果。',
      plain: '看看手上已经有什么可以靠自己安排的资源。用已有成果换一点自由时间，或者试一个新方向。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币九逆位提示表面成果背后的失实或计划落空。',
      plain: '如果你为了维持独立而承担了额外成本，试着把这笔账算清。再决定哪些部分值得自己扛。',
      direction: 'verify',
    },
  },
  'pentacles-10': {
    upright: {
      traditional: '星币十以家族与宅院象征长期积累、家业与共同资源。',
      plain: '评估一个安排时，可以看看它能给你和身边的人提供怎样的长期支持。把需要大家共同维护的事讲清楚。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币十逆位涉及长期资源的不确定性与安排中的风险。',
      plain: '看起来稳定的条件，也值得问清谁负担长期成本、规则会不会变。把需要协商的事列出来。',
      direction: 'verify',
    },
  },
  'pentacles-page': {
    upright: {
      traditional: '星币侍从象征专注、学习与把资源用于实际准备。',
      plain: '如果想做的事还只在脑中，可以选一个入门任务。做完后，你就知道还需要学什么。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币侍从逆位提示资源分散、准备停滞或进度消息不佳。',
      plain: '准备了很久仍没开始时，缩小任务到一个晚上能做完的程度。用做出的东西检查方向。',
      direction: 'adjust',
    },
  },
  'pentacles-knight': {
    upright: {
      traditional: '星币骑士象征持久、尽责与循序落实。',
      plain: '你可以按固定节奏推进这件事。每次完成一点，并如实记录哪些承诺已经做到。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币骑士逆位侧重惰性、停滞与例行事务造成的僵化。',
      plain: '如果按同一套流程做了很久却没进展，选一步改一改。看看变更是否让结果更接近目标。',
      direction: 'adjust',
    },
  },
  'pentacles-queen': {
    upright: {
      traditional: '星币王后象征实际的照料、慷慨与安全感。',
      plain: '把可用的资源安排到最能改善日常的地方。照顾别人时，也给自己留出休息和补充的条件。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币王后逆位涉及安全感不足、疑虑与照料中的消耗。',
      plain: '如果你忙着维持周围人的安排，可以先留下一段只用来恢复自己的时间。再决定哪些事还要帮。',
      direction: 'adjust',
    },
  },
  'pentacles-king': {
    upright: {
      traditional: '星币国王象征实际经营、资源掌握与物质成果。',
      plain: '把你已经拥有的资源用到最能产生长期效果的地方。先定一个能跟踪的成果，再按进度调整。',
      direction: 'advance',
    },
    reversed: {
      traditional: '星币国王逆位提示物质控制失衡、判断受到利益牵制。',
      plain: '追求稳定和回报的时候，看看有没有别的条件被忽略。把质量、关系或生活节奏也放进比较里。',
      direction: 'verify',
    },
  },
};
