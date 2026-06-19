import { withTransaction } from "../../config/database.js";
import { bookingsRepository } from "./bookings.repository.js";
import { auditService } from "../audit/audit.service.js";

export async function cleanupExpiredBookingLocks(): Promise<string[]> {
  return withTransaction(async (client) => {
    const bookingIds = await bookingsRepository.findExpiredLockIds(client);
    if (bookingIds.length === 0) {
      return [];
    }

    await bookingsRepository.deleteSlotsForExpiredBookings(
      client,
      bookingIds
    );
    const expiredCount = await bookingsRepository.markBookingsExpired(
      client,
      bookingIds
    );
    return expiredCount === bookingIds.length ? bookingIds : [];
  });
}

export function startExpiredLockCleanupScheduler(
  intervalMs: number
): () => void {
  let cleanupRunning = false;

  const runCleanup = async (): Promise<void> => {
    if (cleanupRunning) {
      return;
    }

    cleanupRunning = true;
    try {
      const expiredBookingIds = await cleanupExpiredBookingLocks();
      if (expiredBookingIds.length > 0) {
        await Promise.all(
          expiredBookingIds.map((bookingId) =>
            auditService.record({
              actor: {
                userId: null,
                role: "system",
                name: "Lock cleanup scheduler"
              },
              action: "booking_expired",
              entityType: "booking",
              entityId: bookingId,
              summary: "Expired booking lock was cleaned and released."
            })
          )
        );
        console.info(
          JSON.stringify({
            level: "info",
            message: "Expired booking locks cleaned",
            expiredBookings: expiredBookingIds.length
          })
        );
      }
    } catch (error) {
      console.error("Expired booking lock cleanup failed", error);
    } finally {
      cleanupRunning = false;
    }
  };

  void runCleanup();

  const timer = setInterval(() => {
    void runCleanup();
  }, intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
