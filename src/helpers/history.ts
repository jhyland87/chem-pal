import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";

/**
 * Get the history of products that were clicked on.
 *
 * @returns The history of products that were clicked on.
 * @source
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  const { history } = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
  return history || [];
}

/**
 * Add a product to the history of products that were clicked on.
 *
 * @param history - The product to add to the history.
 * @source
 */
export async function addHistory(history: HistoryEntry): Promise<void> {
  if (!history) {
    return;
  }
  history.timestamp = Date.now();
  const historyData = await getHistory();
  historyData.push(history);
  await cstorage.local.set({ [CACHE.SEARCH_HISTORY]: historyData });
}
