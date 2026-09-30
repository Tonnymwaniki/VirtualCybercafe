import { useEffect, useRef } from 'react';

import { ENGINE_HTML } from '@/components/workbench/engine-html';
import type { HostProps } from '@/components/workbench/engine-host';

// Web: a hidden frame running the same page as the phone's web view.
export function EngineHost({ onMessage, connect }: HostProps) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      onMessage(event.data);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [onMessage]);

  return (
    <iframe
      ref={frame}
      title="workbench"
      srcDoc={ENGINE_HTML}
      style={{ display: 'none' }}
      onLoad={() => connect((text) => frame.current?.contentWindow?.postMessage(text, '*'))}
    />
  );
}
