async function emailReport(jobName){
  const job=await get('jobs',jobName);
  const to='jobinformation@arcwaveenergy.com';
  const cc=job.userEmail?`&cc=${encodeURIComponent(job.userEmail)}`:'';
  const subject=encodeURIComponent(`Job Report: ${jobName}`);
  const body=encodeURIComponent(`Job: ${jobName}%0D%0ATechnician: ${job.technician||''}%0D%0AStart: ${job.startDate||''}%0D%0AStatus: ${job.status||''}%0D%0A%0D%0A(Attach CSV from your device.)`);
  window.location.href=`mailto:${to}?subject=${subject}${cc}&body=${body}`;
}