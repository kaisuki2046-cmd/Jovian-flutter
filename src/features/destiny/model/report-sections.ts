export type DestinyReportSection = { title?: string; text: string };

const topicNames: Record<string, string> = {
  综合: '综合', 综合解读: '综合', 整体: '综合', 整体解读: '综合',
  事业: '事业', 事业解读: '事业',
  爱情: '爱情', 感情: '爱情', 爱情解读: '爱情', 感情解读: '爱情',
  学业: '学业', 学业解读: '学业',
  财富: '财富', 财运: '财富', 财富解读: '财富', 财运解读: '财富',
};

function topicHeading(raw: string) {
  const line = raw.trim().replace(/^#{1,6}\s*/u, '').replace(/\s+#+$/u, '')
    .replace(/^(?:[一二三四五]|[1-5])[、.．)）]\s*/u, '');
  const match = /^(?:\*\*|__|【|\[)?(综合解读|整体解读|事业解读|爱情解读|感情解读|学业解读|财富解读|财运解读|综合|整体|事业|爱情|感情|学业|财富|财运)(?:\*\*|__|】|\])?\s*(?:[:：]\s*(.*))?$/u.exec(line);
  return match ? { title: topicNames[match[1]], text: match[2] ?? '' } : null;
}

// Preserve the prose and its order; old reports without titles stay readable.
export function splitDestinyReport(text: string): DestinyReportSection[] {
  const sections: DestinyReportSection[] = [];
  let title: string | undefined;
  let lines: string[] = [];
  const flush = () => {
    const body = lines.join('\n').trim();
    if (title || body) sections.push({ ...(title && { title }), text: body });
    lines = [];
  };
  for (const line of text.replace(/\r\n?/gu, '\n').split('\n')) {
    const heading = topicHeading(line);
    if (!heading) { lines.push(line); continue; }
    flush();
    title = heading.title;
    if (heading.text) lines.push(heading.text);
  }
  flush();
  return sections;
}
