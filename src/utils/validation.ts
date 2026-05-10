export function required(value: string, label: string) {
  return value.trim() ? undefined : `${label} is required.`;
}

export function minLength(value: string, label: string, length: number) {
  return value.trim().length >= length
    ? undefined
    : `${label} must be at least ${length} characters.`;
}

export function maxLength(value: string, label: string, length: number) {
  return value.trim().length <= length
    ? undefined
    : `${label} must be ${length} characters or less.`;
}

export function email(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Email is required.';
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? undefined
    : 'Enter a valid email address.';
}

export function username(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Username is required.';
  }

  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters.';
  }

  if (trimmed.length > 32) {
    return 'Username must be 32 characters or less.';
  }

  return /^[a-zA-Z0-9_]+$/.test(trimmed)
    ? undefined
    : 'Use letters, numbers, and underscores only.';
}

export function nonNegativeInteger(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return `${label} is required.`;
  }

  return /^\d+$/.test(trimmed) ? undefined : `${label} must be a whole number.`;
}

export function optionalMinute(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return 'Minute must be a whole number.';
  }

  const minute = Number(trimmed);

  return minute >= 0 && minute <= 180
    ? undefined
    : 'Minute should be between 0 and 180.';
}
