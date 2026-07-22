// Throwaway migration copied into src/migrations/steps by cache-migration.e2e.test.ts
// so the built extension contains one detectable step. Uses the `@/` alias (not a
// relative import) so it type-checks in place AND after being copied into steps/.
import type { Migration } from '@/migrations/types';

export const migration: Migration = {
  from: '0.9.0',
  to: '1.0.0',
  description: 'E2E fixture: tag cached search results as migrated',
  async up({ db }) {
    const row = await db.get('search_results', 'current');
    if (row) {
      await db.put('search_results', { ...row, migratedBy: '0.9.0->1.0.0' });
    }
  },
};
