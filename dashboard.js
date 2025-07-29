function isoWeek(d){const date=new Date(d);const dayNum=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-dayNum+3);const firstThursday=new Date(Date.UTC(date.getUTCFullYear(),0,4));const week=1+Math.round(((date-firstThursday)/86400000-3+((firstThursday.getUTCDay()+6)%7))/7);return `${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;}
function h(x){return (x/60).toFixed(2);}
async function compute(otDailyHrs){
  const [timeRecs,milesRecs,hotelRecs,partRecs]=await Promise.all([getAll('time'),getAll('mileage'),getAll('hotels'),getAll('parts')]);
  const byWeek={};
  // First, rebuild daily regular/OT based on the chosen threshold
  const dayBuckets={}; // key: date -> total minutes that day
  timeRecs.forEach(t=>{
    const key=t.date; if(!key) return;
    if(!dayBuckets[key]) dayBuckets[key]=0;
    dayBuckets[key]+= (t.durMin ?? 0);
  });
  // Now split each day according to threshold and assign per-record reg/ot for aggregation
  const regByDay={}, otByDay={};
  Object.entries(dayBuckets).forEach(([d,mins])=>{
    const reg = Math.min(mins, otDailyHrs*60);
    const ot = Math.max(0, mins - reg);
    regByDay[d]=reg; otByDay[d]=ot;
  });
  // Aggregate by week
  const weekAgg={}; // week -> {reg,ot,miles,hotel,parts}
  Object.keys(regByDay).forEach(d=>{
    const w=isoWeek(d); if(!weekAgg[w]) weekAgg[w]={reg:0,ot:0,miles:0,hotel:0,parts:0};
    weekAgg[w].reg += regByDay[d];
    weekAgg[w].ot += otByDay[d];
  });
  milesRecs.forEach(m=>{ const w='n/a'; if(!weekAgg[w]) weekAgg[w]={reg:0,ot:0,miles:0,hotel:0,parts:0}; weekAgg[w].miles += +m.miles||0; });
  hotelRecs.forEach(hh=>{ const w='n/a'; if(!weekAgg[w]) weekAgg[w]={reg:0,ot:0,miles:0,hotel:0,parts:0}; weekAgg[w].hotel += +hh.cost||0; });
  partRecs.forEach(p=>{ const w='n/a'; if(!weekAgg[w]) weekAgg[w]={reg:0,ot:0,miles:0,hotel:0,parts:0}; weekAgg[w].parts += +p.cost||0; });
  return weekAgg;
}
async function render(){
  const otDaily = parseFloat(document.getElementById('otThreshold').value||'8');
  const agg = await compute(otDaily);
  const tbody=document.getElementById('summaryBody'); tbody.innerHTML='';
  Object.entries(agg).forEach(([w,v])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${w}</td><td>${h(v.reg)}</td><td>${h(v.ot)}</td><td>${v.miles.toFixed(1)}</td><td>$${v.hotel.toFixed(2)}</td><td>$${v.parts.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
}
document.getElementById('recalcBtn').addEventListener('click',render);
render();