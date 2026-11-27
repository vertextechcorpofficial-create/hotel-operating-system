"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { LaundryRole } from "../types";

export const LAUNDRY_ROLE_EVENT = "hos-laundry-role-change";

export function HeaderRoleSwitcher() {
  const [role, setRole] = useState<LaundryRole>("Laundry Supervisor");

  const handleChange = (nextRole: LaundryRole) => {
    setRole(nextRole);
    window.dispatchEvent(
      new CustomEvent<LaundryRole>(LAUNDRY_ROLE_EVENT, { detail: nextRole })
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
        onChange={(e) => handleChange(e.target.value as LaundryRole)}
        aria-label="Active HOS Role"
        className="bg-transparent text-xs font-semibold text-foreground pr-1 focus:outline-none cursor-pointer dark:[&>option]:bg-card dark:[&>option]:text-foreground"
      >
        <option value="Laundry Supervisor">Laundry Supervisor</option>
        <option value="Valet Runner">Valet Runner / Attendant</option>
        <option value="Front Desk Supervisor">Front Desk Supervisor</option>
        <option value="Revenue Manager">Revenue Manager</option>
        <option value="Sales Manager">Sales / Reservations Mgr</option>
        <option value="System Admin">Platform / System Admin</option>
      </select>
    </div>
  );
}
