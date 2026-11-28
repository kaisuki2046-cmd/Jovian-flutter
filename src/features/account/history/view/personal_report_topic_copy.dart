part of 'personal_report_page.dart';

enum _ReportTopic {
  overview('综述', Icons.auto_awesome_outlined, Color(0xffa88a59)),
  love('情感', Icons.favorite_border_rounded, Color(0xffbb718e)),
  work('事业', Icons.work_outline_rounded, Color(0xff6a91ad)),
  wealth('财富', Icons.currency_yen_rounded, Color(0xffa78551)),
  study('学业', Icons.menu_book_outlined, Color(0xff729888));

  const _ReportTopic(this.label, this.icon, this.tone);

  final String label;
  final IconData icon;
  final Color tone;
}

typedef _ProfileLens = ({
  List<_ReportWords> tags,
  _ReportWords drive,
  _ReportWords friction,
  _ReportWords habit,
  _ReportWords support,
});

const _profileLenses = <ReportGodGroup, _ProfileLens>{
  ReportGodGroup.peers: (
    tags: [
      ('自持', 'Self-directed'),
      ('看重平等', 'Values equality'),
      ('与同伴并肩', 'Peer-oriented'),
      ('行动有主见', 'Decisive'),
    ],
    drive: (
      '先听自己的判断，再找愿意并肩做事的人。关系中比起客套，你更看重说话坦诚和分工清楚。',
      'You tend to trust your own judgment first, then look for people who will work alongside you. Candor and clear roles matter to you.',
    ),
    friction: (
      '独立能让你撑住局面，也容易把求助推迟到累的时候。越是亲近的人，越适合早一点说出需要。',
      'Independence helps you hold things together and can delay asking for help. Say what you need earlier with people close to you.',
    ),
    habit: (
      '有分歧时，先约定彼此都想达成的事，再谈各自愿意承担什么。',
      'In a disagreement, agree on the outcome you both want before dividing responsibilities.',
    ),
    support: (
      '适合与你并肩实践、敢说不同意见，也愿意商量分工的人。',
      'Look for peers who will try things with you, offer a different view and negotiate roles.',
    ),
  ),
  ReportGodGroup.expression: (
    tags: [
      ('善表达', 'Expressive'),
      ('有感受力', 'Perceptive'),
      ('乐于尝试', 'Experimental'),
      ('重视体验', 'Experience-led'),
    ],
    drive: (
      '容易从细节里感到变化，也愿意把灵感做出来。作品、分享和共同体验往往是交流的起点。',
      'You notice changes in the details and like making ideas tangible. Sharing a work or an experience is often how conversation starts.',
    ),
    friction: (
      '好奇心带来很多开头，重复打磨时却容易失去兴趣。少开一条线，能给真正喜欢的事多一次完成的机会。',
      'Curiosity creates plenty of beginnings. Repetitive polishing can feel less appealing. Start fewer things and give a favorite idea time to finish.',
    ),
    habit: (
      '把想法写成一个小作品，约定展示和反馈的时间。',
      'Give an idea a small finished form and decide when to share it and get feedback.',
    ),
    support: (
      '适合愿意认真反馈、给你空间试做，也能一起把事情收尾的人。',
      'Seek people who give thoughtful feedback, make room for experiments and help finish what you start.',
    ),
  ),
  ReportGodGroup.wealth: (
    tags: [
      ('务实', 'Pragmatic'),
      ('整合资源', 'Connects resources'),
      ('重视回馈', 'Values reciprocity'),
      ('爱把计划落地', 'Makes plans concrete'),
    ],
    drive: (
      '会留意手里已有的资源和现实回报，希望把想法落实成看得见的改变。',
      'You watch what resources are available and what a plan can return. Visible progress makes ideas feel worthwhile.',
    ),
    friction: (
      '重视结果时容易把回报等同于自身价值。遇到短期看不到成效的事，最好约定阶段目标再检查。',
      'An emphasis on results can make returns feel like a measure of self-worth. For slower projects, agree on intermediate milestones before judging the outcome.',
    ),
    habit: (
      '说清时间、成本和交付，再决定投入多少。',
      'Clarify time, cost and delivery before committing resources.',
    ),
    support: (
      '适合懂实务、肯共享经验又能明确约定的人。',
      'Look for practical people who share experience and make clear agreements.',
    ),
  ),
  ReportGodGroup.responsibility: (
    tags: [
      ('有责任感', 'Responsible'),
      ('重视秩序', 'Orderly'),
      ('善于推进', 'Follows through'),
      ('看重承诺', 'Values commitments'),
    ],
    drive: (
      '容易留心规则、责任和节奏。目标清楚时，你往往能把复杂的事情推进下去。',
      'You notice rules, responsibilities and pacing. A clear objective helps you carry a complicated effort forward.',
    ),
    friction: (
      '重视承诺也可能把小失误看得太重。约清哪些要求必须做到，哪些可以留给试错。',
      'Commitment can make small mistakes feel bigger than they are. Agree on what is required and where there is room to experiment.',
    ),
    habit: (
      '通过几次有边界的试做来核对标准，不必一开始把自己压得太紧。',
      'Test the standard through a bounded trial before putting yourself under sustained pressure.',
    ),
    support: (
      '适合守约、能给明确反馈并愿意授权的人。',
      'Seek people who keep agreements, give clear feedback and share responsibility.',
    ),
  ),
  ReportGodGroup.learning: (
    tags: [
      ('喜欢理解透彻', 'Looks for explanations'),
      ('善整理', 'Organizes ideas'),
      ('独立观察', 'Observant'),
      ('需要思考空间', 'Needs reflection time'),
    ],
    drive: (
      '习惯先收集线索、弄清来龙去脉，再用自己的方式理解问题。',
      'You tend to collect clues and context before framing a problem in your own way.',
    ),
    friction: (
      '准备得很充分时也可能迟迟不交出第一版。把需要确认的问题减到最关键的两三个。',
      'Preparation can keep a first draft from seeing daylight. Reduce the things you still need to confirm to the few that matter most.',
    ),
    habit: (
      '用一次试做或讲解来验证自己理解了什么。',
      'Use a small application or explanation to verify what you understand.',
    ),
    support: (
      '适合愿意分享方法、认真回答问题和就成果给建议的导师或朋友。',
      'Look for mentors and friends who share methods, answer questions thoughtfully and give feedback on work.',
    ),
  ),
};

const _themeWeights = <_ReportTopic, List<double>>{
  _ReportTopic.overview: [1, 1, 1, 1, 1],
  _ReportTopic.love: [.80, 1.02, 1.23, 1.16, .78],
  _ReportTopic.work: [.86, 1.03, 1.08, 1.27, .89],
  _ReportTopic.wealth: [.66, 1.04, 1.39, .93, .72],
  _ReportTopic.study: [.81, 1.16, .60, .85, 1.39],
};

ReportGodGroup? _leadingGroup(PersonalReportData data, _ReportTopic topic) {
  if (data.gods.isEmpty) return null;
  final weights = _themeWeights[topic]!;
  return ReportGodGroup.values.reduce(
    (left, right) =>
        data.groupShare(right) * weights[right.index] >
            data.groupShare(left) * weights[left.index]
        ? right
        : left,
  );
}

typedef _LoveLens = ({
  _ReportWords give,
  _ReportWords receive,
  _ReportWords fit,
  _ReportWords tension,
  _ReportWords scene,
});

const _loveLenses = <ReportGodGroup, _LoveLens>{
  ReportGodGroup.peers: (
    give: (
      '愿意一起做事，也会给对方自己的空间。',
      'You show care by doing things together and giving each other space.',
    ),
    receive: (
      '希望对方主动回应，也尊重你的节奏和决定。',
      'You value active responses and respect for your pace and decisions.',
    ),
    fit: (
      '说话坦诚、愿意分担，也有自己的生活。',
      'Someone candid, willing to share responsibilities and comfortable with a life of their own.',
    ),
    tension: (
      '意见不同时，两个人可能都等对方先松口。问一句「我们各自在意的是什么」会更容易破冰。',
      'When you disagree, each person may wait for the other to yield. Ask what matters most to each of you.',
    ),
    scene: (
      '对方没回消息时，给彼此一点时间，再直接告诉对方你需要一个大致的回复时间。',
      'If a message goes unanswered, give it some room, then say when you would appreciate an update.',
    ),
  ),
  ReportGodGroup.expression: (
    give: (
      '会用分享、玩笑和共同体验传递喜欢。',
      'You tend to show affection through sharing, humor and experiences together.',
    ),
    receive: (
      '希望感受有人回应，也喜欢对方主动安排一点新鲜体验。',
      'You want someone to respond to your feelings and sometimes initiate a new experience.',
    ),
    fit: (
      '能聊感受，也愿意把喜欢落实到日常行动的人。',
      'Someone who talks about feelings and follows through in everyday life.',
    ),
    tension: (
      '新鲜感过去后，两人需要发明新的日常。把想尝试的活动列在一起，轮流挑一样。',
      'When novelty fades, build shared routines. List things you want to try and take turns choosing one.',
    ),
    scene: (
      '想分享的事被打断时，可以先说「我想把这件事讲完」，再听对方的感受。',
      'If a story is interrupted, say you would like to finish it, then make room for the other person’s response.',
    ),
  ),
  ReportGodGroup.wealth: (
    give: (
      '会用落实计划、照顾实际需要来表达喜欢。',
      'Making plans happen and noticing practical needs are ways you show affection.',
    ),
    receive: (
      '看重持续行动与相互回馈，希望未来的安排可以讲清楚。',
      'You value reliable effort, reciprocity and a candid discussion of the future.',
    ),
    fit: (
      '愿意负责、能讨论生活安排和彼此边界的人。',
      'Someone who follows through and can discuss shared plans and boundaries.',
    ),
    tension: (
      '忙着解决事情时容易漏掉伴侣想被听见的感受。先确认对方现在想讨论方案，还是想被陪一下。',
      'Solving the problem can miss the wish to be heard. Ask whether they want to explore options or simply have company first.',
    ),
    scene: (
      '安排约会前，先交流各自在意的预算、时间和体验，再做共同选择。',
      'Before making a plan together, compare the budget, time and experience each person wants.',
    ),
  ),
  ReportGodGroup.responsibility: (
    give: (
      '你容易用守约和给予安全感来表达爱。',
      'You are likely to show love by keeping commitments and providing steadiness.',
    ),
    receive: (
      '需要关系里有清楚的态度、承诺和稳定的联系。',
      'A clear stance, dependable commitments and regular contact matter to you.',
    ),
    fit: (
      '可靠守时，也愿意沟通变化和调整的人。',
      'Someone dependable who is also willing to talk about change.',
    ),
    tension: (
      '把承诺看得很重时，容易用同一标准衡量两个人。遇到变化先问对方发生了什么，再谈新约定。',
      'When commitments matter deeply, you may judge both people by one standard. Find out what changed before making a new agreement.',
    ),
    scene: (
      '对方临时改计划时，说清哪部分影响了你，再一起敲定一个可行的新时间。',
      'When plans change, name how it affects you and find a workable new time together.',
    ),
  ),
  ReportGodGroup.learning: (
    give: (
      '愿意先听清对方的处境，再用陪伴和具体帮助回应。',
      'You like to understand the other person before offering company or practical help.',
    ),
    receive: (
      '想要体贴的倾听，也需要独处整理情绪的时间。',
      'You appreciate thoughtful listening and time alone to process feelings.',
    ),
    fit: (
      '能认真倾听、表达明确，也尊重安静空间的人。',
      'Someone who listens carefully, speaks clearly and respects quiet time.',
    ),
    tension: (
      '反复揣测容易让一个小信号变得很重。把看到的事实和自己的担心分开说。',
      'Replaying a small signal can give it more weight. Separate what you saw from what you are worried about.',
    ),
    scene: (
      '需要独处时说明多久后再聊，可以让空间和关心同时存在。',
      'When you need space, say when you will be ready to talk again.',
    ),
  ),
};

typedef _WorkLens = ({
  _ReportWords role,
  _ReportWords field,
  _ReportWords wants,
  _ReportWords block,
});

const _workLenses = <ReportGodGroup, _WorkLens>{
  ReportGodGroup.peers: (
    role: ('协作型推动者', 'Collaborative driver'),
    field: (
      '项目协作、运营、社群与需要自主决策的岗位',
      'Project delivery, operations, community work and roles with autonomy',
    ),
    wants: ('明确的自主权和平等对话', 'Autonomy and equal dialogue'),
    block: (
      '反复争论谁决定时，先确认职责和最终拍板的人。',
      'When ownership is disputed, confirm responsibilities and who makes the final call.',
    ),
  ),
  ReportGodGroup.expression: (
    role: ('创意与表达者', 'Creative communicator'),
    field: (
      '内容、设计、产品体验、表达与技能型工作',
      'Content, design, product experience, communication and craft',
    ),
    wants: ('可以先试做再调整的空间', 'Space to try things and refine them'),
    block: (
      '想法过多时，用一个可验证的版本换取真实反馈。',
      'When ideas pile up, ship a testable version and get feedback.',
    ),
  ),
  ReportGodGroup.wealth: (
    role: ('资源整合者', 'Resource integrator'),
    field: (
      '业务开发、运营交付、商业分析和资源配置',
      'Business development, operational delivery, analysis and resourcing',
    ),
    wants: ('实际回报和清楚的交付条件', 'Tangible returns and clear delivery terms'),
    block: (
      '目标短期回报不清时，给投入设上限并安排复盘。',
      'When near-term returns are unclear, cap the initial commitment and schedule a review.',
    ),
  ),
  ReportGodGroup.responsibility: (
    role: ('结构与执行者', 'Structured executor'),
    field: (
      '流程管理、质量管控、统筹和需要承担责任的岗位',
      'Process management, quality, coordination and work with clear ownership',
    ),
    wants: ('稳定授权和可衡量的职责', 'Stable authority and measurable responsibilities'),
    block: (
      '压力集中时，优先删减并明确哪些任务需要他人分担。',
      'When pressure piles up, cut low-priority work and say what needs to be shared.',
    ),
  ),
  ReportGodGroup.learning: (
    role: ('分析与研究者', 'Analyst and researcher'),
    field: (
      '研究、数据、知识服务与方法建设',
      'Research, data, knowledge services and method development',
    ),
    wants: ('深入理解、有时间积累', 'Time to understand and build mastery'),
    block: (
      '信息越多越难行动时，把结论压缩成一条可以试做的假设。',
      'When more information is slowing you down, reduce the conclusion to a hypothesis you can test.',
    ),
  ),
};

typedef _WealthLens = ({
  _ReportWords earning,
  _ReportWords returns,
  _ReportWords leakLabel,
  _ReportWords leak,
  _ReportWords guard,
});

const _wealthLenses = <ReportGodGroup, _WealthLens>{
  ReportGodGroup.peers: (
    leakLabel: ('人情与共同开支', 'Favors and shared expenses'),
    earning: (
      '通过协作做项目，把个人技能和互补资源合起来。',
      'Combine your skills with complementary resources on shared projects.',
    ),
    returns: (
      '看重劳动、风险与收益的分配是否公平。',
      'You care whether effort, risk and returns are shared fairly.',
    ),
    leak: (
      '朋友、同伴或人情支出容易变成没有上限的承诺。',
      'Shared expenses and favors can turn into open-ended commitments.',
    ),
    guard: (
      '先约好分工、金额和结束条件，再开始共同项目。',
      'Agree on roles, amounts and exit conditions before a shared project.',
    ),
  ),
  ReportGodGroup.expression: (
    leakLabel: ('工具与体验支出', 'Tools and experiences'),
    earning: (
      '把作品、内容或可重复的手艺变成能按期交付的服务。',
      'Package work, content or a repeatable skill as something you can deliver on schedule.',
    ),
    returns: (
      '愿意为体验和工具付费，也容易被新尝试吸引。',
      'You value tools and experiences and can be drawn to novel experiments.',
    ),
    leak: (
      '为一时灵感反复买工具，或低估作品的制作成本。',
      'Buying tools for a passing idea or underestimating production costs.',
    ),
    guard: (
      '给新尝试定小额度，先用手上的条件交付一版。',
      'Set a small allowance for experiments and make a first delivery with what you already have.',
    ),
  ),
  ReportGodGroup.wealth: (
    leakLabel: ('未落实的收入与承诺', 'Unconfirmed income and commitments'),
    earning: (
      '把稳定交付与对资源的判断结合，先做能反复验证的收入来源。',
      'Combine reliable delivery and resource judgment, starting with work that can be verified repeatedly.',
    ),
    returns: (
      '倾向于看清成本、回收周期和可用现金。',
      'You tend to look at cost, timing of returns and available cash.',
    ),
    leak: (
      '把未落实的机会提前算成收入，或同时承诺太多项目。',
      'Counting unconfirmed opportunities as income or committing to too many projects.',
    ),
    guard: (
      '分开记录已到账、已约定和只是可能的收入。',
      'Record received, committed and merely possible income separately.',
    ),
  ),
  ReportGodGroup.responsibility: (
    leakLabel: ('超额承诺的隐性成本', 'The hidden cost of overcommitting'),
    earning: (
      '用职责明确、可以持续积累经验的工作做立足点。',
      'Build from work with clear responsibilities and room to accumulate experience.',
    ),
    returns: (
      '更在意可预测性与回报是否匹配承担的责任。',
      'You value predictability and returns that match responsibility.',
    ),
    leak: (
      '责任越多、越容易忽略时间与恢复的成本。',
      'Taking on responsibilities can hide the cost of time and recovery.',
    ),
    guard: (
      '新增承诺时重新核算时间、费用和分工。',
      'Reassess time, costs and responsibilities before taking on more.',
    ),
  ),
  ReportGodGroup.learning: (
    leakLabel: ('买了却没用上的课程与资料', 'Unused courses and materials'),
    earning: (
      '把熟悉的知识慢慢整理成可交付的方法或服务。',
      'Turn knowledge you know well into methods or services someone can use.',
    ),
    returns: (
      '愿意为能力积累付出，回报偏好可以慢一点但看得见。',
      'You may accept slower, visible returns from building skills.',
    ),
    leak: (
      '囤很多课程或资料，学完后没有安排实际应用。',
      'Collecting courses and materials without making time to apply them.',
    ),
    guard: (
      '付费前先写下一个准备在近期完成的应用任务。',
      'Name one task you will apply the learning to before paying for it.',
    ),
  ),
};

typedef _StudyChoice = ({
  _ReportWords label,
  _ReportWords note,
  _ReportWords tryThis,
  List<double> weights,
});

const _studyChoices = <_StudyChoice>[
  (
    label: ('人文与表达', 'Humanities and expression'),
    note: (
      '写作、传播、语言和把抽象想法讲清楚的训练。',
      'Writing, communication, languages and explaining abstract ideas.',
    ),
    tryThis: (
      '写一篇面向陌生读者的短文，请对方复述读到的重点。',
      'Write a short piece for a new reader and ask what they understood.',
    ),
    weights: [.7, 1.3, .3, .4, 1],
  ),
  (
    label: ('研究与数据', 'Research and data'),
    note: (
      '通过观察、实验和证据，把问题拆成可验证的步骤。',
      'Break questions into testable steps with observation, experiments and evidence.',
    ),
    tryThis: (
      '挑一个感兴趣的问题收集小样本，检验原来的猜想。',
      'Collect a small sample about a question you care about, then test your first guess.',
    ),
    weights: [.4, .55, .72, .95, 1.45],
  ),
  (
    label: ('设计与应用', 'Design and application'),
    note: (
      '用原型、作品或实作练习，把构想做成能体验的成果。',
      'Make ideas tangible through prototypes, portfolios or hands-on practice.',
    ),
    tryThis: (
      '从日常找一个不方便的地方，做一版能试用的改进。',
      'Find a small everyday inconvenience and make an improvement someone can try.',
    ),
    weights: [.75, 1.40, .70, .39, .69],
  ),
  (
    label: ('组织与运营', 'Organization and operations'),
    note: (
      '练习安排资源、与人协作，并衡量实际交付。',
      'Practice organizing resources, collaborating and measuring delivery.',
    ),
    tryThis: (
      '和同伴办一次小活动，记录分工、预算和结果。',
      'Plan a small event with peers and record roles, budget and outcome.',
    ),
    weights: [1.25, .39, 1.25, 1.12, .35],
  ),
  (
    label: ('工程与实践', 'Engineering and practice'),
    note: (
      '沿着规则或流程做项目，用反复验证提升准确度。',
      'Work through rules or processes and improve accuracy by testing repeatedly.',
    ),
    tryThis: (
      '复现一个小装置或流程，逐次记录哪一步让结果变得更稳。',
      'Recreate a small device or process and note what improves its reliability.',
    ),
    weights: [.69, .72, .82, 1.26, .86],
  ),
];

double _weightedFocus(PersonalReportData data, List<double> weights) =>
    ReportGodGroup.values.fold(
      0.0,
      (total, group) => total + data.groupShare(group) * weights[group.index],
    );

class _PeriodReading {
  const _PeriodReading(this.period, this.groups);

  final ReportLuckPeriod period;
  final List<ReportGodGroup> groups;

  ReportGodGroup? get theme => groups.firstOrNull;

  double weightFor(_ReportTopic topic) {
    final weights = _themeWeights[topic]!;
    if (groups.isEmpty) return 0;
    return groups.indexed.fold(
          0.0,
          (total, entry) =>
              total + weights[entry.$2.index] * (entry.$1 == 0 ? 2 : 1),
        ) /
        (groups.length + 1);
  }
}

List<_PeriodReading> _periodReadings(PersonalReportData data) {
  final day = data.dayPillar;
  if (day == null) return const [];
  return [
    for (final period in data.periods)
      _PeriodReading(period, _periodGroups(day, period.pillar)),
  ];
}

List<ReportGodGroup> _periodGroups(String day, String stemBranch) {
  final details = detailsFromKnownBaZiPillars({
    Pillar.day: day,
    Pillar.hour: stemBranch,
  }, Pillar.hour);
  if (details['tenGods'] case {
    'heavenlyStem': final String stem,
    'hiddenStems': final List hidden,
  }) {
    return [
      if (ReportGod.fromLabel(stem) case final god?) god.group,
      for (final entry in hidden)
        if (entry case {'tenGod': final String name})
          if (ReportGod.fromLabel(name) case final god?) god.group,
    ];
  }
  return const [];
}

const _periodThemes = <ReportGodGroup, _ReportWords>{
  ReportGodGroup.peers: (
    '建立自主节奏，筛选可靠的合作者。',
    'Develop your own rhythm and find reliable collaborators.',
  ),
  ReportGodGroup.expression: (
    '练习清楚表达，把想法做成作品。',
    'Practice clear expression and give an idea tangible form.',
  ),
  ReportGodGroup.wealth: (
    '看清资源与回报，建立可持续的积累方式。',
    'Understand resources and returns, and find a sustainable way to build.',
  ),
  ReportGodGroup.responsibility: (
    '梳理承诺与职责，给重要事情留出稳定节奏。',
    'Clarify commitments and reserve steady time for important work.',
  ),
  ReportGodGroup.learning: (
    '补方法和知识，善用愿意给反馈的人。',
    'Build knowledge and methods, and seek people who give useful feedback.',
  ),
};
