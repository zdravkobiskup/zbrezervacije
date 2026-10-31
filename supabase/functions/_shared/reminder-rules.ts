export type ReminderStage = "24h" | "6h";

export function reminderStage(hoursUntilBooking: number): ReminderStage | undefined {
  if (hoursUntilBooking >= 23 && hoursUntilBooking <= 25) return "24h";
  if (hoursUntilBooking >= 5.5 && hoursUntilBooking <= 6.5) return "6h";
  return undefined;
}

export function bookingEmailKey(e: {
  bookingId?: string;
  type: string;
  status?: string;
  bookingDate: string;
  bookingTime: string;
  reminderStage?: ReminderStage;
}): string | undefined {
  if (!e.bookingId) return undefined;
  const base = `booking-${e.type}-${e.bookingId}-${e.status ?? ""}-${e.bookingDate}-${e.bookingTime}`;
  // Preserve existing 24h keys; only the second reminder needs a distinct key.
  return e.type === "reminder" && e.reminderStage === "6h" ? `${base}-6h` : base;
}