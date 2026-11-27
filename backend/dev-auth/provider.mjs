import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const inbox = new URL('./inbox/', import.meta.url);

export async function deliverCode({ channel, recipient, purpose, code, expiresIn }) {
  try {
    await mkdir(inbox);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const file = new URL(`${Date.now()}-${channel}-${randomUUID()}.txt`, inbox);
  await writeFile(file, [
    `渠道：${channel === 'email' ? '邮箱' : '短信'}`,
    `收件人：${recipient}`,
    `用途：${purpose}`,
    `验证码：${code}`,
    `有效期：${expiresIn} 秒`,
    '',
  ].join('\n'), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return { delivery: 'local-inbox' };
}

export async function exchangeSocial({ provider, authorizationCode }) {
  if (authorizationCode !== undefined) return;
  const names = { wechat: '微信测试用户', qq: 'QQ 测试用户' };
  if (!Object.hasOwn(names, provider)) return;
  return { subject: 'demo-user', displayName: names[provider] };
}
