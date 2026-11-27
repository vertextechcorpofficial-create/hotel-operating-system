"use client";

import type { FolioPostingEntry } from "../types";

interface FolioPostingsTabProps {
  folioPostings: FolioPostingEntry[];
}

export function FolioPostingsTab({ folioPostings }: FolioPostingsTabProps) {
  return (
    <section className="p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">
          Folio &amp; Settlement Postings (
          <code className="text-xs text-[#1a73e8]">guest_charges_hos</code>)
        </h2>
        <p className="text-xs text-gray-500">
          Itemized transport charges posted to active in-house guest folios or
          walk-in immediate settlement receipts.
        </p>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-700">
              <th className="py-3 px-4">Posting ID</th>
              <th className="py-3 px-4">Booking Ref</th>
              <th className="py-3 px-4">Target Account / Folio</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Posted By</th>
              <th className="py-3 px-4">Date/Time</th>
              <th className="py-3 px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {folioPostings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No transport folio charges posted yet.
                </td>
              </tr>
            ) : (
              folioPostings.map((p) => (
                <tr key={p.postingId} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-semibold text-[#1a73e8]">
                    {p.postingId}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-700">
                    {p.bookingId}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {p.targetAccount}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{p.description}</td>
                  <td className="py-3 px-4 text-gray-600">{p.postedBy}</td>
                  <td className="py-3 px-4 text-gray-400">{p.timestamp}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">
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
