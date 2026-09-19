import {previewBackup} from './backup.js';
import {applyCSVImport} from './import.js';
import { defaults, rebuildState, migrateDefaultSchedule } from './workout.js';
const cfg=window.APP_CONFIG||{};
const url=cfg.SUPABASE_URL?.trim()||'', key=cfg.SUPABASE_PUBLISHABLE_KEY?.trim()||'';
export const isSupabaseConfigured=()=>Boolean(url && key);
export const demo=!isSupabaseConfigured();
const storageKey=`tahmid-workout:v1:${new URL('../',import.meta.url).pathname}`;
export const tables=['profiles','routines','exercises','weekly_schedule','workouts','workout_sets','exercise_state'];
let client, data;

async function ensureClient() {
  if(client) return client;
  if(!url || !key) throw new Error('Supply both Supabase settings, or leave both empty for Local Demo Mode.');
  if(key.startsWith('sb_secret_')) throw new Error('A secret key cannot be used in this app. Use a publishable key.');
  if(!key.startsWith('sb_publishable_')) {
    let role; try {role=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;} catch { /* handled below */ }
    if(role!=='anon') throw new Error('Use a Supabase publishable key or legacy anon key.');
  }
  if(!/^https:\/\//.test(url)) throw new Error('Use your HTTPS Supabase project URL.');

  console.log('Supabase configured');
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
  client=createClient(url,key,{auth:{persistSession:true,detectSessionInUrl:false,autoRefreshToken:true}});
  return client;
}

const defaultSchedule = [
  {day_of_week:0, workout_type:'cardio', cardio_duration_minutes:30, makeup_for_day:null, enabled:true},
  {day_of_week:1, workout_type:'strength', cardio_duration_minutes:null, makeup_for_day:null, enabled:true},
  {day_of_week:2, workout_type:'rest', cardio_duration_minutes:null, makeup_for_day:1, enabled:true},
  {day_of_week:3, workout_type:'cardio', cardio_duration_minutes:30, makeup_for_day:null, enabled:true},
  {day_of_week:4, workout_type:'rest', cardio_duration_minutes:null, makeup_for_day:null, enabled:true},
  {day_of_week:5, workout_type:'strength', cardio_duration_minutes:null, makeup_for_day:null, enabled:true},
  {day_of_week:6, workout_type:'rest', cardio_duration_minutes:null, makeup_for_day:5, enabled:true}
];

const defaultExercises = [
  {name:'Warm-up', exercise_type:'timed', target_sets:null, target_reps:null, duration_seconds:120, progression_enabled:false, position:1, active:true},
  {name:'Smith Machine Squat', exercise_type:'strength', target_sets:5, target_reps:5, duration_seconds:null, progression_enabled:true, position:2, active:true},
  {name:'Cable Crossover Chest Press', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:3, active:true},
  {name:'Seated Cable Row (V-Grip)', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:4, active:true},
  {name:'Lat Pulldown', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:5, active:true},
  {name:'Rotary Shoulder', exercise_type:'strength', target_sets:3, target_reps:8, duration_seconds:null, progression_enabled:true, position:6, active:true},
  {name:'Leg Extension', exercise_type:'strength', target_sets:2, target_reps:10, duration_seconds:null, progression_enabled:true, position:7, active:true},
  {name:'Paramount Lying Leg Curl', exercise_type:'strength', target_sets:2, target_reps:10, duration_seconds:null, progression_enabled:true, position:8, active:true},
  {name:'Decline Reverse Crunch / Leg Raise using decline abdominal bench', exercise_type:'bodyweight', target_sets:3, target_reps:10, duration_seconds:null, progression_enabled:false, position:9, active:true},
  {name:'Cable Tricep Pushdown', exercise_type:'strength', target_sets:3, target_reps:10, duration_seconds:null, progression_enabled:true, position:10, active:true},
  {name:'Dumbbell Bicep Curl', exercise_type:'strength', target_sets:3, target_reps:10, duration_seconds:null, progression_enabled:true, position:11, active:true}
];

async function ensureUserInitialized(user) {
  const supabase = await ensureClient();
  console.log('Initializing user data');

  const { data: prefRows, error: prefError } = await supabase.from('user_preferences').select('*').eq('user_id', user.id);
  if(prefError){ console.error('Supabase user_preferences query failed', prefError); throw prefError; }
  if(!prefRows.length){
    const {error:insertPrefError} = await supabase.from('user_preferences').insert([{ user_id: user.id, weight_unit: 'lb' }]);
    if(insertPrefError){ console.error('Supabase user_preferences insert failed', insertPrefError); throw insertPrefError; }
    console.log('Created user_preferences for authenticated user');
  } else {
    console.log('User preferences already initialized');
  }

  const { data: scheduleRows, error: scheduleError } = await supabase.from('weekly_schedule').select('*').eq('user_id', user.id).order('day_of_week', {ascending: true});
  if(scheduleError){ console.error('Supabase weekly_schedule query failed', scheduleError); throw scheduleError; }
  const existingScheduleDays=new Set(scheduleRows.map(row=>row.day_of_week));
  const missingScheduleRows=defaultSchedule.filter(row=>!existingScheduleDays.has(row.day_of_week)).map(row => ({ user_id: user.id, day_of_week: row.day_of_week, workout_type: row.workout_type, cardio_duration_minutes: row.cardio_duration_minutes, makeup_for_day: row.makeup_for_day, enabled: row.enabled }));
  if(missingScheduleRows.length){
    const {error: insertScheduleError} = await supabase.from('weekly_schedule').insert(missingScheduleRows);
    if(insertScheduleError){ console.error('Supabase weekly_schedule insert failed', insertScheduleError); throw insertScheduleError; }
    console.log(`Created ${missingScheduleRows.length} missing weekly_schedule rows`);
  } else {
    console.log('Weekly schedule already initialized');
  }

  const { data: exerciseRows, error: exerciseError } = await supabase.from('exercises').select('*').eq('user_id', user.id).order('position', {ascending: true});
  if(exerciseError){ console.error('Supabase exercises query failed', exerciseError); throw exerciseError; }
  const existingExerciseNames=new Set(exerciseRows.map(row=>row.name));
  const missingExerciseRows=defaultExercises.filter(row=>!existingExerciseNames.has(row.name)).map(row => ({ user_id: user.id, name: row.name, exercise_type: row.exercise_type, target_sets: row.target_sets, target_reps: row.target_reps, duration_seconds: row.duration_seconds, weight_tracking: row.exercise_type === 'strength', rep_tracking: row.exercise_type !== 'timed', rest_between_sets_seconds: null, rest_after_exercise_seconds: null, position: row.position, active: row.active }));
  if(missingExerciseRows.length){
    const {error: insertExerciseError} = await supabase.from('exercises').insert(missingExerciseRows);
    if(insertExerciseError){ console.error('Supabase exercises insert failed', insertExerciseError); throw insertExerciseError; }
    console.log(`Created ${missingExerciseRows.length} missing exercise rows`);
  } else {
    console.log('Exercise rows already initialized');
  }
}

function fromSupabaseRows(user, results) {
  const routineId='supabase-routine';
  const exercises=(results.exercises.data||[]).map(row=>({
    ...row,
    exercise_type: row.exercise_type==='timed'?'warmup':row.exercise_type,
    target_sets: row.exercise_type==='timed'?1:row.target_sets,
    routine_id: routineId,
    progression_enabled: row.exercise_type==='strength' && row.weight_tracking===true
  }));
  const exerciseById=new Map(exercises.map(row=>[row.id,row]));
  const schedules=(results.schedules.data||[]).map(row=>({
    ...row,
    routine_id: row.workout_type==='strength'?routineId:null,
    cardio_duration_minutes: row.cardio_duration_minutes ?? null
  }));
  const sets=(results.sets.data||[]).map(row=>({
    ...row,
    exercise_name: row.exercise_name_snapshot,
    exercise_type: row.exercise_type_snapshot==='timed'?'warmup':row.exercise_type_snapshot,
    duration_seconds: row.actual_duration_seconds ?? row.target_duration_seconds ?? null,
    status: row.completed===true?'completed':'skipped',
    updated_at: row.logged_at
  }));
  const workouts=(results.workouts.data||[]).map(row=>({
    ...row,
    source: row.session_origin,
    routine_id: row.workout_type==='strength'?routineId:null,
    routine_name: row.workout_type==='strength'?'Full-body strength':'Cardio',
    routine_snapshot: row.workout_type==='strength'?[...exerciseById.values()].filter(ex=>ex.active):[],
    duration_minutes: row.cardio_target_minutes ?? null,
    timer_ends_at: null
  }));
  const states=(results.states.data||[]).map(row=>({
    ...row,
    increase_next_time: row.ready_to_increase,
    mastered_weight: row.current_successful_weight,
    updated_at: row.last_completed_at
  }));
  return {
    schema_version:1,
    defaults_version:2,
    revision:0,
    profiles:[{user_id:user.id,display_name:'Tahmid',revision:0}],
    routines:[{id:routineId,user_id:user.id,name:'Full-body strength'}],
    user_preferences:results.preferences.data||[],
    exercises,
    weekly_schedule:schedules,
    workouts,
    workout_sets:sets,
    exercise_state:states,
    progress_events:results.events.data||[]
  };
}

function toSupabaseRows(user, next) {
  const totalDuration = workout => workout.workout_started_at && workout.workout_completed_at
    ? Math.max(0, Math.round((Date.parse(workout.workout_completed_at)-Date.parse(workout.workout_started_at))/1000))
    : null;
  return {
    preferences:(next.user_preferences||[]).map(row=>({user_id:user.id,weight_unit:row.weight_unit||'lb'})),
    exercises:(next.exercises||[]).map(row=>({
      ...(row.id?{id:row.id}:{}), user_id:user.id, name:row.name, exercise_type:row.exercise_type==='warmup'?'timed':row.exercise_type,
      target_sets:row.exercise_type==='warmup'?null:row.target_sets, target_reps:row.exercise_type==='warmup'?null:row.target_reps, duration_seconds:row.duration_seconds,
      weight_tracking:row.exercise_type==='strength' && row.progression_enabled===true,
      rep_tracking:row.exercise_type!=='warmup', rest_between_sets_seconds:row.rest_between_sets_seconds??null,
      rest_after_exercise_seconds:row.rest_after_exercise_seconds??null, position:row.position, active:row.active
    })),
    schedules:(next.weekly_schedule||[]).map(row=>({
      ...(row.id?{id:row.id}:{}), user_id:user.id, day_of_week:row.day_of_week, workout_type:row.workout_type,
      cardio_duration_minutes:row.workout_type==='cardio'?row.cardio_duration_minutes:null,
      makeup_for_day:row.makeup_for_day??null, enabled:row.enabled!==false
    })),
    workouts:(next.workouts||[]).map(row=>({
      ...(row.id?{id:row.id}:{}), user_id:user.id, workout_type:row.workout_type, session_origin:row.source,
      scheduled_date:row.scheduled_date, actual_workout_date:row.actual_workout_date,
      workout_started_at:row.workout_started_at, workout_completed_at:row.workout_completed_at,
      total_workout_duration_seconds:totalDuration(row), status:row.status,
      cardio_target_minutes:row.workout_type==='cardio'?row.duration_minutes:null,
      cardio_actual_minutes:row.workout_type==='cardio'&&row.status==='completed'?row.duration_minutes:null,
      note:row.note||'', imported_at:row.imported_at??null
    })),
    sets:(next.workout_sets||[]).map(row=>({
      ...(row.id?{id:row.id}:{}), user_id:user.id, workout_id:row.workout_id, exercise_id:row.exercise_id,
      exercise_name_snapshot:row.exercise_name, exercise_type_snapshot:row.exercise_type==='warmup'?'timed':row.exercise_type,
      set_number:row.set_number, target_reps:row.target_reps, actual_reps:row.actual_reps,
      weight:row.weight, unit:row.unit, target_duration_seconds:row.exercise_type==='warmup'?120:null,
      actual_duration_seconds:row.duration_seconds, rest_planned_seconds:row.rest_planned_seconds??null,
      rest_actual_seconds:row.rest_actual_seconds??null, completed:row.status==='completed', note:row.note||'',
      logged_at:row.logged_at, imported_at:row.imported_at??null
    })),
    states:(next.exercise_state||[]).filter(row=>Number(row.mastered_weight)>0).map(row=>({
      user_id:user.id, exercise_id:row.exercise_id, current_successful_weight:row.mastered_weight,
      ready_to_increase:row.increase_next_time===true, last_completed_at:row.updated_at??null,
      last_progression_workout_id:row.last_progression_workout_id??null
    })),
    events:(next.progress_events||[]).map(row=>({
      user_id:user.id, exercise_id:row.exercise_id??null, workout_id:row.workout_id??null,
      event_type:row.event_type, event_date:row.event_date, payload:row.payload??{}, acknowledged:row.acknowledged===true
    }))
  };
}

export async function initialize() {
  if(demo) {
    const raw=localStorage.getItem(storageKey);
    if(raw) { data=JSON.parse(raw); if(data.schema_version!==1) throw new Error('Unsupported demo data version. Your stored data has not been changed.'); const migrated=structuredClone(data); if(migrateDefaultSchedule(migrated))return save(migrated); }
    else {data=defaults('00000000-0000-4000-8000-000000000001'); localStorage.setItem(storageKey,JSON.stringify(data));}
    return data;
  }

  const supabase = await ensureClient();
  console.log('Checking auth session');
  const {data:{session},error}=await supabase.auth.getSession();
  if(error){ console.error('Supabase auth.getSession() failed', error); throw error; }
  if(!session){ console.log('No Supabase session'); return null; }
  console.log('Supabase session restored');
  data={};
  return refresh();
}
export async function signIn(email,password) {
  const supabase = await ensureClient();
  console.log('Attempting Supabase sign-in');
  const { data: authData, error } = await supabase.auth.signInWithPassword({email,password});
  if(error){ console.error('Supabase signInWithPassword failed', error); throw error; }
  if(!authData?.user){ throw new Error('Supabase sign-in succeeded but no user was returned.'); }
  await ensureUserInitialized(authData.user);
  return refresh();
}
export async function signUp(email,password) {
  const supabase = await ensureClient();
  const {error}=await supabase.auth.signUp({email,password}); if(error) throw error;
}
export async function signOut() {const supabase = await ensureClient(); const {error}=await supabase.auth.signOut(); if(error) throw error; data=null;}
export async function refresh() {
  if(demo) { data=JSON.parse(localStorage.getItem(storageKey)); return data; }
  const supabase = await ensureClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if(userError){ console.error('Supabase auth.getUser() failed during refresh', userError); throw userError; }
  const user = userData?.user;
  if(!user){ console.log('No authenticated user found during refresh'); return null; }

  await ensureUserInitialized(user);

  const [preferencesResult, exercisesResult, schedulesResult, workoutsResult, setsResult, statesResult, eventsResult] = await Promise.all([
    supabase.from('user_preferences').select('*').eq('user_id', user.id).limit(1),
    supabase.from('exercises').select('*').eq('user_id', user.id).order('position', { ascending: true }),
    supabase.from('weekly_schedule').select('id,user_id,day_of_week,workout_type,cardio_duration_minutes,makeup_for_day,enabled,created_at,updated_at').eq('user_id', user.id).order('day_of_week', { ascending: true }),
    supabase.from('workouts').select('*').eq('user_id', user.id).order('actual_workout_date', { ascending: false }),
    supabase.from('workout_sets').select('id,user_id,workout_id,exercise_id,exercise_name_snapshot,exercise_type_snapshot,set_number,target_reps,actual_reps,weight,unit,target_duration_seconds,actual_duration_seconds,rest_planned_seconds,rest_actual_seconds,completed,note,logged_at,imported_at').eq('user_id', user.id).order('logged_at', { ascending: false }),
    supabase.from('exercise_state').select('user_id,exercise_id,current_successful_weight,ready_to_increase,last_completed_at,last_progression_workout_id').eq('user_id', user.id).order('last_completed_at', { ascending: false }),
    supabase.from('progress_events').select('user_id,exercise_id,workout_id,event_type,event_date,payload,acknowledged').eq('user_id', user.id).order('event_date', { ascending: false })
  ]);

  for (const result of [preferencesResult, exercisesResult, schedulesResult, workoutsResult, setsResult, statesResult, eventsResult]) {
    if(result.error){ console.error('Supabase table query failed during refresh', result.error); throw result.error; }
  }
  data=fromSupabaseRows(user,{preferences:preferencesResult,exercises:exercisesResult,schedules:schedulesResult,workouts:workoutsResult,sets:setsResult,states:statesResult,events:eventsResult});
  return data;
}
export async function save(candidate) {
  const next=structuredClone(candidate); rebuildState(next);
  if(demo) {
    const existing=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(existing && existing.revision!==next.revision) throw new Error('Data changed in another tab. Reload before saving again.');
    next.revision++; next.profiles[0].revision=next.revision;
    localStorage.setItem(storageKey,JSON.stringify(next));
  } else {
    const supabase = await ensureClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if(userError){ console.error('Supabase auth.getUser() failed during save', userError); throw userError; }
    const user = userData?.user;
    if(!user){ throw new Error('Authentication required to save workout data.'); }
    const rows=toSupabaseRows(user,next);

    const upserts = [
      supabase.from('user_preferences').upsert(rows.preferences, { onConflict: 'user_id' }),
      supabase.from('exercises').upsert(rows.exercises, { onConflict: 'id' }),
      supabase.from('weekly_schedule').upsert(rows.schedules, { onConflict: 'user_id,day_of_week' }),
      supabase.from('workouts').upsert(rows.workouts, { onConflict: 'id' }),
      supabase.from('workout_sets').upsert(rows.sets, { onConflict: 'id' }),
      supabase.from('exercise_state').upsert(rows.states, { onConflict: 'user_id,exercise_id' }),
      supabase.from('progress_events').upsert(rows.events)
    ];

    const results = await Promise.all(upserts);
    for (const result of results) {
      if(result.error){ console.error('Supabase table upsert failed during save', result.error); throw result.error; }
    }
  }
  data=next; return next;
}

export async function resetEverything(confirmation, expectedRevision) {
  if(confirmation!=='RESET') throw new Error('Type RESET exactly to confirm.');
  if(demo) {
    if(!data || data.revision!==expectedRevision) throw new Error('Data changed. Open the reset confirmation again.');
    const clean=defaults(data.profiles[0].user_id);
    clean.revision=data.revision;clean.profiles[0].revision=data.revision;
    return save(clean);
  }

  const supabase=await ensureClient();
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError) throw userError;
  if(!user) throw new Error('Authentication required to reset workout data.');

  for(const table of ['progress_events','exercise_state','workouts','exercises','weekly_schedule','user_preferences']){
    const {error}=await supabase.from(table).delete().eq('user_id',user.id);
    if(error){ console.error(`Supabase ${table} reset delete failed`,error); throw error; }
  }

  await ensureUserInitialized(user);
  return refresh();
}
export async function importCSV(preview, options) {
  if(!demo) throw new Error('CSV import is available in Local Demo Mode only. Cloud import has not been connected.');
  const result=applyCSVImport(data,preview,options);
  return {...result,data:await save(result.data)};
}

export async function restoreJSON(contents, expectedRevision) {
  if(!demo)throw new Error('JSON restore is available in Local Demo Mode only.');
  if(data.revision!==expectedRevision)throw new Error('Data changed after preview. Select the backup again.');
  const preview=previewBackup(contents,data);
  return save(preview.data);
}
