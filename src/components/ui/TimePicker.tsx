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
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between text-left disabled:bg-gray-50 disabled:cursor-not-allowed"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {value ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : placeholder}
        </span>
        <Clock size={18} className="text-gray-400" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 w-48">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Hours</label>
              <select
                value={hours}
                onChange={handleHourChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              <label className="block text-xs font-medium text-gray-700 mb-2">Minutes</label>
              <select
                value={minutes}
                onChange={handleMinuteChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
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
