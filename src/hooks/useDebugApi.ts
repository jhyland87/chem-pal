import { IS_DEV_BUILD } from '@/utils/isDevBuild';
import { useEffect } from 'react';

/**
 * Attaches the `window.chempal` debug helpers while `enabled` is true, and
 * removes them again when it goes false.
 *
 * Dev builds always get the helpers (see `src/main.tsx`); this hook is what makes
 * them reachable in a normal build once the user unlocks advanced mode. The
 * module is imported dynamically so it stays a lazily-loaded chunk — nobody pays
 * for it until advanced mode is actually switched on.
 * @param enabled - Whether the helpers should be attached (i.e. advanced mode).
 * @returns Nothing; mutates the global `window` as a side effect.
 * @category Hooks
 * @example
 * ```tsx
 * const [advancedMode, setAdvancedMode] = useState(false);
 * useDebugApi(advancedMode);
 * // advancedMode → window.chempal is defined; toggling off removes it.
 * ```
 * @source
 */
export function useDebugApi(enabled: boolean): void {
  useEffect(() => {
    // Dev builds already expose the helpers unconditionally at startup; leave
    // them alone so leaving advanced mode doesn't strip a dev convenience.
    if (!enabled || IS_DEV_BUILD) return;

    let cancelled = false;
    void (async () => {
      try {
        const { exposeDebugApi } = await import('@/utils/debugConsole');
        if (!cancelled) exposeDebugApi();
      } catch (error) {
        console.error('Failed to expose the debug helpers:', { error });
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          const { removeDebugApi } = await import('@/utils/debugConsole');
          removeDebugApi();
        } catch (error) {
          console.error('Failed to remove the debug helpers:', { error });
        }
      })();
    };
  }, [enabled]);
}
