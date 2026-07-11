import { useEffect, useState, useRef } from 'react';
import { useWealthStore } from '../store/useWealthStore';

export function StudyTracker() {

  const { studyLogs, addStudyLog, clearStudyLogs } = useWealthStore();

  const [isActive, setIsActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [keepScreenOn, setKeepScreenOn] = useState(true); // Armed by default for mobile workflow stability
  const [goalMinutes, setGoalMinutes] = useState(60); 
  const [showClock, setShowClock] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(true);

  const sessionStartRef = useRef<number | null>(null);
  const lastTickRef = useRef(Date.now());
  const wakeLockRef = useRef<any>(null);
  const controlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computes all-time focus records straight out of synced SQLite rows
  const totalSeconds = studyLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0) + (isActive ? sessionSeconds : 0);

  const presets = [
    { label: '15m', mins: 15 },
    { label: '30m', mins: 30 },
    { label: '45m', mins: 45 },
    { label: '60m', mins: 60 },
    { label: '1.5h', mins: 90 },
    { label: '2.0h', mins: 120 },
  ];

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive) {
      lastTickRef.current = Date.now();
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
      
      interval = setInterval(() => {
        const now = Date.now();
        const elapsedMs = now - lastTickRef.current;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        
        if (elapsedSecs > 0) {
          setSessionSeconds((prev) => {
            const nextSeconds = prev + elapsedSecs;
            if (nextSeconds > 0 && nextSeconds % 60 === 0) {
              setShowClock(true);
            }
            return nextSeconds;
          });
          lastTickRef.current += elapsedSecs * 1000;
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // AUTO-HIDE CLOCK WINDOW
  useEffect(() => {
    if (showClock) {
      const timer = setTimeout(() => setShowClock(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showClock]);

  // AUTO-HIDE CONTROLS VIA TIMEOUT
  useEffect(() => {
    if (isActive && showMobileControls) {
      if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
      controlTimeoutRef.current = setTimeout(() => {
        setShowMobileControls(false);
      }, 5000);
    }
    return () => { if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current); };
  }, [isActive, showMobileControls]);

  // --- WAKE LOCK LOGIC ---
  useEffect(() => {
    const manageWakeLock = async () => {
      if (keepScreenOn && isActive && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (err) {}
      } else if (wakeLockRef.current) {
        try { await wakeLockRef.current.release(); wakeLockRef.current = null; } catch (err) {}
      }
    };
    manageWakeLock();
    return () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); } };
  }, [keepScreenOn, isActive]);

  const handleToggleActive = async () => {
    if (isActive) {
      if (sessionSeconds > 0 && sessionStartRef.current) {
        await addStudyLog({
          startTime: new Date(sessionStartRef.current).toISOString(),
          endTime: new Date().toISOString(),
          durationSeconds: sessionSeconds
        });
      }
      setIsActive(false);
      setShowClock(false);
      sessionStartRef.current = null;
    } else {
      lastTickRef.current = Date.now();
      sessionStartRef.current = Date.now();
      setIsActive(true);
      setShowMobileControls(true);
    }
  };

  const handleResetSession = () => {
    setIsActive(false);
    setShowClock(false);
    setSessionSeconds(0);
    sessionStartRef.current = null;
  };

  // 💡 NEW FEATURE: Safe structural confirmation method to scrub historical target test rows cleanly
  const handleDeleteHistory = async () => {
    const isConfirmed = window.confirm("Are you sure you want to completely purge all focus time history logs? This cannot be undone.");
    if (isConfirmed && clearStudyLogs) {
      await clearStudyLogs();
    }
  };

  const handleCanvasTap = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setShowMobileControls(prev => !prev);
  };

  const formatTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const sessionProgress = Math.min(sessionSeconds / (goalMinutes * 60), 1);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-6 mt-2 pb-10 px-4 text-base">
      
      {/* ==========================================
          STANDARD CONTROL CONTAINER (Hidden when focusing)
          ========================================== */}
      {!isActive && (
        <>
          {/* VIBRANT GLOWING LINE GRAPH */}
          <div className="w-full h-36 bg-zinc-900/60 rounded-2xl p-5 border border-zinc-800 shadow-lg shadow-emerald-500/5 transition-all">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Study Momentum History</p>
            <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="neonGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                fill="url(#neonGlow)"
                d={studyLogs && studyLogs.length > 0 
                  ? `M 0,60 ${studyLogs.map((s, i) => `${i * (200 / Math.max(1, studyLogs.length - 1))},${60 - Math.min(55, (s.durationSeconds || 0) / 60)}`).join(' ')} L 200,60 Z`
                  : "M 0,60 L 200,60 Z"}
              />
              <polyline 
                fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                points={studyLogs && studyLogs.length > 0 
                  ? studyLogs.map((s, i) => `${i * (200 / Math.max(1, studyLogs.length - 1))},${60 - Math.min(55, (s.durationSeconds || 0) / 60)}`).join(' ') 
                  : "0,60 200,60"} 
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              />
            </svg>
          </div>

          {/* STOPWATCH CONTROLS LAYOUT */}
          <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 md:p-8 text-center space-y-6 backdrop-blur-md shadow-xl">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Deep Work Zen</h2>
              <p className="text-xs text-zinc-400">Select your focus matrix intervals before dropping into hyper-focus.</p>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Focus Stack Buffer</p>
              <div className="text-5xl font-mono font-black text-emerald-400 tracking-tight drop-shadow-[0_0_12px_rgba(52,211,153,0.25)]">{formatTime(sessionSeconds)}</div>
            </div>

            {/* TIME PRESET SELECTOR BUTTONS */}
            <div className="space-y-2 max-w-md mx-auto">
              <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block text-center">Interval Target Duration</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {presets.map((preset) => {
                  const isSelected = goalMinutes === preset.mins;
                  return (
                    <button
                      key={preset.label} type="button" onClick={() => setGoalMinutes(preset.mins)}
                      className={`py-3 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                        isSelected 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400 shadow-md shadow-emerald-500/10 scale-105'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <button onClick={handleToggleActive} className="px-12 py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-400 to-teal-400 text-zinc-950 hover:brightness-110 shadow-lg shadow-emerald-500/10 uppercase tracking-wider transition-transform active:scale-95">
                Start Focus
              </button>
              <button onClick={handleResetSession} disabled={sessionSeconds === 0} className="px-8 py-3.5 rounded-xl text-sm font-black bg-zinc-950 text-zinc-400 border border-zinc-800 hover:bg-zinc-900 disabled:opacity-30 transition-all uppercase tracking-wider">
                Reset
              </button>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <input type="checkbox" id="wakelock" checked={keepScreenOn} onChange={(e) => setKeepScreenOn(e.target.checked)} className="accent-emerald-400 h-4 w-4 rounded bg-zinc-800 border-zinc-700" />
              <label htmlFor="wakelock" className="text-xs text-zinc-400 font-medium cursor-pointer select-none">Keep screen turned on while focusing</label>
            </div>

            {/* 💡 STRUCTURAL FOOTER PANEL WITH ADDED PURGE TRIGGER ACTION ELEMENT */}
            <div className="pt-6 border-t border-zinc-800/60 flex justify-between items-center px-2">
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total Cloud-Synced Focus</span>
                <span className="text-base font-mono font-black text-zinc-100 mt-0.5">{formatTime(totalSeconds)}</span>
              </div>
              
              {/* 💡 PURGE BUTTON DESIGNED SPECIFICALLY FOR REMOVING TEST RUN DATA DUMP LOADS */}
              {totalSeconds > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteHistory}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95"
                  title="Wipe logged study intervals from database completely."
                >
                  Clear Logs
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==========================================
          💡 IMMERSIVE DEEP FOCUS MODE (Full Screen Overlay)
          ========================================== */}
      {isActive && (
        <div 
          onClick={handleCanvasTap} onTouchStart={handleCanvasTap}
          className="fixed inset-0 bg-zinc-950 z-50 flex flex-col justify-between overflow-hidden animate-fade-in select-none cursor-pointer"
        >
          {/* HIGH VIBRANCY HIGH-PERFORMANCE NEON ZEN CANVAS */}
          <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
            <style>{`
              @keyframes warp-forward {
                0% { transform: scale(0.05); opacity: 0; stroke-width: 0.75px; }
                10% { opacity: 0.9; }
                90% { opacity: 0.5; }
                100% { transform: scale(5.5); opacity: 0; stroke-width: 4px; }
              }
              @keyframes spin-core { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .drive-ring-1 { animation: warp-forward 7s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite; }
              .drive-ring-2 { animation: warp-forward 7s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 1.75s; }
              .drive-ring-3 { animation: warp-forward 7s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 3.5s; }
              .drive-ring-4 { animation: warp-forward 7s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 5.25s; }
              .spin-core { animation: spin-core 20s linear infinite; transform-origin: center; }
            `}</style>
            
            <svg viewBox="0 0 300 300" className="w-full h-full max-w-[85vh] max-h-[85vh] drop-shadow-[0_0_60px_rgba(16,185,129,0.3)]">
              <defs>
                <filter id="glow-drive" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <g transform="translate(150, 150)">
                <circle className="drive-ring-1" cx="0" cy="0" r="40" fill="none" stroke="#10b981" />
                <circle className="drive-ring-2" cx="0" cy="0" r="40" fill="none" stroke="#06b6d4" />
                <circle className="drive-ring-3" cx="0" cy="0" r="40" fill="none" stroke="#6366f1" />
                <circle className="drive-ring-4" cx="0" cy="0" r="40" fill="none" stroke="#a855f7" />
                <g filter="url(#glow-drive)" className="spin-core">
                  <polygon points="0,-12 12,0 0,12 -12,0" fill="#f8fafc" opacity={0.35 + (sessionProgress * 0.65)} transform={`scale(${1 + (sessionProgress * 2.5)})`} />
                  <rect x="-10" y="-10" width="20" height="20" fill="none" stroke="#a7f3d0" strokeWidth="1" transform={`scale(${1 + (sessionProgress * 3.8)}) rotate(45)`} opacity={0.4 + (sessionProgress * 0.6)} />
                </g>
              </g>
            </svg>
          </div>

          {/* HEADS-UP PERFORMANCE RADAR FEEDBACK PANEL */}
          <div className={`w-full p-6 text-center z-10 bg-gradient-to-b from-zinc-950/90 to-transparent backdrop-blur-xs transition-all duration-300 transform ${
            showMobileControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}>
            <span className="text-xs font-black tracking-widest text-emerald-400 border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 rounded-full uppercase shadow-lg shadow-emerald-500/5 animate-pulse">
              • Running Flow Session
            </span>
            <div className="text-4xl font-mono text-zinc-100 mt-4 tracking-wider font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]">
              {formatTime(sessionSeconds)}
            </div>
          </div>

          {/* AUTOMATED MINUTE NOTIFIER ALIGNMENT MATRIX */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-1000 transform text-center ${
            showClock && !showMobileControls ? 'opacity-90 scale-100 blur-0' : 'opacity-0 scale-95 blur-md'
          }`}>
            <p className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">Time Elapsed</p>
            <div className="text-6xl md:text-7xl font-mono font-black text-zinc-50 tracking-widest drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              {formatTime(sessionSeconds)}
            </div>
          </div>

          {/* INTERACTION OVERLAY CLOSURE DRAWER */}
          <div className={`w-full pb-12 pt-6 px-4 text-center z-10 bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-transparent transition-all duration-300 transform flex flex-col items-center gap-3 ${
            showMobileControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}>
            <p className="text-xs text-zinc-500 font-medium tracking-wide">Tap background empty space safely to toggle UI dashboard panels.</p>
            <button 
              onClick={handleToggleActive} 
              className="px-12 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-xl text-xs font-black uppercase tracking-widest backdrop-blur-md shadow-2xl transition-transform active:scale-95 pointer-events-auto cursor-pointer"
            >
              End Focus Session
            </button>
          </div>
        </div>
      )}

    </div>
  );
}