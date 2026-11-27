import { register } from 'node:module';
import { ensureFortuneKnowledgeDatabase, openFortuneKnowledgeDatabase } from '../../storage/knowledge/database.mjs';

register('../resolve-fortune.mjs', import.meta.url);
const { installFortuneKnowledgeReader } = await import('../../control/knowledge/catalog.ts');
export const fortuneKnowledgeDatabasePath = ensureFortuneKnowledgeDatabase();
const reader = openFortuneKnowledgeDatabase(fortuneKnowledgeDatabasePath);
installFortuneKnowledgeReader(reader);
