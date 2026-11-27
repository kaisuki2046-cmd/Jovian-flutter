import { digest, toRuntimeKnowledgeEntry } from './manifest.mjs';

const key = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const nonEmpty = value => typeof value === 'string' && Boolean(value.trim());
const natalFields = { bazi: 'element', ziwei: 'lifeStar', western: 'sign' };

export function buildFortuneAdviceIndex(db, groups, entries) {
  db.exec(`
    CREATE TABLE advice_group (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, method TEXT NOT NULL REFERENCES library(method),
      natal_field TEXT, source_order INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE advice_theme (
      id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES advice_group(id), label TEXT NOT NULL,
      natal_value TEXT, source_order INTEGER NOT NULL, UNIQUE(group_id, natal_value)
    ) STRICT;
    CREATE INDEX advice_natal ON advice_theme(natal_value);
    CREATE TABLE advice_theme_entry (
      knowledge_id INTEGER PRIMARY KEY REFERENCES knowledge_entry(id),
      theme_id TEXT NOT NULL REFERENCES advice_theme(id)
    ) STRICT;
    CREATE INDEX advice_lookup ON advice_theme_entry(theme_id);
  `);
  const adviceById = new Map(entries.filter(entry => entry.category.contentType === '建议').map(entry => [entry.id, entry]));
  const mapped = new Set();
  const writeGroup = db.prepare('INSERT INTO advice_group VALUES (?, ?, ?, ?, ?)');
  const writeTheme = db.prepare('INSERT INTO advice_theme VALUES (?, ?, ?, ?, ?)');
  const writeMatch = db.prepare('INSERT INTO advice_theme_entry VALUES (?, ?)');
  for (const [groupOrder, group] of groups.entries()) {
    if (!nonEmpty(group?.id) || !key.test(group.id) || !nonEmpty(group.label) || !Object.hasOwn(natalFields, group.method)
      || (group.natalField !== undefined && group.natalField !== natalFields[group.method])
      || !Array.isArray(group.themes) || !group.themes.length) throw new Error('Invalid fortune advice group: ' + group?.id);
    writeGroup.run(group.id, group.label, group.method, group.natalField ?? null, groupOrder);
    for (const [themeOrder, theme] of group.themes.entries()) {
      if (!nonEmpty(theme?.id) || theme.id.length > 72 || !key.test(theme.id) || !theme.id.startsWith(group.id + '-')
        || !nonEmpty(theme.label) || (theme.natalValue !== undefined && (!group.natalField || !nonEmpty(theme.natalValue)))
        || !Array.isArray(theme.entryIds) || !theme.entryIds.length) throw new Error('Invalid fortune advice theme: ' + theme?.id);
      writeTheme.run(theme.id, group.id, theme.label, theme.natalValue ?? null, themeOrder);
      for (const id of theme.entryIds) {
        const entry = adviceById.get(id);
        if (!entry || entry.category.method !== group.method || mapped.has(id)) {
          throw new Error('Invalid fortune advice entry ID: ' + id);
        }
        const sourceHash = entry.legacy?.adviceSourceHash;
        if (sourceHash !== undefined) {
          const { reportTopic, ...reviewedEntry } = toRuntimeKnowledgeEntry(entry);
          if (sourceHash !== digest(JSON.stringify(reviewedEntry))) throw new Error('Fortune advice source review is stale: ' + id);
        }
        mapped.add(id);
        writeMatch.run(id, theme.id);
      }
    }
  }
}

export function readFortuneAdviceIndex(db, readEntry) {
  const selections = db.prepare(`SELECT g.id AS group_id, g.label AS group_label, g.method, t.id, t.label
    FROM advice_group g JOIN advice_theme t ON t.group_id = g.id
    ORDER BY g.source_order, t.source_order`);
  const matchRows = `FROM advice_theme t JOIN advice_group g ON g.id = t.group_id
    JOIN advice_theme_entry a ON a.theme_id = t.id JOIN knowledge_entry e ON e.id = a.knowledge_id`;
  const selected = db.prepare(`SELECT g.method, t.label AS theme, e.payload ${matchRows}
    WHERE t.id = ? ORDER BY e.source_order`);
  const natal = db.prepare(`SELECT g.method, t.natal_value AS theme, e.payload ${matchRows}
    WHERE g.natal_field = ? AND t.natal_value = ? ORDER BY e.source_order`);
  const coverage = db.prepare(`SELECT e.method, count(*) AS entries, count(a.knowledge_id) AS available,
    count(*) - count(a.knowledge_id) AS unsupported
    FROM knowledge_entry e LEFT JOIN advice_theme_entry a ON a.knowledge_id = e.id
    WHERE e.kind = '建议' GROUP BY e.method ORDER BY e.method`);
  const hash = db.prepare("SELECT value FROM metadata WHERE key = 'advice_hash'");
  const readMatches = rows => rows.map(row => ({ method: row.method, theme: row.theme, entry: readEntry(row) }));
  return {
    adviceOptions() {
      const groups = new Map();
      for (const row of selections.iterate()) {
        if (!groups.has(row.group_id)) groups.set(row.group_id, {
          id: row.group_id, label: row.group_label, method: row.method, options: [],
        });
        groups.get(row.group_id).options.push({ id: row.id, label: row.label });
      }
      return [...groups.values()];
    },
    matchSelectedAdvice(id) { return readMatches(selected.all(id)); },
    matchNatalAdvice(field, value) { return readMatches(natal.all(field, value)); },
    adviceCoverage() { return coverage.all(); },
    adviceHash() { return hash.get().value; },
  };
}
