const params=new URLSearchParams(location.search);const jobName=params.get('job');document.getElementById('jobTitle').textContent=jobName?`Job Entry — ${jobName}`:'Job Entry';
function uid(){return jobName+':'+crypto.randomUUID();}
function parseHM(t){if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m;}
function minutesToHours(m){return (m/60);}
document.getElementById('addTimeBtn').addEventListener('click',async()=>{
  const date=document.getElementById('timeDate').value;
  const st=document.getElementById('startTime').value;
  const et=document.getElementById('endTime').value;
  if(!date||!st||!et){alert('Date, start, and end times are required');return;}
  const sm=parseHM(st), em=parseHM(et);
  if(em<=sm){alert('End time must be after start time (24h)');return;}
  const durMin = em - sm;
  const dailyThresholdHrs = 8; // default split policy; dashboard can recalc differently
  const regMin = Math.min(durMin, dailyThresholdHrs*60);
  const otMin = Math.max(0, durMin - regMin);
  const rec={ id:uid(), job:jobName, date, start:st, end:et, durMin, regMin, otMin };
  await put('time', rec);
  alert(`Saved time ${st}–${et} (${(durMin/60).toFixed(2)}h)`);
});
document.getElementById('addMileageBtn').addEventListener('click',async()=>{
  getCurrentPosition(async(p)=>{
    const r={id:uid(),job:jobName,miles:+(document.getElementById('miles').value||0),notes:document.getElementById('milesNotes').value,lat:p.lat,lng:p.lng,ts:p.ts};
    await put('mileage',r);alert('Mileage (with GPS) saved');
  });
});
document.getElementById('addHotelBtn').addEventListener('click',async()=>{
  const r={id:uid(),job:jobName,nights:+(document.getElementById('hotelNights').value||0),cost:+(document.getElementById('hotelCost').value||0)};await put('hotels',r);alert('Hotel saved');
});
document.getElementById('addPartBtn').addEventListener('click',async()=>{
  const r={id:uid(),job:jobName,item:document.getElementById('partItem').value,cost:+(document.getElementById('partCost').value||0)};await put('parts',r);alert('Part saved');
});
document.getElementById('addReceiptBtn').addEventListener('click',async()=>{
  const f=document.getElementById('receiptFile').files[0];if(!f){alert('Choose a file');return;}
  const buf=await f.arrayBuffer();const r={id:uid(),job:jobName,name:f.name,type:f.type,data:new Blob([buf],{type:f.type})};await put('receipts',r);alert('Receipt saved');
});
document.getElementById('markCompleteBtn').addEventListener('click',async()=>{
  const j=await get('jobs',jobName);if(!j)return;j.status='complete';await put('jobs',j);alert('Job marked complete. Entries locked.');
});
document.getElementById('backBtn').addEventListener('click',()=>window.location.href='jobView.html');