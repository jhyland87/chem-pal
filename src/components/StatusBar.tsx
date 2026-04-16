import { StatusBarContainer } from "@/components/StyledComponents";
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import styles from "./StatusBar.module.scss";

interface StatusBarContextValue {
  statusText: string | null;
  setStatusText: (text: string | null) => void;
  flashStatusText: (text: string, durationMs?: number) => void;
}

const StatusBarContext = createContext<StatusBarContextValue>({
  statusText: null,
  setStatusText: () => {},
  flashStatusText: () => {},
});

export function useStatusBar() {
  return useContext(StatusBarContext);
}

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

export default function StatusBar() {
  const { statusText } = useStatusBar();

  if (!statusText) return null;

  return (
    <StatusBarContainer className={styles["status-bar"]}>
      {statusText}
    </StatusBarContainer>
  );
}
