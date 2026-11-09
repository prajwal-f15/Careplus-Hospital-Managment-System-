const url = 'https://vpimfibtizurhuhljcpb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU';

async function testStatuses() {
  const res = await fetch(url + '/rest/v1/appointments?select=id,status,queue_status&limit=1', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await res.json();
  const appt = data[0];
  console.log('Target appt:', appt);
  if (!appt) return;

  const testList = [
    'pending',
    'confirmed',
    'in-progress',
    'in_progress',
    'in-consultation',
    'in_consultation',
    'completed',
    'cancelled',
    'rejected',
    'checked_in',
    'serving',
    'waiting'
  ];

  for (const st of testList) {
    const patchRes = await fetch(url + '/rest/v1/appointments?id=eq.' + appt.id, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ status: st })
    });
    const result = await patchRes.json();
    if (patchRes.ok) {
      console.log(`Status [${st}]: ALLOWED ✅`);
    } else {
      console.log(`Status [${st}]: REJECTED ❌ -> ${result.message}`);
    }
  }

  // Restore original status
  await fetch(url + '/rest/v1/appointments?id=eq.' + appt.id, {
    method: 'PATCH',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: appt.status })
  });
  console.log('Restored original status to:', appt.status);
}

testStatuses().catch(console.error);
