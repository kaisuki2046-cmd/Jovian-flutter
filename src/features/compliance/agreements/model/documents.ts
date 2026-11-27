import { previewConsentDocuments } from './preview-consent-documents.mjs';

function publicDocumentUrl(value: string | undefined) {
  if (!value) return;
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    // A missing or invalid publishing address uses the local preview.
  }
}

export type AgreementDocument = {
  title: string;
  url?: string;
  sections: readonly { title: string; text: string }[];
};

export const agreementPublisher = {
  operator: '',
  contact: '',
  effectiveDate: '',
  filing: '',
};

export const agreementDocuments = {
  terms: { ...previewConsentDocuments.terms, url: publicDocumentUrl(process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL) },
  privacySummary: {
    title: '隐私政策摘要',
    sections: [
      { title: '登录与资料', text: '登录方式决定需要处理的邮箱、手机号或第三方授权信息。你可以自行填写昵称、头像、出生日期、时间和地点。资料的公开范围由已有可见性设置控制。' },
      { title: '本地计算与在线解读', text: '命盘事实由应用本地计算。你使用在线解读时，生成服务可能处理相关盘面、推算条件、你提交的问题和必要上下文。已归档的解读可在当前身份的「我的报告」查看。' },
      { title: '权限与共享', text: '选择头像或附件时使用系统选择器。正式启用的第三方服务及其字段和用途见完整版《隐私政策》和《AI 服务与数据共享告知》。实名预览表单属于内测，姓名与证件号暂不发送或保存。' },
      { title: '你的选择', text: '你可以在「设置 → 隐私设置」管理资料可见性。可在隐私设置管理 UID 搜索及 AI 授权，并从「账户与安全 → 注销账号」提交注销申请。详细范围见《隐私政策》。' },
    ],
  },
  privacy: { ...previewConsentDocuments.privacy, url: publicDocumentUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL) },
  commerce: {
    title: '商城及付费服务协议',
    sections: [],
  },
  online: {
    title: '在线服务协议',
    sections: [
      { title: '适用服务', text: '在线服务指木星环通过网络提供的问题理解、生成解读和账号内记录。若未来开放真人咨询，将在下单前说明【待填：服务方资质、服务内容、费用、改约及取消规则】。当前预览不提供真人咨询承诺。' },
      { title: '发起与结束', text: '你可以从功能界面发起解读，在允许的范围内补充资料或追问。网络中断、输入不完整或服务商异常可能影响生成。遇到失败时，可以按页面提供的重试或退出方式结束流程。' },
      { title: '记录和生成内容', text: '在线解读使用与你所选功能相关的必要输入与上下文。AI 参与生成的内容应按正式版本说明的标识方式展示。具体发送字段、处理方与保留安排列在《AI 服务与数据共享告知》。' },
      { title: '服务边界与反馈', text: '生成内容主要帮助整理信息、探索问题与阅读传统资料。请结合现实判断，避免在紧急问题或需要专业判断的情况下仅依赖解读。服务异常、内容纠错与申诉可通过【待填：有效入口与处理期限】提交。' },
    ],
  },
  account: {
    title: '账号管理规定',
    sections: [
      { title: '注册与登录', text: '木星环按当前页面开放邮箱、手机号、游客体验及相应第三方登录。请提供本人有权使用的登录凭据。账号用于识别当前用户、保存资料和管理本人可访问的报告。' },
      { title: '安全、找回与绑定', text: '请妥善保管账号、密码、验证码及第三方授权信息。你可以通过已开放的验证方式修改密码、绑定或更换手机号及找回账号。无法验证身份时的人工申诉路径为【待填：核验方式与客服入口】。' },
      { title: '访客与正式账号', text: '游客档案和正式账号的数据按身份分别管理。切换身份或结束游客体验前，按界面提示确认本次游客档案的处理。账号停用、退出登录和注销分别处理，注销后的保存期限见相关说明。' },
      { title: '异常使用与申诉', text: '发现冒用、盗号或滥用时，可通过【待填：账户安全举报和申诉渠道】反馈。正式版本应按实际情况告知处置理由、影响范围、期限及可申请复核的方式。' },
    ],
  },
  platform: {
    title: '平台管理规范',
    sections: [
      { title: '适用范围', text: '本规范适用于木星环内实际开放的消息、个人资料展示、内容发布和互动。当前开放 UID 搜索、关注、粉丝、拉黑和用户举报。私信、群聊和站内通知尚未开通。' },
      { title: '互动与内容规则', text: '尊重他人隐私、肖像、著作权和账号权益。请勿发送违法、诈骗、骚扰、冒用身份或泄露个人资料的内容，也不要利用功能批量刷量、诱导付款或绕过平台限制。' },
      { title: 'AI 内容传播', text: '转载或分享 AI 生成内容时保留适用标识，并避免冒充真实人物或权威机构。正式版本的标记工具、样式及导出规则为【待填：实际实现的标记方式与适用内容】。' },
      { title: '举报、处理与复核', text: '举报应说明涉及的内容、发生时间及处理诉求，避免提交无关个人信息。举报、投诉和复核入口与反馈期限为【待填：实际入口及时间】。正式使用前应明确处置方式、告知范围及可申请复核的路径。' },
    ],
  },
  ai: { ...previewConsentDocuments.ai },
  identity: {
    title: '实名认证服务协议',
    sections: [
      { title: '实名认证用途', text: '实名功能拟用于本人主动核对姓名与居民身份证号码是否一致。适用场景为【待填：实际接入的实名用途】。具体采集信息为本人姓名和身份证号码。当前内测仅预览表单，提交不发送姓名或证件号。' },
      { title: '独立同意与当前预览', text: '正式核验由你在了解信息接收方和处理方式后主动发起。本次预览中的勾选只用于体验提交流程。输入的姓名和身份证号码在本页暂存，提交或离开页面时清除。' },
      { title: '服务商和核验结果', text: '接收方与处理地区为【待填：核验供应商法定名称、隐私政策地址、处理地区】。核验结果、保存字段和期限为【待填：核验结果口径、保留记录和删除安排】。服务异常或未通过时，应按实际返回结果说明可用的重试或申诉方式。' },
      { title: '撤回与联系', text: '正式服务的撤回、结果查询、更正或删除由【待填：实际入口、联系方式及回复期限】受理。实名核验相关资料及结果按核定的必要范围保存。' },
    ],
  },
  deletion: {
    title: '账号注销与数据删除说明',
    sections: [
      { title: '注销请求', text: '退出登录用于结束当前会话。申请注销用于终止账号及处理与该账号关联的数据。请从「个人中心 → 设置 → 账户与安全 → 注销账号」发起。重新验证身份并确认后，应用会在登录页显示处理结果。' },
      { title: '注销前可以核对的内容', text: '请在申请前确认账号、命理档案、API 报告、算事记录、第三方登录关联和剩余权益。若有订阅、未完成订单或支付争议，查询、取消及退款方式为【待填：渠道及售后安排】。' },
      { title: '数据处理范围', text: '注销申请涉及账户及相关数据，也可能涉及设备本地数据、备份及第三方处理记录。注销会撤销该账号的会话，并清理账号资料、已归档报告、命理档案和社交关系。旧版未绑定账号的算事会话按原有会话期限过期。第三方平台账号及其记录按对应平台规则处理。' },
      { title: '状态和联系', text: '提交后，登录页显示注销处理状态。如果关联记录仍在清理，可在该处刷新查询。' },
    ],
  },
} satisfies Record<string, AgreementDocument>;

export type AgreementId = keyof typeof agreementDocuments;
export const loginAgreementIds = ['privacy', 'terms'] as const satisfies readonly AgreementId[];
export const aboutAgreementIds = Object.keys(agreementDocuments) as AgreementId[];
