import { icon } from './icons.js';
import * as DB from './db.js';
import {id,timestamp,localDate,niceDate,dateObject,DAY_NAMES,todayPlan,steps,previousSet,progression,createWorkout} from './workout.js';
import {csv,backup,download} from './export.js';
import {previewCSV} from './import.js';
import {previewBackup} from './backup.js';
const $=s=>document.querySelector(s), main=$('#main');
const esc=(s='')=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toTitleCase=(value='')=>String(value)
  .replace(/\s+/g,' ')
  .trim()
  .split(/\s+/)
  .map(word => {
    const normalized = word.replace(/[\u2019\u2018]/g, "'");
    return normalized.split('-').map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part).join('-');
  })
  .join(' ');
let data, view='today', activeId=null, cursor=0, editingId=null, returnView='history', timer=null, busy=false, demoDate='', ready=null;
let csvPreview=null, csvFileName='', jsonPreview=null, jsonContents='', jsonFileName='', resetStage=0, resetRevision=null;
const resetDialog=$('#reset-dialog');
const now=()=>DB.demo && demoDate?dateObject(demoDate):new Date();
const active=()=>data.workouts.find(w=>w.id===activeId);
function message(text=''){ $('#message').textContent=text; }
function number(form,name,{min=0,max=100000,integer=false}={}) {
  const raw=new FormData(form).get(name), n=Number(raw);
  if(raw===null || String(raw).trim()==='' || !Number.isFinite(n) || n<min || n>max || (integer&&!Number.isInteger(n))) throw new Error(`Enter a valid ${name.replaceAll('_',' ')} (${min}–${max}).`);
  return n;
}
async function commit(change) {const next=structuredClone(data);change(next);data=await DB.save(next);}
function button(text,action,extra='',cls='secondary'){return `<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;}
const navigationIcons={today:'house',history:'history',routine:'list-ordered',schedule:'calendar-days',data:'database'};
function nav(){
  document.body.dataset.view=view;
  $('#header-date').textContent=now().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  $('#settings-button').innerHTML=icon('settings');
  $('#settings-button').hidden=!data;
  $('#settings-button').setAttribute('aria-pressed',String(view==='settings'));
  $('#nav').hidden=!data;
  $('#nav').innerHTML=Object.entries(navigationIcons).map(([v,name])=>`<button data-view="${v}" ${(view===v||(view==='workout'||view==='cardio')&&v==='today'||(view==='import'||view==='restore')&&v==='data')?'aria-current="page"':''}>${icon(name)}<span>${v[0].toUpperCase()+v.slice(1)}</span></button>`).join('');
}
function render(){clearInterval(timer);nav();if(!data)return auth();({today:home,workout:workout,history:history,routine:routine,schedule:schedule,data:dataView,import:importView,restore:restoreView,settings:settings,edit:edit,cardio:cardio}[view]||home)();decorate();}
function go(v){view=v;ready=null;message();render();main.focus();window.scrollTo(0,0);}
function home(){
  const plan=todayPlan(data,now()), w=data.workouts.find(w=>w.status==='in_progress');
  const p=plan.makeup||plan.scheduled, make=!!plan.makeup;
  let title='Rest day', description='A little time to recover.', action='';
  if(p){
    title=make?`${toTitleCase(`${DAY_NAMES[dateObject(p.scheduled_date).getDay()]} strength`)} <br> ${toTitleCase('workout')}`:(p.workout_type==='strength'?'Full-Body <br> Strength':`${toTitleCase(`${p.cardio_duration_minutes}-minute`)} <br> ${toTitleCase('cardio')}`);
    description=make?`${DAY_NAMES[dateObject(p.scheduled_date).getDay()]} workout not completed`:p.done?'Completed today. Nicely done.':'Scheduled today';
    if(!p.done)action=button(make?`Do ${DAY_NAMES[dateObject(p.scheduled_date).getDay()]} workout today`:p.workout_type==='strength'?'Start workout':'Log cardio','start',`data-plan="${make?'makeup':'scheduled'}"`,'primary');
  }
  if(w&&!(make&&w.scheduled_date===p.scheduled_date&&w.workout_type==='strength')) action=button('Resume workout','resume',`data-id="${w.id}"`,'primary')+'<p class="muted">Your session is saved. Pick up where you left off.</p>';
  const next=plan.next;
  main.innerHTML=`<section class="hero"><div class="hero-symbol">${icon(make?'calendar-clock':p?.workout_type==='strength'?'dumbbell':p?.workout_type==='cardio'?'activity':'moon')}</div><p class="eyebrow">TODAY’S SESSION</p><h1>${title}</h1><p class="muted">${description}</p>${make?`<p class="makeup-dates"><strong>Make-up available today</strong>Scheduled ${DAY_NAMES[dateObject(p.scheduled_date).getDay()]}<span>Today is ${DAY_NAMES[now().getDay()]}</span></p>`:''}${action}</section>${make&&plan.scheduled&&!plan.scheduled.done&&!w?button('Log today’s scheduled session','start','data-plan="scheduled"'):''}<div class="next"><p class="eyebrow">UP NEXT</p><div class="next-session">${next?`${icon(next.workout_type==='strength'?'dumbbell':'activity')}<div><strong>${DAY_NAMES[dateObject(next.date).getDay()]}</strong><span class="muted">${next.workout_type==='strength'?'Full-body strength':`${next.cardio_duration_minutes}-minute cardio`}</span></div>`:'No sessions scheduled'}</div></div>${!w?button('Start an extra strength session','extra','','secondary'):''}`;
}
async function start(plan){
  const existing=data.workouts.find(w=>w.status==='in_progress');
  if(existing){
    if(plan.source==='makeup'&&existing.workout_type==='strength'&&existing.scheduled_date===plan.scheduled_date)await commit(d=>Object.assign(d.workouts.find(w=>w.id===existing.id),{actual_workout_date:plan.actual_workout_date,source:'makeup'}));
    activeId=existing.id;resume();return;
  }
  const w=createWorkout(data,plan); await commit(d=>d.workouts.push(w));activeId=w.id;cursor=0;go(w.workout_type==='cardio'?'cardio':'workout');
}
function resume(){
  const w=active(), all=steps(w);cursor=all.findIndex(({ex,set_number})=>!data.workout_sets.some(s=>s.workout_id===w.id&&s.exercise_id===ex.id&&s.set_number===set_number));
  if(cursor<0)cursor=all.length;go(w.workout_type==='cardio'?'cardio':'workout');
}
function workout(){
  const w=active();if(!w){go('today');return;}
  if(ready){main.innerHTML=`<section class="card"><div class="success-symbol">${icon('trending-up')}</div><p class="eyebrow">READY TO INCREASE</p><h1>${esc(ready.ex.name)}</h1><p>You completed all ${ready.ex.target_sets} sets at ${ready.result.weight} ${esc(ready.result.unit)} for the target reps.</p><div class="notice"><strong>${icon('trending-up')}Increase weight next workout.</strong><p>You choose the next weight.</p></div>${button('Continue','continue','','primary')}</section>`;return;}
  const all=steps(w), step=all[cursor];
  if(!step){
    const skipped=data.workout_sets.filter(s=>s.workout_id===w.id&&s.status==='skipped').length;
    main.innerHTML=`<section class="card"><p class="eyebrow">SESSION REVIEW</p><div class="section-symbol">${icon('circle-check')}</div><h1>Session complete</h1><p>${all.length-skipped} of ${all.length} steps logged${skipped?` · ${skipped} skipped`:''}. Finish to save this session as completed.</p>${button('Finish workout','finish','','primary')}${button('Back to last set','back')}</section>`;return;
  }
  const {ex,set_number}=step, saved=data.workout_sets.find(s=>s.workout_id===w.id&&s.exercise_id===ex.id&&s.set_number===set_number), last=previousSet(data,ex.id,set_number,w.id), state=data.exercise_state.find(s=>s.exercise_id===ex.id);
  const warm=ex.exercise_type==='warmup';
  main.innerHTML=`<section class="card"><p class="counter">Exercise ${w.routine_snapshot.findIndex(e=>e.id===ex.id)+1} of ${w.routine_snapshot.length} <span aria-hidden="true">/</span> ${warm?'Warm-up':`Set ${set_number} of ${ex.target_sets}`}</p><div class="progress" role="progressbar" aria-label="Workout progress" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${cursor}"><span style="width:${cursor/all.length*100}%"></span></div><div class="exercise-kind">${icon(warm?'activity':'dumbbell')}<span>${warm?'PREPARE & MOVE':'STRENGTH'}</span></div><h1 class="exercise-title">${esc(ex.name)}</h1>${warm?`<p class="muted">Any warm-up activity. Two minutes to get moving.</p><div class="timer" id="timer" role="timer">2:00</div>${button(w.timer_ends_at?'Restart timer':'Start 2-minute timer','timer')}${button('Complete warm-up','warmup','','primary')}`:`${state?.increase_next_time&&ex.progression_enabled?`<div class="notice"><strong>${icon('trending-up')}INCREASE WEIGHT TODAY</strong><p>Previous completed weight: ${state.mastered_weight} ${esc(state.unit)}. Choose your weight.</p></div>`:''}<div class="target">${ex.target_sets} × ${ex.target_reps} <small>sets × reps</small><span class="set-pill">Set ${set_number} of ${ex.target_sets}</span></div><p class="last">Last time: ${last?`${last.weight} ${esc(last.unit)} × ${last.actual_reps}`:'No history yet — start with your chosen weight.'}</p>${ex.exercise_type==='bodyweight'?'<p class="muted">Decline abdominal bench · enter 0 for bodyweight. Positive values may record added weight or assist; note which in History. No automatic progression.</p>':''}<form id="set-form"><div class="fields"><label>Weight (${esc(saved?.unit||last?.unit||'lb')})<input class="big-input" name="weight" type="number" inputmode="decimal" min="0" max="100000" step="0.01" required value="${saved?.weight??last?.weight??0}"></label><label>Reps<input class="big-input" name="reps" type="number" inputmode="numeric" min="0" max="1000" step="1" required value="${saved?.actual_reps??ex.target_reps}"></label></div><button class="primary" type="submit">${saved?'Update set & continue':'Complete set'}</button></form>`}<div class="controls">${button('Back','back','','text')}${button('Skip set','skip','','text')}${button('Edit previous entry','previous','','text')}</div></section><p class="muted">${DB.demo?'Saved on this browser':'Saved to your database'} after every set. You can leave and resume.</p>`;
  if(warm&&w.timer_ends_at){tick();timer=setInterval(tick,250);}
}
function tick(){const end=active()?.timer_ends_at, el=$('#timer');if(!el||!end)return;const seconds=Math.max(0,Math.ceil((new Date(end)-Date.now())/1000));el.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(!seconds){clearInterval(timer);el.innerHTML=`${icon('check')}<span>Ready</span>`;}}
async function record(status,form){
  const w=active(), step=steps(w)[cursor];if(!step)return;
  const {ex,set_number}=step, warm=ex.exercise_type==='warmup', existing=data.workout_sets.find(s=>s.workout_id===w.id&&s.exercise_id===ex.id&&s.set_number===set_number);
  const row={id:existing?.id||id(),user_id:w.user_id,workout_id:w.id,exercise_id:ex.id,exercise_name:ex.name,exercise_type:ex.exercise_type,set_number,target_reps:ex.target_reps,actual_reps:warm||status==='skipped'?null:number(form,'reps',{max:1000,integer:true}),weight:warm||status==='skipped'?0:number(form,'weight'),unit:existing?.unit||previousSet(data,ex.id,set_number,w.id)?.unit||'lb',duration_seconds:warm&&status==='completed'?120:null,status,logged_at:existing?.logged_at||timestamp(),updated_at:timestamp(),note:existing?.note||''};
  await commit(d=>{const i=d.workout_sets.findIndex(s=>s.id===row.id);if(i<0)d.workout_sets.push(row);else d.workout_sets[i]=row;});
  const result=progression(ex,data.workout_sets.filter(s=>s.workout_id===w.id&&s.exercise_id===ex.id));cursor++;
  if(result&&set_number===ex.target_sets)ready={ex,result};render();
}
function cardio(){const w=active();main.innerHTML=`<section class="card"><p class="eyebrow">${esc(niceDate(w.actual_workout_date))}</p><div class="section-symbol">${icon('activity')}</div><h1>Cardio.</h1><p class="muted">Log your cardio, keep it simple.</p><form id="cardio-form"><label>Duration (minutes)<input name="duration" type="number" min="1" max="1440" required value="${w.duration_minutes||30}"></label><label style="margin-top:20px">Note (optional)<textarea name="note" maxlength="2000">${esc(w.note)}</textarea></label><button class="primary">Complete cardio</button></form></section>`;}
function history(){
  main.innerHTML=`<p class="eyebrow">${icon('history')} PAST SESSIONS</p><h1>${toTitleCase('Your history')}</h1><label class="date-filter">Filter by workout date<input type="date" id="history-date"></label><div id="history-list"></div>`;historyList('');
}
function historyList(date){
  const list=data.workouts.filter(w=>!date||w.actual_workout_date===date).sort((a,b)=>b.workout_started_at.localeCompare(a.workout_started_at));
  $('#history-list').innerHTML=list.length?list.map(w=>`<details class="card"><summary>${esc(niceDate(w.actual_workout_date))} · ${w.workout_type==='strength'?'Strength':'Cardio'} <span class="pill">${w.status.replaceAll('_',' ')}</span></summary><p class="muted">Scheduled: ${esc(niceDate(w.scheduled_date))}<br>Started: ${esc(new Date(w.workout_started_at).toLocaleString())}<br>Completed: ${w.workout_completed_at?esc(new Date(w.workout_completed_at).toLocaleString()):'In progress'}</p>${w.workout_type==='cardio'?`<p>${w.duration_minutes} minutes</p><p>${esc(w.note)}</p>${button('Correct cardio entry','edit-cardio',`data-id="${w.id}"`)}`:w.routine_snapshot.map(ex=>{const sets=data.workout_sets.filter(s=>s.workout_id===w.id&&s.exercise_id===ex.id).sort((a,b)=>a.set_number-b.set_number);return sets.length?`<div class="history-exercise"><h3>${esc(ex.name)}</h3>${sets.map(s=>`<div class="history-set"><div>${s.exercise_type==='warmup'?`Warm-up: ${s.status==='skipped'?'skipped':`${s.duration_seconds} sec`}`:`Set ${s.set_number}: ${s.status==='skipped'?'skipped':`${s.weight} ${esc(s.unit)} × ${s.actual_reps}`}`}<small class="muted">${s.note?`<br>${esc(s.note)}`:''}</small></div>${button('Edit','edit-set',`data-id="${s.id}"`,'text')}</div>`).join('')}</div>`:'';}).join('')}${w.status==='in_progress'?button('Resume session','resume',`data-id="${w.id}"`):''}</details>`).join(''):'<p class="muted empty">No workouts here yet. Your next session starts the story.</p>';
}
function edit(){
  const s=data.workout_sets.find(s=>s.id===editingId), w=data.workouts.find(w=>w.id===editingId);
  if(w){main.innerHTML=`<section class="card"><h2>Correct cardio</h2><form id="edit-cardio-form"><label>Duration (minutes)<input type="number" name="duration" min="1" max="1440" required value="${w.duration_minutes}"></label><label>Note<textarea name="note" maxlength="2000">${esc(w.note)}</textarea></label><button class="primary">Save correction</button></form>${button('Cancel','cancel-edit')}</section>`;return;}
  if(!s){go('history');return;}
  main.innerHTML=`<section class="card"><p class="eyebrow">CORRECT AN ENTRY</p><h2>${esc(s.exercise_name)}</h2><p class="muted">Set ${s.set_number} · Originally logged ${esc(new Date(s.logged_at).toLocaleString())}</p><form id="edit-form"><label>Status<select name="status"><option value="completed" ${s.status==='completed'?'selected':''}>Completed</option><option value="skipped" ${s.status==='skipped'?'selected':''}>Skipped</option></select></label>${s.exercise_type==='warmup'?'<p>Warm-up duration: 120 seconds.</p>':`<div class="fields"><label>Weight (${esc(s.unit)})<input name="weight" type="number" min="0" max="100000" step="0.01" required value="${s.weight}"></label><label>Reps<input name="reps" type="number" min="0" max="1000" required value="${s.actual_reps??s.target_reps}"></label></div>`}<label>Note (optional, e.g. added weight or assist)<textarea name="note" maxlength="2000">${esc(s.note)}</textarea></label><button class="primary">Save correction</button></form>${button('Cancel','cancel-edit')}</section>`;
}
function routine(){
  const exercises=[...data.exercises].sort((a,b)=>a.position-b.position);
  main.innerHTML=`<p class="eyebrow">${icon('list-ordered')} YOUR TRAINING PLAN</p><h1>${toTitleCase('Your routine')}</h1><p class="muted">Changes apply to new workouts. Existing sessions keep their original routine.</p>${exercises.map((e,i)=>`<details class="card editor"><summary>${icon('grip-vertical')}<span class="routine-summary"><span>${esc(e.name)} ${!e.active?'· off':''}</span><small>${e.exercise_type==='warmup'?'2 minutes · timed':`${e.target_sets} sets × ${e.target_reps} reps`}</small></span>${icon('pencil')}</summary><form class="exercise-form" data-id="${e.id}"><label>Name<input name="name" maxlength="160" required value="${esc(e.name)}"></label>${e.exercise_type==='warmup'?'<p class="muted">Timed warm-up · 120 seconds · any warm-up activity</p>':`<div class="fields"><label>Sets<input name="sets" type="number" min="1" max="20" required value="${e.target_sets}"></label><label>Target reps<input name="reps" type="number" min="1" max="1000" required value="${e.target_reps}"></label></div>`}<label class="row" style="margin-top:16px"><input name="active" type="checkbox" ${e.active?'checked':''}>Enabled</label><button class="primary">Save exercise</button></form><div class="controls">${button('Move up','move',`data-id="${e.id}" data-direction="-1" ${i===0?'disabled':''}`,'text')}${button('Move down','move',`data-id="${e.id}" data-direction="1" ${i===exercises.length-1?'disabled':''}`,'text')}</div></details>`).join('')}<details class="card"><summary>Add an exercise</summary><form id="add-exercise" class="stack"><label>Name<input name="name" required maxlength="160"></label><label>Type<select name="type"><option value="strength">Weighted strength</option><option value="bodyweight">Bodyweight / assisted</option></select></label><div class="fields"><label>Sets<input name="sets" type="number" min="1" max="20" value="3" required></label><label>Target reps<input name="reps" type="number" min="1" max="1000" value="8" required></label></div><button class="primary">Add exercise</button></form></details>`;
}
function schedule(){
  main.innerHTML=`<p class="eyebrow">${icon('calendar-days')} YOUR WEEK</p><h1>A rhythm that fits.</h1><p class="muted">Make-up days offer the previous day’s missed strength session. Saved workouts keep both dates.</p><form id="schedule-form" class="card">${[...data.weekly_schedule].sort((a,b)=>a.day_of_week-b.day_of_week).map(s=>`<details class="schedule-row"><summary><span class="day-abbrev">${DAY_NAMES[s.day_of_week].slice(0,3)}</span>${icon(s.workout_type==='strength'?'dumbbell':s.workout_type==='cardio'?'activity':s.makeup_for_day!==null?'calendar-clock':'moon')}<span class="schedule-summary">${s.workout_type[0].toUpperCase()+s.workout_type.slice(1)}${s.makeup_for_day!==null?'<small>Make-up available</small>':s.workout_type==='cardio'?`<small>${s.cardio_duration_minutes} minutes</small>`:''}</span>${icon('chevron-down')}</summary><div class="schedule-options"><label>Session<select name="type_${s.day_of_week}">${['strength','cardio','rest'].map(t=>`<option value="${t}" ${s.workout_type===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></label><label>Cardio minutes<input name="duration_${s.day_of_week}" type="number" min="1" max="1440" value="${s.cardio_duration_minutes||30}" required></label><label>Offer missed strength from<select name="makeup_${s.day_of_week}"><option value="">None</option>${DAY_NAMES.map((n,i)=>i!==(s.day_of_week+6)%7?'':`<option value="${i}" ${s.makeup_for_day===i?'selected':''}>${n}</option>`).join('')}</select></label></div></details>`).join('')}<button class="primary">Save schedule</button></form>`;
}
function dataView(){
  main.innerHTML=`<p class="eyebrow">${icon('database')} YOUR DATA</p><h1>Your work.<br>Your data.</h1><section class="card"><h2>Back up & restore</h2><p class="muted">${data.workouts.length} workouts · ${data.workout_sets.length} set records.</p><div class="export-actions">${button('Export CSV','csv','','export-action')}<p>Download workout records for analysis.</p>${button('Export JSON Backup','json','','export-action')}<p>Create a complete backup of the app.</p>${button('Import CSV','choose-csv',DB.demo?'':'disabled','export-action')}<p>Restore or add historical workout records. Preview before saving.</p>${button('Import JSON Backup','choose-json',DB.demo?'':'disabled','export-action')}<p>Restore a complete application backup, including routine and schedule.</p></div><input id="json-file" type="file" accept=".json,application/json" hidden aria-label="Choose JSON backup"><input id="csv-file" type="file" accept=".csv,text/csv" hidden aria-label="Choose workout CSV"><p class="muted import-footnote">CSV adds historical records. JSON restores a complete backup and replaces the current log after your confirmation.</p>${!DB.demo?'<p class="muted">Import and restore are currently available in Local Demo Mode only.</p>':''}</section><section class="danger-zone" aria-labelledby="danger-heading"><p class="eyebrow">${icon('triangle-alert')} DATA MANAGEMENT</p><h2 id="danger-heading">Reset this app</h2><p class="muted">Remove workout history, logged sets, cardio records, progression state, progress events, routine customizations, and schedule customizations. The default routine and schedule will be restored. Export a backup first.</p>${button('Reset Everything','reset-open','','danger-button')}</section>`;
}
function importView(){
  if(!csvPreview){go('data');return;}
  const p=csvPreview;
  main.innerHTML=`<p class="eyebrow">${icon('upload')} REVIEW BEFORE SAVING</p><h1>Import Preview</h1><p class="muted import-filename">${esc(csvFileName)}</p><section class="card"><dl class="import-stats"><div><dt>Rows detected</dt><dd>${p.detected}</dd></div><div><dt>Valid rows</dt><dd>${p.valid}</dd></div><div><dt>Need attention</dt><dd>${p.invalid.length}</dd></div></dl><p class="muted">Date range<br><strong>${p.dateStart?`${esc(niceDate(p.dateStart))} – ${esc(niceDate(p.dateEnd))}`:'No valid dates'}</strong></p><p class="muted">Exercises detected: <strong>${p.exercises}</strong></p>${p.duplicates?`<div class="notice"><strong>${icon('info')}${p.duplicates} records appear to already exist.</strong><p>Includes duplicates already in your log or repeated within this CSV.</p></div><fieldset class="duplicate-options"><legend>Handle likely duplicates</legend><label><input type="radio" name="duplicates" value="skip" checked>Skip duplicates</label><label><input type="radio" name="duplicates" value="keep">Import anyway</label></fieldset>`:''}${p.warnings.length?`<div class="import-warnings"><h3>Before you import</h3><ul>${p.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}${p.invalid.length?`<details class="import-errors" open><summary>${icon('triangle-alert')}${p.invalid.length} rows need attention</summary><ul>${p.invalid.map(r=>`<li><strong>Row ${r.line}</strong><span>${esc(r.reason)}</span></li>`).join('')}</ul><p class="muted">These rows will be skipped. You can import the valid rows now, or cancel and correct the file.</p></details>`:''}${p.rows.length?`<details class="import-sample"><summary>${icon('history')}Preview first ${Math.min(p.rows.length,5)} valid records</summary><ul>${p.rows.slice(0,5).map(r=>`<li><strong>${esc(r.record_type==='set'?r.exercise:r.workout_type==='cardio'?'Cardio':'Strength session')}</strong><span>${esc(r.actual_workout_date)} · ${r.record_type==='set'?`Set ${r.set_number} · ${r.set_status==='skipped'?'skipped':r.exercise_type==='warmup'?`${r.duration_seconds} seconds`:`${r.weight} ${esc(r.unit)} × ${r.actual_reps}`}`:r.record_type==='cardio'?`${r.duration_minutes} minutes`:esc(r.workout_status)}</span></li>`).join('')}</ul></details>`:''}<p class="muted">Nothing has been saved yet. Unknown exercises stay inactive; your current routine and schedule are preserved.</p>${button('Import records','confirm-import','id="confirm-import"','primary')}${button('Cancel','cancel-import')}</section>`;
  updateImportButton();
}
function updateImportButton(){
  const el=$('#confirm-import');if(!el||!csvPreview)return;
  const skip=$('input[name=duplicates]:checked')?.value!=='keep';
  const count=csvPreview.valid-(skip?csvPreview.duplicates:0);
  el.innerHTML=`${icon('upload')}Import ${count} Records`;el.disabled=busy||count===0;
}
async function selectCSV(file){
  if(!file)return;
  if(file.size>10*1024*1024)throw new Error('Choose a CSV smaller than 10 MB. No data was imported.');
  csvFileName=file.name;csvPreview=previewCSV(await file.text(),data);go('import');
}
async function selectJSON(file){
  if(!file)return;
  if(file.size>10*1024*1024)throw new Error('Choose a JSON backup smaller than 10 MB. No data was restored.');
  jsonContents=await file.text();jsonFileName=file.name;jsonPreview=previewBackup(jsonContents,data);go('restore');
}
function restoreView(){
  if(!jsonPreview){go('data');return;}
  const p=jsonPreview;
  main.innerHTML=`<p class="eyebrow">${icon('file-json')} REVIEW BEFORE RESTORING</p><h1>Restore backup</h1><p class="muted import-filename">${esc(jsonFileName)}</p><section class="card"><dl class="import-stats"><div><dt>Workouts</dt><dd>${p.workouts}</dd></div><div><dt>Logged sets</dt><dd>${p.sets}</dd></div><div><dt>Exercises</dt><dd>${p.exercises}</dd></div></dl><div class="notice"><strong>${icon('triangle-alert')}This replaces the current log.</strong><p>Your current ${data.workouts.length} workouts, routine changes, and schedule changes will be replaced by this backup. Export them first if you want to keep a copy.</p></div>${p.scheduleUpdated?'<p class="muted">This backup has the old unchanged default schedule. Tuesday will become Rest with Monday make-up available.</p>':''}<p class="muted">Original dates and records are preserved. Progression is recalculated from the restored sets.</p>${button('Export Current Backup First','json')}${button('Restore JSON Backup','confirm-restore','','danger-button restore-confirm')}${button('Cancel','cancel-restore')}</section>`;
}
function resetContent(stage){
  resetStage=stage;
  resetDialog.innerHTML=`<div class="reset-dialog-content"><div class="section-symbol">${icon('triangle-alert')}</div><p class="eyebrow">STEP ${stage} OF 2</p><h2 id="reset-title">${stage===1?'Reset all workout data?':'Type RESET to confirm.'}</h2><div id="reset-description">${stage===1?`<p>This will permanently remove your:</p><ul><li>workout history</li><li>logged sets</li><li>cardio records</li><li>progression state</li><li>progress and milestone events</li><li>routine customizations</li><li>schedule customizations</li></ul>`:'<p>All workout data and customizations for this app on this address will be removed. The default routine and schedule will be restored.</p>'}<p><strong>This cannot be undone unless you have exported a backup.</strong></p></div><div class="backup-reminder">${button('Export Backup First','reset-backup','','secondary')}<p>Keep a complete JSON copy before deleting your data.</p></div><p id="reset-error" role="alert"></p>${stage===2?`<form id="reset-form"><label>Type RESET to confirm<input id="reset-word" name="confirmation" autocomplete="off" autocapitalize="off" spellcheck="false" required pattern="RESET" aria-describedby="reset-description"></label><button id="reset-final" class="danger-button" type="submit" disabled>${icon('rotate-ccw')}Reset Everything</button></form>`:''}<div class="reset-actions">${button('Cancel','reset-cancel','','secondary')}${stage===1?button('Continue to Reset','reset-continue','','danger-button'):''}</div></div>`;
  resetDialog.querySelectorAll('button[data-action]').forEach(b=>b.insertAdjacentHTML('afterbegin',icon(b.dataset.action==='reset-backup'?'file-json':b.dataset.action==='reset-cancel'?'arrow-left':'arrow-right')));
}
function syncResetButton(){const el=$('#reset-final');if(el)el.disabled=busy||resetStage!==2||$('#reset-word').value!=='RESET';}
function closeReset(){resetDialog.close();resetStage=0;resetRevision=null;resetDialog.innerHTML='';}
function settings(){ main.innerHTML=`<p class="eyebrow">${icon('settings')} PREFERENCES</p><h1>Settings.</h1><section class="card"><h2>${DB.demo?'Local storage':'Connected database'}</h2><p class="muted">${DB.demo?'Your data stays in this browser on this address. Clearing site data removes it. Export a backup before switching browsers or connecting a database.':'Workouts are stored in your connected database. An internet connection is required to save. Sign in again after a page reload.'}</p><p class="muted">Weight unit: lb. You choose every weight; the app never calculates the next increment.</p>${!DB.demo?button('Sign out','signout'):''}</section>${DB.demo?`<section class="card"><h2>Preview a date</h2><p class="muted">Use a different date to preview workout planning while testing locally. Logging timestamps remain automatic. Reload returns to today.</p><form id="demo-date-form"><label>Calendar date<input type="date" name="date" value="${demoDate}" required></label><button class="primary">Use selected date</button></form>${button('Use today','real-date')}</section>`:''}<section class="card"><h2>On your iPhone</h2><p class="muted">Open the app in Safari, tap Share, then Add to Home Screen. Installation and offline caching require HTTPS (or localhost on this computer).</p></section>`; }
function auth(){main.innerHTML=`<section class="card"><p class="eyebrow">Tahmid’s personal training log</p><h1>${toTitleCase('Welcome back')}</h1><form id="auth-form" class="auth"><label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required></label><button class="primary" name="intent" value="signin">Sign in</button><button name="intent" value="signup">Create account</button></form></section>`;}
async function action(name,el){
  if(name==='choose-json')$('#json-file').click();
  if(name==='cancel-restore'){jsonPreview=null;jsonContents='';jsonFileName='';go('data');}
  if(name==='confirm-restore'){data=await DB.restoreJSON(jsonContents,jsonPreview.revision);jsonPreview=null;jsonContents='';jsonFileName='';activeId=null;cursor=0;editingId=null;demoDate='';go('today');message('JSON backup restored. Original records and dates are preserved.');}
  if(name==='choose-csv')$('#csv-file').click();
  if(name==='cancel-import'){csvPreview=null;csvFileName='';go('data');}
  if(name==='confirm-import'){
    const result=await DB.importCSV(csvPreview,{skipDuplicates:$('input[name=duplicates]:checked')?.value!=='keep'});
    data=result.data;csvPreview=null;csvFileName='';go('data');
    message(`Imported ${result.imported} records. Skipped ${result.skippedDuplicates} duplicates and ${result.skippedInvalid} invalid rows. Progression recalculated.`);
  }
  if(name==='reset-open'){resetRevision=data.revision;resetContent(1);resetDialog.showModal();resetDialog.querySelector('[data-action=reset-cancel]').focus();}
  if(name==='reset-continue'&&resetStage===1){resetContent(2);$('#reset-word').focus();}
  if(name==='reset-cancel')closeReset();
  if(name==='reset-backup')download(`tahmid-workout-backup-${localDate()}.json`,backup(data),'application/json');

  if(name==='start'){const plan=todayPlan(data,now());await start(plan[el.dataset.plan]);}
  if(name==='extra')await start({workout_type:'strength',routine_id:data.routines[0].id,scheduled_date:localDate(now()),actual_workout_date:localDate(now()),source:'extra'});
  if(name==='resume'){activeId=el.dataset.id;resume();}
  if(name==='continue'){ready=null;render();}
  if(name==='back'){if(cursor>0)cursor--;else return go('today');ready=null;render();}
  if(name==='skip')await record('skipped');
  if(name==='warmup')await record('completed');
  if(name==='timer'){await commit(d=>d.workouts.find(w=>w.id===activeId).timer_ends_at=new Date(Date.now()+120000).toISOString());render();}
  if(name==='finish'){await commit(d=>{const w=d.workouts.find(w=>w.id===activeId);w.status='completed';w.workout_completed_at=timestamp();});go('today');message('Workout completed. Every set is saved.');}
  if(name==='previous'){
    const w=active(), earlier=steps(w).slice(0,cursor).reverse().map(t=>data.workout_sets.find(s=>s.workout_id===w.id&&s.exercise_id===t.ex.id&&s.set_number===t.set_number)).find(Boolean);
    if(!earlier){message('No previous entry yet.');return;} editingId=earlier.id;returnView='workout';go('edit');
  }
  if(name==='edit-set'||name==='edit-cardio'){editingId=el.dataset.id;returnView='history';go('edit');}
  if(name==='cancel-edit')go(returnView);
  if(name==='csv')download(`tahmid-workouts-${localDate()}.csv`,csv(data),'text/csv;charset=utf-8');
  if(name==='json')download(`tahmid-workout-backup-${localDate()}.json`,backup(data),'application/json');
  if(name==='real-date'){demoDate='';go('today');}
  if(name==='signout'){await DB.signOut();data=null;render();}
  if(name==='move'){
    await commit(d=>{const list=d.exercises.sort((a,b)=>a.position-b.position), i=list.findIndex(e=>e.id===el.dataset.id), j=i+Number(el.dataset.direction);if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];list.forEach((e,k)=>e.position=k+1);});render();
  }
}
async function submit(form,submitter){
  const f=new FormData(form);
  if(form.id==='reset-form'){
    if(!resetDialog.open||resetStage!==2||f.get('confirmation')!=='RESET')throw new Error('Type RESET exactly to confirm.');
    data=await DB.resetEverything(f.get('confirmation'),resetRevision);
    closeReset();activeId=null;cursor=0;editingId=null;ready=null;demoDate='';csvPreview=null;csvFileName='';jsonPreview=null;jsonContents='';jsonFileName='';
    go('today');message('All workout data has been reset.');return;
  }

  if(form.id==='auth-form'){
    if(submitter?.value==='signup'){await DB.signUp(f.get('email').trim(),f.get('password'));message('Account created. Confirm your email if required, then sign in.');}
    else{data=await DB.signIn(f.get('email').trim(),f.get('password'));go('today');}return;
  }
  if(form.id==='set-form')return record('completed',form);
  if(form.id==='cardio-form'||form.id==='edit-cardio-form'){
    const duration=number(form,'duration',{min:1,max:1440,integer:true});
    await commit(d=>{const w=d.workouts.find(w=>w.id===(form.id==='cardio-form'?activeId:editingId));w.duration_minutes=duration;w.note=f.get('note').trim();if(form.id==='cardio-form'){w.status='completed';w.workout_completed_at=timestamp();}});go(form.id==='cardio-form'?'today':'history');message('Cardio saved.');
  }
  if(form.id==='edit-form'){
    const original=data.workout_sets.find(s=>s.id===editingId), warm=original.exercise_type==='warmup', skipped=f.get('status')==='skipped';
    const weight=warm||skipped?0:number(form,'weight'), reps=warm||skipped?null:number(form,'reps',{max:1000,integer:true});
    await commit(d=>Object.assign(d.workout_sets.find(s=>s.id===editingId),{weight,actual_reps:reps,status:f.get('status'),duration_seconds:warm&&!skipped?120:null,note:f.get('note').trim(),updated_at:timestamp()}));go(returnView);message('Correction saved. Progression has been recalculated.');
  }
  if(form.classList.contains('exercise-form')||form.id==='add-exercise'){
    const original=data.exercises.find(e=>e.id===form.dataset.id), warm=original?.exercise_type==='warmup', name=f.get('name').trim();if(!name)throw new Error('Enter an exercise name.');
    const target_sets=warm?1:number(form,'sets',{min:1,max:20,integer:true}),target_reps=warm?null:number(form,'reps',{min:1,max:1000,integer:true});
    await commit(d=>{if(original)Object.assign(d.exercises.find(e=>e.id===original.id),{name,target_sets,target_reps,active:f.has('active')});else d.exercises.push({id:id(),user_id:d.profiles[0].user_id,routine_id:d.routines[0].id,name,target_sets,target_reps,exercise_type:f.get('type'),duration_seconds:null,progression_enabled:f.get('type')==='strength',active:true,position:d.exercises.length+1});});render();message('Routine saved for future sessions.');
  }
  if(form.id==='schedule-form'){
    const rows=data.weekly_schedule.map(s=>({...s,workout_type:f.get(`type_${s.day_of_week}`),cardio_duration_minutes:f.get(`type_${s.day_of_week}`)==='cardio'?number(form,`duration_${s.day_of_week}`,{min:1,max:1440,integer:true}):null,routine_id:f.get(`type_${s.day_of_week}`)==='strength'?data.routines[0].id:null,makeup_for_day:f.get(`makeup_${s.day_of_week}`)===''?null:Number(f.get(`makeup_${s.day_of_week}`))}));
    for(const row of rows)if(row.makeup_for_day!==null&&(row.makeup_for_day!==(row.day_of_week+6)%7||rows.find(r=>r.day_of_week===row.makeup_for_day)?.workout_type!=='strength'))throw new Error(`${DAY_NAMES[row.day_of_week]}: choose the previous strength day as the make-up source, or choose None.`);
    await commit(d=>d.weekly_schedule=rows);render();message('Weekly schedule saved.');
  }
  if(form.id==='demo-date-form'){demoDate=f.get('date');go('today');message(`Preview date: ${niceDate(demoDate)}. Reload to return to today.`);}
}
function decorate(){
  const actions={start:'play',extra:'plus',resume:'play',continue:'arrow-right',back:'arrow-left',skip:'skip-forward',warmup:'check',timer:'timer',finish:'check',previous:'undo-2','edit-set':'pencil','edit-cardio':'pencil','cancel-edit':'arrow-left',csv:'download',json:'file-json','real-date':'calendar-days',signout:'log-out',move:'grip-vertical','choose-csv':'upload','confirm-import':'upload','cancel-import':'arrow-left','reset-open':'rotate-ccw','choose-json':'upload','confirm-restore':'rotate-ccw','cancel-restore':'arrow-left'};
  main.querySelectorAll('button').forEach(b=>{
    if(b.querySelector('svg'))return;
    const name=actions[b.dataset.action]||(b.closest('form')?.id==='auth-form'?'arrow-right':'check');
    b.insertAdjacentHTML('afterbegin',icon(name));
  });
  main.querySelectorAll('.fields label').forEach(label=>{
    if(label.querySelector('.icon'))return;
    const name=label.querySelector('[name=weight]')?'weight':label.querySelector('[name=reps]')?'repeat-2':null;
    if(name)label.insertAdjacentHTML('afterbegin',icon(name));
  });
  main.querySelectorAll('#history-list details>summary').forEach(summary=>{
    summary.insertAdjacentHTML('afterbegin',icon('calendar-days'));
  });
}
async function guard(fn){if(busy)return;busy=true;message();const buttons=[...document.querySelectorAll('button:not(:disabled)')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){if(resetDialog.open)$('#reset-error').textContent=e.message;else message(e.message||'Something went wrong. Your last saved data is unchanged.');}finally{busy=false;buttons.forEach(b=>b.disabled=false);syncResetButton();updateImportButton();}}
document.addEventListener('click',e=>{const el=e.target.closest('button');if(!el)return;if(el.dataset.view){if(!busy)go(el.dataset.view);}else if(el.dataset.action)guard(()=>action(el.dataset.action,el));});
document.addEventListener('submit',e=>{e.preventDefault();guard(()=>submit(e.target,e.submitter));});
document.addEventListener('change',e=>{
  if(e.target.id==='history-date'){historyList(e.target.value);decorate();}
  if(e.target.id==='json-file')guard(()=>selectJSON(e.target.files[0]));
  if(e.target.id==='csv-file')guard(()=>selectCSV(e.target.files[0]));
  if(e.target.name==='duplicates')updateImportButton();
});
document.addEventListener('input',e=>{if(e.target.id==='reset-word'){syncResetButton();$('#reset-error').textContent='';}});
resetDialog.addEventListener('cancel',e=>{e.preventDefault();if(!busy)closeReset();});
window.addEventListener('storage',()=>{if(DB.demo)message('Data changed in another tab. Reload to see the latest saved entries.');});
async function boot(){
  try{data=await DB.initialize();render();}catch(e){main.innerHTML='<section class="card"><h2>Could not open the log</h2><p>Your saved data has not been replaced. Check configuration or browser storage, then reload.</p></section>';message(e.message);}
  if('serviceWorker' in navigator){
    const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    if(!local)navigator.serviceWorker.register(new URL('/workout-log/sw.js',location.origin),{scope:'/workout-log/'}).catch(()=>message('Offline installation is unavailable. The app still works while connected.'));
    else {const registrations=await navigator.serviceWorker.getRegistrations();for(const r of registrations)if(r.scope===new URL('../',import.meta.url).href)await r.unregister();}
  }
}
boot();
