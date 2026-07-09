import { useEffect, useState, useRef } from 'react';

export function StudyTracker() {
  // --- STATES ---
  const [isActive, setIsActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  
  // 💡 NEW: Added 'zendrive' to the theme options!
  const [activeTheme, setActiveTheme] = useState<'crystal' | 'pillar' | 'mountain' | 'zendrive'>('zendrive');
  const [goalMinutes, setGoalMinutes] = useState(120); 
  
  const [totalSeconds, setTotalSeconds] = useState(() => {
    const saved = localStorage.getItem('study_vine_growth');
    return saved ? parseInt(saved, 10) : 0;
  });

  const lastTickRef = useRef(Date.now());
  const wakeLockRef = useRef<any>(null);

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive) {
      lastTickRef.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const elapsedMs = now - lastTickRef.current;
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        if (elapsedSecs > 0) {
          setSessionSeconds((prev) => prev + elapsedSecs);
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

  // --- FORMATTING & MATH ---
  const formatTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleResetSession = () => {
    setIsActive(false);
    setTotalSeconds((prev) => {
      const revertedTotal = Math.max(0, prev - sessionSeconds);
      localStorage.setItem('study_vine_growth', revertedTotal.toString());
      return revertedTotal;
    });
    setSessionSeconds(0);
  };

  // 💡 PROGRESS MATH (0.0 to 1.0)
  const goalSeconds = goalMinutes * 60;
  const sessionProgress = Math.min(sessionSeconds / goalSeconds, 1);

  // ==========================================================================
  // 💡 NON-CIRCULAR THEME RENDERING ENGINE
  // ==========================================================================
  const renderTheme = () => {
    
    if (activeTheme === 'zendrive') {
      // 💡 THE ZEN DRIVE: Hypnotic forward motion into a flow state
      return (
        <>
          <style>{`
            @keyframes warp-forward {
              0% { transform: scale(0.1); opacity: 0; stroke-width: 1px; }
              20% { opacity: 0.6; }
              100% { transform: scale(6); opacity: 0; stroke-width: 4px; }
            }
            @keyframes spin-core {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .drive-ring-1 { animation: warp-forward 10s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
            .drive-ring-2 { animation: warp-forward 10s cubic-bezier(0.4, 0, 0.2, 1) infinite 2.5s; }
            .drive-ring-3 { animation: warp-forward 10s cubic-bezier(0.4, 0, 0.2, 1) infinite 5s; }
            .drive-ring-4 { animation: warp-forward 10s cubic-bezier(0.4, 0, 0.2, 1) infinite 7.5s; }
            .spin-core { animation: spin-core 20s linear infinite; }
          `}</style>
          <svg viewBox="0 0 300 550" className="w-full h-full absolute top-0 left-0 drop-shadow-2xl">
            <defs>
              <filter id="glow-drive" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <g transform="translate(150, 275)">
              
              {/* The Flow Tunnel (Rings coming toward you) */}
              <circle className="drive-ring-1" cx="0" cy="0" r="40" fill="none" stroke="#2dd4bf" /> {/* Teal */}
              <circle className="drive-ring-2" cx="0" cy="0" r="40" fill="none" stroke="#38bdf8" /> {/* Sky Blue */}
              <circle className="drive-ring-3" cx="0" cy="0" r="40" fill="none" stroke="#818cf8" /> {/* Indigo */}
              <circle className="drive-ring-4" cx="0" cy="0" r="40" fill="none" stroke="#c084fc" /> {/* Purple */}

              {/* The Destination Core (Expands as you near your goal) */}
              <g filter="url(#glow-drive)" className="spin-core">
                {/* Inner Bright Diamond */}
                <polygon 
                  points="0,-12 12,0 0,12 -12,0" 
                  fill="#f8fafc" 
                  opacity={0.3 + (sessionProgress * 0.7)} 
                  transform={`scale(${1 + (sessionProgress * 3)})`} 
                />
                {/* Outer Framing Square */}
                <rect 
                  x="-12" y="-12" width="24" height="24" 
                  fill="none" stroke="#94a3b8" strokeWidth="1" 
                  transform={`scale(${1 + (sessionProgress * 4.5)}) rotate(45)`} 
                  opacity={0.4 + (sessionProgress * 0.6)}
                />
              </g>

            </g>
          </svg>
        </>
      );
    }

    if (activeTheme === 'crystal') {
      return (
        <>
          <style>{`
            @keyframes float-crystal { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
            @keyframes shard-rise-1 { 0% { transform: translateY(0px) rotate(0deg); opacity: 0; } 20% { opacity: 0.8; } 100% { transform: translateY(-150px) rotate(180deg); opacity: 0; } }
            @keyframes shard-rise-2 { 0% { transform: translateY(0px) rotate(45deg); opacity: 0; } 30% { opacity: 0.6; } 100% { transform: translateY(-180px) rotate(-90deg); opacity: 0; } }
            .anim-float { animation: float-crystal 6s ease-in-out infinite; }
            .anim-shard-1 { animation: shard-rise-1 4s infinite linear; }
            .anim-shard-2 { animation: shard-rise-2 5.5s infinite linear 2s; }
          `}</style>
          <svg viewBox="0 0 300 550" className="w-full h-full absolute top-0 left-0 drop-shadow-2xl">
            <defs>
              <clipPath id="crystal-fill">
                <rect x="0" y={450 - (sessionProgress * 350)} width="300" height="400" />
              </clipPath>
              <filter id="glow-crystal" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <g fill="#a855f7" stroke="#d8b4fe" strokeWidth="1">
              <polygon points="60,350 70,360 60,370 50,360" className="anim-shard-1" />
              <polygon points="240,400 245,415 230,420" className="anim-shard-2" />
            </g>
            <g className="anim-float">
              <g stroke="#4c1d95" strokeWidth="2" fill="none">
                <polygon points="150,100 230,275 150,450 70,275" />
                <polyline points="150,100 150,450" />
                <polyline points="70,275 230,275" />
              </g>
              <g clipPath="url(#crystal-fill)" filter="url(#glow-crystal)">
                <polygon points="150,100 70,275 150,275" fill="#7c3aed" opacity="0.9" />
                <polygon points="150,100 230,275 150,275" fill="#a78bfa" opacity="0.9" />
                <polygon points="150,450 70,275 230,275" fill="#8b5cf6" opacity="0.8" />
                <polyline points="150,100 150,450" stroke="#f3e8ff" strokeWidth="2" />
              </g>
            </g>
          </svg>
        </>
      );
    }
    
    if (activeTheme === 'pillar') {
      return (
        <>
          <style>{`
            @keyframes pulse-core { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
            @keyframes glitch-line { 0%, 100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(-20px); opacity: 0.1; } }
            .anim-pulse { animation: pulse-core 3s ease-in-out infinite; }
            .anim-glitch { animation: glitch-line 2s linear infinite; }
          `}</style>
          <svg viewBox="0 0 300 550" className="w-full h-full absolute top-0 left-0 drop-shadow-2xl">
            <defs>
              <filter id="glow-pillar">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <g transform="translate(150, 480)">
              <rect x="-40" y="-400" width="80" height="420" fill="none" stroke="#064e3b" strokeWidth="4" />
              <line x1="-50" y1="-410" x2="-20" y2="-410" stroke="#10b981" strokeWidth="2" />
              <line x1="20" y1="-410" x2="50" y2="-410" stroke="#10b981" strokeWidth="2" />
              <rect x="-35" y="-395" width="70" height="410" fill="none" stroke="#047857" strokeWidth="1" strokeDasharray="10 5" />
              <rect x="-30" y={-10 - (sessionProgress * 380)} width="60" height={Math.max(0.1, sessionProgress * 380)} fill="#34d399" filter="url(#glow-pillar)" className="anim-pulse" />
              <line x1="-30" y1="-200" x2="30" y2="-200" stroke="#a7f3d0" strokeWidth="2" className="anim-glitch" />
            </g>
          </svg>
        </>
      );
    }

    if (activeTheme === 'mountain') {
      return (
        <>
          <style>{`
            @keyframes pulse-star { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.3); opacity: 1; } }
            @keyframes slow-breathe { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.9; } }
            .anim-star { animation: pulse-star 4s ease-in-out infinite; transform-origin: center; }
            .anim-breathe { animation: slow-breathe 8s ease-in-out infinite; }
          `}</style>
          <svg viewBox="0 0 300 550" className="w-full h-full absolute top-0 left-0">
            <defs>
              <filter id="glow-star">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <polygon points="10,550 150,250 290,550" fill="#1e293b" className="anim-breathe" />
            <polygon points="150,250 290,550 150,550" fill="#0f172a" />
            <polygon points="-20,550 80,380 180,550" fill="#334155" />
            <polygon points="130,550 240,320 330,550" fill="#475569" />
            <line x1="150" y1="520" x2="150" y2="120" stroke="#64748b" strokeWidth="1" strokeDasharray="5 5" />
            <g transform={`translate(150, ${520 - (sessionProgress * 400)})`} filter="url(#glow-star)" className="anim-star">
               <polygon points="0,-12 8,0 0,12 -8,0" fill="#fde047" />
               <polygon points="-12,0 0,-4 12,0 0,4" fill="#fef08a" />
            </g>
          </svg>
        </>
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto space-y-6 mt-2 pb-10">
      
      <div className="flex flex-col md:flex-row items-center gap-6 w-full">
        
        {/* Left: Stopwatch UI */}
        <div className="flex-1 w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 md:p-8 text-center space-y-6 shadow-sm">
          
          <div className="flex justify-between items-start">
            <div className="space-y-1 text-left">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Deep Work Zen</h2>
              <p className="text-xs text-zinc-400">Your geometry aligns as you near your target.</p>
            </div>
            
            {/* 💡 THEME SELECTOR */}
            <select
              value={activeTheme}
              onChange={(e) => setActiveTheme(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer hover:bg-zinc-900 transition-colors"
            >
              <option value="zendrive">Zen Drive</option>
              <option value="crystal">Floating Crystal</option>
              <option value="pillar">Energy Pillar</option>
              <option value="mountain">Zen Mountain</option>
            </select>
          </div>

          <div className="space-y-2 pt-4">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Current Session</p>
            <div className="text-5xl md:text-6xl font-mono font-light text-zinc-100 tracking-tight">
              {formatTime(sessionSeconds)}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2 pb-4 w-full max-w-[240px] mx-auto">
            <div className="flex justify-between w-full items-end px-1">
              <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Target Time</label>
              <span className="text-sm font-bold text-zinc-300">
                {goalMinutes} <span className="text-[10px] text-zinc-500 uppercase font-medium">mins</span>
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="300"
              step="5"
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(Number(e.target.value))}
              disabled={isActive}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setIsActive(!isActive)}
              className={`px-6 py-3 rounded-full text-sm font-semibold transition-all w-full sm:w-auto ${
                isActive 
                  ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20' 
                  : 'bg-zinc-100 text-zinc-950 hover:bg-white shadow-md shadow-zinc-100/10'
              }`}
            >
              {isActive ? 'Pause Focus' : 'Start Focus'}
            </button>
            <button
              onClick={handleResetSession}
              disabled={isActive && sessionSeconds === 0}
              className="px-6 py-3 rounded-full text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-all border border-zinc-700/50 w-full sm:w-auto"
            >
              Reset Session
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-4">
            <input 
              type="checkbox" 
              id="wakelock" 
              checked={keepScreenOn}
              onChange={(e) => setKeepScreenOn(e.target.checked)}
              className="accent-zinc-500 h-4 w-4 rounded bg-zinc-800 border-zinc-700"
            />
            <label htmlFor="wakelock" className="text-xs text-zinc-400 cursor-pointer">
              Keep screen turned on while focusing
            </label>
          </div>

          <div className="pt-6 border-t border-zinc-800/50 flex justify-between items-center px-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Total All-Time Focus</span>
            <span className="text-sm font-mono font-bold text-zinc-300">{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Right: The Geometry Canvas */}
        <div className="relative w-full max-w-[300px] h-[450px] md:h-[550px] bg-gradient-to-b from-zinc-900/40 to-zinc-950 rounded-2xl border border-zinc-800/50 shadow-inner overflow-hidden flex justify-center items-center shrink-0 mx-auto">
          {renderTheme()}
        </div>

      </div>
    </div>
  );
}