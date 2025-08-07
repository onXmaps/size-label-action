import { describe, expect, it, afterEach } from "vitest";
import {
  parseIgnored,
  actions,
  getSizeLabel,
  defaultSizes,
  getRunOnDraftInput
} from "./index";

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

describe("getSizeLabel", () => {
  it("returns correct size labels for default sizes", () => {
    expect(getSizeLabel(0, defaultSizes)).toBe("size/XS");
    expect(getSizeLabel(5, defaultSizes)).toBe("size/XS");
    expect(getSizeLabel(10, defaultSizes)).toBe("size/S");
    expect(getSizeLabel(25, defaultSizes)).toBe("size/S");
    expect(getSizeLabel(30, defaultSizes)).toBe("size/M");
    expect(getSizeLabel(99, defaultSizes)).toBe("size/M");
    expect(getSizeLabel(100, defaultSizes)).toBe("size/L");
    expect(getSizeLabel(499, defaultSizes)).toBe("size/L");
    expect(getSizeLabel(500, defaultSizes)).toBe("size/XL");
    expect(getSizeLabel(999, defaultSizes)).toBe("size/XL");
    expect(getSizeLabel(1000, defaultSizes)).toBe("size/XXL");
    expect(getSizeLabel(5000, defaultSizes)).toBe("size/XXL");
  });

  it("returns correct size labels for custom sizes", () => {
    const customSizes = {
      0: "XS",
      5: "S",
      50: "M",
      500: "L",
      1000: "XL",
      2000: "XXL"
    };

    expect(getSizeLabel(0, customSizes)).toBe("size/XS");
    expect(getSizeLabel(4, customSizes)).toBe("size/XS");
    expect(getSizeLabel(5, customSizes)).toBe("size/S");
    expect(getSizeLabel(49, customSizes)).toBe("size/S");
    expect(getSizeLabel(50, customSizes)).toBe("size/M");
    expect(getSizeLabel(499, customSizes)).toBe("size/M");
    expect(getSizeLabel(500, customSizes)).toBe("size/L");
    expect(getSizeLabel(999, customSizes)).toBe("size/L");
    expect(getSizeLabel(1000, customSizes)).toBe("size/XL");
    expect(getSizeLabel(1999, customSizes)).toBe("size/XL");
    expect(getSizeLabel(2000, customSizes)).toBe("size/XXL");
    expect(getSizeLabel(10000, customSizes)).toBe("size/XXL");
  });

  it("falls back to default sizes when custom sizes is undefined", () => {
    expect(getSizeLabel(100, undefined)).toBe("size/L");
    expect(getSizeLabel(100)).toBe("size/L");
  });
});

describe("getRunOnDraftInput", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to true when INPUT_RUN_ON_DRAFT is not set", () => {
    delete process.env.INPUT_RUN_ON_DRAFT;
    expect(getRunOnDraftInput()).toBe(true);
  });

  it("defaults to true when INPUT_RUN_ON_DRAFT is empty", () => {
    process.env.INPUT_RUN_ON_DRAFT = "";
    expect(getRunOnDraftInput()).toBe(true);
  });

  it("returns true when INPUT_RUN_ON_DRAFT is 'true'", () => {
    process.env.INPUT_RUN_ON_DRAFT = "true";
    expect(getRunOnDraftInput()).toBe(true);
  });

  it("returns true when INPUT_RUN_ON_DRAFT is 'TRUE'", () => {
    process.env.INPUT_RUN_ON_DRAFT = "TRUE";
    expect(getRunOnDraftInput()).toBe(true);
  });

  it("returns false when INPUT_RUN_ON_DRAFT is 'false'", () => {
    process.env.INPUT_RUN_ON_DRAFT = "false";
    expect(getRunOnDraftInput()).toBe(false);
  });

  it("returns false when INPUT_RUN_ON_DRAFT is 'FALSE'", () => {
    process.env.INPUT_RUN_ON_DRAFT = "FALSE";
    expect(getRunOnDraftInput()).toBe(false);
  });

  it("returns false for any non-'true' value", () => {
    process.env.INPUT_RUN_ON_DRAFT = "no";
    expect(getRunOnDraftInput()).toBe(false);

    process.env.INPUT_RUN_ON_DRAFT = "0";
    expect(getRunOnDraftInput()).toBe(false);
  });
});
