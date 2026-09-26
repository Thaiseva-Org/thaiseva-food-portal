function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Monday 00:00 local as the start of the week. */
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date = new Date()) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function weekIdFromDate(date = new Date()) {
  return formatLocalDate(startOfWeek(date));
}

export function weekFromStartDate(startDate) {
  const start = startOfWeek(new Date(`${startDate}T00:00:00`));
  const end = endOfWeek(start);
  return {
    id: formatLocalDate(start),
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    label: weekLabel(start, end),
  };
}

export function weekLabel(start, end) {
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const endText = end.toLocaleDateString(undefined, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  return `${startText} – ${endText}`;
}

export function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value);
  const [year, month = 1, day = 1] = String(value || "")
    .split(/[-T /]/)
    .map(Number);
  if (Number.isFinite(year) && year > 0) {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  return new Date(`${value}T00:00:00`);
}

export function shiftWeek(startDate, deltaWeeks) {
  const start = startOfWeek(parseLocalDate(startDate));
  start.setDate(start.getDate() + deltaWeeks * 7);
  return weekFromStartDate(formatLocalDate(start));
}

export function monthRange(date = new Date()) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}

export function shiftMonth(startDate, deltaMonths) {
  const d = parseLocalDate(startDate);
  return monthRange(new Date(d.getFullYear(), d.getMonth() + deltaMonths, 1));
}

export function yearRange(date = new Date()) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    label: `Year ${year}`,
  };
}

export function shiftYear(startDate, deltaYears) {
  const d = parseLocalDate(startDate);
  return yearRange(new Date(d.getFullYear() + deltaYears, 0, 1));
}

export function listRecentWeeks(count = 8) {
  const weeks = [];
  const cursor = startOfWeek(new Date());
  for (let i = 0; i < count; i += 1) {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - i * 7);
    const end = endOfWeek(start);
    weeks.push({
      id: formatLocalDate(start),
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(end),
      label: i === 0 ? `This week · ${weekLabel(start, end)}` : weekLabel(start, end),
    });
  }
  return weeks;
}
