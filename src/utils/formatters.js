import { MONTHS } from './constants';

export function formatMonth(monthYear) {
  if (!monthYear || !monthYear.includes('_')) return monthYear || '';
  const [m, y] = monthYear.split('_');
  const monthIndex = parseInt(m, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11 || !y) return monthYear;
  return `${MONTHS[monthIndex]} ${y}`;
}
