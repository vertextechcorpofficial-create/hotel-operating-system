"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AmenityRole } from "../types";

export const AMENITY_ROLE_EVENT = "hos-amenity-role-change";

export function HeaderRoleSwitcher() {
  const [role, setRole] = useState<AmenityRole>("Receptionist");

  const handleChange = (nextRole: AmenityRole) => {
    setRole(nextRole);
    window.dispatchEvent(
      new CustomEvent<AmenityRole>(AMENITY_ROLE_EVENT, { detail: nextRole })
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
        onChange={(e) => handleChange(e.target.value as AmenityRole)}
        aria-label="Active HOS Role"
        className="bg-transparent text-xs font-semibold text-foreground pr-1 focus:outline-none cursor-pointer dark:[&>option]:bg-card dark:[&>option]:text-foreground"
      >
        <option value="Receptionist">Spa / Front Desk Receptionist</option>
        <option value="Manager">HOS Operations Manager</option>
        <option value="Therapist">Therapist / Attendant</option>
      </select>
    </div>
  );
}
