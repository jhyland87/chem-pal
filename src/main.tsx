import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
//import AppExample from "./AppExample.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { ThemeProvider } from "./components/ThemeProvider.tsx";
import "./index.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
