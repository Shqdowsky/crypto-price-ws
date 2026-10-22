import { useCallback, useEffect, useState } from "react";

export function useCountdown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * 1000);
  }, []);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const secondsLeft = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
  return { secondsLeft, start };
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
