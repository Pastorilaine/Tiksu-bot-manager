import { useState, useEffect } from 'react';

export function useUptime(startedAt) {
  const [elapsed, setElapsed] = useState(startedAt ? Date.now() - startedAt : 0);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    setElapsed(Date.now() - startedAt);
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return elapsed;
}

export function formatUptime(ms) {
  if (!ms || ms < 1000) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}t ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
