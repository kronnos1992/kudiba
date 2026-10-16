export const tokens = {
  light: {
    emeraldPrimary: '#0D5C3A',
    emeraldLight: '#168253',
    goldPrimary: '#C59B27',
    bgMain: '#F5F2EB',
    bgSidebar: '#FCFAF6',
    glassBg: 'rgba(255, 253, 249, 0.78)',
    glassBorder: 'rgba(13, 92, 58, 0.16)',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    border: 'rgba(13, 92, 58, 0.12)',
    status: {
      ok: '#0D5C3A',
      medio: '#D97706',
      critico: '#DC2626',
      acompanhar: '#2563EB',
    },
  },
  dark: {
    emeraldPrimary: '#10B981',
    emeraldLight: '#34D399',
    goldPrimary: '#FBBF24',
    bgMain: '#0A0E14',
    bgSidebar: '#0F141D',
    glassBg: 'rgba(15, 20, 29, 0.72)',
    glassBorder: 'rgba(16, 185, 129, 0.22)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: 'rgba(16, 185, 129, 0.18)',
    status: {
      ok: '#34D399',
      medio: '#FBBF24',
      critico: '#F87171',
      acompanhar: '#60A5FA',
    },
  },
  fonts: {
    primary: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
  shadows: {
    glass: '0 8px 32px 0 rgba(13, 92, 58, 0.08)',
    card: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
};

export type ThemeMode = 'light' | 'dark';
