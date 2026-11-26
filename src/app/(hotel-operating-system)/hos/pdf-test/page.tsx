"use client";

import React, { useState, useEffect } from "react";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import { CompanyData } from "@/components/pdf-layout-design/types";
import { PdfTemplate, pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import { FileText, Printer, X, Layout } from "lucide-react";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface RoomRow {
    id: number | string;
    room_number: string;
    floor_number?: number | string | null;
    type_id?: { name?: string } | number | null;
    operational_status_id?: { status_name?: string } | number | null;
    housekeeping_status_id?: { status_name?: string } | number | null;
}

export default function PdfTestPage() {
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [rooms, setRooms] = useState<RoomRow[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // SWR Style: Load from cache first
                const cached = localStorage.getItem('pdf_company_data');
                if (cached) setCompanyData(JSON.parse(cached));

                // Fetch Company Data, Templates, and Live Room Inventory in parallel
                const [compRes, tpls, roomsRes] = await Promise.all([
                    fetch("/api/pdf/company"),
                    pdfTemplateService.fetchTemplates(),
                    fetch("/api/hos/room-registration")
                ]);

                if (compRes.ok) {
                    const result = await compRes.json();
                    const company = result.data?.[0] || (Array.isArray(result.data) ? null : result.data);
                    setCompanyData(company);
                    if (company) localStorage.setItem('pdf_company_data', JSON.stringify(company));
                }

                if (roomsRes.ok) {
                    const roomsJson = await roomsRes.json();
                    setRooms(Array.isArray(roomsJson.data) ? roomsJson.data : []);
                }

                setTemplates(tpls);
                if (tpls.length > 0) {
                    setSelectedTemplateName(tpls[0].name);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoadingRooms(false);
            }
        };
        init();
    }, []);

    const handlePrint = async () => {
        if (!selectedTemplateName) {
            toast.warning("Please select a template first.");
            return;
        }

        setIsGenerating(true);
        try {
            // Ensure we have company data from API
            if (!companyData) {
                toast.warning("Company data not loaded yet. Please wait.");
                setIsGenerating(false);
                return;
            }

            const doc = await PdfEngine.generateWithFrame(selectedTemplateName, companyData, (doc, startY, config) => {
                const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
                
                // Calculate dynamic bottom margin based on Body End indicator
                const baseSize = config.paperSize === 'Custom' ? config.customSize : (PAPER_SIZES[config.paperSize] || PAPER_SIZES.A4);
                const paperHeight = config.orientation === 'landscape' ? baseSize.width : baseSize.height;
                const bottomMargin = config.bodyEnd ? (paperHeight - config.bodyEnd) : margins.bottom;

                // 100% Accurate Title Placement (Using Top Baseline)
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text("ROOM INVENTORY MASTERLIST", margins.left, startY, { baseline: 'top' });

                // Start table just below the title (title is roughly 5mm high at 12pt)
                autoTable(doc, {
                    startY: startY + 8,
                    margin: { ...margins, bottom: bottomMargin },
                    head: [['Room #', 'Floor', 'Room Type', 'Operational Status', 'Housekeeping']],
                    body: rooms.map((r) => [
                        `Room ${r.room_number}`,
                        r.floor_number != null ? `Floor ${r.floor_number}` : '—',
                        typeof r.type_id === 'object' && r.type_id !== null ? r.type_id.name || '—' : '—',
                        typeof r.operational_status_id === 'object' && r.operational_status_id !== null ? r.operational_status_id.status_name || '—' : '—',
                        typeof r.housekeeping_status_id === 'object' && r.housekeeping_status_id !== null ? r.housekeeping_status_id.status_name || '—' : '—',
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                    styles: { fontSize: 8 }
                });
            });

            const blob = doc.output('blob');
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            setIsPreviewOpen(true);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("Failed to generate PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/60">
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto w-full space-y-6 pb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-1.5">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                <Layout className="text-blue-600 shrink-0" size={30} />
                                PDF Engine Test Module
                            </h1>
                            <p className="text-sm text-slate-500 font-medium">
                                Testing cross-module reusability with shared templates and live HOS room inventory.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Layout</label>
                                <select
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none min-w-[220px]"
                                    value={selectedTemplateName}
                                    onChange={(e) => setSelectedTemplateName(e.target.value)}
                                >
                                    {templates.length === 0 && <option>No templates found</option>}
                                    {templates.map(t => (
                                        <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handlePrint}
                                disabled={isGenerating || !companyData}
                                className={`mt-auto flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all transform active:scale-95 shadow-sm
                                    ${isGenerating ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            >
                                {isGenerating ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : <Printer size={18} />}
                                Generate PDF
                            </button>
                        </div>
                    </div>

                    {/* Live HOS Room Inventory Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                                <FileText className="text-slate-400" size={20} />
                                Room Inventory Data (Live HOS)
                            </h2>
                            <span className="bg-blue-50 text-blue-600 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                {rooms.length} Records
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70">
                                        <th className="py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Room #</th>
                                        <th className="py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Floor</th>
                                        <th className="py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Room Type</th>
                                        <th className="py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Operational</th>
                                        <th className="py-3.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-center">Housekeeping</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingRooms ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-sm text-slate-400">Loading live room inventory...</td>
                                        </tr>
                                    ) : rooms.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-sm text-slate-400">No rooms returned from Directus.</td>
                                        </tr>
                                    ) : (
                                        rooms.map((room) => {
                                            const typeName = typeof room.type_id === 'object' && room.type_id !== null ? room.type_id.name || '—' : '—';
                                            const opStatus = typeof room.operational_status_id === 'object' && room.operational_status_id !== null ? room.operational_status_id.status_name || '—' : '—';
                                            const hkStatus = typeof room.housekeeping_status_id === 'object' && room.housekeeping_status_id !== null ? room.housekeeping_status_id.status_name || '—' : '—';
                                            return (
                                                <tr key={room.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="py-4 px-6 text-sm font-mono font-bold text-slate-800 whitespace-nowrap">Room {room.room_number}</td>
                                                    <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">{room.floor_number != null ? `Floor ${room.floor_number}` : '—'}</td>
                                                    <td className="py-4 px-6 text-sm text-slate-700 font-medium">{typeName}</td>
                                                    <td className="py-4 px-6 text-sm text-slate-600">{opStatus}</td>
                                                    <td className="py-4 px-6 text-sm text-center whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter ${
                                                            hkStatus.toLowerCase() === 'clean' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {hkStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100">
                            <p className="text-xs text-slate-400 font-medium">
                                * Clicking &quot;Generate PDF&quot; will use the selected Template from the Database as a Header and render this table as the Body.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Preview Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-6xl h-full rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Print Preview</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">Template: <span className="text-blue-600 font-bold">{selectedTemplateName}</span></p>
                            </div>
                            <button 
                                onClick={() => setIsPreviewOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-red-500"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center relative">
                            {pdfUrl ? (
                                <iframe 
                                    src={pdfUrl} 
                                    className="w-full h-full rounded-2xl border border-slate-200 shadow-xl bg-white"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="animate-pulse flex flex-col items-center gap-4">
                                    <div className="h-20 w-20 bg-slate-200 rounded-full"></div>
                                    <div className="h-4 w-32 bg-slate-200 rounded-md"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
