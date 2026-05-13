export const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave' };
export const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de' };

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export const STATUS_COLORS = {
  pending: { bg: 'rgba(255,159,10,0.10)', color: '#ff9f0a', border: 'rgba(255,159,10,0.25)' },
  approved: { bg: 'rgba(52,199,89,0.10)', color: '#34c759', border: 'rgba(52,199,89,0.25)' },
  rejected: { bg: 'rgba(255,59,48,0.10)', color: '#ff3b30', border: 'rgba(255,59,48,0.25)' },
};

export const DEFAULT_LEAVE_POLICY = { cl: 12, sl: 6, el: 4, rl: 2 };
