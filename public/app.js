const $ = (s)=>document.querySelector(s);

let activeEntryId=null, activeStart=null, tick=null;

function fmt(ms){const s=Math.floor(ms/1000);const h=String(Math.floor(s/3600)).padStart(2,'0');const m=String(Math.floor((s%3600)/60)).padStart(2,'0');const se=String(s%60).padStart(2,'0');return `${h}:${m}:${se}`;}
function startTick(startISO){activeStart=new Date(startISO).getTime();clearInterval(tick);tick=setInterval(()=>{$('#elapsed').textContent=fmt(Date.now()-activeStart)},1000);$('#elapsed').textContent=fmt(Date.now()-activeStart)}
function stopTick(){clearInterval(tick);tick=null;activeStart=null;$('#elapsed').textContent='00:00:00'}

async function fetchJSON(url,opt){const r=await fetch(url,{headers:{'Content-Type':'application/json'},...opt});return r.json();}
async function loadMe(){const me=await fetch('/api/me').then(r=>r.json());$('#userEmail').value=me.email||''}
async function saveMe(){await fetchJSON('/api/me',{method:'POST',body:JSON.stringify({email:$('#userEmail').value.trim()})});alert('Saved email')}

async function loadJobs(selectId){
  const jobs=await fetch('/api/jobs').then(r=>r.json());
  const sel=$('#jobSelect'); sel.innerHTML='';
  jobs.forEach(j=>{const o=document.createElement('option');o.value=j.id;o.textContent=`${j.job_number?('#'+j.job_number+' - '):''}${j.name}`;sel.appendChild(o)});

  const list=$('#jobList'); list.innerHTML='';
  jobs.forEach(j=>{
    const div=document.createElement('div'); div.className='job';
    div.innerHTML=`<div><strong>${j.name}</strong> ${j.job_number?('<span class="badge">#'+j.job_number+'</span>'):''}<br>
      <span class="badge">Client: ${j.client||'-'}</span> <span class="badge">Location: ${j.location||'-'}</span></div>
      <div><button class="appbtn outline send" data-id="${j.id}">Send Report</button></div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('button.send').forEach(b=>b.onclick=async()=>{
    const jobId=Number(b.getAttribute('data-id'));
    const res=await fetchJSON('/api/reports/send',{method:'POST',body:JSON.stringify({jobId})});
    if(res.ok) alert('Report generated' + (res.email?.sent?' and emailed':' (email skipped)')); else alert('Report failed');
  });

  if(selectId) sel.value=String(selectId);
}

async function loadActive(){
  const a=await fetch('/api/active').then(r=>r.json());
  if(a){
    activeEntryId=a.id; $('#status').textContent=`Charging since ${new Date(a.start_time).toLocaleString()}`;
    $('#currentJob').textContent=`${a.job_number?('#'+a.job_number+' - '):''}${a.job_name}`;
    $('#clockInBtn').disabled=true; $('#clockOutBtn').disabled=false; startTick(a.start_time);
    $('#jobSelect').value=String(a.job_id);
  }else{
    activeEntryId=null; $('#status').textContent='Not running'; $('#currentJob').textContent='None';
    $('#clockInBtn').disabled=false; $('#clockOutBtn').disabled=true; stopTick();
  }
}

function getGPS(){
  return new Promise((resolve)=>{
    if(!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition((pos)=>resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}),()=>resolve({}));
  });
}

async function clockIn(){
  const jobId=Number($('#jobSelect').value); if(!jobId){$('#jobModal').showModal();return;}
  const gps=await getGPS(); const res=await fetchJSON('/api/clock/start',{method:'POST',body:JSON.stringify({jobId,...gps})});
  if(res.id){ await loadActive(); }
}
async function clockOut(){
  if(!activeEntryId) return; const gps=await getGPS();
  const res=await fetchJSON('/api/clock/end',{method:'POST',body:JSON.stringify({entryId:activeEntryId,...gps})});
  if(res.ok) await loadActive();
}

async function addHotel(){
  const jobId=Number($('#jobSelect').value); if(!jobId) return alert('Select a job first');
  const date=$('#hotelDate').value; const cost=Number($('#hotelCost').value||0); const nights=Number($('#hotelNights').value||0);
  if(!date) return alert('Pick a date');
  await fetchJSON('/api/hotel',{method:'POST',body:JSON.stringify({jobId,date,cost,nights})});
  $('#hotelDate').value=''; $('#hotelCost').value=''; $('#hotelNights').value=''; alert('Hotel record added');
}

async function createJob(startNow=false){
  const payload={
    name:$('#jobName').value.trim(),
    jobNumber:$('#jobNumber').value.trim(),
    client:$('#jobClient').value.trim(),
    location:$('#jobLocation').value.trim(),
    clientContact:$('#clientContact').value.trim(),
    address:$('#address').value.trim(),
    city:$('#city').value.trim(),
    state:$('#state').value.trim(),
    zip:$('#zip').value.trim(),
    site_lat:parseFloat($('#siteLat').value)||null,
    site_lng:parseFloat($('#siteLng').value)||null,
    generator_model:$('#genModel').value.trim(),
    generator_kw:parseFloat($('#genKW').value)||null,
    fuel_type:$('#fuelType').value.trim(),
    on_site_fuel:$('#onSiteFuel').value.trim(),
    start_kwh:parseFloat($('#startKwh').value)||null,
    notes:$('#notes').value.trim()
  };
  if(!payload.name){ alert('Job name is required'); return; }
  const res=await fetchJSON('/api/jobs',{method:'POST',body:JSON.stringify(payload)});
  document.getElementById('jobModal').close();
  await loadJobs(res.id);
  if(startNow){ await clockIn(); }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  $('#saveEmailBtn').onclick=saveMe;
  $('#newJobBtn').onclick=()=>document.getElementById('jobModal').showModal();
  $('#createJobBtn').onclick=()=>createJob(false);
  $('#createAndStartBtn').onclick=()=>createJob(true);
  $('#clockInBtn').onclick=clockIn;
  $('#clockOutBtn').onclick=clockOut;
  $('#addHotelBtn').onclick=addHotel;

  await loadMe(); await loadJobs(); await loadActive();
});
