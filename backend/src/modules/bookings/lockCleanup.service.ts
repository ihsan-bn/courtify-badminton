import { withTransaction } from "../../config/database.js";
import { bookingsRepository } from "./bookings.repository.js";

export async function cleanupExpiredBookingLocks(): Promise<number> {
  return withTransaction(async (client) => {
    const bookingIds = await bookingsRepository.findExpiredLockIds(client);
    if (bookingIds.length === 0) {
      return 0;
    }

    await bookingsRepository.deleteSlotsForExpiredBookings(
      client,
      bookingIds
    );
    return bookingsRepository.markBookingsExpired(client, bookingIds);
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
      const expiredBookings = await cleanupExpiredBookingLocks();
      if (expiredBookings > 0) {
        console.info(
          JSON.stringify({
            level: "info",
            message: "Expired booking locks cleaned",
            expiredBookings
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
