import { useCallback, useState } from "react";

/**
 * Hook to manage About modal visibility state.
 * Extracted from SpeedDialMenu.tsx for better code organization.
 *
 * @returns About modal state and handlers
 *
 * @example
 * ```tsx
 * const { aboutOpen, handleAboutOpen, handleAboutClose } = useAboutModal();
 *
 * <Button onClick={handleAboutOpen}>About</Button>
 * <AboutModal aboutOpen={aboutOpen} setAboutOpen={handleAboutClose} />
 * ```
 */
export function useAboutModal() {
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleAboutOpen = useCallback(() => {
    setAboutOpen(true);
  }, []);

  const handleAboutClose = useCallback((open: boolean) => {
    setAboutOpen(open);
  }, []);

  return {
    aboutOpen,
    handleAboutOpen,
    handleAboutClose,
    setAboutOpen,
  };
}
