'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      try {
        const date = parse(value, 'yyyy-MM-dd', new Date());
        setDisplayValue(format(date, 'MMM dd, yyyy'));
        setSelectedMonth(date.getMonth());
        setSelectedYear(date.getFullYear());
      } catch {
        setDisplayValue('');
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      onChange(formattedDate);
      setIsOpen(false);
    }
  };

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date(selectedYear, selectedMonth, 1);

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
        <span className={displayValue ? 'text-gray-900' : 'text-gray-500'}>
          {displayValue || placeholder}
        </span>
        <Calendar size={18} className="text-gray-400" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 w-80">
          <style>{`
            .rdp {
              --rdp-cell-size: 36px;
              --rdp-accent-color: #3b82f6;
              --rdp-background-color: #dbeafe;
              margin: 0;
            }
            .rdp-months {
              justify-content: center;
            }
            .rdp-head_cell {
              font-weight: 600;
              color: #374151;
              text-transform: uppercase;
              font-size: 0.75rem;
            }
            .rdp-cell {
              padding: 0;
            }
            .rdp-day {
              border-radius: 0.375rem;
              font-size: 0.875rem;
            }
            .rdp-day_selected:not([disabled]) {
              background-color: #3b82f6;
              color: white;
              font-weight: 600;
            }
            .rdp-day_today:not([disabled]) {
              font-weight: 700;
              color: #3b82f6;
            }
            .rdp-day_disabled {
              color: #d1d5db;
            }
            .rdp-caption {
              padding: 0.5rem 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-weight: 600;
              color: #111827;
              margin-bottom: 1rem;
            }
            .rdp-caption_label {
              font-size: 0.875rem;
            }
            .rdp-button_reset {
              padding: 0.25rem;
              border-radius: 0.375rem;
            }
            .rdp-button_reset:hover:not([disabled]) {
              background-color: #f3f4f6;
            }
          `}</style>

          {/* Year and Month Selector */}
          <div className="mb-4 space-y-3">
            {/* Year Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Year</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="p-1 hover:bg-gray-100 rounded transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 50 + i).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="p-1 hover:bg-gray-100 rounded transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Month Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                <option value={0}>January</option>
                <option value={1}>February</option>
                <option value={2}>March</option>
                <option value={3}>April</option>
                <option value={4}>May</option>
                <option value={5}>June</option>
                <option value={6}>July</option>
                <option value={7}>August</option>
                <option value={8}>September</option>
                <option value={9}>October</option>
                <option value={10}>November</option>
                <option value={11}>December</option>
              </select>
            </div>
          </div>

          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            month={new Date(selectedYear, selectedMonth)}
            onMonthChange={(date) => {
              setSelectedMonth(date.getMonth());
              setSelectedYear(date.getFullYear());
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            showOutsideDays={false}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;
