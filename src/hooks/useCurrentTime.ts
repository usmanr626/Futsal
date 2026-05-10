import {useEffect, useState} from 'react';

export function useCurrentTime(intervalMs = 1_000) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setCurrentTime(Date.now());
    refresh();

    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return currentTime;
}
