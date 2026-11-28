part of 'personal_report_page.dart';

typedef _RelationshipStyle = ({
  _ReportWords name,
  List<_ReportWords> fit,
  _ReportWords beginning,
  _ReportWords middle,
  _ReportWords ending,
  ({_ReportWords outward, _ReportWords inward, _ReportWords followUp})
  delayedReply,
});

const _relationshipStyles = <ReportGodGroup, _RelationshipStyle>{
  ReportGodGroup.peers: (
    name: ('并肩型恋人', 'A side-by-side partner'),
    fit: [
      ('坦诚', 'Candid'),
      ('愿意分担', 'Shares the load'),
      ('各有节奏', 'Has a life of their own'),
    ],
    beginning: (
      '从一起做事开始，遇到需要互相搭把手的时候，最容易看清彼此合不合拍。',
      'You often get closer through shared activity. How you help each other shows whether you fit.',
    ),
    middle: (
      '熟悉后愿意承担具体分工，也会希望两人各自保有同伴和兴趣。',
      'As you get closer, you share responsibilities and still want both people to keep their own friends and interests.',
    ),
    ending: (
      '当你发现总由自己撑住关系，可能先收回投入。试着说清你想要哪一种分担，再一起决定是否继续。',
      'When you feel you are carrying everything, you may pull back. Name the kind of help you need before deciding together what comes next.',
    ),
    delayedReply: (
      outward: ('先照常做自己的事。', 'Carry on with what you were doing.'),
      inward: (
        '你在意对方还愿不愿意主动联系。',
        'You wonder whether they will reach out on their own.',
      ),
      followUp: (
        '约好忙起来时怎样打招呼，对双方都公平。',
        'Agree on a way to check in when busy.',
      ),
    ),
  ),
  ReportGodGroup.expression: (
    name: ('体验型恋人', 'An experience-led partner'),
    fit: [
      ('回应感受', 'Responds to feelings'),
      ('愿意尝新', 'Tries new things'),
      ('把喜欢说出来', 'Expresses affection'),
    ],
    beginning: (
      '聊天有来有回、一起做新的事时，你会更快放松，也更愿意分享自己的感受。',
      'Lively conversation and something new to share help you relax and open up.',
    ),
    middle: (
      '进入日常后，你需要定期有一点可期待的小事，也希望平凡时的照顾能被看见。',
      'Once routines settle in, having small things to look forward to and having daily care noticed both matter.',
    ),
    ending: (
      '冷下来的互动会让你犹豫要不要继续。挑一个具体瞬间说出失落，再约一个彼此愿意投入的行动。',
      'When interaction cools, you may wonder whether to continue. Name one moment that felt disappointing and agree on a real effort you both want to make.',
    ),
    delayedReply: (
      outward: ('先另开一个轻松的话题。', 'Start with a different, lighter topic.'),
      inward: (
        '你更在意刚才的分享有没有被接住。',
        'You wonder whether your earlier message connected.',
      ),
      followUp: (
        '等对方空下来，再说当时想聊什么。',
        'Bring up what you wanted to talk about when they have time.',
      ),
    ),
  ),
  ReportGodGroup.wealth: (
    name: ('务实照顾型恋人', 'A practical, caring partner'),
    fit: [
      ('行动可靠', 'Follows through'),
      ('肯谈现实安排', 'Discusses shared plans'),
      ('有来有回', 'Reciprocal'),
    ],
    beginning: (
      '你会留意对方能不能把说过的话做出来，愿意从小安排里试着配合。',
      'You notice whether words turn into action and try cooperating on small plans.',
    ),
    middle: (
      '时间、金钱和家务逐渐进入相处。分工讲清以后，你更容易放心，也更愿意长期投入。',
      'As time, money and chores enter the picture, clear arrangements make it easier for you to commit.',
    ),
    ending: (
      '当实际负担持续失衡，你容易先盘算还有哪些做法可以改变。把想调整的安排逐条谈清，观察兑现情况。',
      'When responsibilities stay uneven, you look for a practical adjustment. Discuss specific changes and watch what follows through.',
    ),
    delayedReply: (
      outward: ('先核对时间和原先的约定。', 'Check the time and what you agreed on.'),
      inward: (
        '你担心原本的计划会不会被耽搁。',
        'You wonder whether the original plan is on hold.',
      ),
      followUp: (
        '把想联系的心情和必须确认的安排分开说。',
        'Separate your wish for contact from what you need to confirm.',
      ),
    ),
  ),
  ReportGodGroup.responsibility: (
    name: ('承诺型恋人', 'A commitment-minded partner'),
    fit: [
      ('守约', 'Dependable'),
      ('沟通变化', 'Explains changes'),
      ('共同担责', 'Shares responsibility'),
    ],
    beginning: (
      '你更愿意观察一段时间，看看对方在不同场合是否一致，再逐步承诺。',
      'You like to see someone across different situations before making a commitment.',
    ),
    middle: (
      '把关系认真放进日程后，你可能主动照料许多细节。记得询问对方想要怎样的参与方式。',
      'Once a relationship is part of your routine, you may handle many details. Ask how the other person wants to take part.',
    ),
    ending: (
      '遇到反复失约时，你会认真考虑是否退出。先把可以修复的部分和彼此的底线说清楚。',
      'Repeated broken agreements make you reconsider. Talk about what is repairable and what each person absolutely needs.',
    ),
    delayedReply: (
      outward: ('提醒自己对方可能正在忙。', 'Remind yourself they might be busy.'),
      inward: (
        '你还是在意原先的约定会不会兑现。',
        'You still care whether the original agreement will be kept.',
      ),
      followUp: (
        '说清这次最需要确认的是什么，再听听对方的情况。',
        'Say what you need confirmed, then hear what happened.',
      ),
    ),
  ),
  ReportGodGroup.learning: (
    name: ('理解型恋人', 'A reflective partner'),
    fit: [
      ('认真倾听', 'Listens carefully'),
      ('表达清楚', 'Communicates clearly'),
      ('尊重独处', 'Makes room for solitude'),
    ],
    beginning: (
      '会先听对方怎样说自己的经历，慢慢在安全的互动里积累亲近感。',
      'You listen to how someone talks about their life and build closeness through interactions that feel safe.',
    ),
    middle: (
      '越亲近越容易感觉到对方的变化，也更需要一点消化感受的时间。',
      'Growing closer makes shifts easier to notice and gives you more to process in private.',
    ),
    ending: (
      '当感受长期说不清，你可能转向独处。选一件有代表性的事谈起，让对方知道你正在经历什么。',
      'When feelings stay hard to voice, you may retreat. Start with one example so your partner knows what you are experiencing.',
    ),
    delayedReply: (
      outward: (
        '暂时安静下来，回想上一句对话。',
        'Get quiet for a moment and replay the last exchange.',
      ),
      inward: ('你想弄清自己是不是漏掉了什么。', 'You wonder whether you missed something.'),
      followUp: (
        '写下确定的事实和你的担心，再问一个清楚的问题。',
        'Separate what you know from what you fear, then ask one clear question.',
      ),
    ),
  ),
};

typedef _StudyPersonality = ({
  _ReportWords tag,
  _ReportWords mode,
  _ReportWords attitude,
  _ReportWords challenge,
  _ReportWords practice,
});

const _studyPersonalities = <ReportGodGroup, _StudyPersonality>{
  ReportGodGroup.peers: (
    tag: ('同伴练习', 'Practice with peers'),
    mode: (
      '独立做完一轮，再和水平相近的同伴交换思路。共做一个小项目能让你的理解变扎实。',
      'Work through one round alone, then compare approaches with peers. A small project together can deepen understanding.',
    ),
    attitude: (
      '能自己定节奏、看见练习成果时，你更愿意认真持续。过于单向的要求容易让你失去投入感。',
      'You put in steady effort when you set the pace and see progress. One-way instructions may feel less engaging.',
    ),
    challenge: (
      '容易在卡住后仍坚持独自找答案。提前约好哪一类问题可以交换思路，会减少无谓消耗。',
      'You may keep working alone after getting stuck. Decide in advance which questions to bring to a peer.',
    ),
    practice: (
      '选一道同水平的题，各自先交一份答案，再比较两种做法的效率和错误。',
      'Solve a problem separately, then compare where each approach was efficient or went wrong.',
    ),
  ),
  ReportGodGroup.expression: (
    tag: ('输出带动学习', 'Learn by making'),
    mode: (
      '从例子和应用切入，通过讲出来、画出来或动手做，把学习变成自己的作品。',
      'Start with examples and turn what you learn into a talk, sketch or small thing you can make.',
    ),
    attitude: (
      '有好奇心和反馈时投入很快。你会更愿意练习马上看得到用途的方法。',
      'Curiosity and feedback draw you in quickly, especially when you can see what a tool is for.',
    ),
    challenge: (
      '容易跳过枯燥但必要的基础。把每次练习限制在一个技能点，并用它完成一小部分作品。',
      'You may skip a dull but necessary foundation. Practice one skill at a time and apply it to part of a project.',
    ),
    practice: (
      '学完一个概念用三句话讲给别人听，然后做一个能展示它的小例子。',
      'Explain one concept in three sentences, then make an example that shows it working.',
    ),
  ),
  ReportGodGroup.wealth: (
    tag: ('问题驱动', 'Learn through a problem'),
    mode: (
      '先定一个要解决的实际问题，再按任务补知识，适合案例、实验和成果导向的学习。',
      'Choose a real problem first and learn what the task requires through cases and experiments.',
    ),
    attitude: (
      '理解知识能用在哪里时，你更愿意反复练。回报模糊的内容需要一个清楚的小目标。',
      'Seeing a use encourages deliberate practice. For an abstract subject, name a concrete short-term goal.',
    ),
    challenge: (
      '容易把短期用不上和长期价值混为一谈。留一段专门练原理的时间，再检验实际用途。',
      'An idea without immediate payoff can still matter. Set aside time for fundamentals and test where they help.',
    ),
    practice: (
      '带着一个生活案例学习，把结果写成步骤、成本和可检查的指标。',
      'Learn around a real case and record the steps, costs and what you can verify.',
    ),
  ),
  ReportGodGroup.responsibility: (
    tag: ('有框架地练', 'Structured practice'),
    mode: (
      '清楚的进度、示范和定期检查能帮你稳定学习。先跟老师建立框架，再独立练习。',
      'A clear schedule, examples and feedback help you learn steadily. Build a framework with a teacher, then practice independently.',
    ),
    attitude: (
      '答应要完成的事通常会认真做。在节奏太紧时，你也容易把一次失误看得比它实际更重。',
      'You take commitments seriously. On a tight schedule, one mistake may feel bigger than it is.',
    ),
    challenge: (
      '过于追求一次做对会挤掉试错空间。用低风险练习暴露问题，把考核放在后面。',
      'Trying to get it right immediately can crowd out experimentation. Start with low-stakes practice and assess later.',
    ),
    practice: (
      '每周做一组不计分的练习，选一个常见错误写下修正方法。',
      'Do one ungraded exercise a week and record how to fix a recurring error.',
    ),
  ),
  ReportGodGroup.learning: (
    tag: ('深挖原理', 'Understand the principles'),
    mode: (
      '适合先自学找线索，再向熟悉这门学科的人求证。笔记、分类和回看有助于建立自己的理解。',
      'Explore independently, then compare your conclusions with someone who knows the subject. Notes and review develop your own understanding.',
    ),
    attitude: (
      '越能理解来龙去脉越愿意专注。遇到大量碎片信息，你往往要先整理好才能进入状态。',
      'Context supports your focus. When information is fragmented, organizing it helps you get started.',
    ),
    challenge: (
      '可能一直在收集资料，很晚才开始运用。给阅读设一个结束点，拿一道题检查理解。',
      'Gathering sources can delay using them. Stop reading at a chosen point and test your understanding on a problem.',
    ),
    practice: (
      '把一页内容整理成一张概念图，再关掉资料复述它和其他主题的联系。',
      'Turn a page into a concept map. Close the source and explain how it connects to another topic.',
    ),
  ),
};

const _selfPerceptions = <ReportGodGroup, _ReportWords>{
  ReportGodGroup.peers: (
    '你容易把自己看成能拿主意、可以靠得住的人。愿意接住支持，也能保有判断和主动。',
    'You may see yourself as dependable and able to decide. Accepting help can go with keeping initiative.',
  ),
  ReportGodGroup.expression: (
    '你容易用作品、表达和别人是否听懂来认识自己。完成一件小事，也能确认自己的能力。',
    'You get to know yourself through what you make and communicate. Finishing one small piece can affirm your ability.',
  ),
  ReportGodGroup.wealth: (
    '你常用事情有没有做成、资源有没有用好来评价自己。也给在积累的能力一个清楚的尺度。',
    'You may judge yourself by results and how well you used resources. Give skills that are still growing a clear measure too.',
  ),
  ReportGodGroup.responsibility: (
    '你希望自己值得信任，容易把承担的职责看得很重。定期盘点哪些是自己选择的，哪些可以协商。',
    'You want to be trusted and take your duties seriously. Review which are yours by choice and which can be discussed.',
  ),
  ReportGodGroup.learning: (
    '你常从自己是否理解透彻来判断准备程度。用一次轻量的尝试看看，已经掌握的部分能做到什么。',
    'You often judge readiness by understanding. A small trial can show what you already know enough to do.',
  ),
};

typedef _IncomeStyle = ({
  _ReportWords headline,
  _ReportWords steady,
  _ReportWords variable,
  _ReportWords convert,
  _ReportWords risk,
});

const _incomeStyles = <ReportGodGroup, _IncomeStyle>{
  ReportGodGroup.peers: (
    headline: ('靠技能和合作累积', 'Build through skills and collaboration'),
    steady: (
      '先用可独立交付的技能建立稳定来源。稳定岗位、重复服务或长期客户都有利于累积口碑。',
      'A skill you can deliver independently supports steady roles, repeat services and lasting client relationships.',
    ),
    variable: (
      '合伙和共同项目可带来额外机会。工期、付款节点和分账先讲清，才知道自己真正留下多少。',
      'Joint projects can add income. Clarify deadlines, payment milestones and how proceeds are divided.',
    ),
    convert: (
      '把同伴口碑转成明确的项目范围与成果记录，可以减少下一次合作从头说起的成本。',
      'Turn recommendations into a defined scope and a record of outcomes so the next project can start faster.',
    ),
    risk: (
      '容易为了关系多承担费用或人工。把照顾别人的部分列出来，再看个人预算是否承受得住。',
      'Relationships can lead you to absorb extra expenses or work. Write those down and compare them with your own budget.',
    ),
  ),
  ReportGodGroup.expression: (
    headline: ('把作品变成持续收入', 'Turn work into recurring value'),
    steady: (
      '可以从固定交付、长期内容或成熟服务入手，让作品有稳定的发布和反馈渠道。',
      'Look for regular deliverables, ongoing content or a mature service with a reliable route to an audience.',
    ),
    variable: (
      '创作和项目收入容易随需求变动。把一次灵感整理成可以反复使用的作品或服务。',
      'Creative and project income can vary with demand. Give one idea a form that can be used more than once.',
    ),
    convert: (
      '整理作品、训练过程和具体效果，把已经验证的能力变成样例、模板或服务。',
      'Package verified skills as examples, templates or services with visible outcomes.',
    ),
    risk: (
      '对能打开新体验的支出比较愿意尝试。采购前先把准备用在哪个项目上写下来。',
      'New experiences can be attractive purchases. Before buying, name the project they will support.',
    ),
  ),
  ReportGodGroup.wealth: (
    headline: ('靠资源匹配与交付', 'Match resources to delivery'),
    steady: (
      '适合能看到交付与回款的收入方式，例如持续运营、专业服务或能量化产出的岗位。',
      'Ongoing operations and services with measurable delivery and payment can suit you.',
    ),
    variable: (
      '你能敏锐察觉零散机会。把项目收入分成已经确认、等待回款和仍在谈三栏。',
      'You notice emerging opportunities. Track what is confirmed, outstanding and still being discussed.',
    ),
    convert: (
      '把人脉和经验用在真实需求上，核对谁愿意付费、什么算交付、回款要等多久。',
      'Use contacts and experience to meet a real need. Check who pays, what counts as delivery and how long payment takes.',
    ),
    risk: (
      '你在意回报速度。把估计的收益、必须付出的成本和未确认的承诺放在同一张清单里比较。',
      'You notice time to return. Compare expected income, required costs and unconfirmed promises on one list.',
    ),
  ),
  ReportGodGroup.responsibility: (
    headline: ('把稳定责任转成回报', 'Translate steady responsibility into value'),
    steady: (
      '职责清晰的岗位、可复用流程和经过长期验证的服务，更容易形成稳定的收入基础。',
      'Clearly owned roles, reusable processes and well-tested services can support stable income.',
    ),
    variable: (
      '增加职责往往也增加隐性工时。接额外项目时，先把新范围和报酬说清。',
      'Additional responsibilities often add hidden hours. Clarify scope and compensation before taking on more.',
    ),
    convert: (
      '把常年解决的问题沉淀成工作方法和成果记录，让已有经验可以被团队重复采用。',
      'Turn recurring solutions into documented methods and results a team can reuse.',
    ),
    risk: (
      '容易优先守住承诺，把自己的时间和休息少算了。定价或分工前，把这些成本也列进去。',
      'Keeping promises can lead you to undercount your time and rest. Include them when discussing rates and roles.',
    ),
  ),
  ReportGodGroup.learning: (
    headline: ('把知识变成可用成果', 'Make knowledge useful'),
    steady: (
      '依靠研究、整理和方法建设建立专业性。稳定输出可核实的成果，比不断扩大知识范围更容易积累。',
      'Build expertise through research and sound methods. A stream of verifiable results helps it compound.',
    ),
    variable: (
      '顾问、教学和知识产品都可以小范围试做。先看有谁愿意为哪个具体问题付费。',
      'Test consulting, teaching or a knowledge product on a small scale. Find who has a specific problem they would pay to solve.',
    ),
    convert: (
      '把学过的工具用在一个实际任务里，留下可展示的过程、案例和结果。',
      'Apply a tool to a real task and keep examples of the process and outcome.',
    ),
    risk: (
      '容易为下一个可能的方向提前购买课程或资料。把已经拥有的资源先用一次，再判断缺口。',
      'You may buy learning material for a possible future direction. Use one thing you already own before deciding what is missing.',
    ),
  ),
};
