'use client';

import React, { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';

export default function DashboardHeader() {
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);
  const [briefingAudioUrl, setBriefingAudioUrl] = useState<string | null>(null);

  const fetchDailyBriefing = async () => {
    setIsLoadingBriefing(true);
    try {
      const res = await fetch('/api/briefings/daily');
      const data = await res.json();
      if (data.audioUrl) setBriefingAudioUrl(data.audioUrl);
    } catch (err) {
      console.error("Failed to load audio briefing", err);
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          CampusCare <span className="text-amber-400">Intelligence</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Real-time AI Issue Triaging & Executive Briefing</p>
      </div>

      <div className="flex items-center gap-4 w-full md:w-auto">
        <button
          onClick={fetchDailyBriefing}
          disabled={isLoadingBriefing}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all shadow-md focus:ring-4 focus:ring-amber-300"
        >
          {isLoadingBriefing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
          <span>Play Daily Briefing</span>
        </button>

        {briefingAudioUrl && <audio controls src={briefingAudioUrl} autoPlay className="h-10 rounded-md" />}
      </div>
    </header>
  );
}