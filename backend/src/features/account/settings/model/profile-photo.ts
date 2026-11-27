import { Directory, File, Paths } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';
import type { ProfilePhotoKind } from './preferences';

const photoDirectory = (kind: ProfilePhotoKind) => new Directory(Paths.document, kind === 'avatar' ? 'jovian-avatars' : 'jovian-profile-covers');
export async function pickProfilePhoto(kind: ProfilePhotoKind): Promise<string | null> {
  const selection = await launchImageLibraryAsync({ mediaTypes: ['images'],
    ...(kind === 'avatar' ? { allowsEditing: true, aspect: [1, 1] } : { allowsEditing: false }), quality: 0.8, exif: false });
  if (selection.canceled) return null;
  const photo = selection.assets[0];
  if ((photo.fileSize ?? new File(photo.uri).size) > 12 * 1024 * 1024) throw new Error('图片超过 12 MB，请选择较小的图片。');
  return photo.uri;
}
export async function persistProfilePhoto(uri: string, kind: ProfilePhotoKind) {
  const directory = photoDirectory(kind);
  if (uri.startsWith(directory.uri.replace(/\/+$/, '') + '/')) return uri;
  directory.create({ idempotent: true, intermediates: true });
  const source = new File(uri);
  const filename = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const target = new File(directory, filename + (source.extension || '.jpg'));
  await source.copy(target);
  return target.uri;
}
export function discardSavedProfilePhoto(uri: string, kind: ProfilePhotoKind) {
  const directory = photoDirectory(kind);
  if (!uri.startsWith(directory.uri.replace(/\/+$/, '') + '/')) return;
  const file = new File(uri); if (file.exists) file.delete();
}
