export const DEFAULT_POLICY = {
  shiftStartH: 10, shiftStartM: 0, shiftEndH: 19, shiftEndM: 0,
  graceMinutes: 15, lateStartMin: 30,
  shortLeaveStartMin: 60, shortLeaveEndMin: 120, halfDayAfterMin: 120,
  morningHalfDayCutoffH: 14, morningHalfDayCutoffM: 30,
  eveningHalfDayStartH: 14, eveningHalfDayStartM: 0,
  eveningEarliestExitH: 17, eveningEarliestExitM: 0,
  eveningShortLeaveWindowMin: 10,
  minHours: 9, latesPerHD: 3, ssPerHD: 3
};

function parseT(str) {
  if (!str) return null;
  str = String(str).trim();
  if (str.length === 5 && str[2] === ':') {
    const h = parseInt(str.slice(0, 2));
    const m = parseInt(str.slice(3, 5));
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return null;
}

export function analyzeDayTimes(inT, outT, policy = DEFAULT_POLICY) {
  const LATE_THRESHOLD = policy.shiftStartH * 60 + policy.shiftStartM + policy.graceMinutes;
  const SL_START = policy.shortLeaveStartMin !== undefined
    ? policy.shiftStartH * 60 + policy.shortLeaveStartMin
    : policy.shiftStartH * 60 + 60;
  const SL_END = policy.shortLeaveEndMin !== undefined
    ? policy.shiftStartH * 60 + policy.shortLeaveEndMin
    : policy.shiftStartH * 60 + 120;
  const MORNING_HD_CUTOFF = policy.morningHalfDayCutoffH * 60 + policy.morningHalfDayCutoffM;
  const EVENING_HD_START = policy.eveningHalfDayStartH * 60 + policy.eveningHalfDayStartM;
  const EVENING_EXIT = policy.eveningEarliestExitH * 60 + policy.eveningEarliestExitM;
  const EVENING_SL_WINDOW = policy.eveningShortLeaveWindowMin ?? 10;
  const MIN_WH = policy.minHours;

  let isLate = false, isSS = false, isSL = false, isHD = false;

  if (inT !== null && inT > LATE_THRESHOLD) isLate = true;

  if (inT !== null && outT !== null) {
    const wh = (outT - inT) / 60;
    const isEveningSL = outT >= EVENING_EXIT && outT <= EVENING_EXIT + EVENING_SL_WINDOW;

    if (!isLate && outT <= MORNING_HD_CUTOFF) { isHD = true; }
    else if (!isLate && inT >= EVENING_HD_START) { isHD = true; }
    else if (!isLate && isEveningSL && inT >= SL_START && inT <= SL_END) { isSL = true; }
    else if (!isLate && inT >= SL_START && inT <= SL_END) { isSL = true; }
    else if (!isLate && wh < MIN_WH) { isSS = true; }
  } else if (inT !== null && outT === null) {
    if (!isLate && inT >= SL_START && inT <= SL_END) { isSL = true; }
    else if (!isLate && inT <= MORNING_HD_CUTOFF) { isHD = true; }
  }

  return { isLate, isSS, isSL, isHD };
}

export function parseAndAnalyze(rows, policy = DEFAULT_POLICY, dbHolidays = []) {
  const LATE_THRESHOLD = policy.shiftStartH * 60 + policy.shiftStartM + policy.graceMinutes;
  const SL_START = policy.shortLeaveStartMin !== undefined
    ? policy.shiftStartH * 60 + policy.shortLeaveStartMin
    : policy.shiftStartH * 60 + 60;
  const SL_END = policy.shortLeaveEndMin !== undefined
    ? policy.shiftStartH * 60 + policy.shortLeaveEndMin
    : policy.shiftStartH * 60 + 120;
  const HD_AFTER = policy.halfDayAfterMin !== undefined
    ? policy.shiftStartH * 60 + policy.halfDayAfterMin
    : policy.shiftStartH * 60 + 120;
  const MORNING_HD_CUTOFF = policy.morningHalfDayCutoffH * 60 + policy.morningHalfDayCutoffM;
  const EVENING_HD_START = policy.eveningHalfDayStartH * 60 + policy.eveningHalfDayStartM;
  const EVENING_EXIT = policy.eveningEarliestExitH * 60 + policy.eveningEarliestExitM;
  const EVENING_SL_WINDOW = policy.eveningShortLeaveWindowMin ?? 10;
  const MIN_WH = policy.minHours;

  let headerRowIdx = -1, holidayRowIdx = -1, dataStartIdx = -1, numDays = 0, dayStartCol = -1, codeCol = 0, nameCol = -1;

  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (joined.includes('emp code') || joined.includes('emp name')) {
      headerRowIdx = i;
      // Find first day column in header
      for (let j = 0; j < rows[i].length; j++) {
        const v = String(rows[i][j]).trim();
        if (/^\d{1,2}$/.test(v)) { dayStartCol = j; break; }
      }
      if (dayStartCol < 0) throw new Error('Could not detect day columns in header. Please verify file format.');
      // Count consecutive day columns
      for (let j = dayStartCol; j < rows[i].length; j++) {
        const v = String(rows[i][j]).trim();
        if (/^\d{1,2}$/.test(v)) numDays++;
        else break;
      }
      // Find name column from header text
      for (let j = 0; j < rows[i].length; j++) {
        const v = String(rows[i][j]).toLowerCase().trim();
        if (v.includes('emp name') || v.includes('employee name') || v === 'name') { nameCol = j; break; }
      }
      // Find code column from header text
      for (let j = 0; j < rows[i].length; j++) {
        const v = String(rows[i][j]).toLowerCase().trim();
        if (v.includes('emp code') || v.includes('emp. code') || v.includes('employee code') || v === 'code') { codeCol = j; break; }
      }
      holidayRowIdx = i + 1;
      dataStartIdx = i + 2;
      break;
    }
  }

  if (headerRowIdx < 0) throw new Error('Could not detect attendance data. Please verify file format.');

  let detYear = new Date().getFullYear(), detMonth = new Date().getMonth() + 1;
  for (let i = 0; i < Math.min(headerRowIdx, 6); i++) {
    const txt = rows[i].join(' ');
    const m = txt.match(/(\w+)[- ]+(\d{4})/);
    if (m) {
      const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].findIndex(x => m[1].toLowerCase().startsWith(x));
      if (mi >= 0) { detMonth = mi + 1; detYear = parseInt(m[2]); }
    }
  }
  const currentMonth = { year: detYear, month: detMonth };

  const daysInMon = new Date(detYear, detMonth, 0).getDate();

  // Build weekends: all Sundays + Saturdays except 3rd Saturday
  const weekends = new Set();
  const saturdays = [];
  for (let d = 1; d <= daysInMon; d++) {
    const dow = new Date(detYear, detMonth - 1, d).getDay();
    if (dow === 0) weekends.add(d); // all Sundays off
    if (dow === 6) saturdays.push(d); // collect Saturdays
  }
  // Remove 3rd Saturday from weekends (it's a working day)
  const thirdSaturday = saturdays[2];
  if (thirdSaturday) {
    saturdays.forEach(d => { if (d !== thirdSaturday) weekends.add(d); });
  } else {
    // Less than 3 Saturdays in month — all Saturdays are off
    saturdays.forEach(d => weekends.add(d));
  }

  // Build holiday set: prefer DB holidays, fall back to file header row
  const gazHolidays = new Set();
  const rlDays = new Set();

  dbHolidays.filter(h => h.month === detMonth).forEach(h => gazHolidays.add(h.day));

  if (holidayRowIdx >= 0 && rows[holidayRowIdx]) {
    const hr = rows[holidayRowIdx];
    for (let j = dayStartCol; j < hr.length && j - dayStartCol + 1 <= numDays; j++) {
      const v = String(hr[j]).trim().toUpperCase(), day = j - dayStartCol + 1;
      if (gazHolidays.size === 0 && (v === 'HOLI' || v === 'HOLIDAY' || v === 'GH')) gazHolidays.add(day);
      if (v === 'RL' && !weekends.has(day)) rlDays.add(day);
    }
  }

  const results = [];
  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row[codeCol] || !/^\d+$/.test(String(row[codeCol]).trim())) continue;
    const code = String(row[codeCol] || '').trim(), name = String(row[nameCol] || '').trim();
    if (!name || name === 'NA') continue;
    results.push(analyzeEmployee(code, name, row, numDays, dayStartCol, weekends, gazHolidays, rlDays,
      LATE_THRESHOLD, SL_START, SL_END, HD_AFTER, MORNING_HD_CUTOFF, EVENING_HD_START,
      EVENING_EXIT, EVENING_SL_WINDOW, MIN_WH, policy.latesPerHD, policy.ssPerHD, policy));
  }

  return { results, currentMonth, numDays };
}

function analyzeEmployee(code, name, row, numDays, dayStartCol, weekends, gazHolidays, rlDays,
  LATE_THRESHOLD, SL_START, SL_END, HD_AFTER, MORNING_HD_CUTOFF, EVENING_HD_START,
  EVENING_EXIT, EVENING_SL_WINDOW, MIN_WH, latesPerHD, ssPerHD, policy = DEFAULT_POLICY) {

  const days = [];
  let present = 0, absent = 0, halfDay = 0, late = 0, shortShift = 0, shortLeave = 0, rl = 0, holi = 0;
  let lateCounter = 0, ssCounter = 0, lateToHD = 0, ssToHD = 0;

  for (let d = 1; d <= numDays; d++) {
    const idx = dayStartCol + d - 1, raw = String(row[idx] || '').trim();
    if (raw === 'WO-I' || raw === 'WO-II') { days.push({ d, type: 'wo', raw }); continue; }
    if (weekends.has(d)) { days.push({ d, type: 'wo', raw }); continue; }
    if (gazHolidays.has(d)) { holi++; days.push({ d, type: 'holiday', raw }); continue; }
    if (raw === 'A' || raw === '') {
      if (rlDays.has(d)) { rl++; days.push({ d, type: 'rl', raw }); }
      else { absent++; days.push({ d, type: 'absent', raw }); }
      continue;
    }

    const parts = raw.split(/[\n\r]+/).map(x => x.trim()).filter(Boolean);
    let inT = parseT(parts[0]), outT = parseT(parts[1] || '');
    if (parts.length === 1 && inT !== null && inT >= 15 * 60) { outT = inT; inT = null; }

    let { isLate: rawLate, isSS: rawSS, isSL, isHD: rawHD } = analyzeDayTimes(inT, outT, policy);
    let isLate = rawLate, isSS = rawSS, isHD = rawHD;
    let hdReason = null;

    if (isLate) lateCounter++;
    if (isSS) ssCounter++;

    // Threshold: every Nth late → HD, every Nth SS → HD
    if (isLate && latesPerHD > 0 && lateCounter % latesPerHD === 0) {
      isLate = false; isHD = true; hdReason = 'late'; lateToHD++;
    }
    if (isSS && ssPerHD > 0 && ssCounter % ssPerHD === 0) {
      isSS = false; isHD = true; hdReason = 'ss'; ssToHD++;
    }

    if (isHD) halfDay++;
    else {
      if (isLate) late++;
      if (isSL) shortLeave++;
      if (isSS) shortShift++;
      present++;
    }
    days.push({ d, type: isHD ? 'half' : 'present', raw, isLate, isSS, isSL, isHD, inT, outT, hdReason });
  }

  return {
    code, name, present, absent, halfDay, late,
    lateHD: lateToHD,
    shortShift, ssHD: ssToHD,
    shortLeave, rl, holi, days
  };
}
