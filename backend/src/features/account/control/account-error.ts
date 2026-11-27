import { RequestError } from '../../../shared/http/client';

export function accountError(error: unknown, fallback: string) {
  if (!(error instanceof RequestError)) return fallback;
  if (error.kind === 'timeout') return '请求超时，请重试。';
  if (error.kind === 'network' || error.kind === 'configuration') return '暂时无法连接账户服务，请检查网络后重试。';
  if (error.status === 503) return '认证服务暂不可用，请检查本机虚拟服务商是否已配置并重启账户服务。';
  if (error.status === 429) return '操作过于频繁，请稍后重试。';
  if (error.status === 409) return '此邮箱暂时无法注册，请尝试登录或换一个邮箱。';
  if (error.status === 422) return '当前密码不正确。';
  if (error.status === 400) return '请检查填写内容后重试。';
  return fallback;
}
