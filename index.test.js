import { describe, expect, it } from "vitest";
import { parseIgnored, actions } from "./index";

describe("parseIgnored", () => {
  it.each(["", null, undefined, "\r\n", "\n", "#", "#file"])(
    "doesn't ignore when no patterns to ignore provided (%s)",
    input => {
      // when
      const isIgnored = parseIgnored(input);

      // then
      expect(isIgnored("file")).toBe(false);
    }
  );

  it("ignores ordinary patterns", () => {
    // when
    const isIgnored = parseIgnored(
      "**/src/integration/**\n**/src/test/**\n**/src/testFixtures/**"
    );

    // then
    expect(isIgnored("file")).toBe(false);
    expect(isIgnored("src/test/file")).toBe(true);
    expect(isIgnored("codebase/src/testFixtures/file")).toBe(true);
  });

  it.each([null, undefined, "/dev/null"])(
    "ignores some patterns by default (%s)",
    alwaysIgnoredInput => {
      // when
      const isIgnored = parseIgnored(
        "**/src/integration/**\n**/src/test/**\n**/src/testFixtures/**"
      );

      // then
      expect(isIgnored(alwaysIgnoredInput)).toBe(true);
    }
  );

  it("accepts negated patterns", () => {
    // when
    const isIgnored = parseIgnored(".*\n!.gitignore\nyarn.lock\ngenerated/**");

    // then
    expect(isIgnored(".git")).toBe(true);
    expect(isIgnored(".gitignore")).toBe(false);
    expect(isIgnored("yarn.lock")).toBe(true);
    expect(isIgnored("generated/source")).toBe(true);
  });
});

describe("actions array", () => {
  it("includes all expected GitHub pull request actions", () => {
    expect(actions).toContain("opened");
    expect(actions).toContain("synchronize");
    expect(actions).toContain("reopened");
    expect(actions).toContain("ready_for_review");
  });

  it("contains exactly 4 actions", () => {
    expect(actions).toHaveLength(4);
  });

  it("supports ready_for_review action for draft PRs", () => {
    // This ensures that when a draft PR is marked as ready for review,
    // the size label action will be triggered
    expect(actions.includes("ready_for_review")).toBe(true);
  });
});
