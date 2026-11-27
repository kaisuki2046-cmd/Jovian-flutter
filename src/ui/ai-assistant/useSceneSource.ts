import { useEffect, useState } from 'react';
import { assistantSceneDocument } from './sceneDocument';

let source: { html: string } | undefined;

/** Let the surrounding UI paint before building the rig for the first time. */
export function useSceneSource() {
  const [loaded, setLoaded] = useState(() => source !== undefined);
  useEffect(() => {
    if (loaded) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setLoaded(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [loaded]);

  if (!loaded) return undefined;
  // Keep the WebView source stable during ordinary renders and refresh it when the scene code changes.
  const html = assistantSceneDocument();
  if (source?.html !== html) source = { html };
  return source;
}
