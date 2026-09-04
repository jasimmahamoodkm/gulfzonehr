'use client';

import React from 'react';
import { APP_THEMES, ColorMode } from '@/config/themes';
import { useTheme } from '@/context/ThemeContext';

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

interface ThemePickerProps {
  compact?: boolean;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ compact = false }) => {
  const { themeId, colorMode, setThemeId, setColorMode } = useTheme();

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      <div>
        {!compact && (
          <h3 className="text-sm font-semibold text-foreground mb-3">Palette</h3>
        )}
        <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}`}>
          {APP_THEMES.map((theme) => {
            const selected = theme.id === themeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setThemeId(theme.id)}
                aria-pressed={selected}
                className={`text-left rounded-lg border p-3 transition focus:outline-none focus:ring-2 focus:ring-ring ${
                  selected
                    ? 'border-primary ring-2 ring-ring/40'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div
                  className="h-12 rounded-md mb-2 overflow-hidden border border-border/60 flex"
                  aria-hidden
                >
                  <span className="flex-1" style={{ background: theme.preview.background }} />
                  <span className="w-8" style={{ background: theme.preview.primary }} />
                  <span className="w-6" style={{ background: theme.preview.accent }} />
                  <span className="w-8" style={{ background: theme.preview.card }} />
                </div>
                <p className="text-sm font-medium text-foreground">{theme.name}</p>
                {!compact && (
                  <p className="text-xs text-muted-foreground mt-0.5">{theme.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {!compact && (
          <h3 className="text-sm font-semibold text-foreground mb-3">Appearance</h3>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Color mode">
          {COLOR_MODES.map((mode) => {
            const selected = colorMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setColorMode(mode.id)}
                aria-pressed={selected}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemePicker;
