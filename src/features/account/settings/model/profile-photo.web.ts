import type { ProfilePhotoKind } from './preferences';

export function pickProfilePhoto(kind: ProfilePhotoKind): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.style.display = 'none'; document.body.append(input);
    let settled = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: string | null, error?: Error) => {
      if (settled) return; settled = true;
      window.removeEventListener('focus', returned);
      if (focusTimer !== undefined) clearTimeout(focusTimer);
      input.remove();
      if (error) reject(error); else resolve(value);
    };
    const returned = () => { focusTimer = setTimeout(() => { if (!input.files?.length) finish(null); }, 350); };
    window.addEventListener('focus', returned, { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      if (!file.type.startsWith('image/')) return finish(null, new Error('请选择受支持的图片文件。'));
      if (file.size > 12 * 1024 * 1024) return finish(null, new Error('图片超过 12 MB，请选择较小的图片。'));
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise<void>((done, fail) => { image.onload = () => done(); image.onerror = fail; image.src = url; });
        const canvas = document.createElement('canvas');
        [canvas.width, canvas.height] = kind === 'avatar' ? [320, 320] : [1120, 420];
        const context = canvas.getContext('2d'); if (!context) throw new Error('无法读取这张照片，请换一张图片。');
        const ratio = canvas.width / canvas.height;
        const width = Math.min(image.naturalWidth, image.naturalHeight * ratio);
        const height = width / ratio;
        context.drawImage(image, (image.naturalWidth - width) / 2, (image.naturalHeight - height) / 2,
          width, height, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.86));
      } catch { finish(null, new Error('无法读取这张照片，请换一张图片。')); }
      finally { URL.revokeObjectURL(url); }
    }, { once: true });
    input.click();
  });
}
export async function persistProfilePhoto(uri: string, _kind: ProfilePhotoKind) { return uri; }
export function discardSavedProfilePhoto(_uri: string, _kind: ProfilePhotoKind) {}
