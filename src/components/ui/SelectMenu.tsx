'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Styled dropdown that replaces a native <select>. The option list matches the
 * trigger's width and font, is clamped to the viewport, and scrolls — so on
 * mobile the list is never smaller than the box (a native <select> limitation).
 */
export default function SelectMenu({
  value, onChange, options, placeholder = 'Select…', disabled, className = '',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const maxH = 280;

  const position = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > maxH || spaceBelow > r.top ? r.bottom + 4 : Math.max(8, r.top - maxH - 4);
    const width = r.width;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ top, left, width });
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) { position(); setOpen(true); } else setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current && !btnRef.current.contains(t) && listRef.current && !listRef.current.contains(t)) {
        setOpen(false);
      }
    };
    const onDismiss = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onDismiss);
    window.addEventListener('scroll', onDismiss, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onDismiss);
      window.removeEventListener('scroll', onDismiss, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={`w-full px-4 py-2.5 text-base border border-input rounded-lg bg-card flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-secondary disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={18} className="text-muted-foreground flex-shrink-0 ml-2" />
      </button>

      {open && !disabled && (
        <div
          ref={listRef}
          className="fixed bg-card border border-input rounded-lg shadow-2xl py-1 overflow-y-auto"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: maxH, zIndex: 9999 }}
        >
          {options.length === 0 && (
            <div className="px-4 py-2.5 text-sm text-muted-foreground">No options</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-base flex items-center justify-between transition-colors hover:bg-accent ${
                o.value === value ? 'bg-accent text-primary font-medium' : 'text-foreground'
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={16} className="text-primary flex-shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
