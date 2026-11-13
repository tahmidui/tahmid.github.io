export function csvCell(value) {
  let s=String(value??'');
  // Spreadsheet formula injection protection for free-form text.
  if(/^['=+\-@\t\r]/.test(s)) s="'"+s;
  return `"${s.replaceAll('"','""')}"`;
}
export function csv(data) {
  const fields=['csv_version','record_type','workout_id','scheduled_date','actual_workout_date','workout_started_at','workout_completed_at','workout_status','workout_type','routine_name','source','exercise','exercise_id','exercise_type','target_sets','progression_enabled','set_number','target_reps','actual_reps','weight','unit','duration_seconds','duration_minutes','set_status','logged_at','updated_at','note'];
  const rows=[];
  for(const w of data.workouts) {
    const base={...w,csv_version:2,workout_id:w.id,workout_status:w.status};
    const sets=data.workout_sets.filter(s=>s.workout_id===w.id);
    if(!sets.length) rows.push({...base,record_type:w.workout_type==='cardio'?'cardio':'workout'});
    for(const s of sets) {
      const snapshot=w.routine_snapshot?.find(e=>e.id===s.exercise_id);
      rows.push({...base,...s,workout_id:w.id,record_type:'set',exercise:s.exercise_name,set_status:s.status,target_sets:snapshot?.target_sets,progression_enabled:snapshot?.progression_enabled});
    }
  }
  return '\uFEFF'+[fields.map(csvCell).join(','),...rows.map(r=>fields.map(f=>csvCell(r[f])).join(','))].join('\r\n');
}
export function backup(data) { return JSON.stringify({format:'tahmid-workout-log',schema_version:1,exported_at:new Date().toISOString(),data},null,2); }
export function download(name,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type})), a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
