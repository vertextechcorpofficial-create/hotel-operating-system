"use client";

import { Suspense, useMemo, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createBookingTransaction } from "./services/booking.service";
import { RoomData } from "../home/types/room.types";
import { BookingStatusModal, type ModalState } from "./components/BookingStatusModal";
import { BookingSummaryCard } from "./components/BookingSummaryCard";
import { BookingFormFields } from "./components/BookingFormFields";
import { BookingFormValues, bookingSchema } from "./schema/booking.schema";

interface BookingTransactionPayload {
  roomIds: number[];
  roomTypeId: number;
  roomDetails: Array<{ id: number; name: string; price: number }>;
  totalNights: number;
  checkin: string;
  checkout: string;
  total: number;
  adults: number;
  children: number;
}

interface BookingTransactionResponse {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

function BookingViewInner({ rooms }: { rooms: RoomData[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: "warning",
    title: "",
    description: "",
  });

  const roomIdsRaw: string = searchParams.get("roomIds") || searchParams.get("roomId") || "";
  const checkinStr: string = searchParams.get("checkin") || "";
  const checkoutStr: string = searchParams.get("checkout") || "";
  
  const adultsCount = useMemo<number>(() => {
    const parsed = Number(searchParams.get("adults"));
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2;
  }, [searchParams]);

  const childrenCount = useMemo<number>(() => {
    const parsed = Number(searchParams.get("children"));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [searchParams]);

  const matchedRooms = useMemo<RoomData[]>(() => {
    if (!roomIdsRaw.trim()) return [];
    const ids: number[] = roomIdsRaw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return [];
    return rooms.filter((r: RoomData) => ids.includes(r.id));
  }, [roomIdsRaw, rooms]);

  const handleRemoveRoom = (idToRemove: number): void => {
    const currentIds: number[] = roomIdsRaw.split(",").map(Number);
    const updatedIds: number[] = currentIds.filter((id: number) => id !== idToRemove);

    const params = new URLSearchParams(searchParams.toString());

    if (updatedIds.length === 0) {
      router.push(`/hotel-landing-page/rooms?${params.toString()}`);
      return;
    }

    params.set("roomIds", updatedIds.join(","));
    if (params.has("roomId")) params.delete("roomId");

    router.push(`/hotel-landing-page/booking?${params.toString()}`);
  };

  const dateValidation = useMemo<{ nights: number; error: string | null }>(() => {
    if (!checkinStr || !checkoutStr) {
      return { nights: 0, error: "Please select both check-in and check-out dates." };
    }
    const [cy, cm, cd] = checkinStr.split("-").map(Number);
    const [oy, om, od] = checkoutStr.split("-").map(Number);
    if (!cy || !cm || !cd || !oy || !om || !od) {
      return { nights: 0, error: "Invalid date format. Please re-select your dates." };
    }
    const startMs = Date.UTC(cy, cm - 1, cd);
    const endMs = Date.UTC(oy, om - 1, od);
    const now = new Date();
    const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    if (startMs < todayMs) {
      return { nights: 0, error: "Check-in date cannot be in the past." };
    }
    if (endMs <= startMs) {
      return { nights: 0, error: "Check-out date must be after check-in date." };
    }
    const diffDays = Math.round((endMs - startMs) / 86_400_000);
    return { nights: diffDays, error: null };
  }, [checkinStr, checkoutStr]);

  const totalNights = dateValidation.nights;

  const capacityError = useMemo<string | null>(() => {
    if (matchedRooms.length === 0) return null;
    const maxAdults = matchedRooms.reduce((sum, r) => sum + (r.maxAdults || 2), 0);
    const maxChildren = matchedRooms.reduce((sum, r) => sum + (r.maxChildren || 0), 0);
    if (adultsCount > maxAdults || childrenCount > maxChildren) {
      return `Selected room capacity is up to ${maxAdults} Adults and ${maxChildren} Children.`;
    }
    return null;
  }, [matchedRooms, adultsCount, childrenCount]);

  const isBookingBlocked =
    matchedRooms.length === 0 || Boolean(dateValidation.error) || Boolean(capacityError) || totalNights <= 0;

  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return "Select date";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Select date";
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return "Select date";
    }
  };

  const getInitialValues = (): BookingFormValues => {
    if (typeof window !== "undefined") {
      const draft = sessionStorage.getItem("bookingFormDraft");
      if (draft) {
        try {
          return JSON.parse(draft) as BookingFormValues;
        } catch (e) {
          console.error("Failed to parse form draft", e);
        }
      }
    }
    return { firstName: "", lastName: "", email: "", phone: "", gcashNumber: "", specialRequests: "" };
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: getInitialValues(),
  });

  useEffect(() => {
    const subscription = watch((values) => {
      if (Object.keys(values).length > 0) {
        sessionStorage.setItem("bookingFormDraft", JSON.stringify(values));
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);
  
  const baseSubtotal = useMemo<number>(() => {
    const rateSum: number = matchedRooms.reduce((sum: number, room: RoomData) => sum + room.price, 0);
    return rateSum * totalNights;
  }, [matchedRooms, totalNights]);

  const totalInvoiceGross: number = baseSubtotal;

  const onBookingExecute = async (data: BookingFormValues): Promise<void> => {
    if (dateValidation.error) {
      setModal({
        isOpen: true,
        type: "warning",
        title: "Invalid Stay Dates",
        description: dateValidation.error,
      });
      return;
    }

    if (matchedRooms.length === 0) {
      setModal({
        isOpen: true,
        type: "warning",
        title: "No Rooms Selected",
        description: "Your cart is currently empty. Please select at least one room layout to secure a booking.",
      });
      return;
    }

    if (capacityError) {
      setModal({
        isOpen: true,
        type: "warning",
        title: "Guest Count Exceeds Capacity",
        description: capacityError,
      });
      return;
    }

    const fallbackRoomTypeId: number = matchedRooms[0]?.id || 1;

    const payload: BookingTransactionPayload = {
      roomIds: matchedRooms.map((r: RoomData) => r.id),
      roomTypeId: fallbackRoomTypeId,
      roomDetails: matchedRooms.map((r: RoomData) => ({ id: r.id, name: r.name, price: r.price })),
      totalNights: totalNights,
      checkin: checkinStr,
      checkout: checkoutStr,
      total: totalInvoiceGross,
      adults: adultsCount,
      children: childrenCount,
    };

    try {
      const result = await createBookingTransaction(data, payload) as BookingTransactionResponse;

      if (result?.success && result.checkoutUrl) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("bookingFormDraft");
          window.location.href = result.checkoutUrl;
        }
      } else {
        setModal({
          isOpen: true,
          type: "error",
          title: "Payment Gateway Refused Connection",
          description: result?.error || "We couldn't initialize your secure payment checkout loop. Please verify your details and try again.",
        });
      }
    } catch (error: unknown) {
      console.error("Booking submission error:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Network Connection Error",
        description: error instanceof Error ? error.message : "The request timed out or was interrupted. Please check your internet connection and resubmit.",
      });
    }
  };

  const handleModalClose = (): void => {
    setModal((prev: ModalState) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 relative">
      <div className="mb-12 border-b border-zinc-200 pb-8">
        <Link 
          href={`/hotel-landing-page/rooms?${searchParams.toString()}`} 
          className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 hover:text-zinc-900 transition-colors mb-5 group"
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform text-zinc-400 group-hover:text-zinc-900" />
          Back to Selection Catalog
        </Link>
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-zinc-900 font-normal">
          Finalize Your <span className="italic font-light text-zinc-500">Booking</span>
        </h1>
      </div>

      {(matchedRooms.length === 0 || dateValidation.error || capacityError) && (
        <div className="mb-8 border border-amber-200 bg-amber-50/80 text-amber-900 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            {matchedRooms.length === 0 && (
              <p className="font-medium">No valid room selected. Please choose a room from the catalog.</p>
            )}
            {dateValidation.error && <p className="font-medium">{dateValidation.error}</p>}
            {capacityError && <p className="font-medium">{capacityError}</p>}
          </div>
          <Link
            href="/hotel-landing-page/rooms"
            className="shrink-0 bg-zinc-900 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] rounded-sm hover:bg-zinc-800 transition-colors text-center"
          >
            Browse Rooms
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit(onBookingExecute)} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <BookingFormFields register={register} errors={errors} />

        <BookingSummaryCard 
          matchedRooms={matchedRooms}
          handleRemoveRoom={handleRemoveRoom}
          roomIdsRaw={roomIdsRaw}
          checkinStr={checkinStr}
          checkoutStr={checkoutStr}
          adultsCount={adultsCount}
          childrenCount={childrenCount}
          formatDisplayDate={formatDisplayDate}
          searchParamsStr={searchParams.toString()}
          totalNights={totalNights}
          baseSubtotal={baseSubtotal}
          totalInvoiceGross={totalInvoiceGross}
          isSubmitting={isSubmitting}
          isSubmitDisabled={isBookingBlocked}
        />
      </form>

      <BookingStatusModal modal={modal} onClose={handleModalClose} />
    </div>
  );
}

export function BookingView({ rooms }: { rooms: RoomData[] }) {
  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-6 py-10"><div className="animate-pulse bg-zinc-100 rounded-sm h-64 w-full"></div></div>}>
      <BookingViewInner rooms={rooms} />
    </Suspense>
  );
}