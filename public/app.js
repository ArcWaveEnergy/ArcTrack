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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// Me
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

// Jobs
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
      <button class="appbtn alt send" data-id="${j.id}">Report</button>
      <button class="appbtn alt work" data-id="${j.id}">Work Order</button>`;
    div.appendChild(left);
    div.appendChild(right);
    list.appendChild(div);
  });

  list.querySelectorAll('button.send').forEach((b) => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      try {
        const res = await jsonFetch('/api/reports/send', {
          method: 'POST',
          body: JSON.stringify({ jobId })
        });
        alert('Report generated');
      } catch (e) {
        alert('Report failed');
      }
    };
  });

  list.querySelectorAll('button.work').forEach((b) => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      try {
        await jsonFetch('/api/workorder/generate', {
          method: 'POST',
          body: JSON.stringify({ jobId })
        });
        alert('Work Order generated');
      } catch (e) {
        alert('Work Order failed');
      }
    };
  });

  if (selectId) sel.value = String(selectId);
}

// Active job & totals
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

// GPS helper (optional – not required)
function getGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }),
      () => resolve({})
    );
  });
}

// Clock in/out
async function clockIn() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) {
    $('#jobModal').showModal();
    return;
  }
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

// Job creation
async function createJob(startNow = false) {
  const payload = {
    name: $('#jobName').value.trim(),
    jobNumber: $('#jobNumber').value.trim(),
    client: $('#jobClient').value.trim(),
    location: $('#jobLocation').value.trim(),
    clientContact: $('#clientContact').value.trim(),
    address: $('#address').value.trim(),
    city: $('#city').value.trim(),
    state: $('#state').value.trim(),
    zip: $('#zip').value.trim(),
    site_lat: parseFloat($('#siteLat').value) || null,
    site_lng: parseFloat($('#siteLng').value) || null,
    generator_model: $('#genModel').value.trim(),
    generator_kw: parseFloat($('#genKW').value) || null,
    fuel_type: $('#fuelType').value.trim(),
    on_site_fuel: $('#onSiteFuel').value.trim(),
    start_kwh: parseFloat($('#startKwh').value) || null,
    notes: $('#notes').value.trim()
  };
  if (!payload.name) return alert('Job name is required');
  const res = await jsonFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  document.getElementById('jobModal').close();
  await loadJobs(res.id);
  if (startNow) await clockIn();
}

// Hotels
async function openHotel() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return alert('Select a job first');
  $('#hotelModal').showModal();
  await renderHotels(jobId);
}
async function renderHotels(jobId) {
  const rows = await fetch(`/api/hotel/${jobId}`).then((r) => r.json());
  const tb = $('#hotelRows');
  tb.innerHTML = '';
  let total = 0;
  rows.forEach((r) => {
    total += Number(r.cost || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date}</td><td>${r.nights || 0}</td><td>$${Number(
      r.cost || 0
    ).toFixed(2)}</td>
      <td><button class="appbtn alt hdel" data-id="${r.id}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  $('#hotelTotal').textContent = '$' + total.toFixed(2);
  tb.querySelectorAll('button.hdel').forEach((b) => {
    b.onclick = async () => {
      await fetch('/api/hotel/' + b.getAttribute('data-id'), { method: 'DELETE' });
      await renderHotels(jobId);
      await refreshKPIs();
    };
  });
}
async function addHotel() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return;
  const date = $('#hotelDate').value;
  const cost = Number($('#hotelCost').value || 0);
  const nights = Number($('#hotelNights').value || 0);
  if (!date) return alert('Pick a date');
  await jsonFetch('/api/hotel', {
    method: 'POST',
    body: JSON.stringify({ jobId, date, cost, nights })
  });
  $('#hotelDate').value = '';
  $('#hotelCost').value = '';
  $('#hotelNights').value = '';
  await renderHotels(jobId);
  await refreshKPIs();
}

// Parts
async function openParts() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return alert('Select a job first');
  $('#partsModal').showModal();
  await renderParts(jobId);
}
async function renderParts(jobId) {
  const rows = await fetch(`/api/parts/${jobId}`).then((r) => r.json());
  const tb = $('#partsRows');
  tb.innerHTML = '';
  let total = 0;
  rows.forEach((p) => {
    const line = Number(p.qty || 0) * Number(p.price || 0);
    total += line;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.part_number || ''}</td><td>${p.qty || 0}</td><td>$${Number(
      p.price || 0
    ).toFixed(2)}</td><td>${p.vendor || ''}</td><td>$${line.toFixed(
      2
    )}</td><td><button class="appbtn alt pdel" data-id="${p.id}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  $('#partsTotal').textContent = '$' + total.toFixed(2);
  tb.querySelectorAll('button.pdel').forEach((b) => {
    b.onclick = async () => {
      await fetch('/api/parts/' + b.getAttribute('data-id'), { method: 'DELETE' });
      await renderParts(jobId);
      await refreshKPIs();
    };
  });
}
async function addPart() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return;
  const part_number = $('#partNumber').value.trim();
  const qty = Number($('#partQty').value || 0);
  const price = Number($('#partPrice').value || 0);
  const vendor = $('#partVendor').value.trim();
  if (!part_number) return alert('Part number required');
  await jsonFetch('/api/parts', {
    method: 'POST',
    body: JSON.stringify({ jobId, part_number, qty, price, vendor })
  });
  $('#partNumber').value = '';
  $('#partQty').value = '';
  $('#partPrice').value = '';
  $('#partVendor').value = '';
  await renderParts(jobId);
  await refreshKPIs();
}

// Edit time (requires /api/time/edit route below)
function openTimeEdit() {
  if (!activeEntryId) return alert('No active entry to edit.');
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 16);
  $('#editStart').value = iso(new Date(now.getTime() - 60 * 60 * 1000));
  $('#editEnd').value = iso(now);
  $('#timeModal').showModal();
}
async function saveTimeEdit() {
  if (!activeEntryId) return;
  const startISO = new Date($('#editStart').value).toISOString();
  const endISO = new Date($('#editEnd').value).toISOString();
  try {
    await jsonFetch('/api/time/edit', {
      method: 'POST',
      body: JSON.stringify({ entryId: activeEntryId, startISO, endISO })
    });
    $('#timeModal').close();
    await loadActive();
  } catch (e) {
    alert('Edit failed');
  }
}

// Close job
async function closeJob() {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return;
  if (!confirm('Are you sure you want to finalize this job? No more edits allowed after sending the report.')) return;
  await jsonFetch('/api/job/close', {
    method: 'POST',
    body: JSON.stringify({ jobId })
  });
  alert('Job closed.');
  await loadJobs(jobId);
  await loadActive();
  await refreshKPIs();
}

// Summary popup (requires /api/jobs/summary route below)
async function openSummary() {
  $('#summaryModal').showModal();
  const rows = await fetch('/api/jobs/summary').then((r) => r.json());
  const tb = $('#summaryRows'); tb.innerHTML = '';
  rows.forEach((j) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${j.job_number ? '#'+j.job_number+' - ' : ''}${j.name}</td>
                    <td>${j.client || ''}</td>
                    <td>${(j.hours || 0).toFixed(2)}</td>
                    <td>$${(j.parts_total || 0).toFixed(2)}</td>
                    <td>$${(j.hotel_total || 0).toFixed(2)}</td>
                    <td>
                      <button class="appbtn alt ssend" data-id="${j.id}">Report</button>
                      <button class="appbtn alt swork" data-id="${j.id}">Work Order</button>
                    </td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button.ssend').forEach((b) => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      await jsonFetch('/api/reports/send', { method: 'POST', body: JSON.stringify({ jobId }) });
      alert('Report generated');
    };
  });
  tb.querySelectorAll('button.swork').forEach((b) => {
    b.onclick = async () => {
      const jobId = Number(b.getAttribute('data-id'));
      await jsonFetch('/api/workorder/generate', { method: 'POST', body: JSON.stringify({ jobId }) });
      alert('Work Order generated');
    };
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Wire buttons
  $('#saveEmailBtn').onclick = saveMe;
  $('#newJobBtn').onclick = () => $('#jobModal').showModal();
  $('#createJobBtn').onclick = () => createJob(false);
  $('#createAndStartBtn').onclick = () => createJob(true);

  $('#clockInBtn').onclick = clockIn;
  $('#clockOutBtn').onclick = clockOut;
  $('#hotelBtn').onclick = openHotel;
  $('#addHotelBtn').onclick = addHotel;
  $('#partsBtn').onclick = openParts;
  $('#addPartBtn').onclick = addPart;
  $('#editTimeBtn').onclick = openTimeEdit;
  $('#saveTimeEditBtn').onclick = saveTimeEdit;
  $('#closeJobBtn').onclick = closeJob;
  $('#summaryBtn').onclick = openSummary;

  $('#jobSelect').addEventListener('change', async () => {
    await loadActive();
    await refreshKPIs();
  });

  // Initial load
  await loadMe();
  await loadJobs();
  await loadActive();
});
