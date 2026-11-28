import { randomUUID } from 'node:crypto';

const pageSize = 30;

function messageVisible(sender) {
  return `NOT EXISTS (SELECT 1 FROM social_blocks b WHERE
    (b.blocker_id = @viewer AND b.blocked_id = ${sender}) OR
    (b.blocked_id = @viewer AND b.blocker_id = ${sender}))`;
}

export function createMessageStore(db, transaction) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_conversations (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('direct','group')),
      title TEXT NOT NULL DEFAULT '',
      direct_first TEXT REFERENCES account_users(id) ON DELETE CASCADE,
      direct_second TEXT REFERENCES account_users(id) ON DELETE CASCADE,
      creator_id TEXT REFERENCES account_users(id) ON DELETE SET NULL,
      nonce TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE (direct_first, direct_second),
      UNIQUE (creator_id, nonce)
    );
    CREATE TABLE IF NOT EXISTS social_conversation_members (
      thread_id TEXT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      read_id INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (thread_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS social_conversations_by_member
      ON social_conversation_members(user_id, pinned, thread_id);
    CREATE TABLE IF NOT EXISTS social_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      nonce TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      reply_id INTEGER REFERENCES social_messages(id) ON DELETE SET NULL,
      media_kind TEXT,
      media_name TEXT,
      media_type TEXT,
      media_bytes BLOB,
      UNIQUE (thread_id, sender_id, nonce)
    );
    CREATE INDEX IF NOT EXISTS social_messages_by_thread ON social_messages(thread_id, id);
    CREATE TRIGGER IF NOT EXISTS remove_empty_social_group
      AFTER DELETE ON social_conversation_members
      WHEN NOT EXISTS (SELECT 1 FROM social_conversation_members WHERE thread_id = OLD.thread_id)
      BEGIN DELETE FROM social_conversations WHERE id = OLD.thread_id AND kind = 'group'; END;
  `);
  const direct = db.prepare('SELECT id FROM social_conversations WHERE direct_first = ? AND direct_second = ?');
  const group = db.prepare('SELECT id FROM social_conversations WHERE creator_id = ? AND nonce = ?');
  const addThread = db.prepare(`INSERT INTO social_conversations
    (id, kind, title, direct_first, direct_second, creator_id, nonce, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const addMember = db.prepare('INSERT INTO social_conversation_members (thread_id, user_id) VALUES (?, ?)');
  const memberRows = db.prepare(`SELECT m.user_id AS id FROM social_conversation_members m
    WHERE m.thread_id = @thread AND ${messageVisible('m.user_id')} ORDER BY m.user_id`);
  const memberFields = `t.id, t.kind, t.title, m.pinned,
    CASE WHEN t.direct_first = @viewer THEN t.direct_second ELSE t.direct_first END AS peerId`;
  const permittedThread = `t.kind = 'group' OR ${messageVisible(
    'CASE WHEN t.direct_first = @viewer THEN t.direct_second ELSE t.direct_first END',
  )}`;
  const membership = db.prepare(`SELECT ${memberFields} FROM social_conversation_members m
    JOIN social_conversations t ON t.id = m.thread_id
    WHERE m.user_id = @viewer AND t.id = @thread AND (${permittedThread})`);
  const messageVisibleToViewer = messageVisible('s.sender_id');
  const summary = `SELECT ${memberFields}, COALESCE(recent.created_at, t.created_at) AS updatedAt,
    substr(recent.body, 1, 160) AS preview, recent.media_kind AS previewKind,
    (SELECT count(*) FROM social_messages s WHERE s.thread_id = t.id AND s.id > m.read_id
      AND s.sender_id <> @viewer AND ${messageVisibleToViewer}) AS unread,
    matched.id AS matchId,
    CASE WHEN instr(lower(matched.body), lower(@query)) > 0 THEN substr(matched.body, 1, 160)
      ELSE matched.media_name END AS matchText
    FROM social_conversation_members m JOIN social_conversations t ON t.id = m.thread_id
    LEFT JOIN social_messages recent ON recent.id = (
      SELECT s.id FROM social_messages s WHERE s.thread_id = t.id AND ${messageVisibleToViewer}
      ORDER BY s.id DESC LIMIT 1
    )
    LEFT JOIN social_messages matched ON @query <> '' AND matched.id = (
      SELECT s.id FROM social_messages s WHERE s.thread_id = t.id AND ${messageVisibleToViewer}
        AND (instr(lower(s.body), lower(@query)) > 0 OR instr(lower(s.media_name), lower(@query)) > 0)
      ORDER BY s.id DESC LIMIT 1
    )
    WHERE m.user_id = @viewer AND (${permittedThread})`;
  const inbox = db.prepare(`WITH summaries AS (${summary})
    SELECT * FROM summaries WHERE (pinned, updatedAt, id) < (@pin, @time, @before)
      AND (@unreadOnly = 0 OR unread > 0)
      AND (@query = '' OR instr(lower(title), lower(@query)) > 0 OR matchText IS NOT NULL
        OR peerId IN (SELECT value FROM json_each(@contacts)))
    ORDER BY pinned DESC, updatedAt DESC, id DESC LIMIT ${pageSize + 1}`);
  const oneSummary = db.prepare(summary + ' AND t.id = @thread');
  const messageFields = `s.id, s.sender_id AS senderId, s.body, s.created_at AS createdAt,
    s.media_kind AS mediaKind, s.media_name AS mediaName, s.media_type AS mediaType,
    length(s.media_bytes) AS mediaSize,
    q.sender_id AS replySenderId, q.body AS replyBody, q.media_kind AS replyKind`;
  const messages = `SELECT ${messageFields} FROM social_messages s
    LEFT JOIN social_messages q ON q.id = s.reply_id AND ${messageVisible('q.sender_id')}
    WHERE s.thread_id = @thread AND ${messageVisibleToViewer}`;
  const older = db.prepare(messages + ` AND s.id < @before ORDER BY s.id DESC LIMIT ${pageSize + 1}`);
  const message = db.prepare(messages + ' AND s.id = @id');
  const existing = db.prepare('SELECT id FROM social_messages WHERE thread_id = ? AND sender_id = ? AND nonce = ?');
  const deliver = db.prepare(`INSERT INTO social_messages
    (thread_id, sender_id, nonce, body, created_at, reply_id, media_kind, media_name, media_type, media_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
  const read = db.prepare(`UPDATE social_conversation_members SET read_id = max(read_id, ?)
    WHERE thread_id = ? AND user_id = ?`);
  const pin = db.prepare('UPDATE social_conversation_members SET pinned = ? WHERE thread_id = ? AND user_id = ?');
  const attachment = db.prepare(`SELECT s.media_bytes AS bytes FROM social_messages s
    WHERE s.thread_id = @thread AND s.id = @id AND s.media_bytes IS NOT NULL AND ${messageVisibleToViewer}`);

  return {
    membership: (viewer, thread) => membership.get({ viewer, thread }),
    members: (viewer, thread) => memberRows.all({ viewer, thread }),
    summary: (viewer, thread) => oneSummary.get({ viewer, thread, query: '' }),
    list(viewer, { pin, time, before, unreadOnly, query, contacts }) {
      const rows = inbox.all({ viewer, pin, time, before, unreadOnly, query, contacts: JSON.stringify(contacts) });
      const items = rows.slice(0, pageSize);
      const last = items.at(-1);
      const next = rows.length > pageSize ? `${last.pinned}.${last.updatedAt}.${last.id}` : undefined;
      return { items, next };
    },
    start(viewer, targets, title, nonce, now) {
      const groupChat = title !== null;
      const [first, second] = groupChat ? [null, null] : [viewer, targets[0]].sort();
      return transaction(() => {
        const previous = groupChat ? group.get(viewer, nonce) : direct.get(first, second);
        if (previous) return previous.id;
        const id = randomUUID();
        addThread.run(id, groupChat ? 'group' : 'direct', title ?? '', first, second, viewer, nonce, now);
        for (const member of [viewer, ...targets]) addMember.run(id, member);
        return id;
      });
    },
    messages(viewer, thread, before) {
      const rows = older.all({ viewer, thread, before });
      const items = rows.slice(0, pageSize);
      return { items, next: rows.length > pageSize ? items.at(-1).id : undefined };
    },
    send(viewer, thread, { nonce, body, replyTo, media }, time) {
      return transaction(() => {
        const saved = existing.get(thread, viewer, nonce);
        if (saved) return message.get({ viewer, thread, id: saved.id });
        if (replyTo !== null && !message.get({ viewer, thread, id: replyTo })) return;
        const { id } = deliver.get(thread, viewer, nonce, body, time, replyTo,
          media?.kind ?? null, media?.name ?? null, media?.type ?? null, media?.bytes ?? null);
        return message.get({ viewer, thread, id });
      });
    },
    markRead(viewer, thread, id) {
      if (!message.get({ viewer, thread, id })) return false;
      read.run(id, thread, viewer);
      return true;
    },
    setPinned: (viewer, thread, value) => pin.run(Number(value), thread, viewer),
    attachment: (viewer, thread, id) => attachment.get({ viewer, thread, id }),
  };
}
