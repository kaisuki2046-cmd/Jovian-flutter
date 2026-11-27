import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createAccountPermissionReader } from '../../account/server-entry.mjs';
import { createReadingTaskService } from './reading-tasks.mjs';
import { createReadingServer } from './http.mjs';
import { understandWithModel } from './question-model.mjs';
import { generateGuideFollowUp } from './combined-report.mjs';
import { generateProReport } from './pro-report.mjs';
import { readingDatabasePath } from './task-ownership.mjs';

const port = Number(process.env.DIVINATION_REPORT_PORT ?? 8115);
const bindHost = process.env.DIVINATION_REPORT_BIND ?? '127.0.0.1';
const origins = new Set((process.env.DIVINATION_REPORT_WEB_ORIGIN
  ?? 'http://localhost:8114,http://127.0.0.1:8114').split(',').map((origin) => origin.trim()));
const hosts = new Set((process.env.DIVINATION_REPORT_HOSTS
  ?? `localhost:${port},127.0.0.1:${port}`).split(',').map((host) => host.trim()));
function modelOptions() {
  const openaiKey = process.env.DIVINATION_OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return { apiKey: openaiKey, model: process.env.DIVINATION_OPENAI_MODEL?.trim() || 'gpt-4.1-mini' };
  }

  let apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const keyFile = process.env.DEEPSEEK_API_KEY_FILE?.trim();
  if (!apiKey && keyFile) {
    try {
      apiKey = readFileSync(keyFile, 'utf8').trim();
    } catch {
      throw new Error('Could not read DEEPSEEK_API_KEY_FILE.');
    }
    if (!apiKey || /\s/u.test(apiKey)) throw new Error('DEEPSEEK_API_KEY_FILE must contain one key.');
  }
  if (!apiKey) return undefined;
  return { provider: 'deepseek', apiKey, model: process.env.DIVINATION_DEEPSEEK_MODEL?.trim() || 'deepseek-flash' };
}

const model = modelOptions();
const path = readingDatabasePath();
mkdirSync(dirname(path), { recursive: true });
const tasks = createReadingTaskService(path, model ? {
  understand: (question, signal, guide, previousQuestion) => {
    if (guide && (model.provider !== 'deepseek' || model.model !== 'deepseek-flash')) throw new Error('Guide profile requires DeepSeek Flash.');
    return understandWithModel(question, { ...model, signal }, guide, previousQuestion);
  },
  ...(model.provider === 'deepseek' && model.model === 'deepseek-flash' ? {
    generateFollowUp: (task, question, signal) => generateGuideFollowUp(task, question, { ...model, signal }),
    generatePro: (task, signal) => generateProReport(task, { apiKey: model.apiKey, signal }),
  } : {}),
} : {});

const server = createReadingServer({ tasks, hosts, origins, readPermission: createAccountPermissionReader() });
server.listen(port, bindHost, () => {
  console.log(`Divination service listening on http://${bindHost}:${port} (${model ? model.provider ?? 'openai' : 'local'} reports)`);
});
