import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getAvailableLocales, getLocale, i18n, setLocale, useLocale } from "@/helpers/i18n";

/** A component that subscribes to the locale and renders a translated string. */
function Sample() {
  useLocale();
  return <span>{i18n("results_retry")}</span>;
}

describe("reactive i18n", () => {
  afterEach(() => {
    act(() => setLocale("en"));
  });

  it("lists the locales that ship a messages.json", () => {
    expect(getAvailableLocales()).toEqual(expect.arrayContaining(["en", "pl"]));
  });

  it("resolves and substitutes in the active locale", () => {
    setLocale("en");
    expect(i18n("results_retry")).toBe("Retry");
    expect(i18n("results_error", ["boom"])).toBe("Error: boom");

    setLocale("pl");
    expect(i18n("results_retry")).toBe("Ponów");
    expect(i18n("results_error", ["boom"])).toBe("Błąd: boom");
  });

  it("re-renders subscribed components when the locale changes (no refresh)", () => {
    setLocale("en");
    render(<Sample />);
    expect(screen.getByText("Retry")).toBeInTheDocument();

    act(() => setLocale("pl"));
    expect(screen.getByText("Ponów")).toBeInTheDocument();
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("falls back to the default locale for an unknown locale", () => {
    setLocale("xx");
    expect(getLocale()).toBe("en");
  });
});
