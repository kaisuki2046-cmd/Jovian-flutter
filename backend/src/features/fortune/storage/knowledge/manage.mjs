import { ensureFortuneKnowledgeDatabase, openFortuneKnowledgeDatabase } from './database.mjs';

const path = ensureFortuneKnowledgeDatabase();
const database = openFortuneKnowledgeDatabase(path);
try { console.log(JSON.stringify({ path, tables: database.status() }, null, 2)); }
finally { database.close(); }
