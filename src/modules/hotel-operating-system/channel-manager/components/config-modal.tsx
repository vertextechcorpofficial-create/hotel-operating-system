"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { OtaChannel } from "../types";

export interface ChannelConfigDraft {
  id: string;
  name: string;
  apiKeyValid: boolean;
  commissionPct: number;
  icalUrl: string;
}

interface ConfigModalProps {
  channels: OtaChannel[];
  submitting: boolean;
  onClose: () => void;
  onSave: (configs: ChannelConfigDraft[]) => void;
}

export function ConfigModal({
  channels,
  submitting,
  onClose,
  onSave,
}: ConfigModalProps) {
  const [drafts, setDrafts] = useState<ChannelConfigDraft[]>(() =>
    channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      apiKeyValid: ch.apiKeyValid,
      commissionPct: ch.commissionPct,
      icalUrl: ch.icalUrl,
    }))
  );

  const updateDraft = (
    idx: number,
    patch: Partial<Omit<ChannelConfigDraft, "id" | "name">>
  ) => {
    setDrafts((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-xl w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">
              OTA Channel Credentials, Commission &amp; iCal Endpoints
            </h3>
            <p className="text-xs text-muted-foreground">
              Invalid credentials automatically disable sync controls to prevent
              partial inventory drift.
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

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {drafts.map((ch, idx) => (
            <div
              key={ch.id}
              className="p-3.5 rounded-xl border border-border bg-muted/40 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-foreground">
                  {ch.name} ({ch.id})
                </span>
                <label className="inline-flex items-center gap-1.5 font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ch.apiKeyValid}
                    onChange={(e) =>
                      updateDraft(idx, { apiKeyValid: e.target.checked })
                    }
                    className="rounded accent-[#1a68ff]"
                  />
                  <span>Valid API Credentials</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-0.5">
                    Commission %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={ch.commissionPct}
                    onChange={(e) =>
                      updateDraft(idx, {
                        commissionPct: Math.max(
                          0,
                          Math.min(40, Number(e.target.value) || 0)
                        ),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:border-[#1a68ff]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-0.5">
                    iCal Sync URL
                  </label>
                  <input
                    type="text"
                    value={ch.icalUrl}
                    onChange={(e) =>
                      updateDraft(idx, { icalUrl: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-foreground focus:outline-none focus:border-[#1a68ff]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted"
          >
            Close
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSave(drafts)}
            className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white text-xs font-semibold disabled:opacity-50"
          >
            Save &amp; Validate Tokens
          </button>
        </div>
      </div>
    </div>
  );
}
