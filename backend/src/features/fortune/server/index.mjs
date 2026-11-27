import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createAccountPermissionReader } from '../../account/server-entry.mjs';

export function createFortuneTimeHandler({ now = Date.now, webOrigin = 'http://localhost:8081' } = {}) {
  return (request, response) => {
    const { origin } = request.headers;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    if (origin && origin !== webOrigin) {
      response.writeHead(403).end();
      return;
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    if (request.url !== '/fortune/time') {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ asOfUtc: new Date(now()).toISOString() }));
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.FORTUNE_TIME_PORT ?? 8791);
  const webOrigin = new URL(process.env.APP_WEB_ORIGIN ?? 'http://localhost:8081').origin;
  const accountUrl = process.env.FORTUNE_ACCOUNT_BASE_URL;
  const directory = process.env.FORTUNE_FACT_DIRECTORY;
  if (Boolean(accountUrl) !== Boolean(directory)) throw new Error('Configure both fortune account URL and fact directory');
  const time = createFortuneTimeHandler({ webOrigin });
  const service = accountUrl && directory ? await import('./fact-service.mjs') : undefined;
  const shared = service ? { webOrigin, loadArchive: service.createAccountArchiveLoader(accountUrl),
    repository: service.createFortuneRepository(directory) } : undefined;
  const facts = shared && service.createFortuneFactHandler(shared);
  const interpretation = shared ? await import('./interpretation-service.mjs') : undefined;
  const deepseek = interpretation ? await import('./deepseek-expression.mjs') : undefined;
  const interpretationHandler = interpretation?.createFortuneInterpretationHandler({ ...shared,
    readPermission: createAccountPermissionReader({ baseUrl: accountUrl }),
    expression: await deepseek.loadFortuneDeepSeek(),
  });
  createServer({ requestTimeout: 10000, headersTimeout: 4000 }, (request, response) => {
    if (interpretationHandler && interpretation.isFortuneInterpretationRoute(request.url)) void interpretationHandler(request, response);
    else if (facts && request.url !== '/fortune/time') void facts(request, response);
    else time(request, response);
  })
    .listen(port, '127.0.0.1', () => console.log(`Fortune time listening on http://127.0.0.1:${port}/fortune/time`));
}
