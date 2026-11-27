import { RequestError } from '../../../../shared/http/client';
import { isWeb, readNativeToken } from '../../auth/model/session-token';

function sameSiteModelUrl(value: string) {
  if (!isWeb || typeof window === 'undefined') return value;
  const loopback = ['127.0.0.1', 'localhost'];
  const url = new URL(value, window.location.origin);
  if (loopback.includes(url.hostname) && loopback.includes(window.location.hostname)) {
    url.hostname = window.location.hostname;
  }
  return url.href;
}

export const requestSameSiteModel: typeof fetch = (input, init) => fetch(
  typeof input === 'string' || input instanceof URL ? sameSiteModelUrl(String(input)) : input, init,
);

export async function modelAccountRequest() {
  if (isWeb) return { credentials: 'include' as const };
  const token = await readNativeToken();
  return { headers: token ? { 'X-Account-Session': token } : undefined };
}

export function describeModelPermissionError(error: unknown) {
  if (!(error instanceof RequestError)) return;
  if (error.status === 428) return '请到「个人中心 → 设置 → 隐私设置 → AI 数据共享授权」开启此项权限后重试。';
  if (error.status === 401) return '当前会话无法验证，请重新登录或进入游客体验。';
}
