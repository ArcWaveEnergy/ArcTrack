const $ = (s) => document.querySelector(s);
let activeEntryId = null;
let tickInterval = null;
let startTimestamp = null;

async function fetchJSON(url, options={}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return await res.json();
}

function setElapsed(ms) {
  const sec = Math.floor(ms/1000);
  const h = String(Math.floor(sec/3600)).padStart(2, '0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2, '0');
  const s = String(sec%60).padStart(2, '0');
  $('#elapsed').textContent = `${h}:${m}:${s}`;
}

function startTicker(startISO) {
  startTimestamp = new Date(startISO).getTime();
  clearInterval(tickInterval);
  tickInterval = setInterval(() => setElapsed(Date.now() - startTimestamp), 1000);
  setElapsed(Date.now() - startTimestamp);
}

function stopTicker() {
  clearInterval(tickInterval);
  tickInterval = null;
  startTimestamp = null;
}

function setButtons(running) {
  $('#startBtn').disabled = running;
  $('#stopBtn').disabled = !running;
}

function saveLastJob(jobId) {
  localStorage.setItem('arctrack:lastJob', String(jobId));
}
function getLastJob() {
  return Number(localStorage.getItem('arctrack:lastJob') || 0);
}

async function loadUser() {
  const me = await fetchJSON('/api/me');
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.value = me.email || '';
}

async function saveUser() {
  const email = $('#userEmail').value.trim();
  await fetchJSON('/api/me', { method:'POST', body: JSON.stringify({ email }) });
  alert('Saved email: ' + email);
}

async function loadJobs(selectIdToSet) {
  const jobs = await fetchJSON('/api/jobs');
  const activeSel = $('#activeJob');
  const jobsDiv = $('#jobs');
  activeSel.innerHTML = '';
  jobsDiv.innerHTML = '';

  for (const j of jobs) {
    const opt = document.createElement('option');
    opt.value = j.id; opt.textContent = `${j.job_number ? '#'+j.job_number+' - ' : ''}${j.name}`;
    activeSel.appendChild(opt);

    const div = document.createElement('div');
    div.className = 'job';
    div.innerHTML = `
      <div><strong>${j.name}</strong> ${j.job_number ? '<span class="badge">#'+j.job_number+'</span>':''}<br>
        <span class="badge">Client: ${j.client || '-'}</span>
        <span class="badge">Location: ${j.location || '-'}</span>
      </div>
      <div>${j.is_complete ? '<span class="badge ok">Complete</span>' : '<span class="badge warn">In progress</span>'}</div>
      <div><button data-id="${j.id}" class="send">Send Report</button></div>
    `;
    jobsDiv.appendChild(div);
  }

  jobsDiv.querySelectorAll('button.send').forEach(b => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      const res = await fetchJSON('/api/reports/send', { method:'POST', body: JSON.stringify({ jobId }) });
      if (res.ok) alert('Report sent' + (res.email?.sent === false ? ` (email error: ${res.email.error})` : ''));
      else alert('Failed to send');
    };
  });

  if (selectIdToSet) activeSel.value = String(selectIdToSet);
  else {
    const last = getLastJob();
    if (last) activeSel.value = String(last);
  }
}

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({})
    );
  });
}

function openJobModal() { $('#jobModal').classList.remove('hidden'); }
function closeJobModal() { $('#jobModal').classList.add('hidden'); }

async function createJobCore(startImmediately=false) {
  const name = $('#jobName').value.trim();
  if (!name) { alert('Enter job name'); return; }
  const jobNumber = $('#jobNumber').value.trim();
  const client = $('#jobClient').value.trim();
  const location = $('#jobLocation').value.trim();

  const res = await fetchJSON('/api/jobs', { method:'POST', body: JSON.stringify({ name, jobNumber, client, location }) });
  await loadJobs(res.id);
  closeJobModal();
  saveLastJob(res.id);
  if (startImmediately) await startClock();
}

async function startClock() {
  const jobId = Number($('#activeJob').value);
  if (!jobId) { openJobModal(); return; }
  saveLastJob(jobId);
  const gps = await getPosition();
  const res = await fetchJSON('/api/clock/start', { method:'POST', body: JSON.stringify({ jobId, ...gps }) });
  activeEntryId = res.id;
  $('#timerStatus').textContent = `Started at ${new Date(res.startISO).toLocaleString()}`;
  setButtons(true);
  startTicker(res.startISO);
}

async function stopClock() {
  if (!activeEntryId) return;
  const gps = await getPosition();
  const res = await fetchJSON('/api/clock/end', { method:'POST', body: JSON.stringify({ entryId: activeEntryId, ...gps }) });
  $('#timerStatus').textContent = `Ended at ${new Date(res.endISO).toLocaleString()} | Reg: ${(res.regMinutes/60).toFixed(2)}h, OT: ${(res.otMinutes/60).toFixed(2)}h`;
  activeEntryId = null;
  setButtons(false);
  stopTicker();
}

async function addHotel() {
  const jobId = Number($('#activeJob').value);
  if (!jobId) return alert('Select a job first');
  const date = $('#hotelDate').value;
  const cost = Number($('#hotelCost').value || 0);
  const nights = Number($('#hotelNights').value || 0);
  if (!date) return alert('Choose a date');
  await fetchJSON('/api/hotel', { method:'POST', body: JSON.stringify({ jobId, date, cost, nights }) });
  $('#hotelDate').value=''; $('#hotelCost').value=''; $('#hotelNights').value='';
  alert('Hotel record added to job');
}

document.addEventListener('DOMContentLoaded', async () => {
  const saveEmailBtn = document.getElementById('saveEmail');
  if (saveEmailBtn) saveEmailBtn.addEventListener('click', saveUser);

  $('#startBtn').addEventListener('click', startClock);
  $('#stopBtn').addEventListener('click', stopClock);
  $('#addHotel').addEventListener('click', addHotel);

  $('#newJobBtn').addEventListener('click', () => document.getElementById('jobModal').classList.remove('hidden'));
  $('#createJob').addEventListener('click', () => createJobCore(false));
  $('#createStartJob').addEventListener('click', () => createJobCore(true));
  $('#cancelJob').addEventListener('click', () => document.getElementById('jobModal').classList.add('hidden'));

  await loadUser();
  await loadJobs();
});
