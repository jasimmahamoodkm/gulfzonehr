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
          {displayValue}
        </span>
        <Calendar size={18} className="text-muted-foreground" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 bg-card border border-input rounded-lg shadow-lg z-50 p-4 min-w-80">
          <div className="space-y-4">
            {/* Year Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setYear(year - 1)}
                  className="p-1 hover:bg-muted rounded transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-lg font-bold text-foreground">{year}</span>
                <button
                  type="button"
                  onClick={() => setYear(year + 1)}
                  className="p-1 hover:bg-muted rounded transition"
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
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
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

export default MonthPicker;
