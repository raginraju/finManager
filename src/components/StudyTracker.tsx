import { useEffect, useState, useMemo, useRef } from 'react';

export function StudyTracker() {
  // --- STATES ---
  const [isActive, setIsActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  
  const [totalSeconds, setTotalSeconds] = useState(() => {
    const saved = localStorage.getItem('study_vine_growth');
    return saved ? parseInt(saved, 10) : 0;
  });

  // --- REFS ---
  const lastTickRef = useRef(Date.now());
  const wakeLockRef = useRef<any>(null); // Uses 'any' to avoid strict TypeScript DOM errors

  // --- TIMER LOGIC (Timestamp Math for Mobile Sleep) ---
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

  // --- WAKE LOCK LOGIC (Keep Screen On) ---
  useEffect(() => {
    const manageWakeLock = async () => {
      if (keepScreenOn && isActive && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.error("Wake Lock error:", err);
        }
      } else if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {
          console.error("Wake Lock release error:", err);
        }
      }
    };
    manageWakeLock();

    // Auto-release if the component unmounts
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [keepScreenOn, isActive]);

  // --- FORMATTING ---
  const formatTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleResetSession = () => {
    setIsActive(false);
    setSessionSeconds(0);
  };

  // --- VINE MATH ---
  const secondsPerStage = 300; // 5 mins
  const maxStages = 24; // 2 hours
  
  const totalStagesCompleted = Math.floor(totalSeconds / secondsPerStage);
  const currentStageProgress = (totalSeconds % secondsPerStage) / secondsPerStage;
  const growthLevel = totalStagesCompleted + currentStageProgress;

  const seed = useMemo(() => Math.random() * 1000, []);

  const getXAtY = (y: number) => {
    const progress = (1000 - y) / 1000; 
    const wave1 = Math.sin((y + seed) * 0.015) * 45;
    const wave2 = Math.sin((y + seed * 2) * 0.033) * 20;
    return 150 + ((wave1 + wave2) * progress);
  };

  const stemPath = useMemo(() => {
    let path = `M 150 1000`; 
    for (let y = 990; y >= -50; y -= 10) {
      path += ` L ${getXAtY(y)} ${y}`;
    }
    return path;
  }, [seed]);

  const { leaves, branches } = useMemo(() => {
    const generatedLeaves = [];
    const generatedBranches = [];

    for (let i = 0; i < maxStages; i++) {
      const yPos = 950 - (i * 38);
      const basePathX = getXAtY(yPos); 
      const isLeft = i % 2 === 0;
      const direction = isLeft ? -1 : 1;

      if (i > 0 && i % 4 === 0) {
        const endX = basePathX + (direction * 70);
        const endY = yPos - 40;
        const controlX = basePathX + (direction * 50);
        const controlY = yPos + 10;
        
        generatedBranches.push({
          id: i,
          requiredGrowth: i,
          path: `M ${basePathX} ${yPos} Q ${controlX} ${controlY} ${endX} ${endY}`,
          endX,
          endY,
          direction
        });
      } else {
        const xPos = basePathX + (direction * 15);
        const rotation = isLeft ? -35 : 35;
        generatedLeaves.push({ id: i, xPos, yPos, rotation, requiredGrowth: i + 0.5 });
      }
    }
    
    return { leaves: generatedLeaves, branches: generatedBranches };
  }, [seed]);

  const pathLength = 1000; 
  const mainGrowthPercentage = Math.min(growthLevel / maxStages, 1);
  const mainDashOffset = pathLength - (pathLength * mainGrowthPercentage);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto space-y-6 mt-2 pb-10">
      
      <div className="flex flex-col md:flex-row items-center gap-6 w-full">
        
        {/* Left: Stopwatch UI */}
        <div className="flex-1 w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 md:p-8 text-center space-y-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-emerald-400">Deep Work Garden</h2>
            <p className="text-xs text-zinc-400">1 leaf = 5 mins. Max = 2 hours.</p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Current Session</p>
            <div className="text-5xl md:text-6xl font-mono font-light text-zinc-100 tracking-tight">
              {formatTime(sessionSeconds)}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => setIsActive(!isActive)}
              className={`px-6 py-3 rounded-full text-sm font-semibold transition-all w-full sm:w-auto ${
                isActive 
                  ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20' 
                  : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
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

          {/* Wake Lock Toggle */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <input 
              type="checkbox" 
              id="wakelock" 
              checked={keepScreenOn}
              onChange={(e) => setKeepScreenOn(e.target.checked)}
              className="accent-emerald-500 h-4 w-4 rounded bg-zinc-800 border-zinc-700"
            />
            <label htmlFor="wakelock" className="text-xs text-zinc-400 cursor-pointer">
              Keep screen turned on while focusing
            </label>
          </div>

          <div className="pt-6 border-t border-zinc-800/50 flex justify-between items-center px-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Total All-Time Focus</span>
            <span className="text-sm font-mono font-bold text-emerald-500">{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Right: The Vine Canvas (Mobile Constrained) */}
        <div className="relative w-full max-w-[300px] h-[450px] md:h-[550px] bg-gradient-to-b from-zinc-900/40 to-zinc-950 rounded-2xl border border-zinc-800/50 shadow-inner overflow-hidden flex justify-center items-end shrink-0 mx-auto">
          <svg 
            viewBox="0 0 300 1000" 
            className="w-full h-full absolute bottom-0 drop-shadow-lg"
            preserveAspectRatio="xMidYMax slice"
          >
            {/* Background Shadow Stem */}
            <path d={stemPath} fill="transparent" stroke="#18181b" strokeWidth="12" strokeLinejoin="round" />

            {/* Branches Layer */}
            {branches.map((branch) => {
              const branchGrowthRaw = (growthLevel - branch.requiredGrowth) / 2;
              const branchProgress = Math.max(0, Math.min(branchGrowthRaw, 1));
              const branchOffset = 100 - (100 * branchProgress);

              return (
                <g key={`branch-group-${branch.id}`}>
                  <path
                    d={branch.path}
                    fill="transparent"
                    stroke="#059669"
                    strokeWidth="5"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="100"
                    strokeDashoffset={branchOffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                  <g 
                    className="transition-all duration-1000 ease-out origin-center"
                    style={{
                      transform: `translate(${branch.endX + (branch.direction * 5)}px, ${branch.endY + 15}px) scale(${branchProgress === 1 ? 1 : 0})`,
                      opacity: branchProgress === 1 ? 1 : 0
                    }}
                  >
                    <circle cx="0" cy="0" r="10" fill="#8b5cf6" />
                    <circle cx="16" cy="0" r="10" fill="#8b5cf6" />
                    <circle cx="8" cy="12" r="10" fill="#a78bfa" />
                    <circle cx="8" cy="24" r="8" fill="#8b5cf6" />
                    <path d="M 8 -5 Q 15 -15 20 -5 Q 12 0 8 -5 Z" fill="#34d399" />
                  </g>
                </g>
              );
            })}

            {/* Animated Organic Main Stem */}
            <path
              d={stemPath}
              fill="transparent"
              stroke="#34d399"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={pathLength}
              strokeDasharray={pathLength}
              strokeDashoffset={mainDashOffset}
              className="transition-all duration-1000 ease-linear"
            />

            {/* Normal Leaves Layer */}
            {leaves.map((leaf) => (
              <g 
                key={`leaf-${leaf.id}`} 
                className="transition-all duration-1000 ease-out origin-center"
                style={{
                  transform: `translate(${leaf.xPos}px, ${leaf.yPos}px) rotate(${leaf.rotation}deg) scale(${growthLevel >= leaf.requiredGrowth ? 1 : 0})`,
                  opacity: growthLevel >= leaf.requiredGrowth ? 1 : 0
                }}
              >
                <path d="M 0 0 Q 20 -20 40 0 Q 20 20 0 0 Z" fill="#10b981" stroke="#059669" strokeWidth="2" />
              </g>
            ))}
          </svg>
          
          <div className="absolute bottom-0 w-full h-10 bg-amber-900/20 border-t border-amber-900/40 backdrop-blur-sm z-10" />
        </div>

      </div>
    </div>
  );
}