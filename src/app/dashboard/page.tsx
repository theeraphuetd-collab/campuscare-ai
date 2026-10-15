'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CampusIssue, SeverityLevel, IssueStatus } from '../../lib/types';
import DashboardHeader from '@/components/DashboardHeader';
import IssueCard from '@/components/IssueCard';
import { Filter, Layers, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

// Initialize Browser Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  const [issues, setIssues] = useState<CampusIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [groupByDuplicates, setGroupByDuplicates] = useState<boolean>(true);

  // 1. Fetch initial issue reports from Supabase
  const fetchIssues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campus issues:', error);
    } else if (data) {
      setIssues(data as CampusIssue[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIssues();

    // 2. Setup Real-time Supabase Subscription for incoming voice/Ubot reports
    const channel = supabase
      .channel('campus_issues_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newIssue = payload.new as CampusIssue;
            setIssues((prev) => [newIssue, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CampusIssue;
            setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setIssues((prev) => prev.filter((item) => item.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Update Issue Status handler
  const handleStatusUpdate = async (id: string, newStatus: IssueStatus) => {
    const { error } = await supabase
      .from('issues')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Failed to update status:', error);
    } else {
      setIssues((prev) =>
        prev.map((iss) => (iss.id === id ? { ...iss, status: newStatus } : iss))
      );
    }
  };

  // 4. Priority Filter calculation
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedSeverity === 'all') return true;
      return issue.severity === selectedSeverity;
    });
  }, [issues, selectedSeverity]);

  // 5. Duplicate Grouping Logic
  const { primaryIssues, duplicatesMap } = useMemo(() => {
    if (!groupByDuplicates) {
      return { primaryIssues: filteredIssues, duplicatesMap: new Map<string, CampusIssue[]>() };
    }

    const primaries: CampusIssue[] = [];
    const dupMap = new Map<string, CampusIssue[]>();

    filteredIssues.forEach((issue) => {
      if (issue.is_duplicate && issue.duplicate_of_id) {
        const existing = dupMap.get(issue.duplicate_of_id) || [];
        dupMap.set(issue.duplicate_of_id, [...existing, issue]);
      } else {
        primaries.push(issue);
      }
    });

    return { primaryIssues: primaries, duplicatesMap: dupMap };
  }, [filteredIssues, groupByDuplicates]);

  // Statistics counters
  const criticalCount = issues.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length;
  const duplicateCount = issues.filter((i) => i.is_duplicate).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Executive Briefing Bar */}
      <DashboardHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Top Analytics Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Critical Issues</p>
              <h3 className="text-2xl font-black text-white">{criticalCount} Active</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-amber-950/80 border border-amber-800/80 rounded-xl text-amber-400">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI Duplicate Detection</p>
              <h3 className="text-2xl font-black text-white">{duplicateCount} Grouped</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Reports</p>
              <h3 className="text-2xl font-black text-white">{issues.length} Logged</h3>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold text-slate-300">Severity Filter:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-400 outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={groupByDuplicates}
                onChange={(e) => setGroupByDuplicates(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded focus:ring-amber-400"
              />
              <span>Group Duplicate Reports (Ubot AI)</span>
            </label>

            <button
              onClick={fetchIssues}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-all"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Issues List Feed */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mr-3" />
            <span className="text-lg font-medium">Connecting to CampusCare Realtime Feed...</span>
          </div>
        ) : primaryIssues.length === 0 ? (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-xl font-bold text-slate-300">No issues found matching current filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {primaryIssues.map((issue) => {
              const relatedDuplicates = duplicatesMap.get(issue.id) || [];

              return (
                <div key={issue.id} className="flex flex-col gap-2">
                  {/* Primary Issue Card */}
                  <IssueCard issue={issue} />

                  {/* Actions Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Status: <strong className="text-amber-400 uppercase">{issue.status}</strong></span>
                    <div className="flex gap-2">
                      {issue.status !== 'resolved' && (
                        <button
                          onClick={() => handleStatusUpdate(issue.id, 'resolved')}
                          className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg transition-all"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {issue.status === 'open' && (
                        <button
                          onClick={() => handleStatusUpdate(issue.id, 'investigating')}
                          className="bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg transition-all"
                        >
                          Investigate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested Grouped Duplicates */}
                  {groupByDuplicates && relatedDuplicates.length > 0 && (
                    <div className="ml-4 pl-4 border-l-2 border-amber-500/50 flex flex-col gap-2 mt-1">
                      <p className="text-xs font-semibold text-amber-400">
                        ↳ {relatedDuplicates.length} Related Duplicate Report(s)
                      </p>
                      {relatedDuplicates.map((dup) => (
                        <IssueCard key={dup.id} issue={dup} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}