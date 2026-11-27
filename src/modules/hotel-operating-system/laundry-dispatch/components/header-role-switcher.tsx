"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { LaundryRole } from "../types";

export const LAUNDRY_ROLE_EVENT = "hos-laundry-role-change";

const ROLE_OPTIONS: { value: LaundryRole; label: string }[] = [
  { value: "Laundry Supervisor", label: "Laundry Supervisor" },
  { value: "Valet Runner", label: "Valet Runner / Attendant" },
  { value: "Front Desk Supervisor", label: "Front Desk Supervisor" },
  { value: "Revenue Manager", label: "Revenue Manager" },
  { value: "Sales Manager", label: "Sales / Reservations Mgr" },
  { value: "System Admin", label: "Platform / System Admin" },
];

export function HeaderRoleSwitcher() {
  const [role, setRole] = useState<LaundryRole>("Laundry Supervisor");

  const handleChange = (nextRole: LaundryRole) => {
    setRole(nextRole);
    window.dispatchEvent(
      new CustomEvent<LaundryRole>(LAUNDRY_ROLE_EVENT, { detail: nextRole })
    );
    toast.info(`Switched active HOS actor role to: ${nextRole}`);
  };

  const activeLabel =
    ROLE_OPTIONS.find((opt) => opt.value === role)?.label || role;

  return (
    <div className="relative hidden md:inline-flex items-center gap-2 bg-muted/70 hover:bg-muted border border-border rounded-lg px-3 py-1.5 shrink-0 whitespace-nowrap transition-colors">
      <span className="text-xs font-medium text-muted-foreground leading-none">
        Active Role:
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground leading-none">
        <span>{activeLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </span>
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value as LaundryRole)}
        aria-label="Active HOS Role"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer dark:[&>option]:bg-card dark:[&>option]:text-foreground"
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
