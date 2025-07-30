$('#newJobBtn').onclick = () => $('#jobModal').showModal();
$('#hotelBtn').onclick = () => $('#hotelModal').showModal();
$('#partsBtn').onclick = () => $('#partsModal').showModal();
$('#summaryBtn').onclick = () => $('#summaryModal').showModal();

// Hotel add
$('#addHotelBtn').onclick = async () => {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return alert('Select a job first');
  const date = $('#hotelDate').value;
  const cost = Number($('#hotelCost').value || 0);
  const nights = Number($('#hotelNights').value || 0);
  await jsonFetch('/api/hotel', {
    method: 'POST',
    body: JSON.stringify({ jobId, date, cost, nights })
  });
  $('#hotelDate').value = '';
  $('#hotelCost').value = '';
  $('#hotelNights').value = '';
};

// Parts add
$('#addPartBtn').onclick = async () => {
  const jobId = Number($('#jobSelect').value);
  if (!jobId) return alert('Select a job first');
  const part_number = $('#partNumber').value;
  const qty = Number($('#partQty').value || 0);
  const price = Number($('#partPrice').value || 0);
  const vendor = $('#partVendor').value;
  await jsonFetch('/api/parts', {
    method: 'POST',
    body: JSON.stringify({ jobId, part_number, qty, price, vendor })
  });
  $('#partNumber').value = '';
  $('#partQty').value = '';
  $('#partPrice').value = '';
  $('#partVendor').value = '';
};
