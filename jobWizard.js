document.getElementById('jobForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const job = {
        name: document.getElementById('jobName').value,
        technician: document.getElementById('technician').value,
        location: document.getElementById('location').value,
        startDate: document.getElementById('startDate').value,
        userEmail: document.getElementById('userEmail').value
    };

    const jobFolder = `JobExports/${job.name.replace(/\s+/g, '_')}`;
    if (!window.indexedDB) {
        document.getElementById('result').innerText = 'IndexedDB not supported!';
        return;
    }

    const request = indexedDB.open("ArcWaveJobs", 1);
    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        db.createObjectStore("jobs", { keyPath: "name" });
    };

    request.onsuccess = function(event) {
        const db = event.target.result;
        const tx = db.transaction("jobs", "readwrite");
        const store = tx.objectStore("jobs");
        store.put(job);

        tx.oncomplete = function() {
            document.getElementById('result').innerText = `Job "${job.name}" created successfully.`;
            document.getElementById('jobForm').reset();
        };
        tx.onerror = function() {
            document.getElementById('result').innerText = "Error creating job.";
        };
    };
});
