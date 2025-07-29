const CACHE='arcwave-cache-v2';
const ASSETS=['index.html','style.css','jobWizard.html','jobView.html','jobEntry.html','dashboard.html','js/db.js','js/main.js','js/jobWizard.js','js/jobView.js','js/jobEntry.js','js/dashboard.js','js/exportCSV.js','js/emailSender.js','js/gps.js','manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});