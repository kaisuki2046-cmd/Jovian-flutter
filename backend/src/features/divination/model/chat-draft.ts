export type AttachmentKind = 'image' | 'file';
export type ChatAttachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size?: number;
} & ({ file: File; uri?: never } | { uri: string; file?: never } | { file?: never; uri?: never });

export type ChatDraft = { text: string; attachments: ChatAttachment[] };
export const emptyChatDraft = (): ChatDraft => ({ text: '', attachments: [] });

let sequence = 0;
export function attachmentId() { return 'attachment-' + ++sequence; }

export function attachmentKind(mimeType: string, name: string): AttachmentKind {
  return mimeType.startsWith('image/') || ((!mimeType || mimeType === 'application/octet-stream')
    && /\.(?:jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i.test(name)) ? 'image' : 'file';
}

export function hasDraftContent(draft: ChatDraft) {
  return Boolean(draft.text.trim() || draft.attachments.length);
}

export function sameChatDraft(left: ChatDraft, right: ChatDraft) {
  return left.text.trim() === right.text.trim() && left.attachments.length === right.attachments.length
    && left.attachments.every((item, index) => item.id === right.attachments[index].id);
}

export function removeFromDraft(draft: ChatDraft, id: string): ChatDraft {
  return { ...draft, attachments: draft.attachments.filter(item => item.id !== id) };
}

export function formatFileSize(bytes?: number) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.ceil(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
