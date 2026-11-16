import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDashboardRange,
  dayWindow,
  fillDailySeries,
  categoryDistribution,
  adminThumbnail,
  percentOf,
} from "../src/features/products/dashboard-rules.ts";

test("parseDashboardRange allows only whitelisted periods, default is 30", () => {
  assert.equal(parseDashboardRange("7"), 7);
  assert.equal(parseDashboardRange(90), 90);
  assert.equal(parseDashboardRange("30"), 30);
  assert.equal(parseDashboardRange("invalid"), 30);
  assert.equal(parseDashboardRange(undefined), 30);
});

test("dayWindow returns exact number of days in order", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const window7 = dayWindow(now, 7);
  assert.equal(window7.length, 7);
  assert.equal(window7[window7.length - 1], "2026-11-09");
});

test("fillDailySeries preserves continuous daily dates without skipping zeros", () => {
  const window = ["2026-11-01", "2026-11-02", "2026-11-03"];
  const counts = [{ day: "2026-11-02", count: 5 }];
  const series = fillDailySeries(window, counts);
  assert.deepEqual(series, [
    { day: "2026-11-01", count: 0 },
    { day: "2026-11-02", count: 5 },
    { day: "2026-11-03", count: 0 },
  ]);
});

test("categoryDistribution groups into top categories and others", () => {
  const data = [
    { name: "Áo khoác", count: 10 },
    { name: "Áo thun", count: 5 },
    { name: "Áo sơ mi", count: 3 },
    { name: "Quần", count: 2 },
    { name: "Phụ kiện", count: 1 },
  ];
  const res = categoryDistribution(data, 2);
  assert.equal(res.total, 21);
  assert.equal(res.slices.length, 3);
  assert.equal(res.slices[0].name, "Áo khoác");
  assert.equal(res.slices[1].name, "Áo thun");
  assert.equal(res.slices[2].name, "Khác");
  assert.equal(res.slices[2].count, 6);
});

test("adminThumbnail rejects dangerous or non-path strings", () => {
  assert.equal(adminThumbnail("/images/coat.jpg"), "/images/coat.jpg");
  assert.equal(adminThumbnail("/images/../etc/passwd"), null);
  assert.equal(adminThumbnail("javascript:alert(1)"), null);
  assert.equal(adminThumbnail("https://evil.com/img.png"), null);
  assert.equal(adminThumbnail(null), null);
});

test("percentOf calculates rounded integer percentage safely", () => {
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(7, 10), 70);
  assert.equal(percentOf(0, 0), 0);
});
