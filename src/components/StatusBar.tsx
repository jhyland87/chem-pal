import { StatusBarContainer } from '@/components/StyledComponents';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import styles from './StatusBar.module.scss';

/**
 * Shape of the status-bar context: the current status text plus setters for
 * sticky and transient (auto-clearing) messages.
 * @example
 * ```tsx
 * const { setStatusText, flashStatusText } = useStatusBar();
 * setStatusText("https://example.com"); // sticky until cleared
 * flashStatusText("Copied!", 1500);     // clears after 1.5s
 * ```
 * @source
 */
interface StatusBarContextValue {
  /** Current status message, or `null` when hidden. */
  statusText: string | null;
  /** Sets a sticky status message (pass `null` to clear). */
  setStatusText: (text: string | null) => void;
  /** Shows a message that auto-clears after `durationMs` (default 1000ms). */
  flashStatusText: (text: string, durationMs?: number) => void;
}

const StatusBarContext = createContext<StatusBarContextValue>({
  statusText: null,
  setStatusText: () => {},
  flashStatusText: () => {},
});

/**
 * Hook returning the status-bar context, used to read or update the message
 * shown in the bottom status bar (e.g. hovered link URLs, transient flashes).
 * @returns The {@link StatusBarContextValue} from the nearest provider.
 * @example
 * ```tsx
 * const { setStatusText } = useStatusBar();
 * <a onMouseEnter={() => setStatusText(href)} onMouseLeave={() => setStatusText(null)} />
 * ```
 * @source
 */
export function useStatusBar() {
  return useContext(StatusBarContext);
}

/**
 * Context provider for the status bar. Holds the current message and exposes
 * `setStatusText` / `flashStatusText` (the latter auto-clears via a timer) to
 * descendants through {@link useStatusBar}.
 * @param props - The provider props.
 * - `children` - The subtree that can read and update the status bar.
 * @returns The provider wrapping `children`.
 * @example
 * ```tsx
 * <StatusBarProvider>
 *   <App />
 *   <StatusBar />
 * </StatusBarProvider>
 * ```
 * @source
 */
export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [statusText, setStatusText] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashStatusText = useCallback((text: string, durationMs = 1000) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setStatusText(text);
    flashTimerRef.current = setTimeout(() => {
      setStatusText(null);
      flashTimerRef.current = null;
    }, durationMs);
  }, []);

  return (
    <StatusBarContext.Provider value={{ statusText, setStatusText, flashStatusText }}>
      {children}
    </StatusBarContext.Provider>
  );
}

/**
 * Renders the bottom status bar showing the current message from
 * {@link useStatusBar}, or nothing when there's no message.
 * @returns The status-bar element, or `null` when `statusText` is empty.
 * @example
 * ```tsx
 * // Renders "https://example.com" while a link is hovered; null otherwise.
 * <StatusBar />
 * ```
 * @source
 */
export default function StatusBar() {
  const { statusText } = useStatusBar();

  if (!statusText) return null;

  return <StatusBarContainer className={styles['status-bar']}>{statusText}</StatusBarContainer>;
}
