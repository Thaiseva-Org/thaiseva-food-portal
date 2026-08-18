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
  return new Date(`${value}T00:00:00`);
}

export function shiftWeek(startDate, deltaWeeks) {
  const start = startOfWeek(parseLocalDate(startDate));
  start.setDate(start.getDate() + deltaWeeks * 7);
  return weekFromStartDate(formatLocalDate(start));
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
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
