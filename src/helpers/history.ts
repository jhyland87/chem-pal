import { getSearchHistory, addSearchHistoryEntry } from "@/utils/idbCache";

/**
 * Get the history of products that were clicked on.
 *
 * @returns The history of products that were clicked on.
 * @source
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  return await getSearchHistory();
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
  if (history.type === "search") {
    await addSearchHistoryEntry(history);
  }
}
