import React from 'react';
import { CampusIssue } from '../lib/types';
import { MapPin, Copy } from 'lucide-react';

const severityStyles: Record<string, string> = {
  low: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  medium: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  high: 'bg-orange-950 text-orange-400 border-orange-800',
  critical: 'bg-rose-950 text-rose-400 border-rose-800 animate-pulse',
};

export default function IssueCard({ issue }: { issue: CampusIssue }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between hover:border-slate-600 transition-all">
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border uppercase tracking-wider ${severityStyles[issue.severity]}`}>
            {issue.severity} Priority
          </span>
          <span className="text-xs text-slate-400">{issue.category}</span>
        </div>

        {issue.is_duplicate && (
          <div className="mb-3 flex items-center gap-2 bg-amber-950/80 border border-amber-800/80 text-amber-300 text-xs px-3 py-2 rounded-lg">
            <Copy className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Ubot Alert:</strong> Duplicate of report #{issue.duplicate_of_id?.slice(0, 6)}
            </span>
          </div>
        )}

        <h3 className="text-lg font-bold text-white mb-2">{issue.title}</h3>
        <p className="text-slate-300 text-sm mb-4 line-clamp-3">{issue.description}</p>
      </div>

      <div className="pt-3 border-t border-slate-700/60 flex justify-between items-center text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>{issue.location}</span>
        </div>
        <span>{new Date(issue.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}