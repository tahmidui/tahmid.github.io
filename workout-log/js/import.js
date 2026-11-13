import {id, rebuildState} from './workout.js';

const knownColumns=new Set(['csv_version','record_type','workout_id','set_id','scheduled_date','actual_workout_date','workout_started_at','workout_completed_at','workout_status','workout_type','routine_name','source','exercise','exercise_id','exercise_type','target_sets','progression_enabled','set_number','target_reps','actual_reps','weight','unit','duration_seconds','duration_minutes','set_status','logged_at','updated_at','note']);
export const normalizeName=value=>String(value).trim().toLowerCase();

// RFC-style CSV: quoted commas/newlines, escaped quotes, CRLF/LF, and UTF-8 BOM.
// A structurally broken quoted field has no safe row boundary: report it, never guess.
export function parseCSV(text) {
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let cells=[],field='',quoted=false,closed=false,line=1,start=1;
  const finish=()=>{cells.push(field);if(cells.some(c=>c!==''))rows.push({line:start,cells});cells=[];field='';closed=false;};
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=ch;if(ch==='\n')line++;}continue;}
    if(ch==='"'){if(field||closed)throw new Error(`Row ${line}: unexpected quote.`);quoted=true;}
    else if(ch===','){cells.push(field);field='';closed=false;}
    else if(ch==='\n'||ch==='\r'){finish();if(ch==='\r'&&text[i+1]==='\n')i++;line++;start=line;}
    else{if(closed)throw new Error(`Row ${line}: unexpected text after closing quote.`);field+=ch;}
  }
  if(quoted)throw new Error(`Row ${start}: unclosed quoted field. No data was imported.`);
  finish();return rows;
}
function date(value,label){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)throw new Error(`Invalid ${label}`);
  return value;
}
function time(value,label){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error(`Invalid ${label}; use an ISO timestamp with timezone`);
  date(value.slice(0,10),label);return value;
}
function numeric(value,label,{min=0,max=100000,integer=false,optional=false}={}){
  if(value===''&&optional)return null;
  if(value===''||!/^\d+(?:\.\d+)?$/.test(value))throw new Error(`${label} is not numeric`);
  const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error(`Invalid ${label.toLowerCase()} (${min}–${max}${integer?', whole numbers':''})`);
  return n;
}
function choice(value,values,label){if(!values.includes(value))throw new Error(`Invalid ${label}`);return value;}
const instant=value=>value?new Date(value).toISOString():'';
function fingerprint(r){
  return JSON.stringify(r.record_type==='set'?
    ['set',r.actual_workout_date,normalizeName(r.exercise),r.exercise_type,r.set_number,instant(r.logged_at),r.weight,r.actual_reps,r.unit,r.set_status,r.duration_seconds]:
    [r.record_type,r.actual_workout_date,r.scheduled_date,instant(r.workout_started_at),r.duration_minutes,r.workout_status,r.note]);
}
function existingFingerprints(data){
  const result=new Set();
  for(const w of data.workouts){
    const sets=data.workout_sets.filter(s=>s.workout_id===w.id);
    if(!sets.length)result.add(fingerprint({...w,record_type:w.workout_type==='cardio'?'cardio':'workout',workout_status:w.status}));
    for(const s of sets)result.add(fingerprint({...w,...s,record_type:'set',exercise:s.exercise_name,set_status:s.status}));
  }
  return result;
}
function validate(raw,line,warnings){
  const r={};for(const [k,v] of Object.entries(raw))r[k]=v.trim();
  // v2's spreadsheet escaping is reversible; retain original exercise/note text.
  for(const key of ['exercise','note','routine_name']){
    r[key]=raw[key]||'';
    if(r.csv_version==='2'&&/^'['=+\-@\t\r]/.test(r[key]))r[key]=r[key].slice(1);
  }
  if(r.csv_version&&!['1','2'].includes(r.csv_version))throw new Error('Unsupported CSV version');
  r.record_type=choice(r.record_type||((r.exercise||r.set_number||['strength','warmup','bodyweight'].includes(r.exercise_type))?'set':r.exercise_type==='cardio'?'cardio':'workout'),['set','cardio','workout'],'record type');
  r.actual_workout_date=date(r.actual_workout_date||'', 'workout date');
  r.scheduled_date=date(r.scheduled_date||r.actual_workout_date,'scheduled date');
  r.workout_type=choice(r.workout_type||(r.record_type==='cardio'?'cardio':'strength'),['strength','cardio'],'workout type');
  if((r.record_type==='set'&&r.workout_type!=='strength')||(r.record_type==='cardio'&&r.workout_type!=='cardio'))throw new Error('Record type conflicts with workout type');
  r.workout_status=choice(r.workout_status||'completed',['completed','in_progress'],'workout status');
  const fallback=`${r.actual_workout_date}T00:00:00.000Z`;
  if(!r.workout_started_at&&!r.logged_at)warnings.add('Some timestamps are missing. Those records use midnight UTC on their original workout date, never the import date.');
  r.workout_started_at=time(r.workout_started_at||r.logged_at||fallback,'workout start time');
  r.logged_at=time(r.logged_at||r.workout_started_at,'logged time');
  r.workout_completed_at=r.workout_status==='completed'?time(r.workout_completed_at||r.logged_at,'workout completion time'):null;
  if(r.workout_status==='in_progress'&&raw.workout_completed_at?.trim())throw new Error('An unfinished workout cannot have a completion time');
  if(r.workout_completed_at&&Date.parse(r.workout_completed_at)<Date.parse(r.workout_started_at))throw new Error('Workout completion is before its start');
  r.source=choice(r.source||(r.scheduled_date!==r.actual_workout_date?'makeup':'extra'),['makeup','scheduled','extra'],'workout source');
  if(r.note.length>2000)throw new Error('Note exceeds 2000 characters');
  if(r.record_type==='set'){
    if(!r.exercise.trim())throw new Error('Missing exercise name');
    if(r.exercise.length>160)throw new Error('Exercise name exceeds 160 characters');
    r.exercise_type=choice(r.exercise_type||'strength',['strength','warmup','bodyweight'],'exercise type');
    r.set_number=numeric(r.set_number||'','Set number',{min:1,max:20,integer:true});
    r.target_sets=numeric(r.target_sets||'','Target sets',{min:1,max:20,integer:true,optional:true});
    if(r.target_sets!==null&&r.set_number>r.target_sets)throw new Error('Set number exceeds target sets');
    r.set_status=choice(r.set_status||'completed',['completed','skipped'],'set status');
    r.unit=choice(r.unit||'lb',['lb','kg'],'weight unit');
    const warm=r.exercise_type==='warmup', skipped=r.set_status==='skipped';
    r.target_reps=numeric(r.target_reps||'','Target reps',{min:1,max:1000,integer:true,optional:true});
    r.actual_reps=numeric(r.actual_reps||'','Reps',{max:1000,integer:true,optional:warm||skipped});
    r.weight=numeric(r.weight||((warm||skipped)?'0':''),'Weight');
    r.duration_seconds=numeric(r.duration_seconds||(warm&&!skipped?'120':''),'Duration seconds',{min:1,max:86400,integer:true,optional:true});
    if(warm&&(r.weight!==0||r.actual_reps!==null||r.target_reps!==null||r.set_number!==1||(!skipped&&r.duration_seconds!==120)))throw new Error('Warm-up must be one timed 120-second step without weight or reps');
    r.progression_enabled=!r.progression_enabled?null:choice(r.progression_enabled,['true','false'],'progression flag')==='true';
    r.updated_at=time(r.updated_at||r.logged_at,'updated time');
  }else{
    r.duration_minutes=numeric(r.duration_minutes||'','Cardio duration',{min:1,max:1440,integer:true,optional:r.workout_type!=='cardio'});
  }
  r.explicit_start=!!raw.workout_started_at?.trim();r.explicit_completion=!!raw.workout_completed_at?.trim();
  r.line=line;
  r.group=r.workout_id?`id:${r.workout_id}`:`date:${r.actual_workout_date}|${r.scheduled_date}|${r.workout_type}|${raw.workout_started_at?.trim()||''}`;
  return r;
}

export function previewCSV(text,data){
  const parsed=parseCSV(text);if(!parsed.length)throw new Error('The CSV is empty.');
  const headers=parsed.shift().cells.map(s=>s.trim().toLowerCase());
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error('CSV column names must be nonempty and unique.');
  if(!headers.includes('actual_workout_date'))throw new Error('Missing required column: actual_workout_date.');
  const warnings=new Set(), invalid=[], candidates=[];
  const unknown=headers.filter(h=>!knownColumns.has(h));if(unknown.length)warnings.add(`Unrecognized columns are not imported: ${unknown.join(', ')}.`);
  for(const row of parsed){
    try{
      if(row.cells.length!==headers.length)throw new Error(`Expected ${headers.length} columns, found ${row.cells.length}`);
      candidates.push(validate(Object.fromEntries(headers.map((h,i)=>[h,row.cells[i]])),row.line,warnings));
    }catch(e){invalid.push({line:row.line,reason:e.message});}
  }
  // Reject internally inconsistent sessions, not arbitrary "last row wins" data.
  const groups=Map.groupBy(candidates,r=>r.group);
  const valid=[];
  for(const rows of groups.values()){
    const first=rows[0];let reason='';
    if(new Set(rows.filter(r=>r.explicit_start).map(r=>instant(r.workout_started_at))).size>1||new Set(rows.filter(r=>r.explicit_completion).map(r=>instant(r.workout_completed_at))).size>1)reason='Conflicting timestamps for the same workout ID';
    const targets=new Map(), slots=new Map();
    for(const r of rows){
      if(['actual_workout_date','scheduled_date','workout_type','workout_status','source'].some(k=>r[k]!==first[k]))reason='Conflicting workout details for the same workout ID';
      if(r.record_type!==first.record_type)reason='Conflicting record types for the same workout ID';
      if(r.record_type==='set'){
        const exercise=`${normalizeName(r.exercise)}|${r.exercise_type}`;
        const target=JSON.stringify([r.target_sets,r.target_reps,r.progression_enabled]);
        if(targets.has(exercise)&&targets.get(exercise)!==target)reason='Conflicting exercise targets in the same workout';
        targets.set(exercise,target);
        const slot=`${exercise}|${r.set_number}`, value=fingerprint(r);
        if(slots.has(slot)&&slots.get(slot)!==value)reason='Conflicting entries for the same exercise and set number';
        slots.set(slot,value);
      }
    }
    if(reason)for(const r of rows)invalid.push({line:r.line,reason});else valid.push(...rows);
  }
  const seen=existingFingerprints(data);
  for(const r of valid){r.duplicate=seen.has(fingerprint(r));seen.add(fingerprint(r));}
  if(valid.some(r=>r.record_type==='set'&&r.target_sets===null))warnings.add('Older CSVs omit historical set counts. Known exercises use at least their current set count; unknown exercises cannot earn progression without their original set targets.');
  if(valid.some(r=>r.record_type==='set'&&r.target_reps===null&&r.exercise_type!=='warmup'))warnings.add('Rows without target reps are preserved, but cannot establish progression.');
  const dates=valid.map(r=>r.actual_workout_date).sort();
  return {rows:valid,invalid:invalid.sort((a,b)=>a.line-b.line),detected:parsed.length,valid:valid.length,duplicates:valid.filter(r=>r.duplicate).length,dateStart:dates[0]||null,dateEnd:dates.at(-1)||null,exercises:new Set(valid.filter(r=>r.record_type==='set').map(r=>normalizeName(r.exercise))).size,warnings:[...warnings],revision:data.revision};
}

export function applyCSVImport(data,preview,{skipDuplicates=true}={}){
  if(preview.revision!==data.revision)throw new Error('Data changed after preview. Select the CSV again for a fresh preview.');
  const selected=preview.rows.filter(r=>!skipDuplicates||!r.duplicate);
  if(!selected.length)throw new Error('No new records to import.');
  const next=structuredClone(data), uid=next.profiles[0].user_id;
  const groups=new Map();
  // Explicit "Import anyway" keeps repeated rows in separate sessions, never overwrites a set.
  const occurrences=new Map();
  for(const r of selected){
    const slot=`${r.group}|${r.record_type}|${normalizeName(r.exercise||'')}|${r.set_number||''}`;
    const copy=occurrences.get(slot)||0;occurrences.set(slot,copy+1);
    const key=`${r.group}|copy:${copy}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  if([...groups.values()].filter(rows=>rows[0].workout_status==='in_progress').length+next.workouts.filter(w=>w.status==='in_progress').length>1)throw new Error('This import would create more than one unfinished workout. Finish your active session or import completed sessions first. No data was written.');
  for(const rows of groups.values()){
    const first=rows[0], wid=id(), routine=next.routines[0];
    const start=rows.reduce((a,r)=>Date.parse(r.workout_started_at)<Date.parse(a)?r.workout_started_at:a,first.workout_started_at);
    const completed=first.workout_status==='completed'?rows.reduce((a,r)=>Date.parse(r.workout_completed_at)>Date.parse(a)?r.workout_completed_at:a,first.workout_completed_at):null;
    const w={id:wid,user_id:uid,routine_id:first.workout_type==='strength'?routine.id:null,routine_name:first.routine_name|| (first.workout_type==='strength'?'Imported strength':'Cardio'),routine_snapshot:[],scheduled_date:first.scheduled_date,actual_workout_date:first.actual_workout_date,workout_started_at:start,workout_completed_at:completed,workout_type:first.workout_type,source:first.source,status:first.workout_status,duration_minutes:first.duration_minutes||null,note:first.record_type==='set'?'':first.note,timer_ends_at:null};
    const exerciseGroups=Map.groupBy(rows.filter(r=>r.record_type==='set'),r=>`${normalizeName(r.exercise)}|${r.exercise_type}`);
    for(const entries of exerciseGroups.values()){
      const r=entries[0];
      let ex=next.exercises.find(e=>normalizeName(e.name)===normalizeName(r.exercise)&&e.exercise_type===r.exercise_type);
      const targetSets=r.target_sets??Math.max(ex?.target_sets||1,...entries.map(e=>e.set_number));
      // Historical targets drive progression, never a CSV readiness assertion.
      const enabled=r.exercise_type==='strength'&&r.target_reps!==null&&(r.target_sets!==null||!!ex)&&(r.progression_enabled??ex?.progression_enabled??true)!==false;
      if(!ex){
        ex={id:id(),user_id:uid,routine_id:routine.id,name:r.exercise.trim(),exercise_type:r.exercise_type,target_sets:targetSets,target_reps:r.exercise_type==='warmup'?null:r.target_reps||1,duration_seconds:r.exercise_type==='warmup'?120:null,progression_enabled:enabled,position:next.exercises.length+1,active:false};next.exercises.push(ex);
      }
      const snapshot={...ex,name:r.exercise,target_sets:targetSets,target_reps:r.target_reps,progression_enabled:enabled,active:true};w.routine_snapshot.push(snapshot);
      for(const s of entries)next.workout_sets.push({id:id(),user_id:uid,workout_id:wid,exercise_id:ex.id,exercise_name:s.exercise,exercise_type:s.exercise_type,set_number:s.set_number,target_reps:s.target_reps,actual_reps:s.actual_reps,weight:s.weight,unit:s.unit,duration_seconds:s.duration_seconds,status:s.set_status,logged_at:s.logged_at,updated_at:s.updated_at,note:s.note});
    }
    next.workouts.push(w);
  }
  rebuildState(next);
  return {data:next,imported:selected.length,skippedInvalid:preview.invalid.length,skippedDuplicates:skipDuplicates?preview.duplicates:0};
}
