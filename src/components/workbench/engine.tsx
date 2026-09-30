import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { EngineHost } from '@/components/workbench/engine-host';
import { fromBase64, renamed, toBase64, type WorkFile } from '@/lib/workbench/files';

// The page reader: turns PDF pages into pictures and cleans up scans, in a
// hidden web page. It starts the first time a tool needs it.

export type ScanFilter = 'enhance' | 'clean' | 'bw';

type RenderOptions = {
  // 0-based pages; all pages when left out.
  pages?: number[];
  // Pixels per PDF point: 2 is about 150 dpi.
  scale?: number;
  maxSide?: number;
  quality?: number;
};

type Engine = {
  renderPdf: (file: WorkFile, options?: RenderOptions, onPage?: (page: WorkFile, total: number) => void) => Promise<WorkFile[]>;
  filterImage: (file: WorkFile, mode: ScanFilter) => Promise<WorkFile>;
};

type Pending = {
  resolve: (value: WorkFile[]) => void;
  reject: (error: Error) => void;
  pages: WorkFile[];
  total: number;
  name: string;
  onPage?: (page: WorkFile, total: number) => void;
};

const EngineContext = createContext<Engine | null>(null);

const OFFLINE = 'Reading PDF pages needs the internet the first time. Connect and try again.';

export function EngineProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const post = useRef<((text: string) => void) | null>(null);
  const queue = useRef<string[]>([]);
  const pending = useRef(new Map<string, Pending>());

  const send = useCallback((request: Record<string, unknown>) => {
    const text = JSON.stringify(request);
    if (post.current) post.current(text);
    else {
      queue.current.push(text);
      setActive(true);
    }
  }, []);

  // The page is loaded: send whatever was waiting for it.
  const connect = useCallback((poster: (text: string) => void) => {
    post.current = poster;
    queue.current.splice(0).forEach((item) => poster(item));
  }, []);

  const onMessage = useCallback((text: string) => {
    let message: { id?: string; type: string; [key: string]: unknown };
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (message.type === 'ready') return;
    const job = message.id ? pending.current.get(message.id) : undefined;
    if (!job) return;
    if (message.type === 'info') job.total = Number(message.pages) || 0;
    if (message.type === 'page' || message.type === 'image') {
      const index = Number(message.index ?? 0);
      const page: WorkFile = {
        name: message.type === 'page' ? renamed(job.name, `-page-${index + 1}`, 'jpg') : job.name,
        kind: 'image',
        mimeType: 'image/jpeg',
        bytes: fromBase64(String(message.data)),
        width: Number(message.width),
        height: Number(message.height),
      };
      job.pages.push(page);
      job.onPage?.(page, job.total);
    }
    if (message.type === 'done' || message.type === 'image') {
      pending.current.delete(message.id!);
      job.resolve(job.pages);
    }
    if (message.type === 'error') {
      pending.current.delete(message.id!);
      const reason = String(message.message);
      job.reject(new Error(reason === 'offline' ? OFFLINE : /password/i.test(reason) ? 'This PDF is locked with a password.' : reason));
    }
  }, []);

  const start = useCallback(
    (request: Record<string, unknown>, name: string, onPage?: Pending['onPage']) =>
      new Promise<WorkFile[]>((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pending.current.set(id, { resolve, reject, pages: [], total: 0, name, onPage });
        send({ ...request, id });
      }),
    [send],
  );

  const engine = useMemo<Engine>(
    () => ({
      renderPdf: (file, options = {}, onPage) =>
        start({ type: 'pdf', data: toBase64(file.bytes), ...options }, file.name, onPage),
      filterImage: async (file, mode) => {
        const [image] = await start(
          { type: 'image', data: toBase64(file.bytes), mimeType: file.mimeType, mode },
          renamed(file.name, `-${mode === 'bw' ? 'bw' : 'clean'}`, 'jpg'),
        );
        return image;
      },
    }),
    [start],
  );

  return (
    <EngineContext.Provider value={engine}>
      {children}
      {active && <EngineHost onMessage={onMessage} connect={connect} />}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('useEngine needs an EngineProvider');
  return engine;
}
