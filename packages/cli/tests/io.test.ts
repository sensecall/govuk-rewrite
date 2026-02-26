import { afterEach, describe, expect, it } from "vitest";
import { shouldUseSpinner } from "../src/io.js";

const originalDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(process.stdout, "isTTY", originalDescriptor);
  }
});

describe("shouldUseSpinner", () => {
  it("returns true only when spinner enabled and stdout is a TTY", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    expect(shouldUseSpinner(true)).toBe(true);

    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      configurable: true,
    });
    expect(shouldUseSpinner(true)).toBe(false);
    expect(shouldUseSpinner(false)).toBe(false);
  });
});
