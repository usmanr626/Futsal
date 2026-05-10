import dayjs from 'dayjs';

export function formatDateTime(value: string) {
  return dayjs(value).format('D MMM YYYY, h:mm A');
}

export function formatDateTimeValue(value: Date) {
  return dayjs(value).format('D MMM YYYY, h:mm A');
}

export function formatDate(value: string) {
  return dayjs(value).format('D MMM YYYY');
}

export function toDateInputValue(date = new Date()) {
  return dayjs(date).format('YYYY-MM-DDTHH:mm');
}

export function fromDateInputValue(value: string) {
  return dayjs(value).toISOString();
}
