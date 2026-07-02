import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  FileText,
  FolderGit,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  CLERK_DOCUMENT_QUEUE,
  formatShortDate,
} from './clerkPortalData';

const statusTone = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Review: 'bg-amber-50 text-amber-700 border-amber-100',
  Hold: 'bg-red-50 text-red-700 border-red-100',
  Pending: 'bg-blue-50 text-blue-700 border-blue-100',
};

const tabs = ['All', 'Review', 'Hold', 'Verified'];

const DocumentsManagement = () => {
  const [documentQueue, setDocumentQueue] = useState(CLERK_DOCUMENT_QUEUE);
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPacketId, setSelectedPacketId] = useState(CLERK_DOCUMENT_QUEUE[0]?.id || '');

  const filteredQueue = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return documentQueue.filter((packet) => {
      const matchesTab = activeTab === 'All' || packet.status === activeTab;
      const searchBlob = [
        packet.id,
        packet.ownerName,
        packet.ownerType,
        packet.className,
        packet.packet,
        packet.status,
        packet.documents.map((document) => document.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return matchesTab && (!normalizedSearch || searchBlob.includes(normalizedSearch));
    });
  }, [activeTab, documentQueue, searchTerm]);

  const selectedPacket =
    documentQueue.find((packet) => packet.id === selectedPacketId) ||
    filteredQueue[0] ||
    documentQueue[0];

  const updatePacketStatus = (packetId, status) => {
    setDocumentQueue((prev) =>
      prev.map((packet) =>
        packet.id === packetId
          ? {
              ...packet,
              status,
              documents: packet.documents.map((document) =>
                status === 'Verified' ? { ...document, status: 'Verified' } : document
              ),
            }
          : packet
      )
    );
  };

  const updateDocumentStatus = (documentName, status) => {
    if (!selectedPacket) return;

    setDocumentQueue((prev) =>
      prev.map((packet) =>
        packet.id === selectedPacket.id
          ? {
              ...packet,
              status: status === 'Hold' ? 'Hold' : packet.status === 'Verified' ? 'Review' : packet.status,
              documents: packet.documents.map((document) =>
                document.name === documentName ? { ...document, status } : document
              ),
            }
          : packet
      )
    );
  };

  const summary = {
    total: documentQueue.length,
    verified: documentQueue.filter((packet) => packet.status === 'Verified').length,
    review: documentQueue.filter((packet) => packet.status === 'Review').length,
    hold: documentQueue.filter((packet) => packet.status === 'Hold').length,
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <FolderGit className="w-5 h-5" /> Document Management
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Verify admission, staff, and transport document packets from the clerk desk.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/60 border border-white/80 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all rounded-2xl px-3 py-2 text-xs font-bold">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search packets..."
            className="bg-transparent outline-none w-48"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4 stagger">
        <SummaryCard label="Packets" value={summary.total} />
        <SummaryCard label="Verified" value={summary.verified} />
        <SummaryCard label="Review" value={summary.review} />
        <SummaryCard label="Hold" value={summary.hold} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-5 glass-card rounded-3xl overflow-hidden">
          <div className="p-4 bg-indigo-50/60 border-b border-white/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="text-sm font-black">Verification Queue</h3>
            <div className="flex bg-white/60 border border-white/70 p-1 rounded-xl overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${
                    activeTab === tab ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 space-y-2 max-h-[680px] overflow-y-auto">
            {filteredQueue.length === 0 ? (
              <div className="p-10 text-center text-xs font-bold text-slate-500">
                No document packets match this filter.
              </div>
            ) : (
              filteredQueue.map((packet) => (
                <button
                  key={packet.id}
                  type="button"
                  onClick={() => setSelectedPacketId(packet.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    selectedPacket?.id === packet.id
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md shadow-indigo-500/20'
                      : 'bg-white/50 text-slate-900 border-white/70 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{packet.ownerName}</p>
                      <p className={`text-[10px] font-bold mt-1 truncate ${selectedPacket?.id === packet.id ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {packet.packet} | {packet.className}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${statusTone[packet.status]}`}>
                      {packet.status}
                    </span>
                  </div>
                  <p className={`text-[10px] font-mono font-bold mt-3 ${selectedPacket?.id === packet.id ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {packet.id} | Submitted {formatShortDate(packet.submitted)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="xl:col-span-7 glass-card rounded-3xl p-5 min-h-[640px]">
          {selectedPacket ? (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100/80 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[9px] font-mono font-black bg-white/50 px-2 py-0.5 rounded-md">
                      {selectedPacket.id}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${statusTone[selectedPacket.status]}`}>
                      {selectedPacket.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-black">{selectedPacket.ownerName}</h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    {selectedPacket.ownerType} | {selectedPacket.className} | {selectedPacket.packet}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updatePacketStatus(selectedPacket.id, 'Hold')}
                    className="px-3 py-2 bg-red-50 text-red-700 border border-red-100 rounded-xl text-[10px] font-black flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Hold
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePacketStatus(selectedPacket.id, 'Verified')}
                    className="px-3 py-2 btn-primary rounded-xl text-[10px] font-black flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verify Packet
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedPacket.documents.map((document) => (
                  <article key={document.name} className="glass-soft rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-2xl bg-white/60 border border-slate-100/80 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">{document.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1">Uploaded as office packet file</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${statusTone[document.status]}`}>
                        {document.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {['Verified', 'Review', 'Hold'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateDocumentStatus(document.name, status)}
                          className={`px-2 py-1.5 rounded-xl border text-[9px] font-black ${
                            document.status === status
                              ? statusTone[status]
                              : 'bg-white/60 text-slate-500 border-slate-100/80'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs font-semibold text-amber-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Hold packets should include a clear correction note before parents or staff are contacted.
              </div>
            </div>
          ) : (
            <div className="min-h-[560px] flex flex-col items-center justify-center text-center text-slate-500">
              <FileCheck2 className="w-12 h-12 mb-2" />
              <p className="text-xs font-black">No Packet Selected</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="glass-card rounded-3xl p-4 min-h-24">
    <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
    <p className="text-2xl font-black mt-2">{value}</p>
  </div>
);

export default DocumentsManagement;
