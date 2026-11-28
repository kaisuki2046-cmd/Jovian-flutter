part of 'personal_report_page.dart';

class _ReportChapter {
  const _ReportChapter(
    this.title,
    this.icon, {
    this.cover,
    this.centerTitle = false,
    required this.reading,
  });

  final String title;
  final IconData icon;
  final Widget? cover;
  final bool centerTitle;
  final Widget reading;
}

class _ReportChapters {
  const _ReportChapters(this.data, this.topic);

  final PersonalReportData data;
  final _ReportTopic topic;

  Color get _tone => topic.tone;

  List<_ReportChapter> build(BuildContext context) {
    final group = _leadingGroup(data, topic);
    if (group == null) return const [];
    return switch (topic) {
      _ReportTopic.overview => _overview(context, group),
      _ReportTopic.love => _relationship(context, group),
      _ReportTopic.work => _career(context, group),
      _ReportTopic.wealth => _money(context, group),
      _ReportTopic.study => _education(context, group),
    };
  }

  List<_ReportChapter> _overview(BuildContext context, ReportGodGroup group) {
    final lens = _profileLenses[group]!;
    final love = _loveLenses[group]!;
    final primary = data.gods.first;
    final god = _godName(context, primary.god);
    final share = _percent(primary.share);
    final master = data.dayMaster;
    final sun = data.zodiacSigns['Sun'];
    final moon = data.zodiacSigns['Moon'];
    final rising = data.zodiacSigns['Ascendant'];
    final picture = [
      ('太阳星座', '太阳', sun),
      ('月亮星座', '月亮', moon),
      ('上升星座', '上升', rising),
    ];
    final matches = [
      ...data.shenSha.where((entry) => entry.name == '桃花'),
      ...data.shenSha.where((entry) => entry.name != '桃花'),
    ].take(2);
    final main = [
      if (master != null)
        '${context.uiLabel('日主')} ${_dayMasterText(context, master)}',
      if (sun != null) '${context.uiLabel('太阳')} ${context.uiLabel(sun)}',
    ].join(' · ');
    return [
      _ReportChapter(
        '我的命盘综述',
        Icons.auto_awesome_outlined,
        cover: _withReading(
          _InsightChip(text: '$god $share', tone: _tone, featured: true),
          _InsightText((
            [if (main.isNotEmpty) main, lens.tags.first.$1].join(' · '),
            [if (main.isNotEmpty) main, lens.tags.first.$2].join(' · '),
          ), small: true),
        ),
        reading: _InsightEntries([
          for (final (label, position, sign) in picture)
            if (sign != null)
              if (_zodiacReading(position, sign) case final reading?)
                (
                  label,
                  (
                    '$sign座 · ${reading.body.$1}',
                    '${context.uiLabel('$sign座')} · ${reading.body.$2}',
                  ),
                ),
          (
            '日主与十神',
            (
              '${master == null ? '' : '日主为$master。'}$god在已列出的十神里占比最高（$share）。${lens.drive.$1}',
              '${master == null ? '' : 'Day master: ${_dayMasterText(context, master)}. '}$god is the largest listed Ten God at $share. ${lens.drive.$2}',
            ),
          ),
          for (final match in matches)
            (
              match.name,
              (
                '见于${match.pillars.map((pillar) => _pillarName(context, pillar)).join('、')}。${_shenNotes[match.name]?.reading.$1 ?? '可以结合所在四柱一起读。'}',
                'Appears in ${match.pillars.map((pillar) => _pillarName(context, pillar)).join(', ')}. ${_shenNotes[match.name]?.reading.$2 ?? 'Read it alongside those pillars.'}',
              ),
            ),
        ]),
      ),
      _ReportChapter(
        '我的性格内核',
        Icons.fingerprint_rounded,
        cover: _InsightCloud(lens.tags, _tone),
        reading: _withReading(
          _InsightCloud(lens.tags, _tone),
          _InsightEntries([
            ('思维与行动', lens.drive),
            (
              '情绪与需要',
              (
                '${love.receive.$1}${moon == null ? '' : _zodiacReading('月亮', moon)?.body.$1 ?? ''}',
                '${love.receive.$2} ${moon == null ? '' : _zodiacReading('月亮', moon)?.body.$2 ?? ''}',
              ),
            ),
            ('优势与容易吃力的一面', lens.friction),
            ('我怎么看自己', _selfPerceptions[group]!),
          ]),
        ),
      ),
      _radar(
        context,
        '我的天赋与优势',
        const {
          '表达': [.45, 1.25, .28, .28, .55],
          '执行': [.88, .40, .82, 1.15, .53],
          '学习': [.48, .78, .44, .68, 1.33],
          '协作': [1.12, .60, .66, .72, .53],
          '规划': [.51, .52, 1.02, 1.16, .78],
        },
        _InsightEntries([
          ('容易用上的优势', lens.drive),
          ('能力上的盲点', lens.friction),
          ('可以试试', lens.habit),
        ]),
      ),
      _ReportChapter(
        '我的内在矛盾',
        Icons.compare_arrows_rounded,
        cover: _InsightCloud(switch (group) {
          ReportGodGroup.peers => const [
            ('独立坚持', 'Independence'),
            ('及时求助', 'Asking for help'),
          ],
          ReportGodGroup.expression => const [
            ('开始新尝试', 'Starting ideas'),
            ('把作品做完', 'Finishing work'),
          ],
          ReportGodGroup.wealth => const [
            ('看重回报', 'Seeking returns'),
            ('耐心试错', 'Experimenting patiently'),
          ],
          ReportGodGroup.responsibility => const [
            ('守住标准', 'Keeping standards'),
            ('留出弹性', 'Making room for change'),
          ],
          ReportGodGroup.learning => const [
            ('弄懂全貌', 'Understanding fully'),
            ('交出第一版', 'Shipping a first draft'),
          ],
        }, _tone),
        reading: _InsightEntries([
          ('容易卡住的地方', lens.friction),
          ('可以试试', lens.habit),
        ]),
      ),
      _ReportChapter(
        '我怎样与人相处',
        Icons.diversity_3_outlined,
        cover: _InsightText(lens.support, small: true, maxLines: 2),
        reading: _InsightEntries([
          ('友情与合作', lens.support),
          ('亲密关系', love.fit),
          (
            '适配与消耗',
            (
              '${lens.support.$1}${lens.friction.$1}',
              '${lens.support.$2} ${lens.friction.$2}',
            ),
          ),
          (
            '亲情与边界',
            (
              '熟悉的人也需要明确的表达。${lens.habit.$1}',
              'People close to you also benefit from clear communication. ${lens.habit.$2}',
            ),
          ),
          ('贵人与支持', _mentorReading(const ['天乙贵人', '文昌贵人', '将星'], lens.support)),
        ]),
      ),
      _periods('我的人生阶段'),
      _ReportChapter(
        '四个生活方向',
        Icons.grid_view_rounded,
        cover: _lifeAreas(context),
        reading: _InsightEntries(_lifeAreaReadings()),
      ),
      if (data.overview case final body? when body.trim().isNotEmpty)
        _ReportChapter(
          '已保存的命理解读',
          Icons.description_outlined,
          reading: DestinyReportText(body),
        ),
    ];
  }

  List<_ReportChapter> _relationship(
    BuildContext context,
    ReportGodGroup group,
  ) {
    final lens = _loveLenses[group]!;
    final style = _relationshipStyles[group]!;
    final venus = data.zodiacSigns['Venus'];
    final moon = data.zodiacSigns['Moon'];
    final personality = _InsightCloud([
      style.name,
      ...style.fit.take(2),
      if (venus != null) ('金星${venus}', 'Venus in ${context.uiLabel(venus)}'),
    ], _tone);
    final fit = _InsightCloud(style.fit, _tone);
    final balance = _bars(
      context,
      _reportAxes(data, const {
        '照顾': [.70, .71, .97, 1.13, 1.19],
        '表达需要': [.86, 1.25, .75, .67, .66],
        '相处中主导': [1.20, .90, 1.08, 1.08, .64],
        '玩心': [.92, 1.30, .73, .42, .81],
      }),
    );
    const reply = ('对方迟迟没回消息', 'A reply takes a long time');
    final replyScene = [
      ('表面', style.delayedReply.outward),
      ('内心', style.delayedReply.inward),
    ];
    final scenes = [
      ...replyScene,
      ('可以试试', style.delayedReply.followUp),
      switch (group) {
        ReportGodGroup.peers => (
          '一起做事却分工不清',
          (
            '你可能先把剩下的事做完，心里却希望有人主动分担。选一件还来得及一起做的事，问对方想接手哪一步。',
            'You may finish the remaining work while hoping someone offers to help. Choose a task you can still share and ask which step they want to take.',
          ),
        ),
        ReportGodGroup.expression => ('话没说完就被打断', lens.scene),
        ReportGodGroup.wealth => ('约会怎么安排', lens.scene),
        ReportGodGroup.responsibility => ('计划临时变了', lens.scene),
        ReportGodGroup.learning => ('想一个人待会儿', lens.scene),
      },
      ('出现分歧时', lens.tension),
      ('感觉渐渐疏远', style.ending),
    ];
    final window = _relationshipTiming(context);
    final support = _relationshipSignals(group);
    return [
      _ReportChapter(
        '我的恋爱画像',
        Icons.favorite_border_rounded,
        cover: _withReading(
          personality,
          _InsightText(lens.give, small: true, maxLines: 2),
        ),
        reading: _withReading(
          personality,
          _InsightEntries([
            (
              '我怎样爱人',
              (
                '${lens.give.$1}${venus == null ? '' : _zodiacReading('金星', venus)?.body.$1 ?? ''}',
                '${lens.give.$2} ${venus == null ? '' : _zodiacReading('金星', venus)?.body.$2 ?? ''}',
              ),
            ),
            (
              '我想怎样被爱',
              (
                '${lens.receive.$1}${moon == null ? '' : _zodiacReading('月亮', moon)?.body.$1 ?? ''}',
                '${lens.receive.$2} ${moon == null ? '' : _zodiacReading('月亮', moon)?.body.$2 ?? ''}',
              ),
            ),
          ]),
        ),
      ),
      _ReportChapter(
        '十维关系雷达',
        Icons.radar_rounded,
        cover: _RelationshipRadar(data: data),
        reading: _RelationshipRadar(data: data, showDetails: true),
      ),
      _ReportChapter(
        '我在关系中的样子',
        Icons.people_outline_rounded,
        cover: balance,
        reading: _withReading(
          balance,
          _InsightEntries([
            ('开始靠近时', style.beginning),
            ('相处一段时间后', style.middle),
            ('关系走到选择点', style.ending),
          ]),
        ),
      ),
      _ReportChapter(
        '恋爱情境',
        Icons.forum_outlined,
        cover: _withReading(
          _InsightCloud(const [reply], _tone),
          _InsightEntries(replyScene),
        ),
        reading: _withReading(
          _InsightCloud(const [reply], _tone),
          _InsightEntries(scenes),
        ),
      ),
      _ReportChapter(
        '适合的相处方式',
        Icons.handshake_outlined,
        cover: fit,
        reading: _withReading(
          fit,
          _InsightEntries([
            ('适合的人', lens.fit),
            ('相处优势', lens.give),
            ('常遇到的问题', lens.tension),
            (
              '可以试试',
              (
                '挑一件两人能一起完成的小事，回来谈谈彼此的感受和分工。舒服的相处方式会在这些小事里逐渐清楚。',
                'Choose one small thing to do together, then compare how it felt and how the work was shared. Those details reveal a good rhythm.',
              ),
            ),
          ]),
        ),
      ),
      _periods('情感阶段趋势'),
      _ReportChapter(
        '缘分与长期关系',
        Icons.favorite_outline_rounded,
        cover: _InsightText(window.opportunity, small: true, maxLines: 2),
        reading: _InsightEntries([
          ('正缘出现的时机', window.opportunity),
          ('适合长期相处的人', lens.fit),
          ('相识机会与吸引力', support.attraction),
          ('缘分开启早晚', window.early),
          (
            '承诺节奏与晚婚倾向',
            (
              '${style.beginning.$1}相识、确认关系与结婚各有节奏。承诺适合在双方对时间、生活和分工都有共识之后推进。',
              '${style.beginning.$2} Meeting, becoming partners and marrying can have different rhythms. Discuss time, daily life and shared responsibilities before committing.',
            ),
          ),
          (
            '婚姻质量与磨合',
            (
              '${style.middle.$1}${lens.tension.$1}',
              '${style.middle.$2} ${lens.tension.$2}',
            ),
          ),
          (
            '婚姻次数与关系走向',
            (
              '每次是否走入或结束婚姻，都和现实安排、双方的意愿与修复能力有关。${style.ending.$1}',
              'Whether a marriage starts or ends depends on preferences, circumstances and how each person repairs conflict. ${style.ending.$2}',
            ),
          ),
          (
            '单身与陪伴',
            (
              '伴侣只是亲密支持的一种来源。朋友、家人和共同兴趣也能建立稳定的陪伴。想进入关系时，可先从愿意彼此投入的来往开始。',
              'A partner is one source of closeness. Friends, family and shared interests also offer steady companionship. If you want a relationship, start with people who reciprocate.',
            ),
          ),
          ('关系里的重要线索', support.commitment),
        ]),
      ),
    ];
  }

  List<_ReportChapter> _career(BuildContext context, ReportGodGroup group) {
    final profile = _profileLenses[group]!;
    final lens = _workLenses[group]!;
    const signals = ['将星', '驿马', '天乙贵人', '文昌贵人'];
    final style = _InsightCloud([lens.role, ...profile.tags.take(3)], _tone);
    return [
      _ReportChapter(
        '我的事业画像',
        Icons.work_outline_rounded,
        cover: style,
        reading: _withReading(
          style,
          _InsightEntries([
            ('工作风格和态度', profile.drive),
            ('怎样推进任务', profile.habit),
            ('适合的领域', lens.field),
            (
              '适合的工作角色',
              (
                '${lens.role.$1}。可以先试有这项职责的小项目，看看哪一种分工让你发挥得最好。',
                '${lens.role.$2}. Try a small project with that responsibility and see where you contribute most.',
              ),
            ),
          ]),
        ),
      ),
      _periods('事业阶段趋势'),
      _radar(
        context,
        '我的工作画像',
        const {
          '专注': [.6, .60, .45, .85, 1.15],
          '执行': [.97, .50, .89, 1.34, .53],
          '表达': [.56, 1.29, .36, .40, .60],
          '协作': [1.24, .72, .70, .78, .70],
          '统筹': [.72, .49, 1.14, 1.25, .65],
          '创新': [.73, 1.35, .66, .45, 1.04],
        },
        _InsightEntries([
          ('适合的工作环境', lens.wants),
          (
            '我在工作中看重什么',
            (
              '${lens.wants.$1}。${_selfPerceptions[group]!.$1}',
              '${lens.wants.$2}. ${_selfPerceptions[group]!.$2}',
            ),
          ),
          ('可以试试', profile.habit),
        ]),
        emphasis: lens.wants,
      ),
      _ReportChapter(
        '阻碍与建议',
        Icons.alt_route_rounded,
        cover: _InsightText(lens.block, small: true, maxLines: 2),
        reading: _InsightEntries([
          ('容易遇到的困难', lens.block),
          ('怎样应对', profile.friction),
          ('适合的合作者', profile.support),
          ('贵人如何帮到我', _mentorReading(signals, profile.support)),
          ..._chartSignals(context, const {
            ReportGodGroup.peers,
            ReportGodGroup.expression,
            ReportGodGroup.wealth,
            ReportGodGroup.responsibility,
          }, signals),
        ]),
      ),
    ];
  }

  List<_ReportChapter> _money(BuildContext context, ReportGodGroup group) {
    final profile = _profileLenses[group]!;
    final lens = _wealthLenses[group]!;
    final income = _incomeStyles[group]!;
    final creative = _weightedFocus(data, [.48, 1, .12, .15, .29]);
    final planned = _weightedFocus(data, [.52, .13, 1, .9, .72]);
    final emotional = creative / (creative + planned);
    final spending = Column(
      spacing: 8,
      children: [
        _InsightBar(
          context.uiLabel('感性消费'),
          emotional,
          const Color(0xffbb718e),
          percent: true,
        ),
        _InsightBar(
          context.uiLabel('理性规划'),
          1 - emotional,
          _tone,
          percent: true,
        ),
      ],
    );
    final funnel = _WealthLeakFunnel(risk: lens.leakLabel, tone: _tone);
    final opportunities = _bars(
      context,
      _reportAxes(data, const {
        '开源': [.79, 1, 1.29, .79, .67],
        '守财': [.42, .39, 1.26, 1.29, .85],
        '资源转化': [1.10, 1.02, 1.30, .58, .80],
      }),
    );
    final stable = _weightedFocus(data, [.92, .59, .90, 1.30, 1.13]);
    final variable = _weightedFocus(data, [.81, 1.13, 1.19, .61, .70]);
    final incomeBalance = _InsightCloud([
      income.headline,
      stable >= variable
          ? ('稳定收入优先', 'Steadier income first')
          : ('项目收入较灵活', 'Flexible project income'),
    ], _tone);
    final retention = _retentionReading(group);
    const signals = ['禄神', '天乙贵人', '驿马'];
    return [
      _ReportChapter(
        '我的财富画像',
        Icons.currency_yen_rounded,
        cover: _withReading(
          _InsightCloud([income.headline, ...profile.tags.take(2)], _tone),
          spending,
        ),
        reading: _withReading(
          spending,
          _InsightEntries([
            ('金钱观和回报偏好', lens.returns),
            (
              '消费倾向',
              emotional >= .5
                  ? const (
                      '体验、关系和即时需要更容易带动支出。留一栏记录这些愿意花的钱，再决定是否适合当下。两项百分比表示相对侧重。',
                      'Experiences, relationships and immediate needs may encourage spending. Track what feels worth buying and how it fits now. The percentages show relative emphasis.',
                    )
                  : const (
                      '你更容易先考虑用途和可持续性。留意是不是为了等到最划算，拖过了真正需要用的时候。两项百分比表示相对侧重。',
                      'You more often consider utility and durability first. Notice when waiting for the best deal gets in the way of a real need. The percentages show relative emphasis.',
                    ),
            ),
            ('风险态度', income.risk),
          ]),
        ),
      ),
      _ReportChapter(
        '漏斗',
        Icons.filter_alt_outlined,
        cover: funnel,
        centerTitle: true,
        reading: _withReading(
          funnel,
          _InsightEntries([
            (
              '如何看漏斗',
              const (
                '从可用资源往下看，先核对中间的支出和承诺，再看真正留下了什么。三层宽窄表示资源经过的环节。',
                'Start with available resources, check spending and commitments, then see what remains. The three widths illustrate the steps resources pass through.',
              ),
            ),
            ('容易漏财的地方', lens.leak),
            ('风险管理', lens.guard),
            ('留个检查点', income.risk),
          ]),
        ),
      ),
      _ReportChapter(
        '积累财富的方式',
        Icons.stacked_bar_chart_rounded,
        cover: opportunities,
        reading: _withReading(
          opportunities,
          _InsightEntries([
            ('开源', lens.earning),
            ('守财', lens.guard),
            ('资源转化', income.convert),
          ]),
        ),
      ),
      _ReportChapter(
        '收入模式与资源来源',
        Icons.account_tree_outlined,
        cover: incomeBalance,
        reading: _withReading(
          incomeBalance,
          _InsightEntries([
            ('工资与稳定收入', income.steady),
            ('项目与波动收入', income.variable),
            ('自己的本领与人脉', income.convert),
            (
              '家庭资产与共同资源',
              (
                '有家庭支持、继承或伴侣共同收入时，先确认实际可用的部分和共同承担的支出，再放进个人收支计划。',
                'When family support, inheritance or shared income exists, work out what is available and which costs are shared before counting it in a personal budget.',
              ),
            ),
            (
              '面对短期回报',
              (
                '${income.risk.$1}偶发的大笔收入和波动很高的回报，可以单独记录，观察它是否真的到账、能否持续。',
                '${income.risk.$2} Track windfalls and volatile returns separately to see whether they arrive and whether they can recur.',
              ),
            ),
            ('可借力的支持', _mentorReading(signals, profile.support)),
            ..._chartSignals(context, const {
              ReportGodGroup.wealth,
              ReportGodGroup.expression,
              ReportGodGroup.peers,
            }, signals),
          ]),
        ),
      ),
      _periods('财富阶段趋势'),
      _ReportChapter(
        '能留住多少',
        Icons.savings_outlined,
        cover: _InsightCloud([
          retention.label,
          const ('核算实际留存', 'Review what stays'),
        ], _tone),
        reading: _InsightEntries([
          ('整体积累倾向', retention.note),
          (
            '实际到手与积累',
            (
              '把已经到账的收入、计划支出和隐性成本分开记。到手之后，再看多少可以沉淀成现金、长期储备或可复用的资源。',
              'Record received income, planned expenses and hidden costs separately. Then see what can stay as cash, reserves or reusable resources.',
            ),
          ),
          ('怎样守住成果', lens.guard),
        ]),
      ),
    ];
  }

  List<_ReportChapter> _education(BuildContext context, ReportGodGroup group) {
    final lens = _profileLenses[group]!;
    final learning = _studyPersonalities[group]!;
    const signals = ['文昌贵人', '学堂', '词馆', '华盖', '天乙贵人'];
    final choices = [
      for (final option in _studyChoices)
        (option: option, match: _weightedFocus(data, option.weights)),
    ]..sort((a, b) => b.match.compareTo(a.match));
    final picked = choices.take(3).toList();
    final total = picked.fold(0.0, (sum, choice) => sum + choice.match);
    Widget directions({required bool explain}) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        for (final choice in picked)
          Container(
            padding: const EdgeInsets.fromLTRB(10, 9, 10, 10),
            decoration: BoxDecoration(
              color: _tone.withValues(alpha: .055),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _tone.withValues(alpha: .19)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 4,
              children: [
                _InsightBar(
                  _reportWords(context, choice.option.label),
                  choice.match / total,
                  _tone,
                  percent: true,
                ),
                if (explain) ...[
                  _InsightText(choice.option.note, small: true),
                  _InsightText(choice.option.tryThis, small: true),
                ],
              ],
            ),
          ),
        if (explain)
          const _InsightText((
            '百分比是这三个方向之间的相对匹配度。',
            'Percentages compare fit across these three options.',
          ), small: true),
      ],
    );
    return [
      _ReportChapter(
        '适合尝试的学习方向',
        Icons.school_outlined,
        cover: directions(explain: false),
        reading: directions(explain: true),
      ),
      _periods('学运趋势'),
      _radar(
        context,
        '我的学习天赋',
        const {
          '逻辑与条理': [.67, .55, .85, 1.05, 1.30],
          '客观与理性': [.73, .51, 1.22, 1.15, .91],
          '创意与主见': [1.05, 1.37, .64, .59, .83],
          '灵感与悟性': [.64, 1.09, .67, .54, 1.32],
        },
        _InsightEntries([
          ('学习中的优势', learning.attitude),
          ('如何练出成果', learning.practice),
        ]),
        emphasis: learning.tag,
      ),
      _ReportChapter(
        '学习方式与卡点',
        Icons.menu_book_outlined,
        cover: _withReading(
          _InsightCloud([learning.tag], _tone),
          _InsightText(learning.challenge, small: true, maxLines: 2),
        ),
        reading: _InsightEntries([
          ('适合怎样学', learning.mode),
          ('学习态度与动力', learning.attitude),
          ('难点与提醒', learning.challenge),
          ('求学节奏与持续性', _learningRhythm()),
          ('我可以向谁求助', _mentorReading(signals, lens.support)),
          ..._chartSignals(context, const {
            ReportGodGroup.learning,
            ReportGodGroup.expression,
            ReportGodGroup.responsibility,
          }, signals),
        ]),
      ),
    ];
  }

  _ReportChapter _periods(String title) => _ReportChapter(
    title,
    Icons.timeline_rounded,
    cover: _ReportPeriods(data: data, topic: topic, preview: true),
    reading: _ReportPeriods(data: data, topic: topic),
  );

  _ReportChapter _radar(
    BuildContext context,
    String title,
    Map<String, List<double>> weights,
    Widget explanation, {
    _ReportWords? emphasis,
  }) {
    final axes = _reportAxes(data, weights);
    final highest = axes.reduce((a, b) => a.value >= b.value ? a : b);
    final lowest = axes.reduce((a, b) => a.value <= b.value ? a : b);
    final name = context.uiLabel(highest.label);
    final lower = context.uiLabel(lowest.label);
    final chart = _ReportRadar(axes: axes, tone: _tone, height: 154);
    final tag = emphasis == null ? null : _InsightCloud([emphasis], _tone);
    return _ReportChapter(
      title,
      Icons.hexagon_outlined,
      cover: tag == null ? chart : _withReading(tag, chart),
      reading: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          _ReportRadar(axes: axes, tone: _tone),
          _InsightEntries([
            (
              '相对突出的能力',
              (
                '图中「$name」最突出。可以先用它带动一件有挑战的事。',
                '$name stands out here. Use it as a starting point for a challenging task.',
              ),
            ),
            if (lowest.value < highest.value)
              (
                '值得补一补的能力',
                (
                  '「$lower」的侧重较低。遇到相关任务时，可以借助工具或搭档逐步练习。',
                  '$lower has a smaller emphasis. Use a tool or a partner to practice it when needed.',
                ),
              ),
          ]),
          explanation,
        ],
      ),
    );
  }

  Widget _bars(BuildContext context, List<_ChartAxis> axes) => Column(
    spacing: 8,
    children: [
      for (final axis in axes)
        _InsightBar(context.uiLabel(axis.label), axis.value, _tone),
    ],
  );

  Widget _withReading(Widget first, Widget detail) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: 12,
    children: [first, detail],
  );

  List<(String, _ReportWords)> _lifeAreaReadings() => [
    ('情感', _loveLenses[_leadingGroup(data, _ReportTopic.love)]!.give),
    ('事业', _workLenses[_leadingGroup(data, _ReportTopic.work)]!.field),
    ('财富', _incomeStyles[_leadingGroup(data, _ReportTopic.wealth)]!.headline),
    ('学业', _studyPersonalities[_leadingGroup(data, _ReportTopic.study)]!.mode),
  ];

  Widget _lifeAreas(BuildContext context) {
    final directions = _lifeAreaReadings();
    final topics = _ReportTopic.values.skip(1).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        for (final row in const [0, 2])
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 7,
            children: [
              for (final index in [row, row + 1])
                Expanded(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(11),
                      color: topics[index].tone.withValues(alpha: .10),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 4,
                        children: [
                          _ReportLabel(
                            directions[index].$1,
                            topics[index].icon,
                          ),
                          _InsightText(
                            directions[index].$2,
                            small: true,
                            maxLines: 2,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
      ],
    );
  }

  ({_ReportWords opportunity, _ReportWords early}) _relationshipTiming(
    BuildContext context,
  ) {
    final adult = _periodReadings(
      data,
    ).where((item) => item.period.endAge >= 18).toList();
    final peak = _strongestPeriod(adult, _ReportTopic.love);
    if (peak == null) {
      return (
        opportunity: (
          '缘分容易在能持续见面、有共同体验的场合发展。补全起运资料后，可以进一步查看阶段窗口。',
          'Connections can grow where you meet consistently and share experiences. Dated luck phases give a closer view of timing.',
        ),
        early: (
          '可以回看自己什么时候开始愿意主动认识人，又在什么时候想要稳定相处。两种变化往往有不同的节奏。',
          'Look back on when you wanted to meet people and when you wanted a steady partnership. Those rhythms can differ.',
        ),
      );
    }
    final early = adult.firstWhere(
      (item) =>
          item.weightFor(_ReportTopic.love) >=
          peak.weightFor(_ReportTopic.love) - .09,
    );
    final stronger = _phaseLabel(context, peak.period);
    final first = _phaseLabel(context, early.period);
    final isEarly = early.period.startAge < 29;
    return (
      opportunity: (
        '$stronger 的关系议题相对集中。可以多参加愿意反复出现的共同活动，从稳定来往中辨认合适的人。',
        'Relationship themes stand out around $stronger. Regular shared activities give you time to notice who meets you halfway.',
      ),
      early: isEarly
          ? (
              '$first 已有比较活跃的相识线索，倾向较早开始接触和练习相处。想走长期时，再观察对方是否也愿意稳定投入。',
              'Themes of meeting people emerge relatively early, around $first. For a longer relationship, see whether interest turns into steady effort on both sides.',
            )
          : (
              '$first 的相识与关系议题更明显，倾向在节奏稳定后才愿意真正靠近。可以留意换环境、学习或合作带来的新来往。',
              'Meeting and partnership themes become clearer around $first. New settings, learning and collaboration may help you meet people as your rhythm settles.',
            ),
    );
  }

  ({_ReportWords attraction, _ReportWords commitment}) _relationshipSignals(
    ReportGodGroup group,
  ) {
    const names = {'桃花', '红鸾', '天喜'};
    final signals = data.shenSha.where((hit) => names.contains(hit.name));
    final contacts = signals.expand((hit) => hit.pillars).toSet().length;
    final attraction = switch (contacts) {
      >= 2 => (
        '相识与被注意到的线索比较鲜明，有机会从不止一种场合认识人。兴趣小组、同伴合作和反复见面的活动都值得留意。',
        'Meeting and being noticed stand out across more than one setting. Shared interests, peer projects and recurring events can offer natural openings.',
      ),
      1 => (
        '相识机会往往跟具体环境或熟人的引介有关。给有来有回的互动多一点时间，感觉会慢慢清楚。',
        'Introductions and particular settings can create openings. Give reciprocal exchanges enough time for interest to become clearer.',
      ),
      _ => (
        '这份命盘的相识线索更适合从相处方式来看。${_relationshipStyles[group]!.beginning.$1}',
        'The way you get close is a useful clue to meeting people. ${_relationshipStyles[group]!.beginning.$2}',
      ),
    };
    final mostRelated = data.gods
        .where(
          (item) => switch (item.god) {
            ReportGod.steward ||
            ReportGod.opportunity ||
            ReportGod.officer ||
            ReportGod.protector => true,
            _ => false,
          },
        )
        .firstOrNull;
    final mismatch = data.shenSha.any(
      (hit) => {'阴差阳错', '阴阳差错'}.contains(hit.name),
    );
    final wish = switch (mostRelated?.god) {
      ReportGod.steward => (
        '日常照料和稳定行动更容易让你愿意承诺。',
        'Everyday care and steady action make commitment easier.',
      ),
      ReportGod.opportunity => (
        '你比较容易从开放的交往和共同的新体验里发现吸引。',
        'Open interaction and new experiences can reveal interest.',
      ),
      ReportGod.officer => (
        '态度明确、责任讲得清楚时，你比较安心。',
        'Clarity about commitment and responsibilities helps you feel secure.',
      ),
      ReportGod.protector => (
        '有主见、能一起处理变化的人更容易让你留意。',
        'People who think for themselves and can handle change draw your attention.',
      ),
      _ => _loveLenses[group]!.receive,
    };
    return (
      attraction: attraction,
      commitment: mismatch
          ? (
              '${wish.$1}遇到两边期待不同步时，可以把对承诺的理解和准备程度分别讲清。',
              '${wish.$2} When your expectations are out of sync, talk through what commitment means and what each person feels ready for.',
            )
          : wish,
    );
  }

  ({_ReportWords label, _ReportWords note}) _retentionReading(
    ReportGodGroup group,
  ) {
    final hold = _weightedFocus(data, [.49, .48, 1.19, 1.27, .92]);
    final earn = _weightedFocus(data, [.85, 1.04, 1.28, .85, .68]);
    final steady = hold >= earn * .85;
    final income = _incomeStyles[group]!;
    return (
      label: steady
          ? ('偏向持续留存', 'Builds through consistent retention')
          : (
              '开源较活跃，留存看分配',
              'Earning stands out. Retention depends on allocation.',
            ),
      note: steady
          ? (
              '这份命盘的规划与保留资源较有侧重，积累往往来自反复留下小额和长期可重复的回报。${income.steady.$1}',
              'Planning and retention show relatively strongly. Accumulation is more likely to come through contributions and recurring value. ${income.steady.$2}',
            )
          : (
              '这份命盘的收入与机会侧重更明显，到手后能留下多少比较受分工、回款和成本影响。${income.variable.$1}',
              'Income and opportunities have more emphasis. How much stays depends on how work, payments and costs are handled. ${income.variable.$2}',
            ),
    );
  }

  _ReportWords _learningRhythm() {
    final periods = _periodReadings(data);
    final peak = _strongestPeriod(periods, _ReportTopic.study);
    if (peak == null) {
      return const (
        '把正式求学、工作后补课和自学一起看。可以先找出哪些主题会让你愿意不断回来练习，再用一轮成果判断是否继续深造。',
        'Consider formal study, returning to classes and self-study together. Find an area you keep returning to and use a finished project to decide whether to go deeper.',
      );
    }
    final later = periods.indexOf(peak) >= periods.length / 2;
    return later
        ? (
            '求学容易延伸到工作以后的进修或转向。学习侧重更高的阶段在${_ageRange(peak.period)}岁左右，适合用已经积累的问题带动深入学习。',
            'Learning is likely to continue through retraining or a change of direction. It stands out in the phase around ages ${_ageRange(peak.period)}. Bring questions accumulated from experience.',
          )
        : (
            '较早打底的阶段更容易集中精力，${_ageRange(peak.period)}岁左右学习侧重较明显。之后可用阶段性项目或进修继续加深这项能力。',
            'Earlier phases offer more focus for foundations, especially around ages ${_ageRange(peak.period)}. Projects or further study can deepen those skills later.',
          );
  }

  _ReportWords _mentorReading(List<String> relevant, _ReportWords fallback) {
    for (final name in const ['天乙贵人', '文昌贵人', '将星']) {
      if (relevant.contains(name) &&
          data.shenSha.any((hit) => hit.name == name)) {
        final reading = _shenNotes[name]!.reading;
        return ('${fallback.$1}${reading.$1}', '${fallback.$2} ${reading.$2}');
      }
    }
    return fallback;
  }

  List<(String, _ReportWords)> _chartSignals(
    BuildContext context,
    Set<ReportGodGroup> groups,
    List<String> names,
  ) {
    final gods = data.gods
        .where((entry) => groups.contains(entry.god.group))
        .take(2);
    final marks =
        data.shenSha
            .where(
              (hit) =>
                  names.contains(hit.name) && _shenNotes.containsKey(hit.name),
            )
            .toList()
          ..sort((a, b) {
            final count = b.pillars.length.compareTo(a.pillars.length);
            return count != 0
                ? count
                : names.indexOf(a.name).compareTo(names.indexOf(b.name));
          });
    return [
      for (final entry in gods)
        (
          '${_godName(context, entry.god)} ${_percent(entry.share)}',
          _godNotes[entry.god]!,
        ),
      for (final mark in marks.take(2))
        (_shenName(context, mark.name), _shenNotes[mark.name]!.reading),
    ];
  }
}
