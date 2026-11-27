import type { ChatReply, ChatRoute, TaskKind } from '../model/conversation';
import { maxQuestionLength } from '../../../shared/content-limits.mjs';

import { getReadingTopic } from './reading-guidance.mjs';

export const maxMessageLength = maxQuestionLength;

export const recommendedReadingQuestions = [
  '这次面试会顺利吗？',
  '这段感情接下来会怎么发展？',
  '最近什么时候适合搬家？',
] as const;

const taskPrompts: Record<TaskKind, string> = {
  divination: '你想问哪件事？可以说说具体情况，比如「我在考虑换工作，想梳理现在的选择」。',
  compatibility: '你想了解哪段关系的哪个方面？例如「我想看看伴侣间的沟通方式」。',
  naming: '请告诉我姓氏，也可以补充字数或风格。例如「姓林，想要清雅的双字名」。',
};

const previews: Record<Exclude<TaskKind, 'divination'>, string> = {
  compatibility: '问题已进入合盘流程。正式版会在补充双方资料后，展示相处模式、互补之处和沟通建议。',
  naming: '需求已进入五行起名流程。正式版会根据姓氏和偏好展示候选名字、读音和寓意。',
};

const taskSignals: Record<TaskKind, RegExp> = {
  divination: /算一件事|算事|占问|占卜|起[一个]?卦|六爻|塔罗|梅花易数/,
  compatibility: /合盘|配对|合不合|八字合|匹不匹配/,
  naming: /起名|取名|改名|名字|姓氏|姓[\u3400-\u9fff]|[\u3400-\u9fff]姓/,
};

const eventTopics = /工作|辞职|求职|面试|跳槽|升职|考试|学习|留学|录取|合作|项目|感情|复合|表白|求婚|搬家|旅行|出行|比赛|官宣|申请|邀约|联系|租房|买房|卖房|入职|转行|创业/;
const relationshipFocus = /沟通|相处|冲突|磨合|情感需求|合不合|合适|默契|长期关系|亲密关系|信任/;
const surname = /(?:^|[，。！？、：:！?\s])(?:我家?|宝宝|孩子)?姓(?:氏)?[：:\s]*[\u3400-\u9fff]|[\u3400-\u9fff]姓(?=$|[，。！？、：:\s])/;
const greeting = /^(你好|您好|嗨|哈喽|早上好|晚上好|谢谢|感谢|hello|hi)[\s!！。~～]*$/i;
const unrelated = /今[天日].*天气|天气预报|翻译|写代码|讲[一个]*笑话|写[一篇]*作文|查资料/;
const timingWords = /什么时候|何时|哪天|哪月|几号|几月|几天|多久|多长时间|多会儿/;
const bareTiming = /^(?:(?:请问|我想问|帮我看看|帮我算算|想知道)[，、：:]?)*(?:什么时候|何时|哪天|哪月|几号|几月|几天|多久|多长时间|多会儿)(?:呢|啊|呀)?$/;
const readingIntro = /^(?:(?:请|帮我|我想|给我|想)?(?:算一下|算一算|算算|算一卦|占问|占卜|看看|猜一下|猜猜)|请问|我想问|想知道)[\s，、：:]*/;

export function asksAboutTiming(question: string) {
  const text = question.trim().replace(/[\s？?！!。]/g, '');
  return timingWords.test(text) && !bareTiming.test(text);
}

export function asksAboutColor(question: string) {
  const text = question.trim().replace(readingIntro, '').replace(/[\s？?！!。]+$/, '');
  return /.+(?:什么|哪[种个]?)(?:颜色|色)(?:的.+|[呢啊呀])?$/u.test(text)
    || /.+的颜色$/u.test(text) && readingIntro.test(question.trim())
    || /^(?:what|which) colou?r (?:is|was|are|were|did|do|does)\s+\S/i.test(text);
}

export function questionWithClarification(previous: string | null, latest: string) {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s，,。！？!?]/g, '');
  if (!previous || normalize(previous) === normalize(latest)) return latest;

  if (readingIntro.test(latest) || asksAboutTiming(latest) || asksAboutColor(latest)
      || /(?:.{2,}(?:怎么|怎样|为什么|能不能|会不会|要不要|如何|是什么|哪[一几]个)|^(?:what|when|where|who|why|how)\s+\S+(?:\s+\S+)+)/i.test(latest)) {
    return latest;
  }

  const supplemented = `${previous}；补充：${latest}`;
  return validateMessage(supplemented) ? latest : supplemented;
}
const sensitiveRequest = /自杀|自残|轻生|想死|不想活|伤害自己|杀[人他她]|伤害他人|什么时候会死|何时会死|死期|会不会死|灾祸|诊断|是不是得了|患癌|癌症|开药|停药|怎么治|用药|加药|药量|化疗|手术|去医院|胸痛|股票|炒股|投资|基金|期货|炒币|加杠杆|能赚多少|稳赚|诉讼|判刑|起诉|会判多久|违法|犯法吗|胜诉/;

export function isSensitiveQuestion(message: string) {
  return sensitiveRequest.test(message);
}

export function validateMessage(draft: string) {
  if (!draft.trim()) return '请输入你的问题。';
  if (draft.trim().length > maxMessageLength) return `请把问题控制在 ${maxMessageLength} 字以内。`;
  return undefined;
}

export function promptForTask(task: TaskKind): ChatReply {
  return { kind: 'prompt', task, text: taskPrompts[task] };
}

export function classifyPreview(message: string, activeTask: TaskKind | null): ChatRoute {
  if (sensitiveRequest.test(message)) {
    return {
      kind: 'guidance',
      text: '这类问题请寻求相应专业支持。如果你或他人正面临紧急危险，请立即联系当地紧急服务。',
    };
  }
  if (greeting.test(message)) {
    return { kind: 'guidance', text: '你好！你可以问一件具体的事，也可以选择合盘或五行起名。' };
  }

  const matches = (Object.keys(taskSignals) as TaskKind[]).filter((task) => taskSignals[task].test(message));
  if (matches.length > 1) {
    return { kind: 'prompt', task: null, text: '你想先算一件事、看合盘，还是五行起名？请选择一个入口。' };
  }
  if (matches.length === 0 && unrelated.test(message)) {
    return { kind: 'guidance', text: '我可以陪你梳理一件具体的事，也可以引导你体验合盘或五行起名。' };
  }
  if ((asksAboutTiming(message) || asksAboutColor(message)) && (matches[0] === 'divination'
      || (matches.length === 0 && (activeTask === null || activeTask === 'divination')))) {
    return { kind: 'confirmReading' };
  }

  const task = matches[0] ?? activeTask ?? (eventTopics.test(message) ? 'divination' : null);
  if (!task) {
    return {
      kind: 'prompt',
      task: null,
      text: '能具体说说你想问哪件事吗？也可以点加号里的「快捷提问」，选择合盘或五行起名。',
    };
  }

  if (task === 'divination') {
    return eventTopics.test(message) && message.length >= 5 ? { kind: 'confirmReading' } : promptForTask(task);
  }

  const hasDetails = task === 'compatibility' ? relationshipFocus.test(message) : surname.test(message);
  return hasDetails ? { kind: 'preview', task, text: previews[task] } : promptForTask(task);
}

export function canReadQuestion(question: string) {
  if (validateMessage(question) || isSensitiveQuestion(question)) return false;
  const reply = classifyPreview(question, 'divination');
  return reply.kind === 'confirmReading' || (reply.kind === 'prompt' && reply.task === 'divination');
}

export function understandLocally(question: string) {
  const vague = question.trim().replace(/[\s？?！!。]/g, '');
  const clarification = vague.length < 5 || /^(?:最近|帮我|能不能|我想|想|用|请用)*(?:算一件事|算事|占卜|抽牌|抽塔罗|塔罗|六爻|梅花易数|梅花|起卦|看看|算一下|这件事怎么样|这件事能成吗|这件事能不能成|怎么办|未来怎么样)(?:看看|算一下|起卦)?$/.test(vague);
  const topic = getReadingTopic(question);
  return {
    focus: topic.id === 'general' ? '梳理你问的这件事，以及可以采取的下一步。' : '围绕' + topic.focus + '梳理你现在的选择。',
    clarification: clarification ? '可以补充你想问的具体事情，以及最想弄清的一个点。' : '',
    source: 'local' as const,
  };
}
