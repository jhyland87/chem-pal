// Registers @testing-library/jest-dom's global matcher augmentation
// (toBeInTheDocument, toHaveAttribute, toHaveClass, …) for the whole test
// program. Without this, the matchers only type-check when some individual test
// file happens to `import '@testing-library/jest-dom'` — so deleting that one
// file silently breaks `pnpm type-check` across every test. This file is picked
// up via tsconfig.test.json's `src/types/**/*.d.ts` include.
import '@testing-library/jest-dom';
