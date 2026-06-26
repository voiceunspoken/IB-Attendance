export function getThirdSaturday(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const saturdays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 6) saturdays.push(d);
  }
  return saturdays[2] || null;
}

export function getWorkingSaturdayDay(year, month, workingSaturdays) {
  const configured = workingSaturdays.find(s => s.year === year && s.month === month);
  if (configured) return configured.day;
  return getThirdSaturday(year, month);
}

export function buildWorkingSatMap(workingSaturdays) {
  const map = {};
  const year = workingSaturdays.length > 0 ? workingSaturdays[0].year : new Date().getFullYear();
  for (let m = 1; m <= 12; m++) map[m] = getThirdSaturday(year, m);
  workingSaturdays.forEach(s => { map[s.month] = s.day; });
  return map;
}

export function getWorkingSatFromMap(year, month, workingSatMap) {
  if (workingSatMap[month] !== undefined) return workingSatMap[month];
  return getThirdSaturday(year, month);
}

export function isWorkingSaturday(date, workingSatMap) {
  if (date.getDay() !== 6) return false;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = getWorkingSatFromMap(year, month, workingSatMap);
  return day === date.getDate();
}

export function isWeekend(date, workingSatMap) {
  const day = date.getDay();
  if (day === 0) return true;
  if (day === 6) return !isWorkingSaturday(date, workingSatMap);
  return false;
}
