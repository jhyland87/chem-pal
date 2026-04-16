import { StatusBarContainer } from "@/components/StyledComponents";
import { createContext, ReactNode, useContext, useState } from "react";
import styles from "./StatusBar.module.scss";

const StatusBarContext = createContext<{
  statusText: string | null;
  setStatusText: (text: string | null) => void;
}>({ statusText: null, setStatusText: () => {} });

export function useStatusBar() {
  return useContext(StatusBarContext);
}

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [statusText, setStatusText] = useState<string | null>(null);
  return (
    <StatusBarContext.Provider value={{ statusText, setStatusText }}>
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
