/**
 * Get the history of products that were clicked on.
 *
 * @returns The history of products that were clicked on.
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  const { history } = await chrome.storage.local.get(["history"]);
  return history || [];
}

/**
 * Add a product to the history of products that were clicked on.
 *
 * @param history - The product to add to the history.
 */
export async function addHistory(history: HistoryEntry): Promise<void> {
  if (!history) {
    return;
  }
  history.timestamp = Date.now();
  const historyData = await getHistory();
  historyData.push(history);
  await chrome.storage.local.set({ history: historyData });
}
