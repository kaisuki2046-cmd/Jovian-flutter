import { File as DeviceFile } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { attachmentId, attachmentKind, type AttachmentKind, type ChatAttachment } from '../model/chat-draft';

export async function pickChatAttachments(kind: AttachmentKind): Promise<ChatAttachment[]> {
  if (kind === 'image') {
    const selection = await launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, orderedSelection: true, quality: 1, exif: false,
    });
    if (selection.canceled) return [];
    return selection.assets.map(asset => {
      const file = new DeviceFile(asset.uri);
      return { id: attachmentId(), kind, name: asset.fileName || file.name || 'Image',
        mimeType: asset.mimeType || file.type || 'application/octet-stream',
        size: asset.fileSize ?? file.size, uri: asset.uri };
    });
  }
  const selected = await DeviceFile.pickFileAsync({ multipleFiles: true });
  if (selected.canceled) return [];
  return selected.result.map(file => ({
    id: attachmentId(), kind: attachmentKind(file.type, file.name), name: file.name,
    mimeType: file.type || 'application/octet-stream', size: file.size, uri: file.uri,
  }));
}

export async function openChatFile(attachment: ChatAttachment) {
  if (!attachment.uri) return;
  const file = new DeviceFile(attachment.uri);
  await file.preview({ title: attachment.name, mimeType: attachment.mimeType });
}
