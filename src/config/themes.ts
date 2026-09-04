/**
 * App theme registry.
 *
 * How to add a complete palette:
 * 1. Paste the light tokens into `[data-theme="your-id"]` and the dark tokens
 *    into `html.dark[data-theme="your-id"]` in `src/styles/themes.css`.
 *    Keep every token (--background through --shadow-2xl, --radius, fonts).
 * 2. Point --theme-font-sans/serif/mono at next/font CSS variables (load the
 *    family in `src/app/layout.tsx` if it is new).
 * 3. Add the same id here with a name, short description, and preview hex
 *    swatches. The picker and storage validation read only this list.
 * 4. Rebuild. Selection is stored in localStorage and a cookie so it survives
 *    logout and is restored on the next login on this browser.
 *
 * How to update an existing palette: edit that theme's CSS block only. Do not
 * hardcode colors in components — use bg-primary, text-foreground, var(--primary).
 */
export const THEME_STORAGE_KEY = 'gulfzone.theme';
export const COLOR_MODE_STORAGE_KEY = 'gulfzone.colorMode';
export const THEME_COOKIE_NAME = 'gulfzone-theme';
export const COLOR_MODE_COOKIE_NAME = 'gulfzone-color-mode';
export const THEME_PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365;
export const DEFAULT_THEME_ID = 'heritage';
export const DEFAULT_COLOR_MODE = 'light' as const;

export type ColorMode = 'light' | 'dark' | 'system';

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  preview: {
    background: string;
    primary: string;
    accent: string;
    card: string;
  };
}

export const APP_THEMES = [
  {
    id: 'heritage',
    name: 'Heritage',
    description: 'Brick red, cream, and gold with Poppins',
    preview: {
      background: '#F8F5F0',
      primary: '#A32E28',
      accent: '#F4E6B5',
      card: '#F8F5F0',
    },
  },
  {
    id: 'citrus',
    name: 'Citrus',
    description: 'Warm orange and cream with Montserrat',
    preview: {
      background: '#FDF8F3',
      primary: '#E86B3A',
      accent: '#E8B86D',
      card: '#FFFFFF',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool gray and terracotta with Inter',
    preview: {
      background: '#E8EEF2',
      primary: '#E07840',
      accent: '#C9D7E8',
      card: '#FFFFFF',
    },
  },
  {
    id: 'sky',
    name: 'Sky',
    description: 'Bright blue on white with Open Sans',
    preview: {
      background: '#FFFFFF',
      primary: '#1DA1F2',
      accent: '#E8F4FC',
      card: '#F7F9FA',
    },
  },
  {
    id: 'grove',
    name: 'Grove',
    description: 'Mint green on white with Outfit',
    preview: {
      background: '#FCFCFC',
      primary: '#2A9B6A',
      accent: '#EDEDED',
      card: '#FCFCFC',
    },
  },
] as const satisfies readonly AppTheme[];

export type ThemeId = (typeof APP_THEMES)[number]['id'];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && APP_THEMES.some((theme) => theme.id === value);
}

export function isColorMode(value: string | null | undefined): value is ColorMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function parseThemeId(value: string | null | undefined): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

export function parseColorMode(value: string | null | undefined): ColorMode {
  return isColorMode(value) ? value : DEFAULT_COLOR_MODE;
}

export function resolveDarkClass(mode: ColorMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyDocumentTheme(themeId: ThemeId, colorMode: ColorMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', themeId);
  root.classList.toggle('dark', resolveDarkClass(colorMode));
}

function writeCookie(name: string, value: string): void {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${THEME_PREFERENCE_MAX_AGE}; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Save palette + appearance so they survive logout and the next login on this browser. */
export function persistThemePreference(themeId: ThemeId, colorMode: ColorMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
  } catch {
    /* quota / private mode */
  }
  try {
    writeCookie(THEME_COOKIE_NAME, themeId);
    writeCookie(COLOR_MODE_COOKIE_NAME, colorMode);
  } catch {
    /* cookies blocked */
  }
}

export function readStoredThemeId(): ThemeId {
  try {
    return parseThemeId(localStorage.getItem(THEME_STORAGE_KEY) || readCookie(THEME_COOKIE_NAME));
  } catch {
    return parseThemeId(readCookie(THEME_COOKIE_NAME));
  }
}

export function readStoredColorMode(): ColorMode {
  try {
    return parseColorMode(localStorage.getItem(COLOR_MODE_STORAGE_KEY) || readCookie(COLOR_MODE_COOKIE_NAME));
  } catch {
    return parseColorMode(readCookie(COLOR_MODE_COOKIE_NAME));
  }
}

/** Runs before paint so the first frame matches the saved palette. */
export const THEME_INIT_SCRIPT = `(function(){try{var lsT=null,lsM=null;try{lsT=localStorage.getItem('${THEME_STORAGE_KEY}');lsM=localStorage.getItem('${COLOR_MODE_STORAGE_KEY}');}catch(e){}function ck(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}var ids=${JSON.stringify(APP_THEMES.map((theme) => theme.id))};var t=lsT||ck('${THEME_COOKIE_NAME}');var m=lsM||ck('${COLOR_MODE_COOKIE_NAME}');var theme=ids.indexOf(t)!==-1?t:'${DEFAULT_THEME_ID}';var mode=(m==='light'||m==='dark'||m==='system')?m:'${DEFAULT_COLOR_MODE}';try{localStorage.setItem('${THEME_STORAGE_KEY}',theme);localStorage.setItem('${COLOR_MODE_STORAGE_KEY}',mode);}catch(e){}var sec=location.protocol==='https:'?'; Secure':'';var age='; Path=/; Max-Age=${THEME_PREFERENCE_MAX_AGE}; SameSite=Lax'+sec;document.cookie='${THEME_COOKIE_NAME}='+encodeURIComponent(theme)+age;document.cookie='${COLOR_MODE_COOKIE_NAME}='+encodeURIComponent(mode)+age;var dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.setAttribute('data-theme',theme);r.classList.toggle('dark',dark);}catch(e){}})();`;
