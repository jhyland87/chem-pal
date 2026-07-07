import { CACHE } from "@/constants/common";
import { isTabView, openExtensionTab } from "@/utils/displayContext";
import { cstorage } from "@/utils/storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import type { EventData, EventHandler, Step } from "react-joyride";
import {
  FULL_STEPS,
  MAXIMIZE_STEP_ID,
  POPUP_STEPS,
  SPEED_DIAL_STEP_ID,
  TAB_RESUME_STEPS,
} from "./tourSteps";

/** How long the "Maybe later" welcome dismissal stays snoozed (24 hours, ms). */
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Props the hook feeds to the {@link AppTour} presentational component. */
interface AppTourRenderState {
  /** Whether the tour is running. */
  run: boolean;
  /** The active step list for the current context. */
  steps: Step[];
  /** Bumped on replay to force Joyride to remount and restart at step 0. */
  joyrideKey: number;
  /** Joyride event handler. */
  onEvent: EventHandler;
}

/** Props the hook feeds to the {@link TourWelcomeDialog} component. */
interface WelcomeState {
  /** Whether the welcome prompt is shown. */
  open: boolean;
  /** Launches the pointed tour. */
  onStart: () => void;
  /** Snoozes the prompt for 24h. */
  onDismiss: () => void;
}

/** Return value of {@link useAppTour}. */
interface UseAppTourResult {
  /** State/handlers to spread onto {@link AppTour}. */
  tour: AppTourRenderState;
  /** State/handlers to spread onto {@link TourWelcomeDialog}. */
  welcome: WelcomeState;
  /** True while the speed-dial step is spotlighted — App suppresses the hover
   *  mousemove handler so the (normally hidden) speed dial stays open. */
  isSpeedDialLocked: boolean;
  /** Starts (or replays) the tour in the current context. */
  startTour: () => void;
}

/** Options for {@link useAppTour}. */
interface UseAppTourOptions {
  /** Forces the speed-dial FAB open/closed (wired to the App reducer). */
  setSpeedDialVisible: (visible: boolean) => void;
}

/**
 * Orchestrates the first-run guided tour. On mount it decides whether to prompt
 * (unseen + not snoozed), shows an opt-in welcome dialog, drives the popup→tab
 * hand-off through `chrome.storage.session`, forces the speed dial open while it
 * is spotlighted, and persists a permanent "seen" flag when the tour ends.
 * @param options - Callbacks the hook needs from the App reducer.
 * @returns Render state for {@link AppTour}/{@link TourWelcomeDialog}, the
 *   speed-dial lock, and a replay trigger.
 * @example
 * ```tsx
 * const { tour, welcome, isSpeedDialLocked, startTour } = useAppTour({ setSpeedDialVisible });
 * // <TourWelcomeDialog {...welcome} /> opts in; <AppTour {...tour} /> runs the steps.
 * ```
 * @source
 */
export function useAppTour({ setSpeedDialVisible }: UseAppTourOptions): UseAppTourResult {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [joyrideKey, setJoyrideKey] = useState(0);
  const [isSpeedDialLocked, setIsSpeedDialLocked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Set synchronously when the maximize seam is reached so the tour-end handler
  // can tell a popup→tab hand-off apart from a genuine finish/skip.
  const handoffPendingRef = useRef(false);
  // The pointed steps to launch once the welcome prompt's "Start" is clicked.
  const realStepsRef = useRef<Step[]>([...POPUP_STEPS]);

  /**
   * Persists the permanent "tour seen" flag to local storage.
   * @source
   */
  const markSeen = useCallback(async (): Promise<void> => {
    try {
      await cstorage.local.set({ [CACHE.HAS_SEEN_TOUR]: true });
    } catch (error) {
      console.warn("Failed to persist tour-seen flag", { error });
    }
  }, []);

  /**
   * Snoozes the welcome prompt for 24h after a "Maybe later" dismissal.
   * @source
   */
  const snooze = useCallback(async (): Promise<void> => {
    try {
      await cstorage.local.set({ [CACHE.TOUR_SNOOZE_UNTIL]: Date.now() + SNOOZE_MS });
    } catch (error) {
      console.warn("Failed to snooze tour prompt", { error });
    }
  }, []);

  // First-run / resume detection. Runs once on mount.
  useEffect(() => {
    let cancelled = false;

    const init = async (): Promise<void> => {
      try {
        const inTab = isTabView();
        const [local, session] = await Promise.all([
          cstorage.local.get([CACHE.HAS_SEEN_TOUR, CACHE.TOUR_SNOOZE_UNTIL]),
          cstorage.session.get([CACHE.TOUR_RESUME]),
        ]);
        if (cancelled) return;

        const seen = Boolean(local[CACHE.HAS_SEEN_TOUR]);
        const snoozeUntil = Number(local[CACHE.TOUR_SNOOZE_UNTIL] ?? 0);
        const resume = Boolean(session[CACHE.TOUR_RESUME]);

        if (inTab && resume) {
          // Handed off from the popup — clear the flag and continue in the tab.
          await cstorage.session.remove(String(CACHE.TOUR_RESUME));
          if (cancelled) return;
          setSteps([...TAB_RESUME_STEPS]);
          setRun(true);
          return;
        }

        // Already seen, or snoozed via "Maybe later" and still within 24h.
        if (seen || (snoozeUntil > 0 && Date.now() < snoozeUntil)) return;

        // First run (or snooze expired): open the opt-in prompt. "Start tour"
        // then launches the pointed steps for this context.
        realStepsRef.current = inTab ? [...FULL_STEPS] : [...POPUP_STEPS];
        setShowWelcome(true);
      } catch (error) {
        console.warn("Failed to initialise app tour", { error });
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEvent = useCallback<EventHandler>(
    (data: EventData) => {
      const { type, status, action, step } = data;
      const stepId = step?.id;

      // Force the speed dial visible while its step is shown; release on exit.
      if (stepId === SPEED_DIAL_STEP_ID) {
        if (type === EVENTS.STEP_BEFORE) {
          setSpeedDialVisible(true);
          setIsSpeedDialLocked(true);
        } else if (type === EVENTS.STEP_AFTER) {
          setSpeedDialVisible(false);
          setIsSpeedDialLocked(false);
        }
      }

      // Maximize seam. Set the resume flag as soon as the step appears (so
      // clicking the real button through the spotlight still resumes in the
      // tab), and open the tab when the user advances via the tooltip.
      if (stepId === MAXIMIZE_STEP_ID) {
        if (type === EVENTS.STEP_BEFORE) {
          handoffPendingRef.current = true;
          void cstorage.session.set({ [CACHE.TOUR_RESUME]: true });
        } else if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
          void openExtensionTab();
        }
      }

      if (type !== EVENTS.TOUR_END) return;

      // Pointed tour ended.
      setRun(false);
      setSpeedDialVisible(false);
      setIsSpeedDialLocked(false);

      const wasHandoff = handoffPendingRef.current && status === STATUS.FINISHED;
      handoffPendingRef.current = false;

      // A popup→tab hand-off: leave TOUR_RESUME set so the tab resumes and
      // don't mark seen yet. Any other end (finished normally, or skipped at
      // the seam) finalizes: clear the resume flag and mark the tour seen.
      if (!wasHandoff) {
        void cstorage.session.remove(String(CACHE.TOUR_RESUME));
        void markSeen();
      }
    },
    [markSeen, setSpeedDialVisible],
  );

  /**
   * Launches the pointed tour (from the welcome prompt or a manual replay).
   * @source
   */
  const runPointedTour = useCallback((next: Step[]): void => {
    handoffPendingRef.current = false;
    setIsSpeedDialLocked(false);
    setShowWelcome(false);
    setSteps(next);
    setJoyrideKey((key) => key + 1);
    setRun(true);
  }, []);

  const onStart = useCallback(() => {
    runPointedTour(realStepsRef.current);
  }, [runPointedTour]);

  const onDismiss = useCallback(() => {
    setShowWelcome(false);
    void snooze();
  }, [snooze]);

  const startTour = useCallback(() => {
    // Manual replay skips the welcome prompt — they already opted in.
    runPointedTour(isTabView() ? [...FULL_STEPS] : [...POPUP_STEPS]);
  }, [runPointedTour]);

  return {
    tour: { run, steps, joyrideKey, onEvent: handleEvent },
    welcome: { open: showWelcome, onStart, onDismiss },
    isSpeedDialLocked,
    startTour,
  };
}
