const $ = (s) => document.querySelector(s);

let activeEntryId = null;
let activeStart = null;
let tick = null;

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const se = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${se}`;
}

function startTick(startISO) {
  activeStart = new Date(startISO).getTime();
  clearInterval(tick);
  tick = setInterval(() => {
    $('#elapsed').textContent = fmt(Date.now() - activeStart);
  }, 1000);
  $('#elapsed').textContent = fmt(Date.now() - activeStart);
}

function stopTick() {
  clearInterval(tick);
  tick = null;
  activeStart = null;
  $('#elapsed').textContent = '00:00:00';
}

async function jsonFetch(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return res.json();
}

//
// Load user info
//
async function loadMe() {
  const me = await fetch('/api/me').then((r) => r.json());
  $('#userEmail').value = me.email || '';
}

async function saveMe() {
  await jsonFetch('/api/me', {
    method: 'POST',
    body: JSON.stringify({ email: $('#userEmail').value.trim() })
  });
  alert('Saved email');
}

//
// Jobs list & current job
//
async function loadJobs(selectId) {
  const jobs = await fetch('/api/jobs').then((r) => r.json());
  const sel = $('#jobSelect');
  sel.innerHTML = '';
  jobs.forEach((j) => {
    const o = document.createElement('option');
    o.value = j.id;
    o.textContent = `${j.job_number ? `#${j.job_number} - ` : ''}${j.name}`;
    sel.appendChild(o);
  });

  const list = $('#jobList');
  list.innerHTML = '';
  jobs.forEach((j) => {
    const div = document.createElement('div');
    div.className = 'row';
    div.style =
      'justify-content:space-between;border-bottom:1px solid #e5e7eb;padding:10px 0;';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${j.name}</strong> ${
      j.job_number ? `<span class="pill">#${j.job_number}</span>` : ''
    }<br><span class="pill" style="background:#f1f5f9;border:1px solid #e2e8f0">${
      j.client || '-'
    }</span>`;
    const right = document.createElement('div');
    right.innerHTML = `
      <button class="appbtn alt send" data-id="${j.id}">Send Report</button>
      <button class="appbtn alt work" data-id="${j.id}">Work Order</button>`;
    div.appendChild(left);
    div.appendChild(right);
    list.appendChild(div);
  });

  list.querySelectorAll('button.send').forEach((b) => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      const res = await jsonFetch('/api/reports/send', {
        method: 'POST',
        body: JSON.stringify({ jobId })
      });
      if (res.ok) alert('Report generated');
      else alert('Report failed');
    };
  });

  list.querySelectorAll('button.work').forEach((b) => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      const res = await jsonFetch('/api/workorder/generate', {
        method: 'POST',
        body: JSON.stringify({ jobId })
      });
      if (res.ok) alert('Work Order generated');
      else alert('Work Order failed');
    };
  });

  if (selectId) sel.value = String(selectId);
}

async function loadActive() {
  const a = await fetch('/api/active').then((r) => r.json());
  if (a) {
    activeEntryId = a.id;
    $('#status').textContent = `Charging since ${new Date(
      a.start_time
    ).toLocaleString()}`;
    $('#currentJob').textContent = `${
      a.job_number ? `#${a.job_number} - ` : ''
    }${a.job_name}`;
    $('#clockInBtn').disabled = true;
    $('#clockOutBtn').disabled = false;
    startTick(a.start_time);
    $('#jobSelect').value = String(a.job_id);
  } else {
    activeEntryId = null;
    $('#status').textContent = 'Not running';
    $('#currentJob').textContent = 'None';
    $('#clockInBtn').disabled = false;
    $('#clockOutBtn').disabled = true;
    stopTick();
  }
  await refreshKPIs();
}

async function refreshKPIs() {
  const jobId = Number($('#jobSelect').value || 0);
  if (!jobId) return;
  const t = await fetch(`/api/totals/${jobId}`).then((r) => r.json());
  $('#kpiHours').textContent = (t.hours || 0).toFixed(2);
  $('#kpiParts').textContent = (t.parts || 0).toFixed(2);
  $('#kpiHotels').textContent = (t.hotels || 0).toFixed(2);
}

//
// Clock in/out
//
async function clockIn() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return alert('Select a job first');
  const res = await jsonFetch('/api/clock/start', {
    method: 'POST',
    body: JSON.stringify({ jobId })
  });
  if (res.id) await loadActive();
}

async function clockOut() {
  if (!activeEntryId) return;
  const res = await jsonFetch('/api/clock/end', {
    method: 'POST',
    body: JSON.stringify({ entryId: activeEntryId })
  });
  if (res.ok) await loadActive();
}

//
// Close job
//
async function closeJob() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return;
  if (
    !confirm(
      'Are you sure you want to finalize this job? No edits allowed after closure.'
    )
  )
    return;
  await jsonFetch('/api/job/close', {
    method: 'POST',
    body: JSON.stringify({ jobId })
  });
  await loadJobs(jobId);
  await loadActive();
  await refreshKPIs();
}

//
// Init
//
document.addEventListener('DOMContentLoaded', async () => {
  $('#saveEmailBtn').onclick = saveMe;
  $('#clockInBtn').onclick = clockIn;
  $('#clockOutBtn').onclick = clockOut;
  $('#closeJobBtn').onclick = closeJob;

  $('#jobSelect').addEventListener('change', async () => {
    await loadActive();
    await refreshKPIs();
  });

  await loadMe();
  await loadJobs();
  await loadActive();
});
