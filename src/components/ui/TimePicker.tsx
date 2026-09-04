'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select time',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHours(h || '00');
      setMinutes(m || '00');
    }
  }, [value]);

  const handleTimeChange = (newHours: string, newMinutes: string) => {
    const h = String(newHours).padStart(2, '0');
    const m = String(newMinutes).padStart(2, '0');
    onChange(`${h}:${m}`);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = e.target.value;
    setHours(newHour);
    handleTimeChange(newHour, minutes);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinute = e.target.value;
    setMinutes(newMinute);
    handleTimeChange(hours, newMinute);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card flex items-center justify-between text-left disabled:bg-muted disabled:cursor-not-allowed"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : placeholder}
        </span>
        <Clock size={18} className="text-muted-foreground" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 bg-card border border-input rounded-lg shadow-lg z-50 p-4 w-48">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Hours</label>
              <select
                value={hours}
                onChange={handleHourChange}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0');
                  return (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Minutes</label>
              <select
                value={minutes}
                onChange={handleMinuteChange}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
              >
                {Array.from({ length: 60 }, (_, i) => {
                  const minute = String(i).padStart(2, '0');
                  return (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePicker;
