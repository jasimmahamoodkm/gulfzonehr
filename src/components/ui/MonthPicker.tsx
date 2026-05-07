'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MonthPicker: React.FC<MonthPickerProps> = ({
  value,
  onChange,
  placeholder = 'Select month',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-');
      setYear(parseInt(y));
      setMonth(parseInt(m) - 1);
    }
  }, [value]);

  const handleMonthSelect = (selectedMonth: number) => {
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    onChange(`${year}-${monthStr}`);
    setIsOpen(false);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const displayValue = value
    ? `${months[parseInt(value.split('-')[1]) - 1]} ${value.split('-')[0]}`
    : placeholder;

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
          {displayValue}
        </span>
        <Calendar size={18} className="text-gray-400" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 min-w-80">
          <div className="space-y-4">
            {/* Year Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setYear(year - 1)}
                  className="p-1 hover:bg-gray-100 rounded transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-lg font-bold text-gray-900">{year}</span>
                <button
                  type="button"
                  onClick={() => setYear(year + 1)}
                  className="p-1 hover:bg-gray-100 rounded transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleMonthSelect(idx)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    month === idx
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
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

export default MonthPicker;
