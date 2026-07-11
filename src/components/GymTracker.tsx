import React, { useState } from 'react';
import { useWealthStore } from '../store/useWealthStore';
import { PRESSABLE_CLASS, PRESSABLE_SOFT_CLASS } from '../util/pressable';
import { type GymLog } from '../db';

type WorkoutCategory = 'Push' | 'Pull' | 'Legs';

export function GymTracker() {
  const { gymExercises, gymLogs, addGymExercise, addGymLog, deleteGymLog } = useWealthStore();

  // Core Form Management
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('Push');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [workoutDate, setWorkoutDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState('');

  // Custom Exercise Builder State
  const [newExerciseName, setNewExerciseName] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Collapsed State Tracking for Day Groups
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return { [todayStr]: true }; // Automatically expand today's group by default
  });

  // Inline Editing Management State
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editNote, setEditNote] = useState('');

  const currentCategoryExercises = gymExercises.filter(ex => ex.category === selectedCategory);
  const todayStr = new Date().toISOString().split('T')[0];

  // Grouping logs systematically by Date string parameters
  const logsByDate = gymLogs.reduce<Record<string, GymLog[]>>((groups, log) => {
    const d = log.date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(log);
    return groups;
  }, {});

  const sortedDates = Object.keys(logsByDate).sort((a, b) => b.localeCompare(a));

  const toggleDateGroup = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const handleWorkoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeExercise = selectedExercise || currentCategoryExercises[0]?.name;
    
    if (!activeExercise || !weight || !sets || !reps) {
      alert("Please check entry inputs. Critical metrics cannot be blank.");
      return;
    }

    await addGymLog({
      date: workoutDate,
      category: selectedCategory,
      exerciseName: activeExercise,
      weight: parseFloat(weight),
      sets: parseInt(sets, 10),
      reps: parseInt(reps, 10),
      note: note.trim() || undefined
    });

    setWeight('');
    setSets('');
    setReps('');
    setNote('');
  };

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExerciseName.trim()) return;

    await addGymExercise({
      category: selectedCategory,
      name: newExerciseName.trim()
    });

    setSelectedExercise(newExerciseName.trim());
    setNewExerciseName('');
    setIsAddingCustom(false);
  };

  // Feature: Bulk copies an entire historical block directly into today's log matrix
  const handleCopyDayToToday = async (dateStr: string) => {
    const targetLogs = logsByDate[dateStr] || [];
    if (targetLogs.length === 0) return;

    for (const log of targetLogs) {
      await addGymLog({
        date: todayStr,
        category: log.category,
        exerciseName: log.exerciseName,
        weight: log.weight,
        sets: log.sets,
        reps: log.reps,
        note: log.note
      });
    }

    // Force focus overlay screen to automatically unfold today's column to verify items
    setExpandedDates(prev => ({ ...prev, [todayStr]: true }));
  };

  const startInlineEdit = (log: GymLog) => {
    if (!log.id) return;
    setEditingLogId(log.id);
    setEditWeight(log.weight.toString());
    setEditSets(log.sets.toString());
    setEditReps(log.reps.toString());
    setEditNote(log.note || '');
  };

  const saveInlineEdit = async (originalLog: GymLog) => {
    if (!originalLog.id) return;
    
    // Deletes structural row old snapshot and instantly creates the replacement bundle
    await deleteGymLog(originalLog.id);
    await addGymLog({
      date: originalLog.date,
      category: originalLog.category,
      exerciseName: originalLog.exerciseName,
      weight: parseFloat(editWeight),
      sets: parseInt(editSets, 10),
      reps: parseInt(editReps, 10),
      note: editNote.trim() || undefined
    });

    setEditingLogId(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 items-start max-w-5xl mx-auto mt-2 pb-16 px-3 text-base">
      
      {/* LEFT COLUMN: THE INPUT LOGGER CARD CONTAINER */}
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5 shadow-xl backdrop-blur-md">
          <h3 className="text-sm font-bold tracking-wider text-cyan-400 uppercase">Track Performance</h3>
          
          <form onSubmit={handleWorkoutSubmit} className="space-y-4">
            
            {/* Category Segment Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
              {(['Push', 'Pull', 'Legs'] as WorkoutCategory[]).map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat} type="button" onClick={() => { setSelectedCategory(cat); setSelectedExercise(''); }}
                    className={`py-2.5 text-xs rounded-lg text-center uppercase tracking-widest font-bold transition-all ${
                      isSelected 
                        ? cat === 'Push' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          cat === 'Pull' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Workout Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wider text-zinc-400 uppercase block">Date</label>
              <input
                type="date" value={workoutDate} onChange={(e) => setWorkoutDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Exercise Dropdown Selector Matrix */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Movement</label>
                <button
                  type="button" onClick={() => setIsAddingCustom(!isAddingCustom)}
                  className="text-xs font-bold tracking-wide text-cyan-400 hover:text-cyan-300 uppercase"
                >
                  {isAddingCustom ? '‹ Dropdown' : '+ Add Custom'}
                </button>
              </div>

              {!isAddingCustom ? (
                <select
                  value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none"
                >
                  {currentCategoryExercises.map((ex) => (
                    <option key={ex.id} value={ex.name}>{ex.name}</option>
                  ))}
                  {currentCategoryExercises.length === 0 && <option value="">No exercises mapped...</option>}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text" value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)}
                    placeholder="e.g., Hack Squat"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button" onClick={handleCreateExercise}
                    className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 px-4 text-xs font-extrabold rounded-xl transition-transform active:scale-95"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Numeric Volume Inputs Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block text-center">Weight (kg)</label>
                <input
                  type="number" step="0.25" placeholder="0.0" value={weight} onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm font-mono text-zinc-100 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block text-center">Sets</label>
                <input
                  type="number" placeholder="0" value={sets} onChange={(e) => setSets(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm font-mono text-zinc-100 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase block text-center">Reps</label>
                <input
                  type="number" placeholder="0" value={reps} onChange={(e) => setReps(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm font-mono text-zinc-100 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Notes Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wider text-zinc-400 uppercase block">Notes</label>
              <input
                type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="RPE 9, slow eccentrics"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button type="submit" className={`w-full py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-zinc-950 rounded-xl font-black text-sm uppercase tracking-widest ${PRESSABLE_CLASS} shadow-lg shadow-cyan-500/10 hover:brightness-110 mt-3`}>
              Log Active Set
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: DRILLDOWN DAY-GROUP LOGS CONTAINER */}
      <div className="lg:col-span-2 space-y-4">
        
        {sortedDates.length === 0 ? (
          <div className="border border-zinc-800 bg-zinc-900/10 rounded-2xl p-12 text-center text-zinc-500 tracking-wide text-sm">
            No logged workouts detected in cloud repository.
          </div>
        ) : (
          sortedDates.map((dateStr) => {
            const dayLogs = logsByDate[dateStr];
            const isExpanded = !!expandedDates[dateStr];
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className="border border-zinc-800 bg-zinc-900/20 rounded-2xl overflow-hidden shadow-md">
                
                {/* 💡 FLEXIBLE GROUP HEADER PANEL */}
                <div className="p-4 bg-zinc-900/60 border-b border-zinc-800/80 flex justify-between items-center gap-2">
                  <button 
                    onClick={() => toggleDateGroup(dateStr)}
                    className="flex items-center gap-3 flex-1 text-left select-none group focus:outline-none"
                  >
                    <span className="text-zinc-500 group-hover:text-zinc-300 text-xs transition-transform transform">
                      {isExpanded ? '▼' : '►'}
                    </span>
                    <span className={`font-mono font-bold text-base ${isToday ? 'text-cyan-400' : 'text-zinc-200'}`}>
                      {dateStr} {isToday && <span className="text-xs font-sans text-cyan-500 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded ml-1 uppercase">Today</span>}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-950 text-zinc-500 font-mono">
                      {dayLogs.length} {dayLogs.length === 1 ? 'set' : 'sets'}
                    </span>
                  </button>

                  {/* 💡 COPY TO TODAY BUTTON TASK DISPATCHER */}
                  {!isToday && (
                    <button
                      onClick={() => handleCopyDayToToday(dateStr)}
                      className={`text-xs px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold rounded-lg border border-purple-500/20 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                      title="Duplicate all exercises from this day directly into today's log stack."
                    >
                      ⚡ Copy to Today
                    </button>
                  )}
                </div>

                {/* 💡 COLLAPSIBLE FEED GROUP */}
                {isExpanded && (
                  <div className="divide-y divide-zinc-900 bg-zinc-950/20">
                    {dayLogs.map((log) => {
                      const isEditing = editingLogId === log.id;

                      return (
                        <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-zinc-900/10 group">
                          
                          {/* Left Details View */}
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded ${
                                log.category === 'Push' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                log.category === 'Pull' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {log.category}
                              </span>
                              <h4 className="text-base font-bold text-zinc-200 truncate">{log.exerciseName}</h4>
                            </div>

                            {/* 💡 CONDITIONAL INLINE EDITING INTERFACE FORM LAYER */}
                            {isEditing ? (
                              <div className="grid grid-cols-3 gap-2 max-w-xs pt-1.5">
                                <input 
                                  type="number" step="0.25" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} 
                                  className="bg-zinc-950 border border-zinc-800 text-xs font-mono text-center text-zinc-100 rounded p-1.5 focus:outline-none focus:border-cyan-500" 
                                />
                                <input 
                                  type="number" value={editSets} onChange={(e) => setEditSets(e.target.value)} 
                                  className="bg-zinc-950 border border-zinc-800 text-xs font-mono text-center text-zinc-100 rounded p-1.5 focus:outline-none focus:border-cyan-500" 
                                />
                                <input 
                                  type="number" value={editReps} onChange={(e) => setEditReps(e.target.value)} 
                                  className="bg-zinc-950 border border-zinc-800 text-xs font-mono text-center text-zinc-100 rounded p-1.5 focus:outline-none focus:border-cyan-500" 
                                />
                                <input 
                                  type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Edit description note"
                                  className="col-span-3 bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded p-1.5 focus:outline-none focus:border-cyan-500 mt-1" 
                                />
                              </div>
                            ) : (
                              // Metrics View Block
                              <div className="flex gap-4 text-sm font-mono text-zinc-400 pl-0.5">
                                <span>Weight: <strong className="text-zinc-100 font-bold">{log.weight} kg</strong></span>
                                <span>Sets: <strong className="text-zinc-100 font-bold">{log.sets}</strong></span>
                                <span>Reps: <strong className="text-zinc-100 font-bold">{log.reps}</strong></span>
                              </div>
                            )}

                            {!isEditing && log.note && (
                              <p className="text-xs text-zinc-500 italic pl-2 border-l-2 border-zinc-800 bg-zinc-950/40 p-2 rounded-r-xl max-w-xl">
                                {log.note}
                              </p>
                            )}
                          </div>

                          {/* Right Action Trigger Buttons Layer */}
                          <div className="flex items-center gap-3 sm:self-center justify-end border-t border-zinc-900 sm:border-t-0 pt-2 sm:pt-0">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => saveInlineEdit(log)}
                                  className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md"
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setEditingLogId(null)}
                                  className="text-xs font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-md"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startInlineEdit(log)}
                                  className={`text-xs text-zinc-400 hover:text-cyan-400 font-medium px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => log.id && deleteGymLog(log.id)}
                                  className={`text-zinc-600 hover:text-rose-400 px-2 py-1 transition-colors cursor-pointer text-sm ${PRESSABLE_SOFT_CLASS}`}
                                  title="Delete item row entry from relational layout ledger mapping context."
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
                
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}