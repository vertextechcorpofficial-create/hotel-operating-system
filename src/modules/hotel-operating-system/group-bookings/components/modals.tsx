"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { GroupBlock } from "../types";

interface CsvImportModalProps {
  group: GroupBlock;
  submitting: boolean;
  onClose: () => void;
  onImport: (
    rawCsv: string
  ) => Promise<{ validCount: number; rowErrors: string[] } | null>;
}

export function CsvImportModal({
  group,
  submitting,
  onClose,
  onImport,
}: CsvImportModalProps) {
  const [rawCsv, setRawCsv] = useState("");
  const [result, setResult] = useState<{
    validCount: number;
    rowErrors: string[];
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Invalid file format: Please upload a valid .CSV file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error(
        "File too large: CSV rooming lists are restricted to 1MB maximum."
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawCsv(String(ev.target?.result || ""));
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setRawCsv(
      [
        "FirstName,LastName,Email,RoomType,RoomNumber,CheckIn,CheckOut",
        `Daniel,Reyes,daniel.reyes@vertextech.ph,Deluxe King,404,${group.arrivalDate},${group.departureDate}`,
        `Elena,Gomez,elena.gomez@vertextech.ph,Twin Executive,405,${group.arrivalDate},${group.departureDate}`,
        `Adrian,Lim,adrian.lim@vertextech.ph,Deluxe King,401,${group.arrivalDate},${group.departureDate}`,
      ].join("\n")
    );
    setResult(null);
  };

  const handleValidateAndImport = async () => {
    if (!rawCsv.trim()) {
      toast.error("Please paste CSV rows or upload a CSV file first.");
      return;
    }
    const res = await onImport(rawCsv);
    if (res) {
      setResult(res);
      if (res.rowErrors.length === 0 && res.validCount > 0) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Import CSV Rooming List
            </h3>
            <p className="text-xs text-muted-foreground">
              Validates guest duplicates, stay dates, room cleanliness, and
              allotment caps without losing valid rows.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 p-3 rounded-xl border border-border text-xs">
            <div>
              <span className="font-semibold text-foreground">
                Expected CSV Schema:
              </span>
              <code className="text-[11px] text-muted-foreground ml-1">
                FirstName, LastName, Email, RoomType, RoomNumber, CheckIn,
                CheckOut
              </code>
            </div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-[#1a68ff] dark:text-blue-400 hover:underline font-semibold shrink-0"
            >
              Load Test Batch (with 1 Error Row)
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Paste CSV Data or Upload .CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/60 file:text-[#1a68ff] dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/60 mb-2"
            />
            <textarea
              rows={6}
              value={rawCsv}
              onChange={(e) => setRawCsv(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:border-[#1a68ff]"
              placeholder="FirstName,LastName,Email,RoomType,RoomNumber,CheckIn,CheckOut"
            />
          </div>

          {result ? (
            <div className="space-y-2">
              {result.validCount > 0 ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  ✓ Successfully imported {result.validCount} valid reservation(s)
                  into {group.id}.
                </div>
              ) : null}
              {result.rowErrors.length > 0 ? (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1">
                  <div className="font-bold">
                    Row-Level Validation Errors (Halted invalid rows without
                    losing valid ones):
                  </div>
                  {result.rowErrors.map((err, idx) => (
                    <div key={`${err}-${idx}`}>• {err}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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
            onClick={() => void handleValidateAndImport()}
            className="px-4 py-2 rounded-xl bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
          >
            {submitting ? "Importing..." : "Validate & Import Valid Rows"}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface NewGroupBlockPayload {
  name: string;
  status: "Inquiry" | "Tentative Hold" | "Definite / Confirmed";
  allottedRooms: number;
  negotiatedRate: number;
  roomTypeMix: string;
  depositPaid: number;
  arrivalDate: string;
  departureDate: string;
  cutoffDate: string;
  routingRule: string;
}

interface NewGroupBlockModalProps {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: NewGroupBlockPayload) => Promise<void>;
}

export function NewGroupBlockModal({
  submitting,
  onClose,
  onSubmit,
}: NewGroupBlockModalProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<
    "Inquiry" | "Tentative Hold" | "Definite / Confirmed"
  >("Definite / Confirmed");
  const [allottedRooms, setAllottedRooms] = useState(12);
  const [negotiatedRate, setNegotiatedRate] = useState(4200);
  const [roomTypeMix, setRoomTypeMix] = useState(
    "8 Deluxe King, 4 Twin Executive"
  );
  const [depositPaid, setDepositPaid] = useState(15000);
  const [arrivalDate, setArrivalDate] = useState("2026-12-05");
  const [departureDate, setDepartureDate] = useState("2026-12-08");
  const [cutoffDate, setCutoffDate] = useState("2026-12-01");
  const [routingRule, setRoutingRule] = useState(
    "Room & Tax → Master Folio | Incidentals → Individual Folio"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (arrivalDate >= departureDate) {
      toast.error("Departure date must be after arrival date.");
      return;
    }
    await onSubmit({
      name: name.trim(),
      status,
      allottedRooms,
      negotiatedRate,
      roomTypeMix: roomTypeMix.trim(),
      depositPaid,
      arrivalDate,
      departureDate,
      cutoffDate,
      routingRule,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            Create New Group Block (group_blocks_hos)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">
              Group / Organization Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northern Luzon Medical Summit 2026"
              className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:border-[#1a68ff]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Initial Block State *
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as
                      | "Inquiry"
                      | "Tentative Hold"
                      | "Definite / Confirmed"
                  )
                }
                className="w-full rounded-lg border border-border bg-background text-foreground px-2.5 py-2 focus:outline-none focus:border-[#1a68ff]"
              >
                <option value="Inquiry">Inquiry</option>
                <option value="Tentative Hold">Tentative Hold</option>
                <option value="Definite / Confirmed">
                  Definite / Confirmed
                </option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Allotments (5–50+) *
              </label>
              <input
                type="number"
                min={5}
                max={100}
                required
                value={allottedRooms}
                onChange={(e) => setAllottedRooms(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Rate / Night (₱) *
              </label>
              <input
                type="number"
                min={1500}
                required
                value={negotiatedRate}
                onChange={(e) => setNegotiatedRate(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Room Type Mix *
              </label>
              <input
                type="text"
                required
                value={roomTypeMix}
                onChange={(e) => setRoomTypeMix(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Deposit Confirmed (₱)
              </label>
              <input
                type="number"
                min={0}
                required
                value={depositPaid}
                onChange={(e) => setDepositPaid(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Arrival Date *
              </label>
              <input
                type="date"
                required
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-2.5 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Departure Date *
              </label>
              <input
                type="date"
                required
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-2.5 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Cutoff Date *
              </label>
              <input
                type="date"
                required
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-2.5 py-2 focus:outline-none focus:border-[#1a68ff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Folio Split Routing Rule
            </label>
            <select
              value={routingRule}
              onChange={(e) => setRoutingRule(e.target.value)}
              className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:border-[#1a68ff]"
            >
              <option value="Room & Tax → Master Folio | Incidentals → Individual Folio">
                Room &amp; Tax → Master Folio | Incidentals → Individual Folio
              </option>
              <option value="All Charges (Room + Incidentals) → Master Folio">
                All Charges (Room + Incidentals) → Master Folio
              </option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white font-semibold disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Hold Inventory & Create Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OverrideModalProps {
  title: string;
  description: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function OverrideModal({
  title,
  description,
  submitting,
  onClose,
  onConfirm,
}: OverrideModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Audit reason is mandatory for supervisor overrides.");
      return;
    }
    await onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
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
              {submitting ? "Logging..." : "Record Audit & Proceed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
