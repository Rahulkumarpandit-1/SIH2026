import React, { useState } from 'react';
import { 
  History, 
  Search, 
  ArrowRight, 
  User, 
  Building2, 
  Clock, 
  FileText, 
  Tag, 
  CheckCircle,
  Edit2
} from 'lucide-react';
import { formatTimestampWithRelative } from '../utils/dateUtils';

export const ReviewAuditTimeline = ({ auditLogs = [], loading = false }) => {
  const [filterQuery, setFilterQuery] = useState('');

  if (loading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-slate-800/40 rounded"></div>
          <div className="h-16 bg-slate-800/40 rounded"></div>
          <div className="h-16 bg-slate-800/40 rounded"></div>
        </div>
      </div>
    );
  }

  const filtered = auditLogs.filter(log => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.incident_uuid?.toLowerCase().includes(q) ||
      log.reviewer_name?.toLowerCase().includes(q) ||
      log.facility_name?.toLowerCase().includes(q) ||
      log.new_label?.toLowerCase().includes(q)
    );
  });

  const labelColors = {
    TRUE_FIRE: 'text-red-400 bg-red-500/10 border-red-500/20',
    CONTROLLED_FLARING: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    FALSE_ALARM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    MAINTENANCE_ACTIVITY: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
  };

  return (
    <div className="card-glass p-6 border border-slate-700/60 shadow-xl rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <History size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Review Audit Trail &amp; Edit History
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium">
                Phase 14A &amp; 14E
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Immutable chronological record of every analyst label creation and modification
            </p>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Filter by analyst, site, or UUID..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          {filterQuery ? 'No audit events match your filter query.' : 'No review audit events recorded yet.'}
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
          {filtered.map((log) => {
            const isCreate = log.action_type === 'CREATE';
            const timeStr = formatTimestampWithRelative(log.created_at);

            return (
              <div key={log.id} className="relative pl-8 text-xs group">
                {/* Node icon */}
                <div className={`absolute left-1.5 top-2 w-4 h-4 rounded-full border-2 flex items-center justify-center -translate-x-1/2 ${
                  isCreate 
                    ? 'bg-emerald-950 border-emerald-400' 
                    : 'bg-amber-950 border-amber-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isCreate ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </div>

                {/* Audit Card */}
                <div className="p-3.5 bg-slate-900/60 hover:bg-slate-900/90 rounded-lg border border-slate-800 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                        isCreate
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {isCreate ? 'Initial Annotation' : 'Label Modified'}
                      </span>

                      <span className="font-semibold text-slate-200">
                        {log.facility_name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        ({log.incident_uuid})
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {timeStr}
                    </span>
                  </div>

                  {/* Transition row */}
                  <div className="flex items-center gap-2 mb-2 font-mono text-[11px]">
                    <Tag size={12} className="text-slate-500" />
                    {log.previous_label ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded border ${labelColors[log.previous_label] || 'text-slate-400'}`}>
                          {log.previous_label}
                        </span>
                        <ArrowRight size={12} className="text-slate-500" />
                        <span className={`px-2 py-0.5 rounded border font-bold ${labelColors[log.new_label] || 'text-slate-400'}`}>
                          {log.new_label}
                        </span>
                      </div>
                    ) : (
                      <span className={`px-2 py-0.5 rounded border font-bold ${labelColors[log.new_label] || 'text-slate-400'}`}>
                        {log.new_label}
                      </span>
                    )}
                  </div>

                  {/* Reviewer & notes */}
                  <div className="flex items-start gap-4 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div className="flex items-center gap-1 text-slate-400 shrink-0">
                      <User size={12} className="text-purple-400" />
                      <span>Analyst:</span>
                      <span className="font-medium text-slate-300">{log.reviewer_name}</span>
                    </div>

                    {log.notes && (
                      <div className="flex items-start gap-1 text-slate-400 italic truncate">
                        <FileText size={12} className="shrink-0 mt-0.5 text-slate-500" />
                        <span className="truncate">&ldquo;{log.notes}&rdquo;</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
