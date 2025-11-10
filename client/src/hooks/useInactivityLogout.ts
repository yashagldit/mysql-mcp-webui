import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../components/Auth/AuthContext';

interface InactivityLogoutOptions {
  timeoutMs: number;
  warningMs?: number; // Show warning this many ms before logout
  onWarning?: (secondsRemaining: number) => void;
  onLogout?: () => void;
}

/**
 * Hook to automatically log out users after a period of inactivity
 * Only applies to WebUI users (JWT auth with user object), not API token users
 */
export function useInactivityLogout({
  timeoutMs,
  warningMs = 60000, // Default: warn 60 seconds before logout
  onWarning,
  onLogout,
}: InactivityLogoutOptions) {
  const { isAuthenticated, user, logout } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [warningSecondsRemaining, setWarningSecondsRemaining] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Only track inactivity for WebUI users (those with user object from JWT auth)
  // API token users (user === null) are excluded
  const shouldTrackInactivity = isAuthenticated && user !== null;

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setWarningSecondsRemaining(null);
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    await logout();
    if (onLogout) {
      onLogout();
    }
  }, [logout, onLogout, clearAllTimers]);

  const startWarningCountdown = useCallback(() => {
    const secondsRemaining = Math.ceil(warningMs / 1000);
    setWarningSecondsRemaining(secondsRemaining);

    if (onWarning) {
      onWarning(secondsRemaining);
    }

    // Update countdown every second
    let remaining = secondsRemaining;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setWarningSecondsRemaining(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);
  }, [warningMs, onWarning]);

  const resetInactivityTimer = useCallback(() => {
    if (!shouldTrackInactivity) return;

    clearAllTimers();
    lastActivityRef.current = Date.now();

    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, timeoutMs - warningMs);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  }, [shouldTrackInactivity, timeoutMs, warningMs, handleLogout, startWarningCountdown, clearAllTimers]);

  const handleActivity = useCallback(() => {
    // Clear warning if user becomes active again
    if (warningSecondsRemaining !== null) {
      setWarningSecondsRemaining(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
    resetInactivityTimer();
  }, [resetInactivityTimer, warningSecondsRemaining]);

  useEffect(() => {
    if (!shouldTrackInactivity) {
      clearAllTimers();
      return;
    }

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle activity handler to avoid excessive resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandler = () => {
      if (!throttleTimeout) {
        handleActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // Throttle to once per second
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledHandler);
    });

    // Start initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledHandler);
      });
      clearAllTimers();
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [shouldTrackInactivity, handleActivity, resetInactivityTimer, clearAllTimers]);

  return {
    warningSecondsRemaining,
    extendSession: handleActivity,
  };
}
