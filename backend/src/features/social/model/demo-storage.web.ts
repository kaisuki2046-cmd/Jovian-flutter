const storageKey = (scope: string) => 'jovian.social.demo.v1.' + scope;

export function clearMemberDemoStorage(id: string) {
  window.localStorage.removeItem(storageKey('member-' + id));
}

export function readDemoStorage(scope: string) {
  return window.localStorage.getItem(storageKey(scope));
}

export function writeDemoStorage(scope: string, content: string) {
  window.localStorage.setItem(storageKey(scope), content);
}
