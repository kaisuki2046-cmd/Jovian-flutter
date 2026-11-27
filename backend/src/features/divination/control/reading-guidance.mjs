const jobChangeQuestion = /换(?:一份|一个|份|个)?新?工作|跳槽|换岗|辞职|离职|转行/;
const topics = [
  { id: 'work-change', match: jobChangeQuestion, focus: '工作内容、团队环境或发展空间', check: '问清岗位的实际职责，再用同一个标准对照现职和候选岗位。', try: '安排一次了解岗位的面谈，记录它能改善哪一项你最在意的条件。' },
  { id: 'work', match: /工作|求职|面试|升职|入职|合作|项目|创业/, focus: '职责、资源或时间安排', check: '找出一项会影响选择的现实条件，向直接相关的人核实。', try: '先约一次短沟通或做一个小样，把反馈记下来再决定是否继续。' },
  { id: 'relationship', match: /感情|复合|表白|求婚|联系|邀约|关系|相处/, focus: '双方能确认的意愿和界限', check: '把你已经观察到的行为和自己的猜测分别写下来，再选一个适合直接沟通的问题。', try: '用一句具体、开放的问题了解对方的想法，也给对方留出回应的空间。' },
  { id: 'study', match: /考试|学习|留学|录取|申请/, focus: '时间、准备情况或实际要求', check: '查一份原始要求，标记最可能影响你选择的一个条件。', try: '用一小段练习或一份材料清单检验目前的准备情况。' },
  { id: 'move', match: /搬家|旅行|出行|租房|买房|卖房/, focus: '预算、时间或日常安排', check: '把最不能妥协的一项条件写下来，用实际报价或现场信息核实。', try: '先实地走一趟，记录实际时间和最在意的体验。' },
];

const generalTopic = {
  id: 'general', focus: '你最在意的现实条件',
  check: '写下一条会让你改变决定的问题，再找一个可靠的人或一份原始记录去确认。',
  try: '选一个这周能完成的小动作，提前想好用什么反馈来决定是否继续。',
};

/** @param {string} question */
export function getReadingTopic(question) {
  return topics.find(({ match }) => match.test(question)) ?? generalTopic;
}

/** @param {string} question */
export function isJobChangeQuestion(question) {
  return jobChangeQuestion.test(question);
}

/** @param {string} question @param {import('../model/iching').ReadingDirection} direction */
export function getReadingAction(question, direction) {
  const topic = getReadingTopic(question);
  if (direction === 'adjust') {
    return topic.id === 'work-change'
      ? '先从现职中选一项能调整的分工或工作量。试过之后，再比较哪种工作安排更适合你。'
      : '选一个能减轻当前阻力的调整，例如缩小范围或重排时间。做完后记录实际变化。';
  }
  if (direction === 'advance') return topic.try;
  return topic.id === 'work-change'
    ? '先选一项会决定去留的条件，比如岗位职责、薪资或试用期要求。向招聘方问清楚，再用同一标准比较新旧岗位。'
    : topic.check;
}
