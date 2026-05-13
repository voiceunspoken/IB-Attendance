"use client";

import { STATUS_COLORS } from '../utils/constants';

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '980px', fontSize: '12px',
      fontWeight: 500, background: colors.bg, color: colors.color,
      border: `1px solid ${colors.border}`, textTransform: 'capitalize'
    }}>
      {status}
    </span>
  );
}
