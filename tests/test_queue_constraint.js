const url = 'https://vpimfibtizurhuhljcpb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU';

async function testQueueStatus() {
  const res = await fetch(url + '/rest/v1/appointments?select=id,status,queue_status&limit=1', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await res.json();
  const appt = data[0];
  console.log('Target appt:', appt);

  const testQueueList = [
    'waiting',
    'called',
    'in-room',
    'in_room',
    'completed',
    'skipped',
    'in-progress',
    'pending'
  ];

  for (const qs of testQueueList) {
    const patchRes = await fetch(url + '/rest/v1/appointments?id=eq.' + appt.id, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ queue_status: qs })
    });
    const result = await patchRes.json();
    if (patchRes.ok) {
      console.log('queue_status [' + qs + ']: ALLOWED');
    } else {
      console.log('queue_status [' + qs + ']: REJECTED -> ' + result.message);
    }
  }

  // Restore
  await fetch(url + '/rest/v1/appointments?id=eq.' + appt.id, {
    method: 'PATCH',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ queue_status: appt.queue_status })
  });
}
testQueueStatus().catch(console.error);

