part of 'personal_report_page.dart';

const _zodiacMeanings = <String, _ReportWords>{
  '太阳': ('核心性格与自我认同', 'Identity and core character'),
  '上升': ('外在气质与第一印象', 'Presence and first impressions'),
  '月亮': ('情绪需求与安全感', 'Emotions and security'),
  '金星': ('喜好与表达爱的方式', 'Affection and taste'),
  '火星': ('动力与行动方式', 'Drive and action'),
  '水星': ('思考与沟通方式', 'Thinking and communication'),
  '北交': ('未来发展方向', 'Direction of growth'),
  '婚神': ('承诺与长期伴侣关系', 'Commitment and partnership'),
  '天顶': ('事业方向与公众形象', 'Career and public role'),
};

typedef _ZodiacReading = ({_ReportWords focus, _ReportWords body});

_ZodiacReading? _zodiacReading(String position, String sign) {
  final example = _placementReadings[(position, sign)];
  if (example != null) return example;
  final profile = _zodiacSignProfiles[sign];
  if (profile == null) return null;
  final body = switch (position) {
    '太阳' => profile.character,
    '上升' => (
      '进入新环境时，${profile.character.$1}留意别人如何回应你最先展现的这一面。',
      'In a new setting, this is often the side people meet first. ${profile.character.$2}',
    ),
    '月亮' => profile.comfort,
    '金星' => profile.bond,
    '婚神' => (
      '${profile.bond.$1}考虑长期相处时，和对方具体谈谈怎样把这份期待落实到日常。',
      '${profile.bond.$2} In a lasting partnership, talk about what that would look like day to day.',
    ),
    '火星' => profile.action,
    '水星' => (
      '${profile.action.$1}沟通时，把自己是怎么得出结论的讲给对方听。',
      '${profile.action.$2} When you talk it through, let the other person see how you reached your conclusion.',
    ),
    '北交' => profile.growth,
    '天顶' => (
      '${profile.growth.$1}在工作里，找一种能让这种能力反复用得上、也能被看见的角色。',
      '${profile.growth.$2} At work, look for a role where you can use that ability repeatedly and make it visible.',
    ),
    _ => profile.character,
  };
  final focus = switch (position) {
    '上升' => ('你给人的初印象', 'How people first meet you'),
    '月亮' => ('你怎样找回安全感', 'How you find steadiness'),
    '金星' => ('什么让你心动', 'What draws you close'),
    '婚神' => ('你想怎样长久相处', 'How you want to stay together'),
    '水星' => ('你怎样理解并说清一件事', 'How you make sense of things'),
    '火星' => ('你从哪里获得行动力', 'What gets you moving'),
    '北交' => ('值得练习的方向', 'What to practice next'),
    '天顶' => ('工作中想被看见的一面', 'What you want your work to show'),
    _ => profile.focus,
  };
  return (focus: focus, body: body);
}

// These combinations also appear in the example report.
const _placementReadings = <(String, String), _ZodiacReading>{
  ('太阳', '白羊'): (
    focus: ('从第一步找到自己', 'Find yourself in the first move'),
    body: (
      '有了想做的事，你往往想先动起来，边做边弄清自己真正喜欢什么。碰到阻力时，试着给刚点燃的热情安排一个能持续的小目标。',
      'When something interests you, you like to begin and discover what matters by doing it. If you meet resistance, give that first spark a small goal you can keep working on.',
    ),
  ),
  ('上升', '狮子'): (
    focus: ('用热情打开场面', 'Open the room with warmth'),
    body: (
      '刚见面时，你容易让人记住你的声音、神情或带动气氛的方式。先用自己的热情把大家带进话题，也给安静的人一点开口的时间。',
      'Your voice, expression or warmth can make an impression on first meeting. Start the conversation in your own style and leave room for quieter people to join.',
    ),
  ),
  ('月亮', '处女'): (
    focus: ('把心安放进日常', 'Find calm in small routines'),
    body: (
      '情绪乱的时候，把待办写下来、收拾一角房间，或处理一件能立刻做完的小事，会帮你找回秩序。你也可以直接说自己需要被照顾。',
      'A short list, a tidy corner or one manageable task can restore a sense of order. You can also tell someone directly when you need care.',
    ),
  ),
  ('金星', '双鱼'): (
    focus: ('温柔地读懂对方', 'Read the feeling with tenderness'),
    body: (
      '你容易被细腻的表达、想象力和心照不宣的默契打动。表达喜欢时，除了体谅和陪伴，也可以说出自己想得到怎样的回应。',
      'Subtle kindness, imagination and an unspoken understanding can move you. Along with offering care, say what kind of response would feel good to you.',
    ),
  ),
  ('火星', '双子'): (
    focus: ('好奇心带动行动', 'Let curiosity get you moving'),
    body: (
      '新问题和有来有回的交流容易让你动起来。遇到多条路时，可以先给最想尝试的一条设个短期限，把探索变成看得见的进展。',
      'A new question or lively exchange can get you moving. Set a short deadline for the path you most want to try so exploration produces visible progress.',
    ),
  ),
  ('水星', '双鱼'): (
    focus: ('先感到整体，再说清细节', 'Feel the whole, then name the details'),
    body: (
      '你可能先从画面、语气和联想里听出话外之意。把直觉讲给别人时，可以先举一个具体例子，再补上你希望对方理解的那句话。',
      'Images, tone and associations may tell you what is beneath the words. When sharing an intuition, start with a concrete example and say plainly what you want understood.',
    ),
  ),
  ('北交', '白羊'): (
    focus: ('先为自己作决定', 'Make a choice of your own'),
    body: (
      '你的成长方向是把自己的意愿放在桌面上。遇到要选择的事，先问「我想往哪走」，再迈出一个自己能负责的小步，练习在关系中保留主动权。',
      'Practice putting your wishes on the table. Ask where you want to go, then take one step you can own. This builds initiative while staying connected to others.',
    ),
  ),
  ('婚神', '巨蟹'): (
    focus: ('共同养出归属感', 'Build a sense of home together'),
    body: (
      '长期关系里，你在乎能否分享情绪、互相照料，并把家过成舒服的地方。谈承诺时，可以从家务、陪伴和各自怎样被照顾聊起。',
      'In a long partnership, sharing feelings and making a comfortable home matter. Talk about chores, time together and how each person wants to be cared for.',
    ),
  ),
  ('天顶', '金牛'): (
    focus: ('把成果做得经久耐用', 'Build work that lasts'),
    body: (
      '你容易通过稳定的节奏和扎实的产出赢得信任。适合投入能累积手艺、审美或资源的工作，让外界慢慢认得你的标准和品质。',
      'A steady pace and tangible results help you earn trust. Work that compounds craft, taste or resources lets people recognize the quality you bring over time.',
    ),
  ),
};

typedef _ZodiacSignProfile = ({
  _ReportWords focus,
  _ReportWords character,
  _ReportWords comfort,
  _ReportWords bond,
  _ReportWords action,
  _ReportWords growth,
});

const _zodiacSignProfiles = <String, _ZodiacSignProfile>{
  '白羊': (
    focus: ('用尝试确认方向', 'Find direction by trying'),
    character: (
      '你容易先提出想试的办法，再靠亲手验证建立信心。',
      'You often suggest what to try and build confidence by testing it yourself.',
    ),
    comfort: (
      '给自己一点动起来的空间，做完一件小事或到外面走走，会比反复想同一个问题舒服。',
      'A little movement, a modest task or a walk can bring more relief than replaying a worry.',
    ),
    bond: (
      '坦率的回应和共同尝试新事物会让你更容易靠近。',
      'Frank responses and trying things together make it easier to grow close.',
    ),
    action: (
      '一个清楚的目标和立刻能做的第一步，最容易点亮你的动力。',
      'A clear goal and an immediate first step can spark your drive.',
    ),
    growth: (
      '练习自己选方向，再把最初的勇气用在持续行动上。',
      'Practice choosing your direction and carrying early courage into sustained action.',
    ),
  ),
  '金牛': (
    focus: ('把喜欢的事做深', 'Deepen what you value'),
    character: (
      '你更容易从稳定的体验和亲手做出的成果里确认自己的标准。',
      'You find your standards through steady experience and results you can touch.',
    ),
    comfort: (
      '熟悉的空间、规律的作息和看得见的积累能让你安心下来。',
      'Familiar places, steady routines and visible progress help you settle.',
    ),
    bond: (
      '你容易被可靠的相处节奏和看得见的体贴打动。',
      'Reliable rhythms and tangible gestures of care mean a lot to you.',
    ),
    action: (
      '先看清投入和价值，决定值得做以后，你能照自己的节奏坚持。',
      'Once the effort seems worthwhile, you can sustain it at your own pace.',
    ),
    growth: (
      '挑一项值得长期经营的本领，用时间养出稳定而可见的价值。',
      'Choose a skill worth tending and let its value become visible through time.',
    ),
  ),
  '双子': (
    focus: ('在交流中打开选择', 'Open possibilities through exchange'),
    character: (
      '你喜欢问问题、换角度，也擅长让陌生话题变得有意思。',
      'Questions and fresh angles help you make unfamiliar subjects interesting.',
    ),
    comfort: (
      '和信任的人聊一会儿，或把想法写成几行，能帮你把纷乱感受分开。',
      'A conversation or a few written lines can separate tangled feelings.',
    ),
    bond: (
      '有来有回的谈话和一起发现新东西，会让你感到亲近。',
      'Back-and-forth conversation and shared discoveries help you feel close.',
    ),
    action: (
      '先收集几个观点，再做一次短小的试验，往往比长时间等待更有动力。',
      'Collect a few perspectives and run a small test to get yourself moving.',
    ),
    growth: (
      '练习用问题代替预设，把分散的线索整理成别人也能理解的说法。',
      'Replace assumptions with questions and explain scattered clues in a way others can follow.',
    ),
  ),
  '巨蟹': (
    focus: ('在照料中建立连接', 'Connect through care'),
    character: (
      '你常常先感觉到场合里的情绪，再决定自己怎样加入。',
      'You often sense a room’s mood before deciding how to join in.',
    ),
    comfort: (
      '回到熟悉的人和地方，让自己有一段能被照顾的时间，会更容易松下来。',
      'Familiar people and places, and some time to be cared for, can help you relax.',
    ),
    bond: (
      '日常是否肯互相照顾、能否安心说出感受，对你比热烈的场面更重要。',
      'Everyday care and a safe place to speak matter deeply to you.',
    ),
    action: (
      '当事情关系到你珍惜的人或地方，你容易找到坚持下去的动力。',
      'What protects someone or somewhere you cherish can keep you going.',
    ),
    growth: (
      '把擅长照顾别人的能力也用在自己身上，逐渐建立可以信任的依靠。',
      'Extend your care to yourself and build dependable forms of support.',
    ),
  ),
  '狮子': (
    focus: ('让热情被人接住', 'Let your warmth reach people'),
    character: (
      '你愿意把喜欢的东西带到人群中，也容易在表达时找回自信。',
      'You like bringing what you love to others and gain confidence by expressing it.',
    ),
    comfort: (
      '被认真听见和欣赏会让你放松，尤其是别人能说出他具体看见了什么。',
      'Specific appreciation and being heard can help you feel at ease.',
    ),
    bond: (
      '你在亲近的人面前愿意大方表达，也享受对方明确的肯定。',
      'You are willing to show affection generously and enjoy clear appreciation in return.',
    ),
    action: (
      '有观众、有回馈或能带动伙伴的目标，容易让你拿出更多精力。',
      'Feedback, an audience or a chance to inspire others draws out your energy.',
    ),
    growth: (
      '把想展示的热情落到具体作品上，也让一起做事的人有机会被看见。',
      'Put your enthusiasm into something real and make room for others to be seen too.',
    ),
  ),
  '处女': (
    focus: ('在细节里改善事情', 'Improve things through detail'),
    character: (
      '你会留心哪些地方可以衔接得更好，也愿意用小调整解决真实问题。',
      'You spot what could fit together better and make small changes that solve real problems.',
    ),
    comfort: (
      '能看清接下来要做什么，会让你更容易安心。留一点不排任务的时间也有帮助。',
      'A manageable next step helps you settle. Time with nothing scheduled can help as well.',
    ),
    bond: (
      '你在意对方是否记得小事，也常用具体帮助来表示关心。',
      'You notice whether someone remembers small things and show care through practical help.',
    ),
    action: (
      '拆解、核对和逐个处理是你的着力点。先定完成线，就能安心做第一版。',
      'Breaking things down and checking them one by one helps. Give the first version a clear finish line.',
    ),
    growth: (
      '把辨别问题的能力用来改进流程，练习在条件足够时交出初稿。',
      'Use your eye for problems to improve a process and share a draft when it is ready enough.',
    ),
  ),
  '天秤': (
    focus: ('在双方之间找到尺度', 'Find balance across perspectives'),
    character: (
      '你会注意到不同立场，也擅长用有分寸的表达让大家愿意继续谈。',
      'You notice different positions and can phrase things so people stay in conversation.',
    ),
    comfort: (
      '可以商量、有公平感的关系让你安定。心里不舒服时，试着把自己的偏好也讲出来。',
      'Negotiation and fairness help you feel safe. Give your own preferences a voice too.',
    ),
    bond: (
      '你容易在互相尊重、有回应和共同审美的互动里感到被珍惜。',
      'Mutual respect, active responses and shared tastes help you feel valued.',
    ),
    action: (
      '同时看见几种可能以后，给自己一个决定时间，便于从权衡走到实践。',
      'After seeing several possibilities, set a time to decide so weighing turns into action.',
    ),
    growth: (
      '练习兼顾多方感受，也愿意为一个当前能推进的选择承担责任。',
      'Hold several perspectives and take responsibility for a choice that can move things forward.',
    ),
  ),
  '天蝎': (
    focus: ('追到事情的深处', 'Follow the question below the surface'),
    character: (
      '你容易察觉表面说法下面的动机，也倾向把精力留给真正值得投入的事。',
      'You notice motives beneath what is said and reserve energy for what feels worth it.',
    ),
    comfort: (
      '清楚谁能守住约定、哪些信息可以放心分享，会比催着自己放松更有用。',
      'Knowing who keeps agreements and what you can share safely helps you relax.',
    ),
    bond: (
      '你看重真诚和深度，愿意把信任交给经得起相处的人。',
      'You value sincerity and depth and offer trust as people show up consistently.',
    ),
    action: (
      '碰到重要问题时，你能把注意力集中很久，也适合先分清要深挖还是要停手。',
      'You can focus for a long time on a real question. Decide when to dig deeper and when to stop.',
    ),
    growth: (
      '允许信任靠一次次小承诺建立，也把洞察用来解决共同关心的问题。',
      'Let trust build through small commitments and use your insight for shared concerns.',
    ),
  ),
  '射手': (
    focus: ('让远方变成经验', 'Turn the horizon into experience'),
    character: (
      '新地方、新观念和能拓宽眼界的人，容易把你对生活的兴趣带起来。',
      'New places, ideas and people who broaden your view can revive your interest.',
    ),
    comfort: (
      '给自己一个能期待的计划，或暂时换个环境，会帮助你把眼下的问题放回全局。',
      'Something to look forward to or a change of scene can put the present difficulty in perspective.',
    ),
    bond: (
      '你喜欢能一起探索，也能保有各自空间的相处。',
      'You enjoy exploring together while keeping space for separate interests.',
    ),
    action: (
      '明白事情的意义后你会很愿意试。把大的目标接到一个近期能完成的动作上。',
      'Purpose gets you started. Connect a big goal to something you can do soon.',
    ),
    growth: (
      '把抽象兴趣交给亲身验证，再把学到的经验讲给需要的人。',
      'Ground an abstract interest in experience and share what you learn with someone who can use it.',
    ),
  ),
  '摩羯': (
    focus: ('靠积累站稳脚跟', 'Build a foothold over time'),
    character: (
      '你容易从能承担的责任和一步步完成的结果里建立对自己的信任。',
      'Responsibility you can carry and results you can build strengthen your self-trust.',
    ),
    comfort: (
      '把责任列清楚，并划出今天可以先放下的部分，有助于把压力还原成可处理的事情。',
      'Name the responsibilities and what can wait today so pressure becomes manageable.',
    ),
    bond: (
      '你信任能一起兑现承诺的人，也会通过承担事情表示在乎。',
      'You trust people who follow through with you and often show care by taking responsibility.',
    ),
    action: (
      '清楚的阶段目标能给你耐心。也可以为阶段之间留下休息的时间。',
      'Clear milestones support your patience. Leave space to rest between them.',
    ),
    growth: (
      '选一个真正希望承担的目标，按阶段积累口碑、经验和稳定的方法。',
      'Choose a responsibility you want and build reputation, experience and sound methods over time.',
    ),
  ),
  '水瓶': (
    focus: ('给旧问题一个新角度', 'Give an old question a new angle'),
    character: (
      '你倾向先拉开距离看全局，也愿意质疑大家已经习惯的做法。',
      'You step back for the bigger picture and are willing to question familiar routines.',
    ),
    comfort: (
      '保有独立思考的时间，同时找到能理解你想法的人，会让你更自在。',
      'Room for independent thought and someone who understands your ideas help you feel at ease.',
    ),
    bond: (
      '在友谊、好奇与彼此尊重里，你容易发展亲密感，也在乎个人选择。',
      'Friendship, curiosity and mutual respect help intimacy grow, along with freedom of choice.',
    ),
    action: (
      '能试试新规则、改进共同生活或做出更好的工具时，你容易主动投入。',
      'You are drawn to testing better rules, improving shared life or making useful tools.',
    ),
    growth: (
      '把新想法用在具体的人和问题上，听听受影响的人会怎样使用它。',
      'Apply a new idea to a specific problem and listen to the people who would use it.',
    ),
  ),
  '双鱼': (
    focus: ('把感受转成能分享的东西', 'Give feeling a form you can share'),
    character: (
      '你容易接收到语气、气氛和细微变化，也善于用想象把它们组织起来。',
      'You pick up tone and small shifts and use imagination to make sense of them.',
    ),
    comfort: (
      '给感受一个安静的出口，例如散步、画画或听一首熟悉的歌，会帮你辨认自己的需要。',
      'A walk, a drawing or a familiar song can give feelings room and help you recognize what you need.',
    ),
    bond: (
      '你珍惜温柔、想象力和被理解的感觉，也可以把想要的照顾说得具体一点。',
      'You value tenderness and being understood. Say concretely what care would look like to you.',
    ),
    action: (
      '当一件事有画面、情感或你愿意守护的意义时，你更容易投入。',
      'A compelling image, feeling or purpose can draw you into action.',
    ),
    growth: (
      '用具体作品、清晰表达或一件可完成的行动，为直觉和同理心找到出口。',
      'Give intuition and empathy an outlet in a piece of work, clear words or a doable action.',
    ),
  ),
};
