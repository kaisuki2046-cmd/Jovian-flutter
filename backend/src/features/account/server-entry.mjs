export class ModelPermissionError extends Error {
  constructor(status) {
    super(status === 428 ? 'ai_permission_required' : status === 401 ? 'account_session_required' : 'account_permission_unavailable');
    this.status = status;
  }
}

export function createAccountPermissionReader({ baseUrl = 'http://127.0.0.1:' + (process.env.APP_ACCOUNT_PORT ?? 8787),
  transport = fetch } = {}) {
  return async (headers, purpose) => {
    const credentials = new Headers();
    if (headers.origin && headers.cookie) {
      credentials.set('Origin', headers.origin);
      credentials.set('Cookie', headers.cookie);
    } else if (!headers.origin && typeof headers['x-account-session'] === 'string' &&
        /^[A-Za-z0-9_-]{43}$/.test(headers['x-account-session'])) {
      credentials.set('X-App-Client', 'native');
      credentials.set('Authorization', 'Bearer ' + headers['x-account-session']);
    } else {
      throw new ModelPermissionError(401);
    }
    const url = new URL('/account/agreements/permission', baseUrl);
    url.searchParams.set('purpose', purpose);
    try {
      const response = await transport(url, { headers: credentials, signal: AbortSignal.timeout(4000), redirect: 'error' });
      if (response.status === 401) throw new ModelPermissionError(401);
      if (!response.ok) throw new ModelPermissionError(503);
      const { allowed, identity } = await response.json();
      if (typeof allowed !== 'boolean' || !['member', 'guest'].includes(identity?.kind) ||
          !/^[0-9a-f-]{36}$/.test(identity.id)) throw new ModelPermissionError(503);
      return { allowed, identity };
    } catch (error) {
      if (error instanceof ModelPermissionError) throw error;
      throw new ModelPermissionError(503);
    }
  };
}

export async function requireModelPermission(read, headers, purpose, expectedOwnerId) {
  const { allowed, identity } = await read(headers, purpose);
  if (expectedOwnerId !== undefined && (identity.kind !== 'member' || identity.id !== expectedOwnerId)) {
    throw new ModelPermissionError(401);
  }
  if (!allowed) throw new ModelPermissionError(428);
  return identity;
}
