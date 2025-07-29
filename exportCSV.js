async function exportJobCSV(jobName){
  const [job,time,miles,hotels,parts]=await Promise.all([get('jobs',jobName),getAll('time'),getAll('mileage'),getAll('hotels'),getAll('parts')]);
  const header = ['Job Report', jobName];
  const rows = [];
  rows.push(header); rows.push([]);
  rows.push(['Technician', job?.technician||'']); rows.push(['Start', job?.startDate||'']); rows.push(['Status', job?.status||'']); rows.push([]);
  rows.push(['Time Entries (24h)', 'ID','Date','Start','End','Duration (h)','Regular (h)','OT (h)']);
  let totalRegMin=0,totalOtMin=0;
  time.filter(x=>x.job===jobName).forEach(t=>{
    const durH=(t.durMin||0)/60; const regH=(t.regMin||0)/60; const otH=(t.otMin||0)/60;
    totalRegMin += (t.regMin||0); totalOtMin += (t.otMin||0);
    rows.push(['',t.id,t.date||'',t.start||'',t.end||'',durH.toFixed(2),regH.toFixed(2),otH.toFixed(2)]);
  });
  rows.push(['Totals','','','','','', (totalRegMin/60).toFixed(2), (totalOtMin/60).toFixed(2)]);
  rows.push([]);
  rows.push(['Mileage','ID','Miles','Notes']);
  miles.filter(x=>x.job===jobName).forEach(m=>rows.push(['',m.id,m.miles||0,m.notes||'']));
  rows.push([]);
  rows.push(['Hotels','ID','Nights','Cost']);
  hotels.filter(x=>x.job===jobName).forEach(h=>rows.push(['',h.id,h.nights||0,h.cost||0]));
  rows.push([]);
  rows.push(['Parts','ID','Item','Cost']);
  parts.filter(x=>x.job===jobName).forEach(p=>rows.push(['',p.id,p.item||'',p.cost||0]));
  const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${jobName}_report.csv`; a.click();
}