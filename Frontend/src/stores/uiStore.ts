import { create } from 'zustand';
import { ThemeMode } from '../theme/designTokens';

interface UiState {
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('kudiba_theme_mode');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
};

export const useUiStore = create<UiState>((set) => ({
  themeMode: getInitialTheme(),
  sidebarOpen: true,
  mobileSidebarOpen: false,
  sidebarCollapsed: false,

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
  toggleMobileSidebar: () =>
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
