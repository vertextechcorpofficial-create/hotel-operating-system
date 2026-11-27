"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { TransportRole } from "../types";

export const TRANSPORT_ROLE_EVENT = "hos-transport-role-change";

export function HeaderRoleSwitcher() {
  const [role, setRole] = useState<TransportRole>("Concierge");

  const handleChange = (nextRole: TransportRole) => {
    setRole(nextRole);
    window.dispatchEvent(
      new CustomEvent<TransportRole>(TRANSPORT_ROLE_EVENT, { detail: nextRole })
    );
    toast.info(`Switched active HOS actor role to: ${nextRole}`);
  };

  return (
    <div className="hidden md:flex items-center gap-2.5 bg-muted/70 border border-border rounded-lg px-3.5 py-1.5 shrink-0 whitespace-nowrap">
      <span className="text-[11px] font-medium text-muted-foreground">
        Active Role:
      </span>
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value as TransportRole)}
        aria-label="Active HOS Role"
        className="bg-transparent text-xs font-semibold text-foreground pr-1 focus:outline-none cursor-pointer dark:[&>option]:bg-card dark:[&>option]:text-foreground"
      >
        <option value="Concierge">Concierge / Front Desk</option>
        <option value="Driver">Transport Driver</option>
        <option value="Billing">Billing / Folio Auditor</option>
        <option value="Admin">System Admin / QA</option>
      </select>
    </div>
  );
}
