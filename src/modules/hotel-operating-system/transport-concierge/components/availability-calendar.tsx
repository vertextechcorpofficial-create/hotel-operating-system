"use client";

import { TURNAROUND_BUFFER_MINS, timeToMinutes } from "../lib/dispatch-engine";
import type { TransportBooking, VehicleMaster } from "../types";

interface AvailabilityCalendarProps {
  filterDate: string;
  vehicles: VehicleMaster[];
  bookings: TransportBooking[];
  onSelectBookingFromTimeline: (bookingId: string) => void;
}

export function AvailabilityCalendar({
  filterDate,
  vehicles,
  bookings,
  onSelectBookingFromTimeline,
}: AvailabilityCalendarProps) {
  const startHour = 6;
  const endHour = 23;
  const totalMins = (endHour - startHour) * 60;
  const hourLabels: string[] = [];
  for (let h = startHour; h <= endHour; h += 2) {
    hourLabels.push(`${String(h).padStart(2, "0")}:00`);
  }

  return (
    <section className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            Fleet &amp; Chauffeur Availability Calendar ({filterDate})
          </h2>
          <p className="text-xs text-gray-500">
            Displays active bookings plus the mandatory 30-minute turnaround buffer.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#1a73e8] inline-block" /> Active
            Trip
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" />{" "}
            30m Turnaround Buffer
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
            <div className="col-span-3 p-2.5 border-r border-gray-200">
              Fleet Vehicle
            </div>
            <div className="col-span-9 flex justify-between px-2 py-2.5 text-[11px] font-mono text-gray-500">
              {hourLabels.map((lbl) => (
                <span key={lbl}>{lbl}</span>
              ))}
            </div>
          </div>

          {vehicles.map((v) => {
            const vBookings = bookings.filter(
              (b) =>
                b.date === filterDate &&
                b.vehicleId === v.id &&
                !["Cancelled", "No-Show"].includes(b.status)
            );

            return (
              <div
                key={v.id}
                className="grid grid-cols-12 border-b border-gray-100 hover:bg-gray-50/60"
              >
                <div className="col-span-3 p-3 border-r border-gray-200 flex flex-col justify-center">
                  <span className="text-xs font-bold text-gray-800">{v.name}</span>
                  <span className="text-[11px] text-gray-400">
                    {v.plate} • Max {v.capacity} pax
                    {!v.active ? " • Maintenance" : ""}
                  </span>
                </div>
                <div className="col-span-9 relative h-14 bg-[linear-gradient(to_right,#f3f4f6_1px,transparent_1px)] bg-[length:5.88%_100%]">
                  {vBookings.map((b) => {
                    const bStart = Math.max(
                      startHour * 60,
                      timeToMinutes(b.pickupTime)
                    );
                    const tripPct = (b.durationMins / totalMins) * 100;
                    const bufferPct = (TURNAROUND_BUFFER_MINS / totalMins) * 100;
                    const leftPct = ((bStart - startHour * 60) / totalMins) * 100;

                    return (
                      <div key={b.id}>
                        <button
                          type="button"
                          onClick={() => onSelectBookingFromTimeline(b.id)}
                          title={`${b.id}: ${b.guestName} (${b.pickupTime}, ${b.durationMins}m + 30m turnaround)`}
                          style={{ left: `${leftPct}%`, width: `${tripPct}%` }}
                          className="absolute top-2 bottom-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-l px-2 flex items-center text-[11px] font-medium truncate cursor-pointer z-10 text-left"
                        >
                          {b.pickupTime} {b.guestName.split(" ")[0]}
                        </button>
                        <div
                          style={{
                            left: `${leftPct + tripPct}%`,
                            width: `${bufferPct}%`,
                          }}
                          title="Mandatory 30m Turnaround Buffer"
                          className="absolute top-2 bottom-2 bg-amber-200/90 border-y border-r border-amber-400 rounded-r flex items-center justify-center text-[9px] font-bold text-amber-800"
                        >
                          30m
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
