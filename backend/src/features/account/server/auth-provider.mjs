// Adapter contract: deliverCode({ channel, recipient, purpose, code, expiresIn })
// resolves on delivery. exchangeSocial({ provider, authorizationCode })
// resolves to a verified { subject, displayName }, or undefined for invalid proof.
export async function loadLocalAuthProvider({ host, webOrigin, environment, providerUrl =
  new URL('../../../../dev-auth/provider.mjs', import.meta.url) }) {
  const loopback = ['localhost', '127.0.0.1'];
  if (!providerUrl || environment === 'production' || host !== '127.0.0.1' || !loopback.includes(new URL(webOrigin).hostname)) return;

  try {
    const { deliverCode, exchangeSocial } = await import(providerUrl.href);
    if (typeof deliverCode === 'function' && typeof exchangeSocial === 'function') {
      return { namespace: 'local', deliverCode, exchangeSocial };
    }
  } catch {
    // A missing or broken optional provider leaves password sessions available.
  }
}
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';


export async function loadEmailDelivery(path) {
  if (!path) return;
  const { deliverCode } = await import(pathToFileURL(resolve(path)).href);
  if (typeof deliverCode !== 'function') throw new Error('Email adapter must export deliverCode');
  return async (message) => { await deliverCode(message); };
}

export function createTencentSmsDelivery(client, { appId, signName, templateId }) {
  return async ({ phone, code }) => {
    const { SendStatusSet } = await client.SendSms({
      PhoneNumberSet: [phone], SmsSdkAppId: appId, SignName: signName,
      TemplateId: templateId, TemplateParamSet: [code],
    });
    if (!Array.isArray(SendStatusSet) || SendStatusSet.length !== 1 ||
        SendStatusSet[0]?.PhoneNumber !== phone || SendStatusSet[0]?.Code !== 'Ok') {
      throw new Error('SMS provider rejected delivery');
    }
  };
}

export async function loadTencentSmsDelivery(env) {
  if (env.APP_PHONE_CODES !== 'tencent') return;
  const [secretId, secretKey, region, appId, signName, templateId] = [
    'SECRET_ID', 'SECRET_KEY', 'REGION', 'SDK_APP_ID', 'SIGN_NAME', 'TEMPLATE_ID',
  ].map((key) => env['APP_TENCENT_SMS_' + key]?.trim());
  if (!secretId || !secretKey || !region || !appId || !signName || !templateId) {
    throw new Error('Incomplete Tencent SMS configuration');
  }
  const sdk = await import('tencentcloud-sdk-nodejs-sms');
  const client = new (sdk.default ?? sdk).sms.v20210111.Client({
    credential: { secretId, secretKey }, region, profile: { httpProfile: { reqTimeout: 8 } },
  });
  return createTencentSmsDelivery(client, { appId, signName, templateId });
}
