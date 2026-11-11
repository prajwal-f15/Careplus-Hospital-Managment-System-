/**
 * ==============================================================================
 * CAREPULSE - UNIFIED REALTIME & AUTO-REFRESH VERIFICATION TEST SUITE
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`✖ FAIL: ${msg}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`✔ PASS: ${msg}`);
    passed++;
  }
}

function collectFiles(dir, ext, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.gemini'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, ext, results);
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

console.log('\n======================================================================');
console.log('CAREPULSE REALTIME & AUTO-REFRESH VERIFICATION SUITE');
console.log('======================================================================\n');

// ------------------------------------------------------------------------------
// 1. Validate Syntax of ALL External JS & Inline HTML <script> Blocks
// ------------------------------------------------------------------------------
const jsFiles = collectFiles(ROOT, '.js').filter(f => !f.includes(`${path.sep}tests${path.sep}`));
for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.Script(code, { filename: path.relative(ROOT, file) });
    assert(true, `Valid JS syntax: ${path.relative(ROOT, file)}`);
  } catch (err) {
    assert(false, `JS syntax error in ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

const htmlFiles = collectFiles(ROOT, '.html');
let checkedInlineBlocks = 0;
let htmlSyntaxErrors = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const scriptRegex = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let idx = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    idx++;
    const code = match[1].trim();
    if (!code) continue;
    checkedInlineBlocks++;
    try {
      new vm.Script(code, { filename: `${path.relative(ROOT, file)}#inline-${idx}` });
    } catch (err) {
      htmlSyntaxErrors++;
      console.error(`✖ Inline script syntax error in ${path.relative(ROOT, file)}#${idx}:`, err.message);
    }
  }
}
assert(checkedInlineBlocks > 0 && htmlSyntaxErrors === 0, `All ${checkedInlineBlocks} inline <script> blocks across ${htmlFiles.length} HTML files parse cleanly`);

// ------------------------------------------------------------------------------
// 2. Verify SQL Realtime Publication Migration Coverage
// ------------------------------------------------------------------------------
const sqlPath = path.join(ROOT, 'sql', 'realtime_publication.sql');
assert(fs.existsSync(sqlPath), 'sql/realtime_publication.sql exists');
const sqlText = fs.readFileSync(sqlPath, 'utf8');
const expectedTables = [
  'appointments', 'notifications', 'chat_messages', 'doctors',
  'doctor_availability', 'doctor_leaves', 'waiting_list', 'reviews',
  'departments', 'opd_rooms', 'profiles', 'audit_logs'
];
for (const tbl of expectedTables) {
  assert(sqlText.includes(`'${tbl}'`), `realtime_publication.sql includes table '${tbl}'`);
}
assert(/ALTER PUBLICATION supabase_realtime ADD TABLE/i.test(sqlText), 'realtime_publication.sql adds tables to supabase_realtime');

// ------------------------------------------------------------------------------
// 3. Verify Portal & Standalone Page Wiring
// ------------------------------------------------------------------------------
const supabaseSrc = fs.readFileSync(path.join(ROOT, 'js', 'supabase.js'), 'utf8');
const emitDefCount = (supabaseSrc.match(/\bemitSyncEvent\s*\(/g) || []).length;
assert(supabaseSrc.includes('emitSyncEvent(table = \'*\')'), 'js/supabase.js defines emitSyncEvent()');
assert(supabaseSrc.includes('hasActiveModalOrInputFocus()'), 'js/supabase.js defines hasActiveModalOrInputFocus()');
assert(supabaseSrc.includes('enableAutoRealtimeSync('), 'js/supabase.js defines enableAutoRealtimeSync()');
assert((supabaseSrc.match(/\benableAutoRealtimeSync\s*\(\s*\{/g) || []).length === 1, `No duplicate enableAutoRealtimeSync definitions in js/supabase.js (found ${emitDefCount} calls/refs)`);

const requiredWiring = [
  'js/patient.js',
  'js/doctor.js',
  'js/admin.js',
  'js/doctors.js',
  'index.html',
  'doctor-profile.html',
  'departments.html',
  'admin/rooms.html',
  'admin/audit-logs.html',
  'doctor/leaves.html',
  'doctor/queue.html',
  'patient/appointment-details.html'
];

for (const rel of requiredWiring) {
  const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert(txt.includes('enableAutoRealtimeSync'), `${rel} integrates enableAutoRealtimeSync`);
}

const doctorJs = fs.readFileSync(path.join(ROOT, 'js', 'doctor.js'), 'utf8');
assert(doctorJs.includes('dateFilter.onchange') && doctorJs.includes('statusFilter.onchange'), 'js/doctor.js avoids duplicate filter listeners across auto-refreshes');

const adminJs = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');
assert(
  adminJs.includes('this.filterDoctors()') &&
  adminJs.includes('this.filterPatients()') &&
  adminJs.includes('this.filterAppointments()'),
  'js/admin.js preserves active filters during auto-refresh'
);

const patientJs = fs.readFileSync(path.join(ROOT, 'js', 'patient.js'), 'utf8');
assert(patientJs.includes('triggerCallChimeOnce') && patientJs.includes('_reloadWizardSlots'), 'js/patient.js supports cross-device call chime & booking wizard live slot sync');

// ------------------------------------------------------------------------------
// 4. Behavioral Sandbox Simulation of CarePulseDB Realtime Coordinator
// ------------------------------------------------------------------------------
async function runBehaviorTests() {
  const windowListeners = {};
  const docListeners = {};
  const bcInstances = [];
  const storageMap = {};
  const subscribedCallbacks = {};
  let removedChannels = 0;

  class MockEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.closed = false;
      bcInstances.push(this);
    }
    postMessage(data) {
      for (const peer of bcInstances) {
        if (peer !== this && !peer.closed && peer.name === this.name && typeof peer.onmessage === 'function') {
          peer.onmessage({ data });
        }
      }
    }
    close() {
      this.closed = true;
    }
  }

  let modalOpen = false;
  let notesVal = '';
  let activeElement = { tagName: 'BODY' };

  const mockChannelObj = {
    on(_type, filterCfg, cb) {
      subscribedCallbacks[filterCfg.table] = cb;
      return mockChannelObj;
    },
    subscribe(cb) {
      if (typeof cb === 'function') cb('SUBSCRIBED');
      return mockChannelObj;
    }
  };

  const mockSupabaseClient = {
    channel: () => mockChannelObj,
    removeChannel: () => { removedChannels++; }
  };

  const activeTimers = new Set();
  const safeSetTimeout = (fn, ms, ...args) => {
    const id = setTimeout(() => { activeTimers.delete(id); fn(...args); }, ms);
    activeTimers.add(id);
    return id;
  };
  const safeClearTimeout = (id) => { activeTimers.delete(id); clearTimeout(id); };
  const safeSetInterval = (fn, ms, ...args) => {
    // Skip js/supabase.js's background 60s expiry runner inside short unit tests
    if (ms >= 10000) return 0;
    const id = setInterval(() => fn(...args), ms);
    activeTimers.add(id);
    return id;
  };
  const safeClearInterval = (id) => { activeTimers.delete(id); clearInterval(id); };

  const sandbox = {
    console,
    setTimeout: safeSetTimeout,
    clearTimeout: safeClearTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    Math,
    Date,
    JSON,
    Array,
    Set,
    Map,
    Promise,
    Error,
    CustomEvent: MockEvent,
    BroadcastChannel: MockBroadcastChannel,
    localStorage: {
      getItem: (k) => storageMap[k] ?? null,
      setItem: (k, v) => { storageMap[k] = String(v); },
      removeItem: (k) => { delete storageMap[k]; }
    },
    window: {
      SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'test-key' },
      supabase: { createClient: () => mockSupabaseClient },
      addEventListener(type, fn) {
        (windowListeners[type] = windowListeners[type] || []).push(fn);
      },
      removeEventListener(type, fn) {
        if (windowListeners[type]) {
          windowListeners[type] = windowListeners[type].filter(f => f !== fn);
        }
      },
      dispatchEvent(ev) {
        for (const fn of (windowListeners[ev.type] || [])) fn(ev);
      }
    },
    document: {
      visibilityState: 'visible',
      get activeElement() { return activeElement; },
      querySelector(sel) {
        if (modalOpen && sel.includes('modal')) return { id: 'mock-modal' };
        return null;
      },
      querySelectorAll() { return []; },
      getElementById(id) {
        if (id === 'active-consultation-notes') return { value: notesVal };
        return null;
      },
      addEventListener(type, fn) {
        (docListeners[type] = docListeners[type] || []).push(fn);
      },
      removeEventListener(type, fn) {
        if (docListeners[type]) {
          docListeners[type] = docListeners[type].filter(f => f !== fn);
        }
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(supabaseSrc, sandbox);
  const DB = sandbox.window.CarePulseDB;

  assert(typeof DB.emitSyncEvent === 'function' && typeof DB.enableAutoRealtimeSync === 'function', 'CarePulseDB boots cleanly inside sandbox VM');

  // Test BroadcastChannel cross-tab + localStorage emission
  const externalTabBC = new MockBroadcastChannel('carepulse_realtime_sync');
  let receivedBC = null;
  externalTabBC.onmessage = (m) => { receivedBC = m.data; };

  let localEventTable = null;
  sandbox.window.addEventListener('carepulse_db_change', (e) => {
    localEventTable = e.detail?.table;
  });

  DB.emitSyncEvent('appointments');
  assert(localEventTable === 'appointments', 'emitSyncEvent dispatches same-tab carepulse_db_change');
  assert(receivedBC && receivedBC.table === 'appointments', 'emitSyncEvent broadcasts across tabs via BroadcastChannel');
  assert(JSON.parse(storageMap.carepulse_last_sync).table === 'appointments', 'emitSyncEvent writes storage fallback event');

  // Test modal/input guards
  assert(DB.hasActiveModalOrInputFocus() === false, 'hasActiveModalOrInputFocus is false when idle');
  modalOpen = true;
  assert(DB.hasActiveModalOrInputFocus() === true, 'hasActiveModalOrInputFocus blocks refresh when modal is open');
  modalOpen = false;
  notesVal = 'Prescribe Paracetamol 500mg';
  assert(DB.hasActiveModalOrInputFocus() === true, 'hasActiveModalOrInputFocus protects unsaved consultation notes');
  notesVal = '';
  activeElement = { tagName: 'INPUT', type: 'text' };
  assert(DB.hasActiveModalOrInputFocus() === true, 'hasActiveModalOrInputFocus protects active text search/form typing');
  activeElement = { tagName: 'INPUT', type: 'date' };
  assert(DB.hasActiveModalOrInputFocus() === false, 'hasActiveModalOrInputFocus allows sync after date selection focus');
  activeElement = { tagName: 'SELECT' };
  assert(DB.hasActiveModalOrInputFocus() === false, 'hasActiveModalOrInputFocus allows sync after dropdown selection focus');
  activeElement = { tagName: 'BODY' };

  // Test enableAutoRealtimeSync multiplexed subscription + debounce + deferred flush + teardown
  let refreshCount = 0;
  let lastSource = null;
  let notifPayload = null;
  const controller = DB.enableAutoRealtimeSync({
    tables: ['appointments', 'doctors', 'notifications'],
    userId: 'pat-123',
    intervalMs: 120,
    onRefresh: async (src) => {
      refreshCount++;
      lastSource = src;
    },
    onNotificationEvent: (p) => { notifPayload = p; }
  });

  assert(typeof subscribedCallbacks.appointments === 'function' && typeof subscribedCallbacks.doctors === 'function', 'enableAutoRealtimeSync subscribes to multiplexed tables');

  // Trigger simulated Postgres Changes from another device
  subscribedCallbacks.notifications({ eventType: 'INSERT', new: { id: 'n1', title: 'Calling', message: 'Go inside' } });
  subscribedCallbacks.appointments({ eventType: 'UPDATE', new: { id: 'a1' } });
  assert(notifPayload?.new?.id === 'n1', 'onNotificationEvent fires on INSERT');

  await new Promise(r => setTimeout(r, 320));
  assert(refreshCount >= 1, `Debounced Supabase realtime triggered refresh (${refreshCount}x, last=${lastSource})`);

  // Verify deferred refresh while modal is open
  const beforeModalCount = refreshCount;
  modalOpen = true;
  externalTabBC.postMessage({ type: 'db_change', table: 'doctors' });
  await new Promise(r => setTimeout(r, 180));
  assert(refreshCount === beforeModalCount, 'Refresh stays paused while modal is open');

  modalOpen = false;
  for (const fn of (docListeners.click || [])) fn();
  await new Promise(r => setTimeout(r, 320));
  assert(refreshCount > beforeModalCount, 'Deferred refresh flushes automatically once modal closes');

  // Verify cleanup on destroy / pagehide
  const beforeDestroyCount = refreshCount;
  controller.destroy();
  externalTabBC.close();
  assert(removedChannels === 1, 'destroy() removes Supabase realtime channel');
  await new Promise(r => setTimeout(r, 200));
  assert(refreshCount === beforeDestroyCount, 'destroy() stops polling interval cleanly');

  // Verify live Supabase REST API connectivity
  const cfgText = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  const urlMatch = cfgText.match(/url:\s*['"](https:\/\/[^'"]+)['"]/);
  const keyMatch = cfgText.match(/anonKey:\s*['"]([^'"]+)['"]/);
  if (urlMatch && keyMatch) {
    try {
      const res = await fetch(`${urlMatch[1]}/rest/v1/departments?select=id,name&limit=3`, {
        headers: {
          apikey: keyMatch[1],
          Authorization: `Bearer ${keyMatch[1]}`
        }
      });
      assert(res.ok, `Live Supabase REST reachable (HTTP ${res.status})`);
    } catch (netErr) {
      console.warn('⚠ Skipping live network assertion (offline environment):', netErr.message);
    }
  }

  // Ensure no leftover sandbox timers remain
  for (const t of activeTimers) {
    clearTimeout(t);
    clearInterval(t);
  }
  activeTimers.clear();

  console.log('\n======================================================================');
  console.log(`REALTIME & AUTO-REFRESH CHECKS PASSED: ${passed}, FAILED: ${failed}`);
  console.log('======================================================================\n');
  if (failed > 0) process.exitCode = 1;
}

runBehaviorTests();
