const {test}=require('node:test')
const assert=require('node:assert/strict')
const agenda=import('../../lib/agenda.mjs')
test('Guayaquil date/time persists independently of browser timezone and rejects normalized dates',async()=>{
  const {clinicDateTimeToInstant,clinicDayKey,clinicTime}=await agenda
  const original=process.env.TZ
  try{for(const zone of ['UTC','America/Los_Angeles','Asia/Tokyo']){process.env.TZ=zone;assert.equal(clinicDateTimeToInstant('2026-09-28','09:00'),'2026-09-28T14:00:00.000Z');assert.equal(clinicDayKey('2026-09-28T02:00:00Z'),'2026-09-27');assert.equal(clinicTime('2026-09-28T14:00:00Z'),'09:00')}}
  finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original}
  for(const [day,time] of [['2026-02-30','09:00'],['2026-09-28','24:00'],['bad','09:00']])assert.throws(()=>clinicDateTimeToInstant(day,time))
})
test('month/week range follows displayed date and includes neighboring grid days',async()=>{
  const {calendarRange,moveCalendarDay}=await agenda
  const month=calendarRange('2026-09-28','month');assert.equal(month.days.length,42);assert.equal(month.days[0],'2026-08-31');assert.equal(month.start,'2026-08-31T05:00:00.000Z');assert.equal(month.end,'2026-10-12T05:00:00.000Z')
  const next=moveCalendarDay('2026-09-28','month',1);assert.equal(next,'2026-10-01');assert.notEqual(calendarRange(next,'month').start,month.start)
  const week=calendarRange('2026-09-28','week');assert.equal(week.days.length,7);assert.equal(week.end,'2026-10-05T05:00:00.000Z')
})
test('schedule validates clinic and total, drops financial fields and rejects unknown statuses/timestamps',async()=>{
  const {parseSchedule}=await agenda
  const row={id:'id',clinic_id:'A',start_time:'2026-09-28T14:00:00Z',end_time:'2026-09-28T14:30:00Z',status:'arrived',billings:[{amount:100}]}
  assert.equal(parseSchedule({items:[row],total_count:1},'A')[0].billings,undefined)
  for(const change of [{clinic_id:'B'},{status:'constructor'},{end_time:'bad'}])assert.throws(()=>parseSchedule({items:[{...row,...change}],total_count:1},'A'))
  assert.throws(()=>parseSchedule({items:[row],total_count:2},'A'))
})
test('shared save sends only authorized operational fields and reception never sends notes',async()=>{
  const {saveAppointment}=await agenda
  const calls=[]
  const client={rpc:async(name,args)=>{calls.push({name,args});return{data:{id:'saved',clinic_id:'A'},error:null}}}
  const input={patient_id:'p',doctor_id:'d',status:'scheduled',notes:'clinical',price:123,invoice_id:'never'}
  await saveAppointment(client,'A',input,null,'receptionist')
  assert.deepEqual(calls[0],{name:'save_clinic_appointment',args:{p_clinic_id:'A',p_appointment_id:null,p_data:{patient_id:'p',doctor_id:'d',status:'scheduled'}}})
  await saveAppointment(client,'A',input,null,'doctor');assert.equal(calls[1].args.p_data.notes,'clinical')
})
test('server conflict and zero-result saves cannot produce success',async()=>{
  const {saveAppointment}=await agenda
  await assert.rejects(()=>saveAppointment({rpc:async()=>({data:null,error:{code:'23P01',message:'other patient'}})},'A',{},null,'doctor'),/El odontólogo ya tiene/)
  for(const data of [null,[],{id:'saved',clinic_id:'B'}])await assert.rejects(()=>saveAppointment({rpc:async()=>({data,error:null})},'A',{},null,'doctor'),/no confirmó/)
})
test('schedule requests require clinic, propagate server errors and pass AbortSignal',async()=>{
  const {loadSchedule}=await agenda;const controller=new AbortController();let calls=0
  const client={rpc:(name,args)=>{calls++;assert.equal(name,'get_clinic_schedule');assert.equal(args.p_clinic_id,'A');return{abortSignal:async signal=>{assert.equal(signal,controller.signal);return{data:null,error:Error('failed')}}}}}
  await assert.rejects(()=>loadSchedule(client,'',{start:'s',end:'e'}));assert.equal(calls,0)
  await assert.rejects(()=>loadSchedule(client,'A',{start:'s',end:'e'},controller.signal),/failed/)
})

test('overnight appointments remain visible after midnight, with exclusive end boundary', async()=>{
  const {groupScheduleByDay}=await agenda
  const crossing={id:'overnight',start_time:'2026-09-29T04:30:00Z',end_time:'2026-09-29T05:30:00Z'}
  const atMidnight={id:'ends',start_time:'2026-09-29T04:00:00Z',end_time:'2026-09-29T05:00:00Z'}
  const grouped=groupScheduleByDay([crossing,atMidnight],['2026-09-28','2026-09-29'])
  assert.deepEqual(grouped.get('2026-09-28').map(a=>a.id),['overnight','ends'])
  assert.deepEqual(grouped.get('2026-09-29').map(a=>a.id),['overnight'])
  assert.deepEqual(groupScheduleByDay([crossing],['2026-09-29']).get('2026-09-29'),[crossing])
})

test('editor offers the current state and permitted active transitions only',async()=>{
  const {editorStatuses}=await agenda
  assert.deepEqual(editorStatuses(),['scheduled','confirmed'])
  assert.deepEqual(editorStatuses('confirmed'),['confirmed','arrived'])
  assert.deepEqual(editorStatuses('arrived'),['arrived'])
})
