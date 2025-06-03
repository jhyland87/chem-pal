import { vi } from "vitest";

const actionMock = {
  setIcon: vi.fn(),
  setBadgeText: vi.fn(),
  setBadgeBackgroundColor: vi.fn(),
  setBadgeTextColor: vi.fn(),
  setTitle: vi.fn(),
  setTitleColor: vi.fn(),
  setPopup: vi.fn(),
};

if (!chrome.action) {
  console.debug("!!! chrome.action not found, using mock - may result in unexpected behavior !!!");
  window.chrome = {
    action: actionMock as unknown as typeof chrome.action,
  } as unknown as typeof chrome;
}

export default chrome.action;
