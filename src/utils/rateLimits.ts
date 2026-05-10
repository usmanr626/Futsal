const DAY_MS = 24 * 60 * 60 * 1000;

export function isWithinLast24Hours(value?: string | null) {
  if (!value) {
    return false;
  }

  return Date.now() - new Date(value).getTime() < DAY_MS;
}

export function next24HourReset(value: string) {
  return new Date(new Date(value).getTime() + DAY_MS);
}
