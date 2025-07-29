const $ = (s) => document.querySelector(s);

let activeEntryId = null;

async function fetchJSON(url, options={}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return await res.json();
}

async function loadUser() {
  const me = await fetchJSON('/api/me');
  $('#userEmail').value = me.email || '';
}

async function saveUser() {
  const email = $('#userEmail').value.trim();
  await fetchJSON('/api/me', { method:'POST', body: JSON.stringify({ email }) });
  alert('Saved email: ' + email);
}

async function loadJobs() {
  const jobs = await fetchJSON('/api/jobs');
  const jobsDiv = $('#jobs');
  jobsDiv.innerHTML = '';
  const activeSel = $('#activeJob');
  const hotelSel = $('#hotelJob');
  activeSel.innerHTML = ''; hotelSel.innerHTML = '';

  for (const j of jobs) {
    const div = document.createElement('div');
    div.className = 'job';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${j.name}</strong><br><span class="badge">Client: ${j.client || '-'}</span> <span class="badge">Location: ${j.location || '-'}</span>`;
    const status = document.createElement('div');
    status.innerHTML = j.is_complete ? '<span class="badge ok">Complete</span>' : '<span class="badge warn">In progress</span>';
    const actions = document.createElement('div');
    const btn = document.createElement('button');
    btn.textContent = 'Send Report';
    btn.onclick = async () => {
      const res = await fetchJSON('/api/reports/send', { method:'POST', body: JSON.stringify({ jobId: j.id }) });
      if (res.ok) alert('Report sent' + (res.email?.sent === false ? ` (email error: ${res.email.error})` : ''));
      else alert('Failed to send');
    };
    actions.appendChild(btn);
    div.appendChild(left); div.appendChild(status); div.appendChild(actions);
    jobsDiv.appendChild(div);

    const opt1 = document.createElement('option'); opt1.value = j.id; opt1.textContent = j.name; activeSel.appendChild(opt1);
    const opt2 = document.createElement('option'); opt2.value = j.id; opt2.textContent = j.name; hotelSel.appendChild(opt2);
  }
}

async function createJob() {
  const name = $('#jobName').value.trim();
  if (!name) return alert('Enter job name');
  const client = $('#jobClient').value.trim();
  const location = $('#jobLocation').value.trim();
  await fetchJSON('/api/jobs', { method:'POST', body: JSON.stringify({ name, client, location }) });
  $('#jobName').value = ''; $('#jobClient').value = ''; $('#jobLocation').value = '';
  await loadJobs();
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

async function startClock() {
  const jobId = Number($('#activeJob').value);
  const gps = await getPosition();
  const body = { jobId, ...gps };
  const res = await fetchJSON('/api/clock/start', { method:'POST', body: JSON.stringify(body) });
  activeEntryId = res.id;
  $('#timerStatus').textContent = `Started at ${new Date(res.startISO).toLocaleString()}`;
  $('#startBtn').disabled = true; $('#stopBtn').disabled = false;
}

async function stopClock() {
  if (!activeEntryId) return;
  const gps = await getPosition();
  const res = await fetchJSON('/api/clock/end', { method:'POST', body: JSON.stringify({ entryId: activeEntryId, ...gps }) });
  $('#timerStatus').textContent = `Ended at ${new Date(res.endISO).toLocaleString()} | Reg: ${(res.regMinutes/60).toFixed(2)}h, OT: ${(res.otMinutes/60).toFixed(2)}h`;
  activeEntryId = null;
  $('#startBtn').disabled = false; $('#stopBtn').disabled = true;
}

async function addHotel() {
  const jobId = Number($('#hotelJob').value);
  const date = $('#hotelDate').value;
  const cost = Number($('#hotelCost').value || 0);
  const nights = Number($('#hotelNights').value || 0);
  if (!date) return alert('Choose a date');
  await fetchJSON('/api/hotel', { method:'POST', body: JSON.stringify({ jobId, date, cost, nights }) });
  $('#hotelDate').value=''; $('#hotelCost').value=''; $('#hotelNights').value='';
  alert('Hotel record added');
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#saveEmail').addEventListener('click', saveUser);
  $('#createJob').addEventListener('click', createJob);
  $('#startBtn').addEventListener('click', startClock);
  $('#stopBtn').addEventListener('click', stopClock);
  $('#addHotel').addEventListener('click', addHotel);

  await loadUser();
  await loadJobs();
});
