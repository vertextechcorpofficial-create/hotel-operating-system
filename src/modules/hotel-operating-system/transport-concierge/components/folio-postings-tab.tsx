"use client";

import type { FolioPostingEntry } from "../types";

interface FolioPostingsTabProps {
  folioPostings: FolioPostingEntry[];
}

export function FolioPostingsTab({ folioPostings }: FolioPostingsTabProps) {
  return (
    <section className="p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-foreground">
          Folio &amp; Settlement Postings (
          <code className="text-xs text-[#1a73e8] dark:text-blue-400">
            guest_charges_hos
          </code>
          )
        </h2>
        <p className="text-xs text-muted-foreground">
          Itemized transport charges posted to active in-house guest folios or
          walk-in immediate settlement receipts.
        </p>
      </div>
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border text-xs font-semibold text-foreground">
              <th className="py-3 px-4">Posting ID</th>
              <th className="py-3 px-4">Booking Ref</th>
              <th className="py-3 px-4">Target Account / Folio</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Posted By</th>
              <th className="py-3 px-4">Date/Time</th>
              <th className="py-3 px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {folioPostings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No transport folio charges posted yet.
                </td>
              </tr>
            ) : (
              folioPostings.map((p) => (
                <tr key={p.postingId} className="hover:bg-muted/40">
                  <td className="py-3 px-4 font-mono font-semibold text-[#1a73e8] dark:text-blue-400">
                    {p.postingId}
                  </td>
                  <td className="py-3 px-4 font-mono text-foreground">
                    {p.bookingId}
                  </td>
                  <td className="py-3 px-4 font-medium text-foreground">
                    {p.targetAccount}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {p.description}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {p.postedBy}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {p.timestamp}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ₱
                    {Number(p.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
