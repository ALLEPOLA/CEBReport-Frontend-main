import { useEffect, useRef, useCallback } from "react";

interface UseIdleTimeoutOptions {
  /** Called when the user has been idle for the full idleTime */
  onIdle: () => void;
  /** Called warningTime minutes before logout (optional) */
  onWarning?: () => void;
  /** Called when user resumes activity after warning is shown (optional) */
  onActive?: () => void;
  /** Total idle time in minutes before auto-logout. Default: 15 */
  idleTime?: number;
  /** How many minutes before logout the warning fires. Default: 1 */
  warningTime?: number;
  /** Set to false to disable the hook (e.g. when not logged in). Default: true */
  enabled?: boolean;
}

/**
 * useIdleTimeout
 *
 * Listens to common user-activity events and resets a countdown timer on
 * each event.  When the countdown reaches zero the `onIdle` callback is
 * invoked.  An optional `onWarning` callback fires `warningTime` minutes
 * before the idle timeout so that a toast / modal can be shown.
 */
const useIdleTimeout = ({
  onIdle,
  onWarning,
  onActive,
  idleTime = 15,
  warningTime = 1,
  enabled = true,
}: UseIdleTimeoutOptions): void => {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWarnedRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    // If the warning was shown and user is now active, call onActive
    if (isWarnedRef.current) {
      isWarnedRef.current = false;
      if (onActive) {
        onActive();
      }
    }

    const idleMs = idleTime * 60 * 1000;
    const warningMs = (idleTime - warningTime) * 60 * 1000;

    // Fire warning before logout (only if there is time to show it)
    if (onWarning && warningMs > 0) {
      warningTimerRef.current = setTimeout(() => {
        isWarnedRef.current = true;
        onWarning();
      }, warningMs);
    }

    // Fire the actual logout
    idleTimerRef.current = setTimeout(onIdle, idleMs);
  }, [clearTimers, onIdle, onWarning, onActive, idleTime, warningTime]);

  useEffect(() => {
    if (!enabled) return;

    const activityEvents: string[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
      "wheel",
    ];

    // Start the initial countdown
    resetTimers();

    // Reset on any activity
    activityEvents.forEach((event) =>
      window.addEventListener(event, resetTimers, { passive: true })
    );

    return () => {
      clearTimers();
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetTimers)
      );
    };
  }, [enabled, resetTimers, clearTimers]);
};

export default useIdleTimeout;
