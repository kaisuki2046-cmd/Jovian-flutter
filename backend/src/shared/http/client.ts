export type RequestErrorKind =
  | 'configuration'
  | 'request'
  | 'auth'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'http'
  | 'response';

export class RequestError extends Error {
  readonly kind: RequestErrorKind;
  readonly status?: number;
  readonly requestId?: string;

  constructor(kind: RequestErrorKind, message: string, status?: number, requestId?: string) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.status = status;
    this.requestId = requestId;
  }
}

type QueryValue = string | number | boolean;
type RequestOptions = {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Readonly<Record<string, QueryValue | null | undefined>>;
  body?: unknown;
  headers?: HeadersInit;
  credentials?: 'include';
  authenticated?: boolean;
  signal?: AbortSignal;
};
type JsonRequest<T> = RequestOptions & { parse: (body: unknown) => T; response?: never };
type EmptyRequest = RequestOptions & { response: 'empty'; parse?: never };

type ClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  transport?: typeof fetch;
};

export interface HttpClient {
  request<T>(path: string, options: JsonRequest<T>): Promise<T>;
  request(path: string, options: EmptyRequest): Promise<void>;
}

export function createHttpClient({
  baseUrl,
  timeoutMs = 10_000,
  getAccessToken,
  transport = (url, init) => fetch(url, init),
}: ClientOptions): HttpClient {
  async function request<T>(path: string, options: JsonRequest<T> | EmptyRequest): Promise<T | void> {
    const url = buildUrl(baseUrl, path, options.query);
    const method = options.method ?? 'GET';
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
      throw new RequestError('configuration', 'Invalid request timeout.');
    }
    if (options.body !== undefined && (method === 'GET' || method === 'HEAD')) {
      throw new RequestError('request', 'GET and HEAD requests cannot have a JSON body.');
    }

    let headers: Headers;
    try {
      headers = new Headers(options.headers);
    } catch {
      throw new RequestError('request', 'Invalid request headers.');
    }
    headers.set('Accept', 'application/json');
    const body = serializeBody(options.body);
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    return withDeadline(options.signal, timeoutMs, async (signal) => {
      if (options.authenticated) {
        let token: string | undefined;
        try {
          token = await getAccessToken?.();
          if (token) {
            headers.set('Authorization', 'Bearer ' + token);
          }
        } catch {
          throw new RequestError('auth', 'Could not read the access token.');
        }
        if (signal.aborted) {
          throw new RequestError('cancelled', 'Request cancelled.');
        }
        if (!token) {
          throw new RequestError('auth', 'This request requires an access token.');
        }
      }

      let response: Response;
      try {
        response = await transport(url, {
          method, headers, body, signal, redirect: 'error', credentials: options.credentials ?? 'omit',
        });
      } catch {
        throw new RequestError('network', 'The request could not reach the API.');
      }

      const requestId = response.headers.get('x-request-id') ?? undefined;
      if (!response.ok) {
        throw new RequestError('http', 'The API returned an HTTP error.', response.status, requestId);
      }
      if (options.response === 'empty') {
        return;
      }
      try {
        return options.parse(await response.json());
      } catch {
        throw new RequestError('response', 'The API response did not match the expected JSON.', response.status, requestId);
      }
    });
  }

  return { request };
}

function buildUrl(baseUrl: string | undefined, path: string, query: RequestOptions['query']): string {
  let base: URL;
  try {
    base = new URL(baseUrl ?? '');
  } catch {
    throw new RequestError('configuration', 'Configure an absolute API base URL.');
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new RequestError('configuration', 'The API base URL must be HTTP(S) without credentials, query or fragment.');
  }
  if (!path.startsWith('/') || path.startsWith('//') || /[\s\\?#]/.test(path)) {
    throw new RequestError('request', 'Provide a relative API path and pass query parameters separately.');
  }

  base.pathname = base.pathname.replace(/\/+$/, '') + '/';
  const url = new URL(base.href + path.slice(1));
  if (!url.pathname.startsWith(base.pathname)) {
    throw new RequestError('request', 'The request path must stay under the API base path.');
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.href;
}

function serializeBody(body: unknown): string | undefined {
  if (body === undefined) {
    return undefined;
  }
  try {
    const json = JSON.stringify(body);
    if (json !== undefined) {
      return json;
    }
  } catch {
    throw new RequestError('request', 'The request body could not be serialized to JSON.');
  }
  throw new RequestError('request', 'The request body must be JSON-serializable.');
}

async function withDeadline<T>(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const cancelled = new RequestError('cancelled', 'Request cancelled.');
  if (callerSignal?.aborted) {
    throw cancelled;
  }

  const controller = new AbortController();
  let rejectDeadline!: (error: RequestError) => void;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  function abort(error: RequestError) {
    rejectDeadline(error);
    controller.abort();
  }

  const onCancel = () => abort(cancelled);
  callerSignal?.addEventListener('abort', onCancel);
  const timer = setTimeout(() => abort(new RequestError('timeout', 'Request timed out.')), timeoutMs);
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCancel);
  }
}
