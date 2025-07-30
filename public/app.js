const $ = (s) => document.querySelector(s);

let activeEntryId = null;
let activeStart = null;
let tick = null;

function fmtDuration(ms){
  const s = Math.floor(ms/1000);
  const h = String(Math.floor(s/3600)).padStart(2,'0');
  const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const sec = String(s%60).padStart(2,'0');
  return `${h}:${m}:${sec}`;
}
function startTicker(startISO){
  activeStart = new Date(startISO).getTime();
  clearInterval(tick);
  tick = setInterval(()=>{
    $('#elapsed').textContent = fmtDuration(Date.now()-activeStart);
  }, 1000);
  $('#elapsed').textContent = fmtDuration(Date.now()-activeStart);
}
function stopTicker(){
  clearInterval(tick); tick = null; activeStart = null;
  $('#elapsed').textContent = '00:00:00';
}

async function api(url, data, method='POST'){
  const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: data?JSON.stringify(data):undefined });
  return res.json();
}

async function loadMe(){
  const me = await fetch('/api/me').then(r=>r.json());
  $('#userEmail').value = me.email || '';
}
async function saveMe(){
  const email = $('#userEmail').value.trim();
  await api('/api/me', { email });
  alert('Saved email');
}

async function loadJobs(selectId){
  const jobs = await fetch('/api/jobs').then(r=>r.json());
  const sel = $('#jobSelect'); sel.innerHTML = '';
  jobs.forEach(j => {
    const opt = document.createElement('option');
    opt.value=j.id;
    opt.textContent = `${j.job_number?('#'+j.job_number+' - '):''}${j.name}`;
    sel.appendChild(opt);
  });
  // Jobs list with report buttons
  const list = $('#jobList'); list.innerHTML='';
  jobs.forEach(j=>{
    const div = document.createElement('div');
    div.className='job';
    div.innerHTML = `<div><strong>${j.name}</strong> ${j.job_number?('<span class="badge">#'+j.job_number+'</span>'):''}<br>
      <span class="badge">Client: ${j.client||'-'}</span> <span class="badge">Location: ${j.location||'-'}</span></div>
      <div><button class="appbtn outline send" data-id="${j.id}">Send Report</button></div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('button.send').forEach(b => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      const res = await api('/api/reports/send', { jobId });
      if(res.ok) alert('Report generated' + (res.email?.sent? ' and emailed' : ' (email skipped)'));
      else alert('Report failed');
    };
  });

  if (selectId){ sel.value = String(selectId); }
}

async function loadActive(){
  const a = await fetch('/api/active').then(r=>r.json());
  if (a){
    activeEntryId = a.id;
    $('#status').textContent = `Charging since ${new Date(a.start_time).toLocaleString()}`;
    $('#currentJob').textContent = `${a.job_number?('#'+a.job_number+' - '):''}${a.job_name}`;
    $('#clockInBtn').disabled = true;
    $('#clockOutBtn').disabled = false;
    startTicker(a.start_time);
    // preselect in dropdown
    $('#jobSelect').value = String(a.job_id);
  } else {
    activeEntryId = null;
    $('#status').textContent = 'Not running';
    $('#currentJob').textContent = 'None';
    $('#clockInBtn').disabled = false;
    $('#clockOutBtn').disabled = true;
    stopTicker();
  }
}

async function clockIn(){
  const jobId = Number($('#jobSelect').value);
  if (!jobId){ return alert('Select a job or create one first'); }
  const gps = await getGPS();
  const res = await api('/api/clock/start', { jobId, ...gps });
  if (res.id){
    activeEntryId = res.id;
    await loadActive();
  }
}
async function clockOut(){
  if (!activeEntryId) return;
  const gps = await getGPS();
  const res = await api('/api/clock/end', { entryId: activeEntryId, ...gps });
  if (res.ok){
    await loadActive();
  }
}

function getGPS(){
  return new Promise((resolve)=>{
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos)=> resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()=> resolve({})
    );
  });
}

async function addHotel(){
  const jobId = Number($('#jobSelect').value);
  if(!jobId) return alert('Select a job first');
  const date = $('#hotelDate').value;
  const cost = Number($('#hotelCost').value||0);
  const nights = Number($('#hotelNights').value||0);
  if(!date) return alert('Pick a date');
  await api('/api/hotel', { jobId, date, cost, nights });
  $('#hotelDate').value=''; $('#hotelCost').value=''; $('#hotelNights').value='';
  alert('Hotel record added');
}

async function createJob(startNow=false){
  const name = $('#jobName').value.trim();
  if(!name) return alert('Enter job name');
  const jobNumber = $('#jobNumber').value.trim();
  const client = $('#jobClient').value.trim();
  const location = $('#jobLocation').value.trim();
  const res = await api('/api/jobs', { name, jobNumber, client, location });
  document.getElementById('jobModal').close();
  await loadJobs(res.id);
  if (startNow) await clockIn();
}

document.addEventListener('DOMContentLoaded', async () => {
  // hook up UI
  $('#saveEmailBtn').onclick = saveMe;
  $('#newJobBtn').onclick = () => document.getElementById('jobModal').showModal();
  $('#createJobBtn').onclick = () => createJob(false);
  $('#createAndStartBtn').onclick = () => createJob(true);
  $('#clockInBtn').onclick = clockIn;
  $('#clockOutBtn').onclick = clockOut;
  $('#addHotelBtn').onclick = addHotel;

  await loadMe();
  await loadJobs();
  await loadActive();
});
