import { randomUUID } from 'node:crypto';

const pageSize = 30;

function paginate(entries) {
  const items = entries.slice(0, pageSize);
  const last = items.at(-1);
  return { items, next: entries.length > pageSize ? `${last.createdAt}.${last.id}` : undefined };
}

export function createRelationshipStore(db, transaction) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_discoverability (
      user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
      allowed INTEGER NOT NULL CHECK (allowed IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS social_follows (
      follower_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      followee_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (follower_id, followee_id),
      CHECK (follower_id <> followee_id)
    );
    CREATE INDEX IF NOT EXISTS social_follower_pages ON social_follows(followee_id, created_at, follower_id);
    CREATE INDEX IF NOT EXISTS social_following_pages ON social_follows(follower_id, created_at, followee_id);
    CREATE TABLE IF NOT EXISTS social_blocks (
      blocker_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      PRIMARY KEY (blocker_id, blocked_id),
      CHECK (blocker_id <> blocked_id)
    );
    CREATE INDEX IF NOT EXISTS social_block_target ON social_blocks(blocked_id);
    CREATE TABLE IF NOT EXISTS social_reports (
      reporter_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      detail TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (reporter_id, target_id),
      CHECK (reporter_id <> target_id)
    );
    CREATE INDEX IF NOT EXISTS social_report_target ON social_reports(target_id);
    CREATE TABLE IF NOT EXISTS social_follower_notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      read_at INTEGER,
      suppressed INTEGER NOT NULL DEFAULT 0,
      UNIQUE (recipient_id, actor_id)
    );
    CREATE INDEX IF NOT EXISTS social_notification_pages
      ON social_follower_notifications(recipient_id, created_at, id) WHERE suppressed = 0;
    CREATE INDEX IF NOT EXISTS social_notification_actor ON social_follower_notifications(actor_id);
    CREATE TABLE IF NOT EXISTS social_report_cases (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reviewed_at INTEGER,
      reviewer_id TEXT REFERENCES account_users(id) ON DELETE SET NULL,
      conclusion TEXT,
      UNIQUE (reporter_id, target_id),
      FOREIGN KEY (reporter_id, target_id) REFERENCES social_reports(reporter_id, target_id) ON DELETE CASCADE
    );
  `);
  db.exec(`INSERT INTO social_report_cases (id, reporter_id, target_id)
    SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2))
      || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))), reporter_id, target_id
    FROM social_reports WHERE NOT EXISTS (SELECT 1 FROM social_report_cases c
      WHERE c.reporter_id = social_reports.reporter_id AND c.target_id = social_reports.target_id)`);
  const see = db.prepare('SELECT allowed FROM social_discoverability WHERE user_id = ?');
  const setSee = db.prepare(`INSERT INTO social_discoverability VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET allowed = excluded.allowed`);
  const follows = db.prepare('SELECT 1 FROM social_follows WHERE follower_id = ? AND followee_id = ?');
  const blocked = db.prepare('SELECT 1 FROM social_blocks WHERE blocker_id = ? AND blocked_id = ?');
  const counts = db.prepare(`SELECT (SELECT count(*) FROM social_follows WHERE follower_id = ?) AS following,
    (SELECT count(*) FROM social_follows WHERE followee_id = ?) AS followers`);
  const addFollow = db.prepare('INSERT INTO social_follows VALUES (?, ?, ?) ON CONFLICT DO NOTHING');
  const removeFollow = db.prepare('DELETE FROM social_follows WHERE follower_id = ? AND followee_id = ?');
  const addBlock = db.prepare('INSERT INTO social_blocks VALUES (?, ?) ON CONFLICT DO NOTHING');
  const removeBlock = db.prepare('DELETE FROM social_blocks WHERE blocker_id = ? AND blocked_id = ?');
  const listBlocks = db.prepare('SELECT blocked_id AS id FROM social_blocks WHERE blocker_id = ? ORDER BY blocked_id');
  const report = db.prepare(`INSERT INTO social_reports (reporter_id, target_id, reason, detail, created_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`);
  const addCase = db.prepare('INSERT INTO social_report_cases (id, reporter_id, target_id) VALUES (?, ?, ?)');
  const reportRows = `SELECT c.id, r.reporter_id AS reporterId, r.target_id AS targetId, r.reason, r.detail,
    r.status, r.created_at AS createdAt, c.reviewed_at AS reviewedAt, c.reviewer_id AS reviewerId, c.conclusion
    FROM social_reports r JOIN social_report_cases c USING (reporter_id, target_id)`;
  const reportForPair = db.prepare(reportRows + ' WHERE r.reporter_id = ? AND r.target_id = ?');
  const reportById = db.prepare(reportRows + ' WHERE c.id = ?');
  const reportPage = (condition) => db.prepare(reportRows + ` WHERE ${condition} AND (r.created_at, c.id) < (?, ?)
    ORDER BY r.created_at DESC, c.id DESC LIMIT ${pageSize + 1}`);
  const ownReports = reportPage('r.reporter_id = ?');
  const pendingReports = reportPage("r.status = 'pending'");
  const changeReportStatus = db.prepare('UPDATE social_reports SET status = ? WHERE reporter_id = ? AND target_id = ?');
  const reviewReport = db.prepare('UPDATE social_report_cases SET reviewed_at = ?, reviewer_id = ?, conclusion = ? WHERE id = ?');
  const addNotification = db.prepare(`INSERT INTO social_follower_notifications (id, recipient_id, actor_id, created_at)
    VALUES (?, ?, ?, ?) ON CONFLICT (recipient_id, actor_id) DO NOTHING`);
  // Keep the pair as a deduplication record, with no visible alert after a block.
  const suppressNotification = db.prepare(`UPDATE social_follower_notifications SET suppressed = 1, read_at = NULL, created_at = 0
    WHERE recipient_id = ? AND actor_id = ?`);
  const notificationPage = db.prepare(`SELECT id, actor_id AS actorId, created_at AS createdAt, read_at AS readAt
    FROM social_follower_notifications WHERE recipient_id = ? AND suppressed = 0 AND (created_at, id) < (?, ?)
    ORDER BY created_at DESC, id DESC LIMIT ${pageSize + 1}`);
  const unreadNotifications = db.prepare(`SELECT count(*) AS total FROM social_follower_notifications
    WHERE recipient_id = ? AND suppressed = 0 AND read_at IS NULL`);
  const ownedNotification = db.prepare('SELECT 1 FROM social_follower_notifications WHERE recipient_id = ? AND id = ? AND suppressed = 0');
  const readOne = db.prepare(`UPDATE social_follower_notifications SET read_at = ?
    WHERE recipient_id = ? AND id = ? AND suppressed = 0 AND read_at IS NULL`);
  const readAll = db.prepare(`UPDATE social_follower_notifications SET read_at = ?
    WHERE recipient_id = ? AND suppressed = 0 AND read_at IS NULL`);
  const page = (own, other) => db.prepare(`SELECT ${other} AS id, created_at AS createdAt FROM social_follows
    WHERE ${own} = ? AND (created_at, ${other}) < (?, ?)
    ORDER BY created_at DESC, ${other} DESC LIMIT ${pageSize + 1}`);
  const lists = { following: page('follower_id', 'followee_id'), followers: page('followee_id', 'follower_id') };
  const isBlocked = (a, b) => Boolean(blocked.get(a, b) || blocked.get(b, a));
  const isDiscoverable = (id) => see.get(id)?.allowed === 1;
  const relation = (viewer, target) => ({
    follows: Boolean(follows.get(viewer, target)),
    followedBy: Boolean(follows.get(target, viewer)),
  });
  const available = (viewer, target) => {
    if (viewer === target) return true;
    if (isBlocked(viewer, target)) return false;
    const current = relation(viewer, target);
    return isDiscoverable(target) || current.follows || current.followedBy;
  };

  return {
    isBlocked, isDiscoverable, relation, available,
    count: (id) => counts.get(id, id),
    setDiscoverable: (id, allowed) => setSee.run(id, Number(allowed)),
    list(viewer, direction, beforeTime, beforeId) {
      return paginate(lists[direction].all(viewer, beforeTime, beforeId));
    },
    follow(viewer, target, active, now) {
      return transaction(() => {
        if (!available(viewer, target)) return false;
        if (active) {
          if (addFollow.run(viewer, target, now).changes) addNotification.run(randomUUID(), target, viewer, now);
        } else {
          removeFollow.run(viewer, target);
        }
        return true;
      });
    },
    block(viewer, target) {
      return transaction(() => {
        addBlock.run(viewer, target);
        removeFollow.run(viewer, target);
        removeFollow.run(target, viewer);
        suppressNotification.run(viewer, target);
        suppressNotification.run(target, viewer);
      });
    },
    unblock: (viewer, target) => removeBlock.run(viewer, target),
    listBlocks: (viewer) => listBlocks.all(viewer),
    unread: (viewer) => unreadNotifications.get(viewer).total,
    notifications: (viewer, beforeTime, beforeId) => paginate(notificationPage.all(viewer, beforeTime, beforeId)),
    readNotifications(viewer, id, now) {
      if (!id) readAll.run(now, viewer);
      else {
        if (!ownedNotification.get(viewer, id)) return false;
        readOne.run(now, viewer, id);
      }
      return true;
    },
    reportForPair: (viewer, target) => reportForPair.get(viewer, target),
    report(viewer, target, reason, detail, now) {
      return transaction(() => {
        if (report.run(viewer, target, reason, detail, now).changes) addCase.run(randomUUID(), viewer, target);
        return reportForPair.get(viewer, target);
      });
    },
    reports: (viewer, beforeTime, beforeId) => paginate(ownReports.all(viewer, beforeTime, beforeId)),
    pendingReports: (beforeTime, beforeId) => paginate(pendingReports.all(beforeTime, beforeId)),
    review(id, reviewer, status, conclusion, now) {
      return transaction(() => {
        const item = reportById.get(id);
        if (!item) return;
        if (item.status !== 'pending') return null;
        if (reviewer === item.reporterId || reviewer === item.targetId) return false;
        changeReportStatus.run(status, item.reporterId, item.targetId);
        reviewReport.run(now, reviewer, conclusion, id);
        return reportById.get(id);
      });
    },
  };
}
