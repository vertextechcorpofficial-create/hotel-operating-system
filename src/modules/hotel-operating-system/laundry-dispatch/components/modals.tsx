"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  GARMENT_CATALOG,
  calculateLaundryItemsTotal,
} from "../lib/laundry-engine";
import type {
  LaundryCategory,
  LaundryChannel,
  LaundryFolioPosting,
  LaundryTier,
} from "../types";

export interface NewLaundryPayload {
  category: LaundryCategory;
  tier: LaundryTier;
  roomOrDept: string;
  channel: LaundryChannel;
  garmentName: string;
  qty: number;
  damageNotes: string;
}

interface NewLaundryModalProps {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: NewLaundryPayload) => void;
}

export function NewLaundryModal({
  submitting,
  onClose,
  onSubmit,
}: NewLaundryModalProps) {
  const [category, setCategory] = useState<LaundryCategory>("VALET");
  const [tier, setTier] = useState<LaundryTier>("Standard");
  const [roomOrDept, setRoomOrDept] = useState("");
  const [channel, setChannel] = useState<LaundryChannel>("Internal");
  const [garmentName, setGarmentName] = useState(GARMENT_CATALOG[1].key);
  const [qty, setQty] = useState(2);
  const [damageNotes, setDamageNotes] = useState("");

  const selectedCatalog =
    GARMENT_CATALOG.find((g) => g.key === garmentName) || GARMENT_CATALOG[0];
  const calculatedFee = calculateLaundryItemsTotal(category, tier, [
    { qty, unitPrice: selectedCatalog.unitPrice },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomOrDept.trim()) {
      toast.error("Room / Guest ID or Department is required.");
      return;
    }
    onSubmit({
      category,
      tier,
      roomOrDept: roomOrDept.trim(),
      channel,
      garmentName,
      qty: Math.max(1, qty),
      damageNotes: damageNotes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border max-w-lg w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-base font-bold text-foreground">
            Create New Laundry / Valet Ticket
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Ticket Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const nextCat = e.target.value as LaundryCategory;
                  setCategory(nextCat);
                  if (nextCat === "LINEN") {
                    setGarmentName(GARMENT_CATALOG[4].key);
                  } else if (garmentName === GARMENT_CATALOG[4].key) {
                    setGarmentName(GARMENT_CATALOG[1].key);
                  }
                }}
                className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
              >
                <option value="VALET">Guest Valet (Billable)</option>
                <option value="LINEN">Hotel Bulk Linen (Non-Billable)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Turnaround Tier <span className="text-red-500">*</span>
              </label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as LaundryTier)}
                className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
              >
                <option value="Standard">Standard (24h Window)</option>
                <option value="Express">Express (4h SLA • +50%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                {category === "VALET"
                  ? "Room / Guest ID *"
                  : "Hotel Department / Floor *"}
              </label>
              <input
                type="text"
                required
                value={roomOrDept}
                onChange={(e) => setRoomOrDept(e.target.value)}
                placeholder={
                  category === "VALET"
                    ? "e.g. Room 512 – Marco Reyes"
                    : "e.g. Housekeeping Floor 5"
                }
                className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff]"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Processing Channel <span className="text-red-500">*</span>
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as LaundryChannel)}
                className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
              >
                <option value="Internal">Internal Hotel Laundry</option>
                <option value="Outsourced">
                  Outsourced Vendor (SparklePro DryClean)
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Garment / Linen Item
              </label>
              <select
                value={garmentName}
                onChange={(e) => setGarmentName(e.target.value)}
                className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
              >
                {GARMENT_CATALOG.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff]"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">
                Calculated Fee
              </label>
              <div className="w-full border border-border bg-muted/50 rounded-xl px-3 py-2 font-extrabold text-[#1a68ff] dark:text-blue-400">
                {category === "LINEN" || selectedCatalog.unitPrice === 0
                  ? "Non-Billable"
                  : `₱${calculatedFee.toLocaleString()}`}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Pre-Existing Damage / Tagging Notes
            </label>
            <input
              type="text"
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="e.g. Missing second cuff button on left sleeve; light collar wear"
              className="w-full border border-border bg-background rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
              className="px-4 py-2 rounded-xl bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold disabled:opacity-50"
            >
              Generate Tagged Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OverrideReasonModalProps {
  title: string;
  description: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function OverrideReasonModal({
  title,
  description,
  submitting,
  onClose,
  onConfirm,
}: OverrideReasonModalProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      toast.error("A logged audit reason is mandatory.");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{description}</p>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Mandatory Audit Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for audit log..."
            className="w-full border border-border bg-background rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-[#1a68ff]"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white text-xs font-semibold disabled:opacity-50"
          >
            Confirm &amp; Log
          </button>
        </div>
      </div>
    </div>
  );
}

interface FoliosDrawerModalProps {
  folios: LaundryFolioPosting[];
  onClose: () => void;
}

export function FoliosDrawerModal({
  folios,
  onClose,
}: FoliosDrawerModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border max-w-2xl w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Billing &amp; Folios Ledger (folios_hos)
            </h3>
            <p className="text-xs text-muted-foreground">
              Live automated charges from Valet Laundry and connected HOS
              postings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-border text-xs">
          {folios.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No folio postings yet.
            </p>
          ) : (
            folios.map((f) => (
              <div
                key={f.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-foreground">
                    {f.id} • {f.account}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {f.source} • {f.timestamp}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-extrabold ${
                      f.amount < 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-foreground"
                    }`}
                  >
                    {f.amount < 0
                      ? `-₱${Math.abs(f.amount).toLocaleString()}`
                      : `₱${f.amount.toLocaleString()}`}
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                    {f.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
