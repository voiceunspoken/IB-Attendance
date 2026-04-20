const LATE_H = 10, LATE_M = 15, MIN_WH = 9;
const SL_LATE_MAX_H = 12, SL_LATE_MAX_M = 5;
const SL_EARLY_MIN_H = 16, SL_EARLY_MIN_M = 55, SL_EARLY_MAX_H = 17, SL_EARLY_MAX_M = 5;

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

export function parseAndAnalyze(rows) {
  let headerRowIdx = -1, holidayRowIdx = -1, dataStartIdx = -1, numDays = 31;
  
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (joined.includes('emp code') || joined.includes('emp name')) {
      headerRowIdx = i;
      let dc = 0;
      for (let j = 2; j < rows[i].length; j++) {
        const v = String(rows[i][j]).trim();
        if (/^\d{1,2}$/.test(v)) dc++;
      }
      if (dc > 20) numDays = dc;
      holidayRowIdx = i + 1;
      dataStartIdx = i + 2;
      break;
    }
  }

  if (headerRowIdx < 0) {
    throw new Error('Could not detect attendance data. Please verify file format.');
  }

  let detYear = new Date().getFullYear(), detMonth = new Date().getMonth() + 1;
  for (let i = 0; i < Math.min(headerRowIdx, 6); i++) {
    const txt = rows[i].join(' ');
    const m = txt.match(/(\w+)[- ]+(\d{4})/);
    if (m) {
      const mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].findIndex(x => m[1].toLowerCase().startsWith(x));
      if (mi >= 0) {
        detMonth = mi + 1;
        detYear = parseInt(m[2]);
      }
    }
  }
  const currentMonth = { year: detYear, month: detMonth };

  const weekends = new Set();
  const daysInMon = new Date(detYear, detMonth, 0).getDate();
  for (let d = 1; d <= daysInMon; d++) {
    const dow = new Date(detYear, detMonth - 1, d).getDay();
    if (dow === 0 || dow === 6) weekends.add(d);
  }

  const gazHolidays = new Set(), rlDays = new Set();
  if (holidayRowIdx >= 0 && rows[holidayRowIdx]) {
    const hr = rows[holidayRowIdx];
    for (let j = 2; j < hr.length; j++) {
      const v = String(hr[j]).trim().toUpperCase(), day = j - 1;
      if (v === 'HOLI' || v === 'HOLIDAY' || v === 'GH') gazHolidays.add(day);
      if (v === 'RL' && !weekends.has(day)) rlDays.add(day);
    }
  }
  // Hardcoded falbacks as per original
  if (gazHolidays.size === 0 && detMonth === 3 && detYear === 2026) gazHolidays.add(4);
  if (rlDays.size === 0 && detMonth === 3 && detYear === 2026) rlDays.add(26);

  const results = [];
  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !/^\d+$/.test(String(row[0]).trim())) continue;
    const code = String(row[0]).trim(), name = String(row[1]).trim();
    if (!name || name === 'NA') continue;
    results.push(analyzeEmployee(code, name, row, numDays, weekends, gazHolidays, rlDays));
  }

  return { results, currentMonth, numDays };
}

function analyzeEmployee(code, name, row, numDays, weekends, gazHolidays, rlDays) {
  const days = [];
  let present = 0, absent = 0, halfDay = 0, late = 0, shortShift = 0, shortLeave = 0, rl = 0, holi = 0;
  
  for (let d = 1; d <= numDays; d++) {
    const idx = d + 1, raw = String(row[idx] || '').trim();
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
    
    let isLate = false, isSS = false, isSL = false, isHD = false;
    if (inT !== null && inT > LATE_H * 60 + LATE_M) { isLate = true; late++; }
    
    if (inT !== null && outT !== null) {
      const wh = (outT - inT) / 60;
      if (outT <= 14 * 60 + 30) { isHD = true; halfDay++; }
      else if (inT >= 14 * 60 + 30) { isHD = true; halfDay++; }
      else if (outT >= SL_EARLY_MIN_H * 60 + SL_EARLY_MIN_M && outT <= SL_EARLY_MAX_H * 60 + SL_EARLY_MAX_M) { isSL = true; shortLeave++; }
      else if (wh < MIN_WH && !isLate) { isSS = true; shortShift++; }
    } else if (inT !== null && outT === null) {
      if (inT >= SL_LATE_MAX_H * 60 - 15 && inT <= SL_LATE_MAX_H * 60 + SL_LATE_MAX_M) { isSL = true; shortLeave++; }
    }
    
    if (!isHD) present++;
    days.push({ d, type: isHD ? 'half' : 'present', raw, isLate, isSS, isSL, inT, outT });
  }
  
  return { 
    code, name, present, absent, halfDay, late, lateHD: Math.floor(late / 3),
    shortShift, ssHD: Math.floor(shortShift / 3), shortLeave, rl, holi, days 
  };
}
