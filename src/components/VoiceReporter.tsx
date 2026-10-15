'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function VoiceReporter() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = handleAudioSubmission;
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setFeedbackMessage("Listening... Speak clearly about the issue and location.");
    } catch (err) {
      setFeedbackMessage("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setFeedbackMessage("Processing your voice report with CampusCare AI...");
    }
  };

  const handleAudioSubmission = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'report.webm');

    try {
      const res = await fetch('/api/reports/voice', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setFeedbackMessage(data.message || "Report submitted successfully!");
        if (data.elevenLabsAudioUrl) setAudioUrl(data.elevenLabsAudioUrl);
      } else {
        setFeedbackMessage("Failed to parse report. Please try again.");
      }
    } catch (error) {
      setFeedbackMessage("Network error. Please try submitting again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section aria-label="Voice Report Section" className="flex flex-col items-center justify-center p-8 bg-slate-800 rounded-3xl border-2 border-slate-700 max-w-xl mx-auto shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">CampusCare Voice Assist</h2>
      <p className="text-slate-300 mb-8 text-center text-lg">Tap the microphone below to report any issue hands-free.</p>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        aria-label={isRecording ? "Stop recording voice report" : "Start recording voice report"}
        className={`relative flex items-center justify-center w-44 h-44 rounded-full transition-all duration-300 focus:outline-none focus:ring-8 focus:ring-amber-400 ${
          isRecording ? 'bg-rose-600 animate-pulse scale-105' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg hover:scale-105'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isProcessing ? (
          <Loader2 className="w-20 h-20 animate-spin text-slate-900" />
        ) : isRecording ? (
          <Square className="w-20 h-20 text-white" />
        ) : (
          <Mic className="w-20 h-20 text-slate-950" />
        )}
      </button>

      <div aria-live="polite" className="mt-8 min-h-[60px] text-center px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 w-full">
        <p className="text-lg font-medium text-amber-300">
          {feedbackMessage || "Ready. Tap the microphone to begin."}
        </p>
      </div>

      {audioUrl && (
        <div className="mt-6 w-full">
          <p className="text-sm font-semibold text-slate-400 mb-2">Voice Confirmation:</p>
          <audio controls src={audioUrl} autoPlay className="w-full rounded-lg" />
        </div>
      )}
    </section>
  );
}