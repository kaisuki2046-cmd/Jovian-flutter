import { Directory, File, Paths } from 'expo-file-system';

function location(scope: string) {
  const directory = new Directory(Paths.document, 'jovian-social-demo-v1');
  const fileName = Array.from(scope, character => character.codePointAt(0)?.toString(36)).join('-');
  return { directory, fileName };
}

export function readDemoStorage(scope: string): string | null {
  const { directory, fileName } = location(scope);
  const file = new File(directory, fileName + '.json');
  return file.exists ? file.textSync() : null;
}

export function writeDemoStorage(scope: string, content: string) {
  const { directory, fileName } = location(scope);
  directory.create({ idempotent: true, intermediates: true });
  const pending = new File(directory, fileName + '.tmp');
  pending.writeSync(content);
  pending.moveSync(new File(directory, fileName + '.json'), { overwrite: true });
}

export function clearMemberDemoStorage(id: string) {
  const { directory, fileName } = location('member-' + id);
  for (const extension of ['.json', '.tmp']) {
    const file = new File(directory, fileName + extension);
    if (file.exists) file.delete();
  }
}
