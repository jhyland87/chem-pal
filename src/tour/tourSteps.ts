import type { Step } from "react-joyride";

/**
 * CSS selectors for every element the guided tour anchors to. Buttons carry a
 * dedicated `data-tour` attribute so the copy/aria-labels can change freely; the
 * speed dial already has a stable `id`.
 * @source
 */
export const TOUR_TARGETS = {
  searchForm: '[data-tour="search-form"]',
  searchSubmit: '[data-tour="search-submit"]',
  advanced: '[data-tour="advanced-search"]',
  settings: '[data-tour="settings"]',
  maximize: '[data-tour="maximize"]',
  speedDial: '[data-tour="speed-dial-menu"]',
} as const;

/**
 * Step id for the maximize/"Open in tab" seam. The hook watches for this id to
 * hand the tour off from the popup to a full browser tab.
 * @source
 */
export const MAXIMIZE_STEP_ID = "maximize";

/**
 * Step id for the speed-dial step. The hook watches for this id to force the
 * (normally hover-hidden) speed dial open while it is spotlighted.
 * @source
 */
export const SPEED_DIAL_STEP_ID = "speed-dial";

const searchFormStep: Step = {
  target: TOUR_TARGETS.searchForm,
  title: "Search Input",
  content:
    'Search by chemical name, CAS number, formula, or SMILES. Build advanced queries with AND, OR, NOT, parentheses, and "quoted phrases" — the box highlights and validates your syntax as you type.',
  placement: "bottom",
};

const searchSubmitStep: Step = {
  target: TOUR_TARGETS.searchSubmit,
  title: "Run the search",
  content: "Click here — or just press Enter — to search across your selected suppliers.",
  placement: "bottom",
};

const advancedStep: Step = {
  target: TOUR_TARGETS.advanced,
  title: "Advanced search",
  content:
    "Open the side panel to filter by supplier, availability, country, and more before you search.",
  placement: "bottom-end",
};

const settingsStep: Step = {
  target: TOUR_TARGETS.settings,
  title: "Settings",
  content: "Manage your suppliers, currency, theme, and other preferences here.",
  placement: "bottom-end",
};

const maximizeStep: Step = {
  id: MAXIMIZE_STEP_ID,
  target: TOUR_TARGETS.maximize,
  title: "More room to explore",
  content: "Last thing — the popup is a little cramped. Open ChemPal in a full tab for more room.",
  placement: "bottom-end",
  // Last popup step, so react-joyride uses the `last` label, not `next`.
  locale: { next: "Open in tab", last: "Open in tab" },
};

const speedDialStep: Step = {
  id: SPEED_DIAL_STEP_ID,
  target: TOUR_TARGETS.speedDial,
  title: "Quick actions",
  content:
    "This corner menu lets you clear results, clear the cache, and toggle light/dark theme. Hover the bottom-right corner anytime to reveal it.",
  placement: "top-end",
  skipScroll: true,
};

const finishStep: Step = {
  target: "body",
  title: "You're all set!",
  content:
    'That\'s the tour. Happy searching — you can replay this anytime via "Take the tour" in the quick-actions menu.',
  placement: "center",
  buttons: ["primary"],
  locale: { last: "Done" },
};

/**
 * Tour shown on first open in the small popup. The speed dial is spotlighted
 * before the maximize seam, which is the last step and hands off to a full tab
 * (see {@link TAB_RESUME_STEPS}).
 * @source
 */
export const POPUP_STEPS: readonly Step[] = [
  searchFormStep,
  searchSubmitStep,
  advancedStep,
  settingsStep,
  speedDialStep,
  maximizeStep,
];

/**
 * Steps run in the full tab after the popup hands off at the maximize seam —
 * just the closing note (everything else was covered in the popup).
 * @source
 */
export const TAB_RESUME_STEPS: readonly Step[] = [finishStep];

/**
 * Complete single-context tour, used when the extension is opened directly in a
 * full tab on first run (no popup, so no maximize seam).
 * @source
 */
export const FULL_STEPS: readonly Step[] = [
  searchFormStep,
  searchSubmitStep,
  advancedStep,
  settingsStep,
  speedDialStep,
  finishStep,
];
