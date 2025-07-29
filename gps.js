function getCurrentPosition(cb){
  if(!navigator.geolocation){ alert('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => cb({lat: pos.coords.latitude, lng: pos.coords.longitude, ts: new Date().toISOString()}),
    err => alert('GPS error: ' + err.message),
    {enableHighAccuracy:true, timeout:10000, maximumAge:30000}
  );
}