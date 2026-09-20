import React from 'react';
import { 
  Users, 
  Award, 
  Flame, 
  ShieldCheck, 
  AlertTriangle, 
  Wrench, 
  Clock, 
  Edit3, 
  Activity,
  CheckCircle2
} from 'lucide-react';
import { formatTimestampWithRelative } from '../utils/dateUtils';

export const ReviewerAnalyticsCard = ({ reviewerData, loading = false }) => {
  if (loading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-4"></div>
        <div className="h-40 bg-slate-800/40 rounded"></div>
      </div>
    );
  }

  if (!reviewerData) {
    return (
      <div className="card-glass p-6 text-center text-slate-400">
        <Users className="mx-auto mb-2 opacity-50" size={32} />
        <p>No reviewer analytics telemetry available.</p>
      </div>
    );
  }

  const {
    total_active_reviewers = 0,
    leaderboard = [],
    summary = {}
  } = reviewerData;

  const {
    total_reviews = 0,
    avg_reviews_per_reviewer = 0.0,
    most_active_reviewer = 'None',
    total_audit_events = 0
  } = summary;

  return (
    <div className="card-glass p-6 border border-slate-700/60 shadow-xl rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Users size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Reviewer Accountability &amp; Leaderboard
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
                Phase 14B
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Human analyst contributions, class diversity, and review throughput
            </p>
          </div>
        </div>

        {/* Summary Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 mr-1">Active Reviewers:</span>
            <span className="font-bold text-sky-400">{total_active_reviewers}</span>
          </div>
          <div className="bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 mr-1">Top Contributor:</span>
            <span className="font-bold text-emerald-400 truncate max-w-[140px] inline-block align-bottom" title={most_active_reviewer}>
              {most_active_reviewer}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      {leaderboard.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">
          No human reviews recorded yet. Reviews will appear here as analysts verify incidents.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                <th className="py-2.5 px-3">Analyst Identity</th>
                <th className="py-2.5 px-3 text-center">Total Reviews</th>
                <th className="py-2.5 px-3">Class Distribution</th>
                <th className="py-2.5 px-3 text-center">Edits</th>
                <th className="py-2.5 px-3">Last Active (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leaderboard.map((rev, index) => {
                const isTop = index === 0;
                const classes = rev.reviews_by_class || {};
                const lastActiveFormatted = formatTimestampWithRelative(rev.last_active);

                return (
                  <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                    {/* Rank Badge */}
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                        isTop ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        index === 1 ? 'bg-slate-700 text-slate-200' :
                        index === 2 ? 'bg-amber-900/30 text-amber-600' :
                        'text-slate-500'
                      }`}>
                        {index + 1}
                      </span>
                    </td>

                    {/* Reviewer Name */}
                    <td className="py-3 px-3 font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span>{rev.reviewer_name}</span>
                        {isTop && (
                          <Award size={14} className="text-amber-400" title="Top Reviewer" />
                        )}
                      </div>
                    </td>

                    {/* Total Reviews */}
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono font-bold">
                        {rev.total_reviews}
                      </span>
                    </td>

                    {/* Class Distribution Mini-Chips */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {classes.TRUE_FIRE > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-medium" title="True Fire">
                            🔥 {classes.TRUE_FIRE}
                          </span>
                        )}
                        {classes.CONTROLLED_FLARING > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium" title="Controlled Flaring">
                            🛡️ {classes.CONTROLLED_FLARING}
                          </span>
                        )}
                        {classes.FALSE_ALARM > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium" title="False Alarm">
                            ⚠️ {classes.FALSE_ALARM}
                          </span>
                        )}
                        {classes.MAINTENANCE_ACTIVITY > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium" title="Maintenance">
                            🔧 {classes.MAINTENANCE_ACTIVITY}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Edit Count */}
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">
                      {rev.edit_count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {rev.edit_count}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>

                    {/* Last Active Timestamp (IST) */}
                    <td className="py-3 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {lastActiveFormatted}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
