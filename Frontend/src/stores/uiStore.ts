import { create } from 'zustand';
import { ThemeMode } from '../theme/designTokens';

interface UiState {
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('kudiba_theme_mode');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
};

export const useUiStore = create<UiState>((set) => ({
  themeMode: getInitialTheme(),
  sidebarOpen: true,

  toggleTheme: () =>
    set((state) => {
      const next = state.themeMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('kudiba_theme_mode', next);
      return { themeMode: next };
    }),

  setThemeMode: (mode) => {
    localStorage.setItem('kudiba_theme_mode', mode);
    set({ themeMode: mode });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
