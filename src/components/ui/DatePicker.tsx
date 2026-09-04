'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-day-picker/style.css';

// Year options for the selector — module-level so the 100-element array isn't
// rebuilt on every render of every open picker.
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 50 + i);

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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 320 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Only highlight a day when there is an actual value — otherwise the picker
  // pre-selects the 1st of the month, and clicking it (deselect) feels like a
  // dead first click.
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  // Position the dropdown BEFORE it paints (computing in an effect after open
  // makes it flash at the top-left corner first, then jump into place).
  const positionDropdown = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 450; // Approximate height of dropdown
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > dropdownHeight ? rect.bottom + 8 : rect.top - dropdownHeight - 8;
    // Clamp horizontally so the panel never overflows the viewport (e.g. the
    // "To Date" field in a two-column row on a phone).
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setDropdownPos({ top: Math.max(8, top), left, width });
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) { positionDropdown(); setIsOpen(true); }
    else setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideButton = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      if (isOutsideButton && isOutsideDropdown) setIsOpen(false);
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
        onClick={toggleOpen}
        disabled={disabled}
        className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card flex items-center justify-between text-left disabled:bg-muted disabled:cursor-not-allowed"
      >
        <span className={displayValue ? 'text-foreground' : 'text-muted-foreground'}>
          {displayValue || placeholder}
        </span>
        <Calendar size={18} className="text-muted-foreground" />
      </button>

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="fixed bg-card border border-input rounded-lg shadow-2xl p-4"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            zIndex: 9999,
          }}
        >
          <style>{`
            .rdp-root {
              --rdp-accent-color: var(--primary);
              --rdp-accent-background-color: var(--accent);
              --rdp-day-width: 36px;
              --rdp-day-height: 36px;
              --rdp-today-color: var(--primary);
              margin: 0;
            }
            .rdp-months { justify-content: center; }
            .rdp-weekday {
              font-weight: 600;
              color: var(--muted-foreground);
              text-transform: uppercase;
              font-size: 0.75rem;
            }
            .rdp-day_button { border-radius: 0.375rem; font-size: 0.875rem; }
            .rdp-selected .rdp-day_button {
              background-color: var(--primary);
              color: var(--primary-foreground);
              font-weight: 600;
              border: none;
            }
            .rdp-today:not(.rdp-outside) .rdp-day_button { font-weight: 700; color: var(--primary); }
            .rdp-disabled { opacity: 0.4; }
            .rdp-month_caption {
              font-weight: 600;
              color: var(--foreground);
              font-size: 0.875rem;
              padding: 0.25rem 0 0.75rem;
            }
          `}</style>

          {/* Year and Month Selector */}
          <div className="mb-4 space-y-3">
            {/* Year Selector */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Year</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="p-1 hover:bg-muted rounded transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card text-sm"
                >
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="p-1 hover:bg-muted rounded transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Month Selector */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-1 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card text-sm"
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
            required
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
