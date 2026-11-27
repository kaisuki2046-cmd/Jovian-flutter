import { useCallback, useEffect, useRef, useState } from 'react';
import { RequestError } from '../../../shared/http/client';
import { requestSocialSearch, requestSocialSearchByNickname, socialUid, type SocialProfile } from '../requests/relationships';

type SearchMode = 'uid' | 'nickname';

export function useUserSearch() {
  const [mode, setMode] = useState<SearchMode>('uid');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialProfile[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const searched = useRef<{ mode: SearchMode; query: string } | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), []);

  function changeQuery(value: string) {
    searched.current = undefined;
    setQuery(value);
    setResults(undefined);
    setError('');
  }

  function changeMode(value: SearchMode) {
    if (mode === value) return;
    request.current?.abort();
    request.current = null;
    setMode(value);
    setBusy(false);
    changeQuery('');
  }

  const searchFor = useCallback(async (mode: SearchMode, query: string, refresh: boolean) => {
    if (request.current) return;
    const text = query.trim();
    if (!text) return;
    const uid = text.replace(/^UID\s*[·:：]?\s*/i, '');
    if (mode === 'uid' && !socialUid.test(uid)) return setError('请输入完整的 8 位 UID。');
    if (mode === 'nickname' && Array.from(text).length > 40) return setError('昵称最多 40 个字符。');
    const controller = new AbortController();
    request.current = controller;
    searched.current = { mode, query };
    if (!refresh) setResults(undefined);
    setError('');
    setBusy(true);
    try {
      const found = mode === 'uid' ? [await requestSocialSearch(uid, controller.signal)]
        : await requestSocialSearchByNickname(text, controller.signal);
      if (!controller.signal.aborted) setResults(found);
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof RequestError && failure.status === 404) setResults([]);
        else {
          setResults(undefined);
          setError('搜索暂时不可用，请重试。');
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    if (searched.current) return searchFor(searched.current.mode, searched.current.query, true);
  }, [searchFor]);
  return { mode, query, results, busy, error, changeQuery, changeMode, search: () => searchFor(mode, query, false), refresh };
}
