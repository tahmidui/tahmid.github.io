import {migrateDefaultSchedule,rebuildState} from './workout.js';
const tables=['profiles','routines','exercises','weekly_schedule','workouts','workout_sets','exercise_state'];
const fail=message=>{throw new Error(`Invalid JSON backup: ${message}. Nothing was restored.`);};
function check(condition,message){if(!condition)fail(message);}
function text(v,name,max=2000){check(typeof v==='string'&&v.length>0&&v.length<=max,`${name} must be text`);}
function num(v,name,min,max,nullable=false){check(nullable&&v===null||typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,`${name} is out of range`);}
function integer(v,name,min,max,nullable=false){num(v,name,min,max,nullable);check(v===null||Number.isInteger(v),`${name} must be a whole number`);}
function date(v,name){check(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,`${name} is invalid`);}
function time(v,name,nullable=false){if(nullable&&v===null)return;check(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v)),`${name} is invalid`);date(v.slice(0,10),name);}
function choice(v,values,name){check(values.includes(v),`${name} is invalid`);}
function unique(rows,name,key='id'){const ids=rows.map(r=>r[key]);check(ids.every(v=>typeof v==='string'&&v.length>0)&&new Set(ids).size===ids.length,`${name} has missing or duplicate IDs`);}
function exercise(e,snapshot=false){
 text(e.name,'exercise name',160);choice(e.exercise_type,['strength','warmup','bodyweight'],'exercise type');integer(e.target_sets,'target sets',1,20);integer(e.target_reps,'target reps',1,1000,e.exercise_type==='warmup'||snapshot&&!e.progression_enabled);check(typeof e.active==='boolean'&&typeof e.progression_enabled==='boolean','exercise flags must be boolean');integer(e.position,'exercise position',0,100000);
 if(e.exercise_type==='warmup')check(e.duration_seconds===120&&e.target_sets===1&&e.target_reps===null&&!e.progression_enabled,'warm-up must remain a 120-second timed step');
 else check(e.duration_seconds===null,'weighted/bodyweight exercise cannot have a timed duration');
 check(!e.progression_enabled||e.exercise_type==='strength','only weighted strength supports progression');
}
export function previewBackup(contents,current){
 let backup;try{backup=JSON.parse(contents);}catch{fail('file is not valid JSON');}
 check(backup?.format==='tahmid-workout-log'&&backup.schema_version===1&&backup.data?.schema_version===1,'unsupported format or version');
 const d=structuredClone(backup.data);
 for(const t of tables)check(Array.isArray(d[t])&&d[t].every(r=>r&&typeof r==='object'&&!Array.isArray(r)),`${t} must contain records`);
 check(d.profiles.length===1,'exactly one profile is required');const sourceUser=d.profiles[0].user_id;text(sourceUser,'profile owner');text(d.profiles[0].display_name,'display name',160);
 for(const t of tables)for(const r of d[t])check(r.user_id===sourceUser,'records must belong to the same profile');
 for(const t of ['routines','exercises','weekly_schedule','workouts','workout_sets'])unique(d[t],t);
 check(d.routines.length>0,'a routine is required');const routines=new Set(d.routines.map(r=>r.id));d.routines.forEach(r=>text(r.name,'routine name',160));
 const exercises=new Map(d.exercises.map(e=>[e.id,e]));for(const e of d.exercises){exercise(e);check(routines.has(e.routine_id),'exercise refers to a missing routine');}
 check(d.weekly_schedule.length===7&&new Set(d.weekly_schedule.map(s=>s.day_of_week)).size===7,'schedule must contain all seven days');
 for(const s of d.weekly_schedule){integer(s.day_of_week,'schedule day',0,6);choice(s.workout_type,['rest','strength','cardio'],'schedule type');integer(s.makeup_for_day,'make-up day',0,6,true);check(s.makeup_for_day!==s.day_of_week,'make-up source cannot be the same day');integer(s.cardio_duration_minutes,'cardio duration',1,1440,true);check(s.workout_type==='cardio'?s.cardio_duration_minutes!==null:s.cardio_duration_minutes===null,'schedule duration conflicts with type');check(s.workout_type==='strength'?routines.has(s.routine_id):s.routine_id===null,'schedule routine conflicts with type');}
 check(d.workouts.filter(w=>w.status==='in_progress').length<=1,'more than one unfinished workout');
 const workouts=new Map(d.workouts.map(w=>[w.id,w]));
 for(const w of d.workouts){
  date(w.scheduled_date,'scheduled date');date(w.actual_workout_date,'actual workout date');time(w.workout_started_at,'workout start');time(w.workout_completed_at,'workout completion',true);choice(w.workout_type,['strength','cardio'],'workout type');choice(w.status,['completed','in_progress'],'workout status');choice(w.source,['scheduled','makeup','extra'],'workout source');text(w.routine_name,'workout routine name',160);check(typeof w.note==='string'&&w.note.length<=2000,'workout note is invalid');time(w.timer_ends_at,'timer',true);integer(w.duration_minutes,'cardio duration',1,1440,true);
  check((w.status==='completed')===(w.workout_completed_at!==null),'workout status conflicts with completion');check(!w.workout_completed_at||Date.parse(w.workout_completed_at)>=Date.parse(w.workout_started_at),'completion precedes start');check(w.workout_type==='cardio'?w.duration_minutes!==null&&w.routine_id===null:routines.has(w.routine_id),'workout routine/duration is invalid');
  check(Array.isArray(w.routine_snapshot),'routine snapshot is missing');unique(w.routine_snapshot,'routine snapshot');for(const e of w.routine_snapshot){exercise(e,true);check(exercises.has(e.id),'snapshot refers to a missing exercise');}
 }
 const slots=new Set();
 for(const s of d.workout_sets){
  const w=workouts.get(s.workout_id),e=w?.routine_snapshot.find(e=>e.id===s.exercise_id);check(!!w&&w.workout_type==='strength'&&!!e&&exercises.has(s.exercise_id),'set refers to a missing workout or exercise');text(s.exercise_name,'historical exercise name',160);choice(s.exercise_type,['strength','warmup','bodyweight'],'historical exercise type');check(s.exercise_type===e.exercise_type,'set and snapshot exercise types differ');integer(s.set_number,'set number',1,e.target_sets);integer(s.target_reps,'historical target reps',1,1000,true);integer(s.actual_reps,'actual reps',0,1000,true);num(s.weight,'weight',0,100000);choice(s.unit,['lb','kg'],'weight unit');choice(s.status,['completed','skipped'],'set status');time(s.logged_at,'logged timestamp');time(s.updated_at,'updated timestamp');integer(s.duration_seconds,'timed duration',1,86400,true);check(typeof s.note==='string'&&s.note.length<=2000,'set note is invalid');
  if(s.exercise_type==='warmup')check(s.actual_reps===null&&s.weight===0&&s.target_reps===null&&(s.status==='skipped'||s.duration_seconds===120),'invalid timed warm-up');else check(s.status==='skipped'||s.actual_reps!==null,'completed set is missing reps');
  const slot=JSON.stringify([s.workout_id,s.exercise_id,s.set_number]);check(!slots.has(slot),'duplicate set number in a workout');slots.add(slot);
 }
 // Ownership is the local application's profile, never a foreign backup account.
 const owner=current.profiles[0].user_id;
 for(const t of tables)for(const row of d[t])row.user_id=owner;
 for(const w of d.workouts)for(const e of w.routine_snapshot)e.user_id=owner;
 const previousTuesday=d.weekly_schedule.find(s=>s.day_of_week===2).workout_type;
 migrateDefaultSchedule(d);const scheduleUpdated=previousTuesday==='cardio'&&d.weekly_schedule.find(s=>s.day_of_week===2).workout_type==='rest';
 d.revision=current.revision;d.profiles[0].revision=current.revision;rebuildState(d);
 return {data:d,revision:current.revision,workouts:d.workouts.length,sets:d.workout_sets.length,exercises:d.exercises.length,scheduleUpdated};
}
