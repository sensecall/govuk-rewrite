import { describe, expect, it } from "vitest";
import { resolveInputText } from "../src/oneshot.js";

describe("resolveInputText", () => {
  it("prefers stdin when piped", () => {
    const resolved = resolveInputText(["arg", "text"], "stdin text", true);
    expect(resolved).toBe("stdin text");
  });

  it("uses positional args when stdin is not piped", () => {
    const resolved = resolveInputText(["arg", "text"], "", false);
    expect(resolved).toBe("arg text");
  });

  it("returns empty string when no stdin and no args", () => {
    const resolved = resolveInputText([], "", false);
    expect(resolved).toBe("");
  });
});
