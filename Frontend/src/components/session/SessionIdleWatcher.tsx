import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/auth';

const IDLE_LIMIT_MS = (() => {
  const minutes = Number(import.meta.env.VITE_SESSION_IDLE_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60_000;
})();

const RESET_THROTTLE_MS = 15_000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'mousemove',
];

export const SessionIdleWatcher: React.FC = () => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastResetAt = 0;

    const endSession = () => {
      const { refreshToken, logout } = useAuthStore.getState();
      if (refreshToken) {
        void authApi.logout(refreshToken);
      }
      logout('idle');
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastResetAt < RESET_THROTTLE_MS) return;
      lastResetAt = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(endSession, IDLE_LIMIT_MS);
    };

    lastResetAt = Date.now();
    timer = setTimeout(endSession, IDLE_LIMIT_MS);
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, []);

  return null;
};
