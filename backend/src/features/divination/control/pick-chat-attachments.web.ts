import { attachmentId, attachmentKind, type AttachmentKind, type ChatAttachment } from '../model/chat-draft';

// Keep the original File objects. Selecting never reads, uploads or submits them.
export function pickChatAttachments(kind: AttachmentKind): Promise<ChatAttachment[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (kind === 'image') input.accept = 'image/*';
    input.hidden = true;
    document.body.append(input);
    let focusTimer: number | undefined;
    let finished = false;
    const close = () => {
      finished = true;
      window.clearTimeout(focusTimer);
      window.removeEventListener('focus', onFocus);
      input.remove();
    };
    const finish = () => {
      if (finished) return;
      const files = Array.from(input.files ?? []);
      close();
      resolve(files.map(file => ({
        file, id: attachmentId(), name: file.name, size: file.size,
        mimeType: file.type || 'application/octet-stream', kind: attachmentKind(file.type, file.name),
      })));
    };
    // Older WebViews only restore window focus when the user cancels.
    function onFocus() { focusTimer = window.setTimeout(finish, 350); }
    if (!('oncancel' in input)) window.addEventListener('focus', onFocus, { once: true });
    input.addEventListener('change', finish, { once: true });
    input.addEventListener('cancel', finish, { once: true });
    try { input.click(); } catch (error) { close(); reject(error); }
  });
}

export async function openChatFile(attachment: ChatAttachment) {
  if (!attachment.file) return;
  const url = URL.createObjectURL(attachment.file);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
