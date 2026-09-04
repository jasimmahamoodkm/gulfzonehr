'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ColorMode,
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME_ID,
  ThemeId,
  applyDocumentTheme,
  persistThemePreference,
  readStoredColorMode,
  readStoredThemeId,
} from '@/config/themes';

interface ThemeContextValue {
  themeId: ThemeId;
  colorMode: ColorMode;
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  initialThemeId?: ThemeId;
  initialColorMode?: ColorMode;
}> = ({ children, initialThemeId = DEFAULT_THEME_ID, initialColorMode = DEFAULT_COLOR_MODE }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(initialThemeId);
  const [colorMode, setColorModeState] = useState<ColorMode>(initialColorMode);
  const themeIdRef = useRef(themeId);
  const colorModeRef = useRef(colorMode);
  themeIdRef.current = themeId;
  colorModeRef.current = colorMode;

  useLayoutEffect(() => {
    const storedTheme = readStoredThemeId();
    const storedMode = readStoredColorMode();
    setThemeIdState(storedTheme);
    setColorModeState(storedMode);
    persistThemePreference(storedTheme, storedMode);
    applyDocumentTheme(storedTheme, storedMode);
  }, []);

  useEffect(() => {
    if (colorMode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyDocumentTheme(themeIdRef.current, 'system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [colorMode]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    persistThemePreference(id, colorModeRef.current);
    applyDocumentTheme(id, colorModeRef.current);
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    persistThemePreference(themeIdRef.current, mode);
    applyDocumentTheme(themeIdRef.current, mode);
  }, []);

  const value = useMemo(
    () => ({ themeId, colorMode, setThemeId, setColorMode }),
    [themeId, colorMode, setThemeId, setColorMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
