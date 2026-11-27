"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AmenityBookingStatus } from "../types";

interface OverrideModalProps {
  bookingId: string;
  targetState: AmenityBookingStatus;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function OverrideModal({
  bookingId,
  targetState,
  submitting,
  onClose,
  onConfirm,
}: OverrideModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    await onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            Supervisor Approval: {targetState} ({bookingId})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Marking booking {bookingId} as &ldquo;{targetState}&rdquo; releases
          locked resources and waives standard late-cancellation fees. Provide an
          audit reason.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Mandatory Audit Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter business justification for audit trail..."
              className="w-full rounded-xl border border-border bg-background text-foreground p-3 text-xs focus:outline-none focus:border-[#1a68ff]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? "Recording..." : "Record Audit & Proceed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
