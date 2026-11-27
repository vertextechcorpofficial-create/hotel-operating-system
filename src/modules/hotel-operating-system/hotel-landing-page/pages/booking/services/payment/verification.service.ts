"use server";

import crypto from "crypto";
import { directus } from "../../lib/directus";
import { updateItem, readItem } from "@directus/sdk";
import { bookingEnv } from "./config";

interface VerificationResult {
  success: boolean;
  guestName?: string;
  email?: string;
  totalAmount?: number;
  checkInDate?: string;  // Added type definition
  checkOutDate?: string; // Added type definition
  error?: string;
}

interface GuestDetail {
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface ReservationDetail {
  status?: string;
  guest_id?: GuestDetail;
  total_amount?: string | number;
  check_in?: string;
  check_out?: string;
}

function isValidVerificationToken(reservationId: string, token?: string): boolean {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = crypto
    .createHmac("sha256", bookingEnv.PAYMONGO_SECRET_KEY)
    .update(reservationId)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}

/**
 * Reconciles the redirect payload, transitions status to paid, and resolves guest metadata.
 */
export async function verifyAndFinalizeReservation(
  reservationId: string,
  token?: string
): Promise<VerificationResult> {
  try {
    if (!reservationId) {
      return { success: false, error: "Missing reservation reference ID configuration parameter." };
    }

    let reservation: ReservationDetail | null = null;
    
    // STAGE 1: Attempt to read the item along with its guest relationships
    try {
      reservation = await directus.request<ReservationDetail>(
        readItem("reservations_hos", reservationId, {
          fields: ["*", "guest_id.*"],
        })
      );
    } catch (readError) {
      const err = readError as Error;
      console.error("❌ [STAGE 1 FAILED] Directus Read Operation Error:", err);
      return {
        success: false,
        error: `[Directus Fetch Error]: ${err.message || "Failed to read the reservation row."}`,
      };
    }

    if (!reservation) {
      return { success: false, error: `Reservation reference allocation #${reservationId} could not be located.` };
    }

    const currentStatus = (reservation.status || "").toLowerCase();

    // STAGE 2: Transition pending -> paid only with a valid signed redirect token
    if (currentStatus === "pending") {
      if (!isValidVerificationToken(reservationId, token)) {
        return {
          success: false,
          error: "Invalid or missing payment verification token.",
        };
      }

      try {
        await directus.request(
          updateItem("reservations_hos", reservationId, {
            status: "paid",
          })
        );
      } catch (updateError) {
        const err = updateError as Error;
        console.error("❌ [STAGE 2 FAILED] Directus Update Operation Error:", err);
        return {
          success: false,
          error: `[Directus Update Error]: ${err.message || "Failed to change status to 'paid'."}`,
        };
      }
    } else if (currentStatus !== "paid" && currentStatus !== "confirmed" && currentStatus !== "checked-in") {
      return {
        success: false,
        error: `Reservation #${reservationId} cannot be confirmed (status: ${reservation.status || "unknown"}).`,
      };
    }

    // STAGE 3: Resolve formatting boundaries for the customer presentation card
    const guest = reservation.guest_id;
    const resolvedName = guest ? `${guest.first_name || ""} ${guest.last_name || ""}`.trim() : "Valued Guest";

    return {
      success: true,
      guestName: resolvedName || "Valued Guest",
      email: guest?.email || "",
      totalAmount: Number(reservation.total_amount) || 0,
      checkInDate: reservation.check_in || "",   // Safely map field values
      checkOutDate: reservation.check_out || "", // Safely map field values
    };

  } catch (error: unknown) {
    console.error("❌ CRITICAL: VERIFICATION SERVICE ROUTE CRASHED:", error);
    return {
      success: false,
      error: error instanceof Error 
        ? `[Database Rejection]: ${error.message}` 
        : "An unknown error disrupted database transaction confirmation.",
    };
  }
}