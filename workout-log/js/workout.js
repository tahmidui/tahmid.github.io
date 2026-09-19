export const DEFAULT_EXERCISES = [
    {name:'Warm-up', exercise_type:'warmup', target_sets:1, target_reps:null, duration_seconds:120, progression_enabled:false, position:1},
    {name:'Smith Machine Squat', exercise_type:'strength', target_sets:5, target_reps:5, duration_seconds:null, progression_enabled:true, position:2},
    {name:'Cable Crossover Chest Press', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:3},
    {name:'Seated Cable Row (V-Grip)', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:4},
    {name:'Lat Pulldown', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:5},
    {name:'Rotary Shoulder', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:6},
    {name:'Leg Extension', exercise_type:'strength', target_sets:2, target_reps:10, duration_seconds:null, progression_enabled:true, position:7},
    {name:'Paramount Lying Leg Curl', exercise_type:'strength', target_sets:2, target_reps:10, duration_seconds:null, progression_enabled:true, position:8},
    {name:'Decline Reverse Crunch / Leg Raise', exercise_type:'bodyweight', target_sets:3, target_reps:10, duration_seconds:null, progression_enabled:false, position:9},
    {name:'Cable Tricep Pushdown', exercise_type:'strength', target_sets:3, target_reps:10, duration_seconds:null, progression_enabled:true, position:10},
    {name:'Dumbbell Bicep Curl', exercise_type:'strength', target_sets:3, target_reps:10, duration_seconds:null, progression_enabled:true, position:11}
  ];

  // JS Date: Sunday=0 ... Saturday=6
export const DEFAULT_SCHEDULE = [
  {day_of_week:0, workout_type:'cardio', cardio_duration_minutes:30, makeup_for_day:null, enabled:true},
  {day_of_week:1, workout_type:'strength', cardio_duration_minutes:null, makeup_for_day:null, enabled:true},
  {day_of_week:2, workout_type:'rest', cardio_duration_minutes:null, makeup_for_day:1, enabled:true},
  {day_of_week:3, workout_type:'cardio', cardio_duration_minutes:30, makeup_for_day:null, enabled:true},
  {day_of_week:4, workout_type:'rest', cardio_duration_minutes:null, makeup_for_day:null, enabled:true},
  {day_of_week:5, workout_type:'strength', cardio_duration_minutes:null, makeup_for_day:null, enabled:true},
  {day_of_week:6, workout_type:'rest', cardio_duration_minutes:null, makeup_for_day:5, enabled:true}
  ];
export const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];


export const id = () => crypto.randomUUID();
export const timestamp = () => new Date().toISOString();
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function dateObject(s) { return new Date(`${s}T12:00:00`); }
export function addDays(d, n) { const next = new Date(d); next.setDate(next.getDate()+n); return next; }
export function niceDate(s) { return dateObject(s).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}); }
export function defaults(user_id) {
  const routine_id = id();
  return {
    schema_version: 1, defaults_version: 2, revision: 0,
    profiles: [{user_id, display_name:'Tahmid', revision:0}],
    routines: [{id:routine_id,user_id,name:'Full-body strength'}],
    exercises: DEFAULT_EXERCISES.map(e=>({...e,id:id(),user_id,routine_id,active:true})),
    weekly_schedule: DEFAULT_SCHEDULE.map(s=>({...s,id:id(),user_id,routine_id:s.workout_type==='strength'?routine_id:null})),
    workouts: [], workout_sets: [], exercise_state: []
  };
}
export function todayPlan(data, now = new Date()) {
  const today=localDate(now), rule=data.weekly_schedule.find(s=>s.day_of_week===now.getDay());
  const done=(date,type)=>data.workouts.some(w=>w.scheduled_date===date && w.workout_type===type && w.status==='completed');
  let makeup=null;
  if(rule?.makeup_for_day != null && rule.makeup_for_day===(now.getDay()+6)%7) {
    const source=data.weekly_schedule.find(s=>s.day_of_week===rule.makeup_for_day);
    const scheduled=localDate(addDays(now,-1));
    if(source?.workout_type==='strength' && !done(scheduled,'strength')) makeup={...source,scheduled_date:scheduled,actual_workout_date:today,source:'makeup'};
  }
  const scheduled=rule && rule.workout_type!=='rest'?{...rule,scheduled_date:today,actual_workout_date:today,source:'scheduled',done:done(today,rule.workout_type)}:null;
  let next=null;
  for(let i=1;i<=7;i++) {
    const date=addDays(now,i), r=data.weekly_schedule.find(s=>s.day_of_week===date.getDay());
    if(r && r.workout_type!=='rest') { next={...r,date:localDate(date)}; break; }
  }
  return {today, scheduled, makeup, next};
}
export function progression(ex, sets) {
  if(ex.exercise_type!=='strength' || !ex.progression_enabled || sets.length!==ex.target_sets) return null;
  const weight=Number(sets[0]?.weight), unit=sets[0]?.unit;
  if(!(weight>0) || new Set(sets.map(s=>s.set_number)).size!==ex.target_sets) return null;
  return sets.every(s=>s.status==='completed' && s.set_number>=1 && s.set_number<=ex.target_sets && Number(s.weight)===weight && s.unit===unit && s.actual_reps>=ex.target_reps)?{weight,unit}:null;
}
export function steps(workout) {
  return workout.routine_snapshot.flatMap(ex=>Array.from({length:ex.target_sets},(_,i)=>({ex,set_number:i+1})));
}
export function previousSet(data, exercise_id, set_number, currentId) {
  const current=data.workouts.find(w=>w.id===currentId);
  const previous=data.workouts.filter(w=>w.id!==currentId && w.status==='completed' && w.workout_type==='strength' && (!current || w.workout_started_at<current.workout_started_at) && w.routine_snapshot.some(e=>e.id===exercise_id)).sort((a,b)=>b.workout_started_at.localeCompare(a.workout_started_at))[0];
  return previous && data.workout_sets.find(s=>s.workout_id===previous.id && s.exercise_id===exercise_id && s.set_number===set_number && s.status==='completed');
}
// Rebuild from history after edits. A mixed/heavier attempt does not erase mastery.
export function rebuildState(data) {
  const states=new Map();
  for(const w of [...data.workouts].sort((a,b)=>a.workout_started_at.localeCompare(b.workout_started_at))) {
    for(const ex of w.routine_snapshot || []) {
      const result=progression(ex,data.workout_sets.filter(s=>s.workout_id===w.id && s.exercise_id===ex.id));
      if(!result) continue;
      const old=states.get(ex.id);
      if(!old || result.weight>=old.mastered_weight) states.set(ex.id,{user_id:w.user_id,exercise_id:ex.id,increase_next_time:true,mastered_weight:result.weight,unit:result.unit,updated_at:w.workout_completed_at||w.workout_started_at});
    }
  }
  data.exercise_state=[...states.values()];
}
export function createWorkout(data, plan) {
  const routine=data.routines.find(r=>r.id===plan.routine_id)||data.routines[0];
  const snapshot=plan.workout_type==='strength'?data.exercises.filter(e=>e.active && e.routine_id===routine.id).sort((a,b)=>a.position-b.position).map(e=>({...e})):[];
  if(plan.workout_type==='strength' && !snapshot.length) throw new Error('Enable at least one exercise in Routine first.');
  return {id:id(),user_id:data.profiles[0].user_id,routine_id:plan.workout_type==='strength'?routine.id:null,routine_name:plan.workout_type==='strength'?routine.name:'Cardio',routine_snapshot:snapshot,scheduled_date:plan.scheduled_date,actual_workout_date:plan.actual_workout_date,workout_started_at:timestamp(),workout_completed_at:null,workout_type:plan.workout_type,source:plan.source,status:'in_progress',duration_minutes:plan.cardio_duration_minutes||null,note:'',timer_ends_at:null};
}

// Only migrate an untouched old default schedule; customized schedules are preserved.
export function migrateDefaultSchedule(data) {
  if(data.defaults_version>=2)return false;
  const old=DEFAULT_SCHEDULE.map(s=>s.day_of_week===2?{...s,workout_type:'cardio',cardio_duration_minutes:30,makeup_for_day:null}:s);
  const untouched=data.weekly_schedule.length===7&&old.every(expected=>{
    const row=data.weekly_schedule.find(s=>s.day_of_week===expected.day_of_week);
    return row&&['workout_type','cardio_duration_minutes','makeup_for_day'].every(k=>row[k]===expected[k]);
  });
  if(untouched)Object.assign(data.weekly_schedule.find(s=>s.day_of_week===2),{workout_type:'rest',cardio_duration_minutes:null,makeup_for_day:1,routine_id:null,enabled:true});
  data.defaults_version=2;
  return true;
}
