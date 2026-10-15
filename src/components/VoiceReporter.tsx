'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Camera, MapPin, Send, MessageSquare, AlertCircle } from 'lucide-react';

export default function VoiceReporter() {
  const [activeTab, setActiveTab] = useState<'voice' | 'text_image'>('voice');
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Text + Picture state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Location state
  const [locationText, setLocationText] = useState<string>('Detecting location...');
  const [isLocating, setIsLocating] = useState<boolean>(true);

  // Auto-detect user GPS location on component mount
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationText(`GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (Campus West)`);
          setIsLocating(false);
        },
        (error) => {
          console.warn("Geolocation failed, using default campus location:", error);
          setLocationText('Main Campus - Engineering Building');
          setIsLocating(false);
        },
        { timeout: 8000 }
      );
    } else {
      setLocationText('Main Campus - General Area');
      setIsLocating(false);
    }
  };

  // Image upload handling
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Voice Recording handlers
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
      setFeedbackMessage("Listening... Describe the problem and location clearly.");
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
    formData.append('location', locationText);

    try {
      const res = await fetch('/api/reports/voice', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setFeedbackMessage(data.message || "Voice report submitted successfully!");
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

  // Form Submission handler for Picture + Description
  const handleTextFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      setFeedbackMessage("Please provide a title and description.");
      return;
    }

    setIsProcessing(true);
    setFeedbackMessage("Submitting your visual report...");

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('location', locationText);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const res = await fetch('/api/reports/voice', { method: 'POST', body: formData });
      if (res.ok) {
        setFeedbackMessage("Report submitted successfully! Thank you for keeping campus safe.");
        setTitle('');
        setDescription('');
        setImageFile(null);
        setImagePreview(null);
      } else {
        setFeedbackMessage("Error submitting report. Please try again.");
      }
    } catch (err) {
      setFeedbackMessage("Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section aria-label="CampusCare Issue Reporting" className="flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-800 rounded-3xl border-2 border-slate-700 max-w-2xl w-full mx-auto shadow-2xl">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 text-center">
        CampusCare <span className="text-amber-400">Reporter</span>
      </h2>
      <p className="text-slate-300 mb-6 text-center text-sm sm:text-base">
        Report campus facilities or safety concerns instantly.
      </p>

      {/* GPS Location Indicator Badge */}
      <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300 text-xs sm:text-sm">
          <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
          <span className="font-medium text-slate-400">Location:</span>
          <span className="text-white font-semibold truncate max-w-[220px] sm:max-w-xs">{locationText}</span>
        </div>
        <button
          onClick={detectLocation}
          className="text-xs text-amber-400 hover:text-amber-300 font-bold underline ml-2"
        >
          {isLocating ? 'Locating...' : 'Refresh GPS'}
        </button>
      </div>

      {/* Toggle Tabs: Voice vs Picture + Description */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-700 w-full mb-8">
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'voice' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Voice Report</span>
        </button>
        <button
          onClick={() => setActiveTab('text_image')}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'text_image' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Photo & Text</span>
        </button>
      </div>

      {/* TAB 1: Voice Recording View */}
      {activeTab === 'voice' && (
        <div className="flex flex-col items-center w-full">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop recording voice report" : "Start recording voice report"}
            className={`relative flex items-center justify-center w-40 h-40 sm:w-44 sm:h-44 rounded-full transition-all duration-300 focus:outline-none focus:ring-8 focus:ring-amber-400 ${
              isRecording ? 'bg-rose-600 animate-pulse scale-105' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg hover:scale-105'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <Loader2 className="w-16 h-16 animate-spin text-slate-900" />
            ) : isRecording ? (
              <Square className="w-16 h-16 text-white" />
            ) : (
              <Mic className="w-16 h-16 text-slate-950" />
            )}
          </button>
          <p className="text-slate-400 text-xs mt-4">Tap to start/stop voice recording</p>
        </div>
      )}

      {/* TAB 2: Photo + Description Form View */}
      {activeTab === 'text_image' && (
        <form onSubmit={handleTextFormSubmit} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Issue Title</label>
            <input
              type="text"
              placeholder="e.g. Broken Elevator in Science Building"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Detailed Description</label>
            <textarea
              rows={3}
              placeholder="Describe the problem, severity, or safety hazard..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Upload Photo (Optional)</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-3 rounded-xl cursor-pointer text-xs font-semibold transition-all">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>{imageFile ? 'Change Photo' : 'Choose Photo'}</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {imageFile && <span className="text-xs text-emerald-400 truncate max-w-[150px]">{imageFile.name}</span>}
            </div>

            {imagePreview && (
              <div className="mt-3 relative w-full h-40 rounded-xl overflow-hidden border border-slate-700">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="mt-2 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            <span>Submit Report</span>
          </button>
        </form>
      )}

      {/* Live Status Feedback Box */}
      <div aria-live="polite" className="mt-6 min-h-[50px] text-center px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 w-full">
        <p className="text-sm font-medium text-amber-300">
          {feedbackMessage || "Ready to log campus report."}
        </p>
      </div>

      {audioUrl && (
        <div className="mt-4 w-full">
          <p className="text-xs font-semibold text-slate-400 mb-1">Voice Response:</p>
          <audio controls src={audioUrl} autoPlay className="w-full rounded-lg h-10" />
        </div>
      )}
    </section>
  );
}