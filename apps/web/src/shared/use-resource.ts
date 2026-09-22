import { useEffect, useState } from 'react';
import { z } from 'zod';

export function useResource<T>(path: string | null, schema: z.ZodType<T>) {
  const [result, setResult] = useState<{ data: T | null; status: number; loading: boolean }>({ data: null, status: 0, loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) { setResult({ data: null, status: 200, loading: false }); return; }
    const controller = new AbortController();
    setResult({ data: null, status: 0, loading: true });
    void fetch(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).then(async response => {
      const data = response.ok ? schema.parse(await response.json()) : null;
      if (!controller.signal.aborted) setResult({ data, status: response.status, loading: false });
    }).catch(() => { if (!controller.signal.aborted) setResult({ data: null, status: 503, loading: false }); });
    return () => controller.abort();
  }, [path, schema, attempt]);
  return { ...result, retry: () => setAttempt(n => n + 1) };
}
