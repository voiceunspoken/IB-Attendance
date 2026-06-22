"use client";

import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiCalendar } from 'react-icons/fi';

const InputButton = forwardRef(({ value, onClick, placeholder, className }, ref) => (
  <button type="button" onClick={onClick} ref={ref}
    className={className}
    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
    <FiCalendar size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
    <span style={{ flex: 1, color: value ? 'inherit' : 'var(--text3)' }}>{value || placeholder}</span>
  </button>
));

InputButton.displayName = 'InputButton';

export default function DatePickerInput({ selected, onChange, minDate, placeholder, className }) {
  return (
    <DatePicker
      selected={selected}
      onChange={onChange}
      minDate={minDate}
      placeholderText={placeholder || 'Select date'}
      customInput={<InputButton className={className} placeholder={placeholder} />}
      popperPlacement="bottom-start"
      popperModifiers={[
        { name: 'offset', options: { offset: [0, 4] } },
      ]}
      calendarClassName="rdp-custom"
    />
  );
}
