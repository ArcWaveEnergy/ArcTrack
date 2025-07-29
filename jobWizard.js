document.getElementById('createJobBtn').addEventListener('click',async()=>{
  const n=document.getElementById('jobName').value.trim();
  if(!n){alert('Job Name required');return;}
  const j={name:n,technician:document.getElementById('technician').value.trim(),location:document.getElementById('location').value.trim(),startDate:document.getElementById('startDate').value,userEmail:document.getElementById('userEmail').value.trim(),status:'in-progress',createdAt:new Date().toISOString()};
  try{await put('jobs',j);alert('Job created');window.location.href='jobEntry.html?job='+encodeURIComponent(n);}catch(e){alert('Error creating job: '+e);}
});