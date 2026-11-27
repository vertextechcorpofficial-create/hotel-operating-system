"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { BlocksWorkspace } from "./components/blocks-workspace";
import { FolioLedgerTab } from "./components/folio-ledger-tab";
import { GroupSummaryCard } from "./components/group-summary-card";
import { GROUP_ROLE_EVENT } from "./components/header-role-switcher";
import {
  CsvImportModal,
  NewGroupBlockModal,
  type NewGroupBlockPayload,
  OverrideModal,
} from "./components/modals";
import {
  canRoleBatchCheckIn,
  canRoleReconcileFolio,
  canRoleTransitionPreArrival,
} from "./lib/group-engine";
import type {
  GroupBlock,
  GroupBlockStatus,
  GroupBookingsPayload,
  GroupRole,
} from "./types";

type GroupSubView = "blocks" | "folios";

interface OverrideRequest {
  title: string;
  description: string;
  groupId: string;
  action: "cancel" | "extend_cutoff" | "reopen_block";
}

export default function GroupBookingsModule() {
  const [data, setData] = useState<GroupBookingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRole, setActiveRole] = useState<GroupRole>("Manager");
  const [subView, setSubView] = useState<GroupSubView>("blocks");
  const [selectedGroupId, setSelectedGroupId] = useState("GRP-2026-01");

  const [searchQuery, setSearchQuery] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [newBlockOpen, setNewBlockOpen] = useState(false);
  const [overrideReq, setOverrideReq] = useState<OverrideRequest | null>(null);
  const [mutating, setMutating] = useState(false);

  const fetchGroupData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hos/group-bookings", { cache: "no-store" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: GroupBookingsPayload;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load group blocks.");
      }
      setData(json.data);
      setSelectedGroupId((prev) => {
        if (prev && json.data!.groupBlocks.some((g) => g.id === prev)) {
          return prev;
        }
        return json.data!.groupBlocks[0]?.id || "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load group blocks."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
    const onRoleChange = (e: Event) => {
      const next = (e as CustomEvent<GroupRole>).detail;
      if (next) setActiveRole(next);
    };
    window.addEventListener(GROUP_ROLE_EVENT, onRoleChange);
    return () => window.removeEventListener(GROUP_ROLE_EVENT, onRoleChange);
  }, []);

  const patchGroupAction = async (
    groupId: string,
    body: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> => {
    setMutating(true);
    try {
      const res = await fetch(
        `/api/hos/group-bookings/${encodeURIComponent(groupId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: activeRole, ...body }),
        }
      );
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: unknown;
        releasedCount?: number;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Action failed.");
        return null;
      }
      await fetchGroupData();
      return json;
    } catch {
      toast.error("Network error updating group block.");
      return null;
    } finally {
      setMutating(false);
    }
  };

  const handleTransitionState = (
    group: GroupBlock,
    nextState: GroupBlockStatus
  ) => {
    if (
      ["Inquiry", "Tentative Hold", "Definite / Confirmed", "Cancelled"].includes(
        nextState
      ) &&
      !canRoleTransitionPreArrival(activeRole)
    ) {
      toast.error(
        "Permission Denied: Only Sales / Reservations Managers can change pre-arrival block states."
      );
      return;
    }
    if (nextState === "Cancelled") {
      setOverrideReq({
        title: `Cancel Group Block (${group.id})`,
        description: `Cancelling ${group.name} releases all ${group.allottedRooms} held rooms back to public and OTA channel inventory. Enter audit reason.`,
        groupId: group.id,
        action: "cancel",
      });
      return;
    }
    void (async () => {
      const res = await patchGroupAction(group.id, {
        action: "transition",
        targetState: nextState,
      });
      if (res) toast.success(`${group.id} transitioned to "${nextState}".`);
    })();
  };

  const handleExtendCutoff = (group: GroupBlock) => {
    if (!canRoleTransitionPreArrival(activeRole)) {
      toast.error(
        "Permission Denied: Only an authorized Sales/Reservations Manager can extend a cutoff date."
      );
      return;
    }
    setOverrideReq({
      title: `Extend Cutoff Date (${group.id})`,
      description:
        "Extending the cutoff date holds unassigned rooms out of public/OTA inventory for 5 additional days. Record justification.",
      groupId: group.id,
      action: "extend_cutoff",
    });
  };

  const handleReopenReleased = (group: GroupBlock) => {
    if (!canRoleTransitionPreArrival(activeRole)) {
      toast.error(
        "Only HOS Operations Managers can reopen released group blocks."
      );
      return;
    }
    setOverrideReq({
      title: `Reopen Released Group Block (${group.id})`,
      description:
        "Reopening a released block verifies available hotel inventory and logs a mandatory audit entry.",
      groupId: group.id,
      action: "reopen_block",
    });
  };

  const handleConfirmOverride = async (reason: string) => {
    if (!overrideReq) return;
    if (overrideReq.action === "cancel") {
      const res = await patchGroupAction(overrideReq.groupId, {
        action: "transition",
        targetState: "Cancelled",
        reason,
      });
      if (res) {
        toast.warning(
          `Block ${overrideReq.groupId} cancelled and inventory released.`
        );
        setOverrideReq(null);
      }
      return;
    }
    if (overrideReq.action === "extend_cutoff") {
      const res = await patchGroupAction(overrideReq.groupId, {
        action: "extend_cutoff",
        reason,
      });
      if (res) {
        toast.success("Cutoff date extended (Audit logged).");
        setOverrideReq(null);
      }
      return;
    }
    const res = await patchGroupAction(overrideReq.groupId, {
      action: "reopen_block",
      reason,
    });
    if (res) {
      toast.success(
        `Group block ${overrideReq.groupId} reopened with 5 allotted rooms.`
      );
      setOverrideReq(null);
    }
  };

  const handleCreateNewBlock = async (payload: NewGroupBlockPayload) => {
    if (!canRoleTransitionPreArrival(activeRole)) {
      toast.error(
        "Permission Denied: Only Sales / Reservations Managers can create new group blocks."
      );
      return;
    }
    setMutating(true);
    try {
      const res = await fetch("/api/hos/group-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: activeRole, ...payload }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: GroupBlock;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || "Failed to create group block.");
        return;
      }
      setSelectedGroupId(json.data.id);
      setNewBlockOpen(false);
      toast.success(
        `Created ${json.data.id} (${json.data.status}) and deducted ${json.data.allottedRooms} rooms from sellable & OTA inventory.`
      );
      await fetchGroupData();
    } catch {
      toast.error("Network error creating group block.");
    } finally {
      setMutating(false);
    }
  };

  const handleCsvImport = async (rawCsv: string) => {
    const res = await patchGroupAction(selectedGroupId, {
      action: "import_csv",
      rawCsv,
    });
    if (!res) return null;
    const payload = res.data as { validCount: number; rowErrors: string[] };
    if (payload.rowErrors.length === 0) {
      toast.success(`Imported all ${payload.validCount} guests cleanly!`);
    } else {
      toast.warning(
        `Imported ${payload.validCount} valid rows; flagged ${payload.rowErrors.length} row error(s).`
      );
    }
    return payload;
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#1a68ff] dark:text-blue-400" />
          <span>Loading Group Blocks &amp; Rooming List Manager...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
          Unable to load Group Blocks
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void fetchGroupData()}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const selectedGroup =
    data.groupBlocks.find((g) => g.id === selectedGroupId) ||
    data.groupBlocks[0] ||
    null;

  return (
    <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 py-2 space-y-6">
      {/* Page Title & Metadata Header (1-to-1 Canvas layout) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-[#1a68ff] dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Group Blocks &amp; Rooming List Manager
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#1a68ff] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Priority: P1 • Phase 2
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage high-volume room allotments (5–50+ rooms), enforce inventory
            cutoff dates, validate CSV rooming list imports, execute batch
            check-ins, and split Master vs. Incidental folios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0 whitespace-nowrap">
          <div className="inline-flex items-center bg-muted p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setSubView("blocks")}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition ${
                subView === "blocks"
                  ? "font-semibold bg-card text-foreground shadow-2xs"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              Blocks &amp; Rooming List
            </button>
            <button
              type="button"
              onClick={() => setSubView("folios")}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition ${
                subView === "folios"
                  ? "font-semibold bg-card text-foreground shadow-2xs"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              Folio &amp; Audit Ledger ({data.folioPostings.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setNewBlockOpen(true)}
            className="bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xs transition flex items-center gap-1.5"
          >
            <span>+ Create Group Block</span>
          </button>
        </div>
      </div>

      {subView === "blocks" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <BlocksWorkspace
            groupBlocks={data.groupBlocks}
            selectedGroupId={selectedGroup?.id || ""}
            businessDate={data.meta.businessDate}
            searchQuery={searchQuery}
            arrivalFilter={arrivalFilter}
            statusFilter={statusFilter}
            mutating={mutating}
            onSearchChange={setSearchQuery}
            onArrivalFilterChange={setArrivalFilter}
            onStatusFilterChange={setStatusFilter}
            onResetFilters={() => {
              setSearchQuery("");
              setArrivalFilter("");
              setStatusFilter("ALL");
            }}
            onSelectGroup={setSelectedGroupId}
            onTransitionState={handleTransitionState}
            onToggleRoutingRule={(id) =>
              void (async () => {
                const res = await patchGroupAction(id, {
                  action: "toggle_routing",
                });
                if (res) toast.info(`Updated split-billing rule for ${id}.`);
              })()
            }
            onOpenCsvModal={() => setCsvModalOpen(true)}
            onExtendCutoff={handleExtendCutoff}
            onEnforceCutoff={(id) =>
              void (async () => {
                const res = await patchGroupAction(id, {
                  action: "enforce_cutoff",
                });
                if (res) {
                  toast.warning(
                    `Released ${String(
                      res.releasedCount ?? 0
                    )} unassigned rooms back to general & OTA inventory.`
                  );
                }
              })()
            }
            onReopenReleased={handleReopenReleased}
            onMarkRoomClean={(groupId, resId) =>
              void (async () => {
                const res = await patchGroupAction(groupId, {
                  action: "mark_clean",
                  resId,
                });
                if (res) toast.success("Room marked Clean & ready for batch check-in.");
              })()
            }
            onRemoveGuest={(groupId, resId) =>
              void (async () => {
                const res = await patchGroupAction(groupId, {
                  action: "remove_guest",
                  resId,
                });
                if (res) {
                  toast.info(
                    `Processed early departure / cancellation (${resId}) without corrupting Master Folio totals.`
                  );
                }
              })()
            }
          />

          <GroupSummaryCard
            group={selectedGroup}
            mutating={mutating}
            onExecuteBatchCheckIn={(id) => {
              if (!canRoleBatchCheckIn(activeRole)) {
                toast.error(
                  "Permission Denied: Only Front Desk Supervisors or Managers can execute Batch Check-In."
                );
                return;
              }
              void (async () => {
                const res = await patchGroupAction(id, {
                  action: "batch_checkin",
                });
                if (res) {
                  toast.success(
                    `Batch Check-In Complete for ${selectedGroup?.name || id}!`
                  );
                }
              })();
            }}
            onSettleMasterFolio={(id) => {
              if (!canRoleReconcileFolio(activeRole)) {
                toast.error(
                  "Permission Denied: Only Accounting or HOS Managers can reconcile Master Folios."
                );
                return;
              }
              void (async () => {
                const res = await patchGroupAction(id, {
                  action: "settle_master_folio",
                });
                if (res) {
                  toast.success("Master Folio reconciled and posted to folios_hos.");
                }
              })();
            }}
          />
        </div>
      ) : (
        <FolioLedgerTab folioPostings={data.folioPostings} />
      )}

      {csvModalOpen && selectedGroup ? (
        <CsvImportModal
          key={`csv-${selectedGroup.id}`}
          group={selectedGroup}
          submitting={mutating}
          onClose={() => setCsvModalOpen(false)}
          onImport={handleCsvImport}
        />
      ) : null}

      {newBlockOpen ? (
        <NewGroupBlockModal
          key="new-group-block"
          submitting={mutating}
          onClose={() => setNewBlockOpen(false)}
          onSubmit={handleCreateNewBlock}
        />
      ) : null}

      {overrideReq ? (
        <OverrideModal
          key={`${overrideReq.groupId}-${overrideReq.action}`}
          title={overrideReq.title}
          description={overrideReq.description}
          submitting={mutating}
          onClose={() => setOverrideReq(null)}
          onConfirm={handleConfirmOverride}
        />
      ) : null}
    </div>
  );
}
