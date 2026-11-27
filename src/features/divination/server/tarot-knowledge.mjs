import { tarotDeck, tarotSpread } from '../model/tarot-deck.mjs';
import { tarotMeanings } from '../model/tarot-meanings.mjs';

const spreadPrompts = {
  situation: '这张牌用于回看用户所描述的现状和处境。把牌义当作观察角度。',
  focus: '这张牌用于指出最值得核实的条件、取舍或阻力。',
  'next-step': '这张牌用于提出一个用户能自主选择、可以验证的小动作。',
};
const waite = 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/';

export function createTarotKnowledge(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tarot_cards (
      id TEXT PRIMARY KEY, name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tarot_meanings (
      card_id TEXT NOT NULL, orientation TEXT NOT NULL,
      traditional TEXT NOT NULL, plain TEXT NOT NULL, direction TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(card_id, orientation)
    );
    CREATE TABLE IF NOT EXISTS tarot_spread_positions (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, purpose TEXT NOT NULL
    );
  `);
  const cardRow = db.prepare('INSERT OR REPLACE INTO tarot_cards VALUES (?, ?)');
  const meaningRow = db.prepare('INSERT OR REPLACE INTO tarot_meanings VALUES (?, ?, ?, ?, ?, ?)');
  const positionRow = db.prepare('INSERT OR REPLACE INTO tarot_spread_positions VALUES (?, ?, ?)');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { id, name } of tarotDeck) {
      cardRow.run(id, name);
      for (const [orientation, meaning] of Object.entries(tarotMeanings[id])) {
        meaningRow.run(id, orientation, meaning.traditional, meaning.plain, meaning.direction, waite + 'Part_3');
      }
    }
    for (const { id, label } of tarotSpread) positionRow.run(id, label, spreadPrompts[id]);
    db.exec('COMMIT');
  } catch (failure) {
    db.exec('ROLLBACK');
    throw failure;
  }

  const find = db.prepare(`
    SELECT c.name, m.traditional, m.plain, m.direction, m.source, p.label, p.purpose
    FROM tarot_cards c JOIN tarot_meanings m ON m.card_id = c.id
    JOIN tarot_spread_positions p ON p.id = ?
    WHERE c.id = ? AND m.orientation = ?
  `);
  return {
    retrieve(draw) {
      return draw.cards.map(({ card, orientation, position }) => {
        const doc = find.get(position, card.id, orientation);
        if (!doc) throw new Error('Missing tarot knowledge document.');
        return { id: position + ':' + card.id + ':' + orientation, cardId: card.id, position, orientation, ...doc };
      });
    },
  };
}
