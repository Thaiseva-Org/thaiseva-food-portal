export const messageTime = (message) => {
  const value = message?.createdAt || message?.date || message?.timestamp;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};
