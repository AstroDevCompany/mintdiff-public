import { describe, expect, it } from "vitest";
import {
  computeTextDiff,
  isProbablyText,
  normalizeNewlines,
} from "./diff";

describe("normalizeNewlines", () => {
  it("converts windows and legacy newlines to unix style", () => {
    const input = "a\r\nb\rc";
    expect(normalizeNewlines(input)).toBe("a\nb\nc");
  });
});

describe("isProbablyText", () => {
  it("identifies text buffers", () => {
    const buffer = Buffer.from("hello world\n");
    expect(isProbablyText(buffer, "text/plain")).toBe(true);
  });

   it("treats .ts with octet-stream mime as text", () => {
    const buffer = Buffer.from("const x = 1;\n");
    expect(isProbablyText(buffer, "application/octet-stream", "ts")).toBe(true);
  });

  it("identifies binary buffers", () => {
    const buffer = Buffer.from([0, 120, 3, 255, 10]);
    expect(isProbablyText(buffer, "application/octet-stream")).toBe(false);
  });
});

describe("computeTextDiff", () => {
  it("counts added lines", () => {
    const left = "hello\nworld\n";
    const right = "hello\nthere\nworld\n";
    const { summary, lines } = computeTextDiff(left, right);

    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(0);
    expect(summary.modified).toBe(0);
    expect(summary.identical).toBe(false);
    expect(summary.totalLines).toBe(3);
    expect(summary.changePercent).toBe(33);
    expect(lines.some((line) => line.type === "added")).toBe(true);
  });

  it("treats replacement as modification", () => {
    const left = "color\n";
    const right = "colour\n";
    const { summary, lines } = computeTextDiff(left, right);

    expect(summary.modified).toBe(1);
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
    expect(lines[0].type).toBe("modified");
    expect(lines[0].before).toBe("color");
    expect(lines[0].after).toBe("colour");
  });

  it("caps change percent at 100", () => {
    const left = "a\nb\nc\n";
    const right = "x\ny\nz\nw\n";
    const { summary } = computeTextDiff(left, right);
    expect(summary.changePercent).toBeLessThanOrEqual(100);
  });
});
