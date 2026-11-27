import { demoFriendSeeds } from './demo-friends';

export const demoReports = {
  all: '个人综合分析',
  career: '事业与财富探索',
  love: '情感与关系观察',
} as const;
export const maxMessageLength = 500;
const maxThreadLength = 90;
const strangerDemoId = 'sora_c';
const contactNames = new Intl.Collator('zh-Hans-u-co-pinyin', { sensitivity: 'base', numeric: true });

// The imported demo only stored weekday/clock labels. Anchor its sample week
// once so reloading later cannot move those messages above real chats.
const demoDay = Date.UTC(2026, 10, 20);
const demoWeekday = new Date(demoDay).getUTCDay();
const weekdays = '日一二三四五六';

export const werewolfGame = {
  id: 'game-werewolf-1123',
  groupName: '11：23 狼人杀局',
  notice: '组局成功！请于11.23日19：00到丰兴广场2101参加狼人杀吧~',
} as const;

export type DemoReport = keyof typeof demoReports;
export type MessageContent = { kind: 'text'; text: string } | { kind: 'report'; report: DemoReport };
type SeedMessage = MessageContent & { side: 'me' | 'other'; time: string };
export type DemoFriendSeed = {
  id: string;
  name: string;
  online: boolean;
  bio?: string;
  colors?: readonly [string, string, string];
  unread: number;
  thread: readonly SeedMessage[];
};

export type DemoMessage = MessageContent & {
  id: number;
  side: 'me' | 'other';
  time?: string;
  sentAt?: number;
  demo?: boolean;
};

export type DemoConversation = {
  id: string;
  name: string;
  kind: 'friend' | 'group' | 'stranger';
  bio?: string;
  online?: boolean;
  unread: number;
  thread: DemoMessage[];
  createdAt?: number;
  members?: string[];
};

type InboxRow = { kind: 'conversation'; item: DemoConversation }
  | { kind: 'strangers' | 'games'; items: DemoConversation[] };

export function createDemoConversations(): DemoConversation[] {
  return demoFriendSeeds.map((friend: DemoFriendSeed) => ({
    id: friend.id,
    name: friend.name,
    bio: friend.bio,
    online: friend.online,
    unread: friend.unread,
    kind: friend.id === strangerDemoId ? 'stranger' : 'friend',
    thread: friend.thread.map((message, index) => ({ ...message, id: index + 1, demo: true })),
  }));
}

export function withWerewolfGame(conversations: DemoConversation[]): DemoConversation[] {
  if (conversations.some(item => item.id === werewolfGame.id)) return conversations;
  return [...conversations, {
    id: werewolfGame.id,
    name: werewolfGame.groupName,
    kind: 'group',
    bio: '8 人群聊',
    // A group's stored members are the other participants. The local user is implicit.
    members: demoFriendSeeds.filter(friend => friend.id !== strangerDemoId).map(friend => friend.id),
    unread: 0,
    thread: [],
  }];
}

function demoMessageTime(time: string | undefined) {
  const parts = /^(?:(今天|昨天|周[日一二三四五六])\s+)?(\d{1,2})[:：](\d{2})$/.exec(time?.trim() ?? '');
  if (!parts) return;
  const [, day, hours, minutes] = parts;
  const hour = Number(hours);
  const minute = Number(minutes);
  if (hour > 23 || minute > 59) return;
  let daysAgo = 0;
  if (day === '昨天') daysAgo = 1;
  else if (day?.startsWith('周')) daysAgo = (demoWeekday - weekdays.indexOf(day[1]) + 7) % 7 || 7;
  return demoDay - daysAgo * 86_400_000 + ((hour - 8) * 60 + minute) * 60_000;
}

function lastActivity(item: DemoConversation | undefined) {
  if (!item) return 0;
  for (let index = item.thread.length - 1; index >= 0; index--) {
    const message = item.thread[index];
    const time = message.sentAt ?? demoMessageTime(message.time);
    if (time !== undefined) return time;
  }
  return item.createdAt ?? 0;
}

export function findConversations(
  conversations: readonly DemoConversation[], query: string, friendsOnly: boolean, translate = (text: string) => text,
) {
  const needle = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(needle);
  const matchesDemo = (text: string) => matches(text) || matches(translate(text));
  return conversations.filter(item => {
    if (friendsOnly && item.kind !== 'friend') return false;
    if (!needle) return true;
    return matches(item.name) || matches(item.id) || matchesDemo(item.bio ?? '') || item.thread.some(message => {
      if (message.kind === 'report') return matchesDemo(demoReports[message.report]);
      return message.demo ? matchesDemo(message.text) : matches(message.text);
    });
  }).sort(friendsOnly
    ? (left, right) => contactNames.compare(left.name, right.name)
    : (left, right) => lastActivity(right) - lastActivity(left));
}

export function buildInboxRows(
  matches: readonly DemoConversation[], query: string, translate = (text: string) => text,
): InboxRow[] {
  const rows: InboxRow[] = [];
  const strangers: DemoConversation[] = [];
  const games: DemoConversation[] = [];
  for (const item of matches) {
    if (item.kind === 'stranger') strangers.push(item);
    else if (item.id === werewolfGame.id) games.push(item);
    else rows.push({ kind: 'conversation', item });
  }

  const needle = query.trim().toLowerCase();
  if (!needle || strangers.length) rows.push({ kind: 'strangers', items: strangers });
  if (!needle || games.length || ['组局消息', werewolfGame.notice].some(text =>
    text.toLowerCase().includes(needle) || translate(text).toLowerCase().includes(needle))) {
    rows.push({ kind: 'games', items: games });
  }
  const activity = (row: InboxRow) => lastActivity(row.kind === 'conversation' ? row.item : row.items[0]);
  return rows.sort((left, right) => activity(right) - activity(left));
}

export function appendMessage(item: DemoConversation, content: MessageContent, sentAt: number): DemoConversation {
  const last = item.thread.at(-1);
  const message: DemoMessage = { ...content, id: (last?.id ?? 0) + 1, side: 'me', sentAt };
  return { ...item, thread: [...item.thread.slice(1 - maxThreadLength), message] };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validMessage(value: unknown): value is DemoMessage {
  return record(value) && Number.isSafeInteger(value.id) && (value.side === 'me' || value.side === 'other')
    && (value.time === undefined || typeof value.time === 'string')
    && (value.sentAt === undefined || (typeof value.sentAt === 'number' && Number.isFinite(value.sentAt)))
    && (value.kind === 'text' ? typeof value.text === 'string'
      : value.kind === 'report' && typeof value.report === 'string' && Object.hasOwn(demoReports, value.report));
}

function validConversation(value: unknown): value is DemoConversation {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string'
    && (value.kind === 'friend' || value.kind === 'group' || value.kind === 'stranger')
    && Number.isSafeInteger(value.unread) && Array.isArray(value.thread) && value.thread.every(validMessage)
    && (value.bio === undefined || typeof value.bio === 'string')
    && (value.createdAt === undefined || (typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)))
    && (value.members === undefined || (Array.isArray(value.members) && value.members.every(member => typeof member === 'string')));
}

export function parseDemoConversations(raw: string): DemoConversation[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(validConversation)) throw new Error('Invalid local conversation data');
  // Earlier versions stored this demo conversation alongside friends.
  return value.map(item => item.id === strangerDemoId && item.kind === 'friend' ? { ...item, kind: 'stranger' } : item);
}
