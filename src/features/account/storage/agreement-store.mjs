export function createAgreementStore(db, transaction) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_agreement_versions (
      agreement_id TEXT NOT NULL,
      version TEXT NOT NULL,
      hash TEXT NOT NULL,
      document TEXT NOT NULL,
      PRIMARY KEY (agreement_id, version)
    );
    CREATE TABLE IF NOT EXISTS account_agreement_decisions (
      id INTEGER PRIMARY KEY,
      member_id TEXT REFERENCES account_users(id) ON DELETE CASCADE,
      guest_id TEXT REFERENCES account_guest_sessions(id) ON DELETE CASCADE,
      agreement_id TEXT NOT NULL,
      version TEXT NOT NULL,
      purpose TEXT NOT NULL,
      agreed INTEGER NOT NULL CHECK (agreed IN (0, 1)),
      decided_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      CHECK ((member_id IS NULL) <> (guest_id IS NULL)),
      FOREIGN KEY (agreement_id, version) REFERENCES account_agreement_versions(agreement_id, version)
    );
    CREATE INDEX IF NOT EXISTS account_member_agreement_owner ON account_agreement_decisions(member_id, id);
    CREATE INDEX IF NOT EXISTS account_guest_agreement_owner ON account_agreement_decisions(guest_id, id);
  `);
  const addDocument = db.prepare(`INSERT INTO account_agreement_versions VALUES (?, ?, ?, ?)
    ON CONFLICT(agreement_id, version) DO NOTHING`);
  const getDocument = db.prepare('SELECT hash, document FROM account_agreement_versions WHERE agreement_id = ? AND version = ?');
  const fields = `agreement_id AS agreementId, version, purpose, agreed, decided_at AS decidedAt, source`;
  const addDecision = db.prepare(`INSERT INTO account_agreement_decisions
    (member_id, guest_id, agreement_id, version, purpose, agreed, decided_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const decisionStatements = Object.fromEntries([['member', 'member_id'], ['guest', 'guest_id']].map(([kind, owner]) => [
    kind, {
      latest: db.prepare(`SELECT ${fields} FROM account_agreement_decisions WHERE ${owner} = ?
        AND agreement_id = ? AND version = ? AND purpose = ? ORDER BY id DESC LIMIT 1`),
      history: db.prepare(`SELECT ${fields} FROM account_agreement_decisions WHERE ${owner} = ? ORDER BY id DESC`),
    },
  ]));

  return {
    seedAgreements(documents) {
      transaction(() => {
        for (const document of documents) {
          const { id, version, hash } = document;
          addDocument.run(id, version, hash, JSON.stringify(document));
          const previous = getDocument.get(id, version);
          if (previous.hash !== hash || JSON.parse(previous.document).state !== document.state) {
            throw new Error('Publish a new agreement version before changing ' + id + '/' + version);
          }
        }
      });
    },
    getAgreementVersion(id, version) {
      const row = getDocument.get(id, version);
      return row ? JSON.parse(row.document) : undefined;
    },
    getAgreementHistory(identity) {
      return decisionStatements[identity.kind].history.all(identity.id).map((row) => ({ ...row, agreed: Boolean(row.agreed) }));
    },
    hasAgreement(identity, document, purpose) {
      const row = decisionStatements[identity.kind].latest.get(identity.id, document.id, document.version, purpose);
      return row?.agreed === 1;
    },
    saveAgreementDecisions(identity, decisions, now, source) {
      transaction(() => {
        const member = identity.kind === 'member' ? identity.id : null;
        const guest = identity.kind === 'guest' ? identity.id : null;
        for (const { document, purpose, agreed } of decisions) {
          const latest = decisionStatements[identity.kind].latest.get(identity.id, document.id, document.version, purpose);
          if (latest?.agreed !== Number(agreed)) {
            addDecision.run(member, guest, document.id, document.version, purpose, Number(agreed), now, source);
          }
        }
      });
    },
  };
}
