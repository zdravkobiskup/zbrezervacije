import { test, expect } from "bun:test";
import { fromZonedTime } from "date-fns-tz";
import { bookingEmailKey, reminderStage } from "./reminder-rules";

test("24-hour reminders cover the existing 23–25 hour window", () => {
  expect(reminderStage(23)).toBe("24h");
  expect(reminderStage(24)).toBe("24h");
  expect(reminderStage(25)).toBe("24h");
  expect(reminderStage(25.01)).toBeUndefined();
});

test("6-hour reminders cover the existing 5.5–6.5 hour window", () => {
  expect(reminderStage(5.5)).toBe("6h");
  expect(reminderStage(6)).toBe("6h");
  expect(reminderStage(6.5)).toBe("6h");
  expect(reminderStage(5.49)).toBeUndefined();
});

test("6h and 24h reminders cannot deduplicate each other; retries deduplicate", () => {
  const booking = { bookingId: "test-booking", type: "reminder", bookingDate: "2026-10-30", bookingTime: "09:00:00" };
  const first = bookingEmailKey({ ...booking, reminderStage: "24h" });
  const second = bookingEmailKey({ ...booking, reminderStage: "6h" });
  expect(first).toBe("booking-reminder-test-booking--2026-10-30-09:00:00");
  expect(second).toBe("booking-reminder-test-booking--2026-10-30-09:00:00-6h");
  expect(second).not.toBe(first);
  expect(bookingEmailKey({ ...booking, reminderStage: "6h" })).toBe(second);
});

test("Zagreb appointment time uses winter and summer offsets", () => {
  expect(fromZonedTime("2026-10-30T09:00:00", "Europe/Zagreb").toISOString()).toBe("2026-10-30T08:00:00.000Z");
  expect(fromZonedTime("2026-07-30T09:00:00", "Europe/Zagreb").toISOString()).toBe("2026-07-30T07:00:00.000Z");
});