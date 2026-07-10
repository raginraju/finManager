import { useEffect, useState, useRef } from 'react';
import { useWealthStore } from '../store/useWealthStore';

export function StudyTracker() {
  const { studyLogs, addStudyLog } = useWealthStore();

  const [isActive, setIsActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [goalMinutes, setGoalMinutes] = useState(120); 
  const [showClock, setShowClock] = useState(false);

  const [totalSeconds, setTotalSeconds] = useState(() => {
    const saved = localStorage.getItem('study_vine_growth');
    return saved ? parseInt(saved, 10) : 0;
  });

  const sessionStartRef = useRef<number | null>(null);
  const lastTickRef = useRef(Date.now());
  const wakeLockRef = useRef<any>(null);

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
            
            // 💡 Trigger the clock visibility overlay exactly every 60 seconds (1 minute)
            if (nextSeconds > 0 && nextSeconds % 60 === 0) {
              setShowClock(true);
            }
            return nextSeconds;
          });

          setTotalSeconds((prev) => {
            const newTotal = prev + elapsedSecs;
            localStorage.setItem('study_vine_growth', newTotal.toString());
            return newTotal;
          });
          lastTickRef.current += elapsedSecs * 1000;
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // 💡 AUTO-HIDE CLOCK WINDOW: Keeps the clock display up for exactly 3 seconds before fading out
  useEffect(() => {
    if (showClock) {
      const timer = setTimeout(() => setShowClock(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showClock]);

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
    }
  };

  const handleResetSession = () => {
    setIsActive(false);
    setShowClock(false);
    setTotalSeconds((prev) => {
      const revertedTotal = Math.max(0, prev - sessionSeconds);
      localStorage.setItem('study_vine_growth', revertedTotal.toString());
      return revertedTotal;
    });
    setSessionSeconds(0);
    sessionStartRef.current = null;
  };

  const formatTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const sessionProgress = Math.min(sessionSeconds / (goalMinutes * 60), 1);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-6 mt-2 pb-10 px-4">
      
      {/* ==========================================
          STANDARD CONTROL CONTAINER (Hidden when focusing)
          ========================================== */}
      {!isActive && (
        <>
          {/* LINE GRAPH */}
          <div className="w-full h-32 bg-zinc-900/60 rounded-xl p-4 border border-zinc-800 transition-all">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Study Momentum (Seconds)</p>
            <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible">
              <polyline 
                fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round"
                points={studyLogs && studyLogs.length > 0 
                  ? studyLogs.map((s, i) => `${i * (200 / Math.max(1, studyLogs.length - 1))},${60 - Math.min(55, (s.durationSeconds || 0) / 60)}`).join(' ') 
                  : "0,60 200,60"} 
              />
            </svg>
          </div>

          {/* STOPWATCH CONTROLS LAYOUT */}
          <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 md:p-8 text-center space-y-6">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Deep Work Zen</h2>
              <p className="text-xs text-zinc-400">Configure your target work metrics before dropping into hyper-focus.</p>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Previous Session State</p>
              <div className="text-5xl font-mono font-light text-zinc-400 tracking-tight">{formatTime(sessionSeconds)}</div>
            </div>

            <div className="flex flex-col items-center gap-2 max-w-[240px] mx-auto">
              <div className="flex justify-between w-full items-end px-1">
                <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Target Time</label>
                <span className="text-sm font-bold text-zinc-300">{goalMinutes} <span className="text-[10px] text-zinc-500 uppercase font-medium">mins</span></span>
              </div>
              <input
                type="range" min="5" max="300" step="5" value={goalMinutes}
                onChange={(e) => setGoalMinutes(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={handleToggleActive} className="px-10 py-3 rounded-full text-sm font-semibold bg-zinc-100 text-zinc-950 hover:bg-white shadow-md font-medium tracking-wide">
                Start Focus
              </button>
              <button onClick={handleResetSession} disabled={sessionSeconds === 0} className="px-6 py-3 rounded-full text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 transition-all border border-zinc-700/50">
                Reset
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <input type="checkbox" id="wakelock" checked={keepScreenOn} onChange={(e) => setKeepScreenOn(e.target.checked)} className="accent-teal-400 h-4 w-4 rounded bg-zinc-800 border-zinc-700" />
              <label htmlFor="wakelock" className="text-xs text-zinc-400 cursor-pointer select-none">Keep screen turned on while focusing</label>
            </div>

            <div className="pt-6 border-t border-zinc-800/50 flex justify-between items-center px-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Total All-Time Focus</span>
              <span className="text-sm font-mono font-bold text-zinc-300">{formatTime(totalSeconds)}</span>
            </div>
          </div>
        </>
      )}

      {/* ==========================================
          💡 IMMERSIVE DEEP FOCUS MODE (Full Screen Overlay)
          ========================================== */}
      {isActive && (
        <div className="fixed inset-0 bg-zinc-950 z-50 flex items-center justify-center overflow-hidden animate-fade-in select-none">
          
          {/* THE HYPNOTIC ZEN DRIVE CANVAS */}
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <style>{`
              @keyframes warp-forward {
                0% { transform: scale(0.05); opacity: 0; stroke-width: 0.5px; }
                10% { opacity: 0.7; }
                90% { opacity: 0.4; }
                100% { transform: scale(5.5); opacity: 0; stroke-width: 3.5px; }
              }
              @keyframes spin-core { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .drive-ring-1 { animation: warp-forward 8s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite; }
              .drive-ring-2 { animation: warp-forward 8s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 2s; }
              .drive-ring-3 { animation: warp-forward 8s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 4s; }
              .drive-ring-4 { animation: warp-forward 8s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 6s; }
              .spin-core { animation: spin-core 25s linear infinite; transform-origin: center; }
            `}</style>
            
            <svg viewBox="0 0 300 300" className="w-full h-full max-w-[85vh] max-h-[85vh] drop-shadow-[0_0_50px_rgba(45,212,191,0.15)]">
              <defs>
                <filter id="glow-drive" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <g transform="translate(150, 150)">
                <circle className="drive-ring-1" cx="0" cy="0" r="40" fill="none" stroke="#2dd4bf" />
                <circle className="drive-ring-2" cx="0" cy="0" r="40" fill="none" stroke="#38bdf8" />
                <circle className="drive-ring-3" cx="0" cy="0" r="40" fill="none" stroke="#818cf8" />
                <circle className="drive-ring-4" cx="0" cy="0" r="40" fill="none" stroke="#c084fc" />
                <g filter="url(#glow-drive)" className="spin-core">
                  <polygon points="0,-10 10,0 0,10 -10,0" fill="#f8fafc" opacity={0.25 + (sessionProgress * 0.75)} transform={`scale(${1 + (sessionProgress * 2.5)})`} />
                  <rect x="-10" y="-10" width="20" height="20" fill="none" stroke="#94a3b8" strokeWidth="0.75" transform={`scale(${1 + (sessionProgress * 3.8)}) rotate(45)`} opacity={0.3 + (sessionProgress * 0.7)} />
                </g>
              </g>
            </svg>
          </div>

          {/* 💡 TIMED INTERVAL CLOCK DISPLAY (Fades in every 60 seconds) */}
          <div className={`absolute pointer-events-none transition-all duration-1000 transform text-center ${
            showClock ? 'opacity-80 scale-100 blur-0' : 'opacity-0 scale-95 blur-md'
          }`}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-1">Time Elapsed</p>
            <div className="text-6xl md:text-7xl font-mono font-extralight text-zinc-100 tracking-wider">
              {formatTime(sessionSeconds)}
            </div>
          </div>

          {/* INTERACTION OVERLAY LAYER (Hovering/Tapping shows exit control button) */}
          <div className="absolute inset-0 flex flex-col justify-end items-center pb-12 opacity-0 hover:opacity-100 focus-within:opacity-100 active:opacity-100 transition-opacity duration-300">
            <button 
              onClick={handleToggleActive} 
              className="px-8 py-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-full text-xs font-semibold uppercase tracking-widest backdrop-blur-md shadow-2xl transition-all pointer-events-auto cursor-pointer active:scale-95"
            >
              End Focus Session
            </button>
          </div>

        </div>
      )}

    </div>
  );
}