/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * Doctor Module Controller
 * ==============================================================================
 */

window.DoctorApp = {
  currentUser: null,
  doctorRecord: null,

  async init() {
    this.currentUser = window.Auth.getCurrentUser();
    if (!this.currentUser) return;

    // Find Doctor Record
    const doctors = await window.CarePulseDB.getDoctors();
    this.doctorRecord = doctors.find(d => d.profile_id === this.currentUser.id || d.id === this.currentUser.doctor_id) || doctors[0];

    // Page-specific initializations
    if (document.getElementById('doctor-dashboard-view')) {
      await this.initDashboard();
    }
    if (document.getElementById('doctor-appointments-view')) {
      await this.initAppointmentsManager();
    }
    if (document.getElementById('doctor-schedule-view')) {
      await this.initScheduleManager();
    }
    if (document.getElementById('doctor-patients-view')) {
      await this.initPatientsList();
    }
    if (document.getElementById('doctor-reviews-view')) {
      await this.initReviews();
    }
    if (document.getElementById('doctor-profile-form')) {
      await this.initProfileForm();
    }

    // Auto-render mobile bottom bar on smartphones & tablets
    this.renderMobileBottomNav();

    // Realtime Database listeners & Supabase WebSockets
    const refreshDoctorViews = async () => {
      if (document.getElementById('doctor-dashboard-view')) await this.initDashboard();
      if (document.getElementById('doctor-appointments-view')) await this.initAppointmentsManager();
      if (document.getElementById('doctor-reviews-view')) await this.initReviews();
      if (document.getElementById('doctor-patients-view')) await this.initPatientsList();
    };

    window.addEventListener('carepulse_db_change', refreshDoctorViews);

    // Live Supabase Realtime Channels
    window.CarePulseDB.subscribeToAppointments(() => {
      refreshDoctorViews();
    });

    if (this.currentUser?.id) {
      window.CarePulseDB.subscribeToNotifications(this.currentUser.id, (notif) => {
        if (window.showToast && notif.new) {
          window.showToast(`${notif.new.title}: ${notif.new.message}`, 'info');
        }
        refreshDoctorViews();
      });
    }
  },

  // Render Doctor Mobile Bottom Bar
  renderMobileBottomNav() {
    if (document.getElementById('doctor-mobile-bottom-nav')) return;
    const currentPath = window.location.pathname;
    const nav = document.createElement('nav');
    nav.id = 'doctor-mobile-bottom-nav';
    nav.className = 'mobile-nav-bar';
    nav.innerHTML = `
      <a href="index.html" class="mobile-nav-item ${currentPath.endsWith('index.html') ? 'active' : ''}">
        <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
        <span>Home</span>
      </a>
      <a href="appointments.html" class="mobile-nav-item ${currentPath.includes('appointments') ? 'active' : ''}">
        <i data-lucide="calendar" class="w-5 h-5"></i>
        <span>Appts</span>
      </a>
      <a href="schedule.html" class="mobile-nav-item ${currentPath.includes('schedule') ? 'active' : ''}">
        <i data-lucide="clock" class="w-5 h-5"></i>
        <span>Schedule</span>
      </a>
      <a href="patients.html" class="mobile-nav-item ${currentPath.includes('patients') ? 'active' : ''}">
        <i data-lucide="users" class="w-5 h-5"></i>
        <span>Patients</span>
      </a>
      <a href="profile.html" class="mobile-nav-item ${currentPath.includes('profile') ? 'active' : ''}">
        <i data-lucide="user" class="w-5 h-5"></i>
        <span>Profile</span>
      </a>
    `;
    document.body.appendChild(nav);
    if (window.lucide) window.lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 1. DOCTOR DASHBOARD & LIVE QUEUE CONTROLS
  // --------------------------------------------------------------------------
  async initDashboard() {
    const todayStr = new Date().toISOString().split('T')[0];
    const appointments = await window.CarePulseDB.getAppointments();
    
    // Appointments for this doctor
    const myAppointments = appointments.filter(a => a.doctor_id === this.doctorRecord.id);
    const todayAppointments = myAppointments.filter(a => a.appointment_date === todayStr);

    const pendingRequests = myAppointments.filter(a => a.status === 'pending');
    const todayCompleted = todayAppointments.filter(a => a.status === 'completed');
    const inProgressApt = todayAppointments.find(a => a.status === 'in-progress');
    const nextWaitingApt = todayAppointments
      .filter(a => a.status === 'confirmed')
      .sort((a, b) => (a.token_sequence || 0) - (b.token_sequence || 0))[0];

    // Set Counters
    const todayTotalEl = document.getElementById('stat-today-total');
    const pendingEl = document.getElementById('stat-pending-requests');
    const completedEl = document.getElementById('stat-today-completed');
    const ratingEl = document.getElementById('stat-doctor-rating');

    if (todayTotalEl) todayTotalEl.innerText = todayAppointments.length;
    if (pendingEl) pendingEl.innerText = pendingRequests.length;
    if (completedEl) completedEl.innerText = todayCompleted.length;
    if (ratingEl) ratingEl.innerText = `${this.doctorRecord.rating || 5.0} ★`;

    // Render Pending Requests List (Feature: Doctor Confirm / Reject)
    const pendingListEl = document.getElementById('doctor-pending-requests-list');
    const pendingBadgeEl = document.getElementById('pending-count-badge');
    if (pendingBadgeEl) pendingBadgeEl.innerText = `${pendingRequests.length} Pending`;
    if (pendingListEl) {
      if (pendingRequests.length === 0) {
        pendingListEl.innerHTML = `
          <div class="p-8 text-center text-xs text-slate-400">
            <i data-lucide="check-circle" class="w-8 h-8 mx-auto mb-2 text-emerald-500"></i>
            No pending appointment requests. All incoming patient bookings are up to date!
          </div>
        `;
      } else {
        pendingListEl.innerHTML = pendingRequests.map(p => `
          <div class="p-4 hover:bg-slate-50/75 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition">
            <div class="flex items-start gap-3">
              <span class="token-badge text-xs px-2.5 py-1 font-mono">${p.token_number}</span>
              <div>
                <h5 class="text-xs font-bold text-slate-900">${p.patient_name || 'Patient'}</h5>
                <p class="text-[11px] text-slate-500">${p.appointment_date} at ${window.CarePulseDB.formatTime12Hour(p.time_slot || p.appointment_time)} &bull; ${p.patient_phone || 'No phone'}</p>
                <div class="text-xs text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <strong>Visit Reason:</strong> ${p.reason || 'General Health Consultation'}
                  ${p.symptoms ? `<br><span class="text-slate-400">Symptoms: ${p.symptoms}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
              <button onclick="window.DoctorApp.confirmPendingRequest('${p.id}')" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5">
                <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i> Confirm
              </button>
              <button onclick="window.DoctorApp.rejectPendingRequest('${p.id}')" class="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition flex items-center gap-1.5">
                <i data-lucide="x" class="w-4 h-4 stroke-[3]"></i> Decline
              </button>
              <button onclick="window.DoctorApp.openChatWithPatient('${p.id}', '${p.patient_name || 'Patient'}', '${p.patient_id}', '${p.token_number}')" class="p-1.5 rounded-xl text-teal-600 hover:bg-teal-50 border border-teal-200 transition" title="Chat with Patient">
                <i data-lucide="message-square" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render active OPD delay banner
    await this.renderDashboardDelayBanner();

    // Active Consultation Banner
    const activeBanner = document.getElementById('active-consultation-banner');
    if (activeBanner) {
      if (inProgressApt) {
        activeBanner.innerHTML = `
          <div class="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-500/30">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-300">Consultation In Progress</span>
              </div>
              <span class="token-badge bg-emerald-600 text-white">Token: ${inProgressApt.token_number}</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
              <div>
                <h3 class="text-2xl font-black">${inProgressApt.patient_name}</h3>
                <p class="text-xs text-emerald-200 mt-1">Phone: ${inProgressApt.patient_phone || 'N/A'} &bull; ${inProgressApt.patient_gender || 'Patient'}</p>
                <div class="mt-3 p-3 bg-white/10 rounded-xl text-xs text-emerald-100">
                  <strong>Reason:</strong> ${inProgressApt.reason}
                </div>
              </div>
              <div class="flex flex-col justify-end">
                <textarea id="active-consultation-notes" placeholder="Enter clinical notes / prescription here..." class="w-full bg-white/15 border border-white/20 rounded-xl p-3 text-xs text-white placeholder-emerald-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"></textarea>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <button onclick="window.DoctorApp.completeConsultation('${inProgressApt.id}')" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs shadow-lg transition flex items-center gap-1.5">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Complete Consultation
              </button>
            </div>
          </div>
        `;
      } else if (nextWaitingApt) {
        activeBanner.innerHTML = `
          <div class="bg-gradient-to-r from-sky-900 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-sky-300">Next Patient In Queue</span>
              <span class="token-badge">Token: ${nextWaitingApt.token_number}</span>
            </div>
            
            <div class="my-6">
              <h3 class="text-2xl font-bold">${nextWaitingApt.patient_name}</h3>
              <p class="text-xs text-sky-200 mt-1">Time: ${nextWaitingApt.appointment_time} &bull; Reason: ${nextWaitingApt.reason}</p>
            </div>

            <div class="flex items-center justify-end gap-3">
              <button onclick="window.DoctorApp.callNextPatient('${nextWaitingApt.id}')" class="px-6 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-900 font-extrabold text-xs shadow-lg transition flex items-center gap-2">
                <i data-lucide="bell" class="w-4 h-4"></i> Call & Start Consultation (Token ${nextWaitingApt.token_number})
              </button>
            </div>
          </div>
        `;
      } else {
        activeBanner.innerHTML = `
          <div class="bg-white rounded-3xl p-8 border border-slate-200 text-center">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
              <i data-lucide="check-check" class="w-6 h-6"></i>
            </div>
            <h4 class="text-sm font-bold text-slate-800">Queue is Clear</h4>
            <p class="text-xs text-slate-400 mt-1">No confirmed patients currently waiting in line for today.</p>
          </div>
        `;
      }
    }

    // Today's Queue List
    const queueList = document.getElementById('doctor-today-queue-list');
    if (queueList) {
      if (todayAppointments.length === 0) {
        queueList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No appointments scheduled for today.</div>`;
      } else {
        queueList.innerHTML = todayAppointments.map(a => `
          <div class="p-4 border-b border-slate-100 hover:bg-slate-50/75 flex items-center justify-between gap-4 transition">
            <div class="flex items-center gap-3">
              <span class="token-badge text-xs px-2.5 py-1 font-mono">${a.token_number}</span>
              <div>
                <h5 class="text-xs font-bold text-slate-900">${a.patient_name}</h5>
                <p class="text-[11px] text-slate-500">${a.appointment_time} &bull; ${a.reason}</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="status-badge ${a.status}">${a.status}</span>
              ${a.status === 'confirmed' ? `
                <button onclick="window.DoctorApp.callNextPatient('${a.id}')" class="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold rounded-lg transition" title="Start Consultation">
                  Start
                </button>
                <button onclick="window.DoctorApp.openDirectCallModal('${a.id}', '${a.patient_name || 'Patient'}', '${a.patient_phone || ''}', '${a.token_number}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Direct Phone / Chime Call">
                  <i data-lucide="phone-call" class="w-4 h-4"></i>
                </button>
              ` : ''}
              <button onclick="window.DoctorApp.openChatWithPatient('${a.id}', '${a.patient_name || 'Patient'}', '${a.patient_id}', '${a.token_number}')" class="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition" title="Chat with Patient">
                <i data-lucide="message-square" class="w-4 h-4"></i>
              </button>
              <button onclick="window.generateAppointmentReceiptPDF(${JSON.stringify(a).replace(/"/g, '&quot;')})" class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition" title="Download Token Slip (with QR)">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  },

  async callNextPatient(appointmentId) {
    try {
      const doctorId = this.doctorRecord?.id || this.currentUser?.doctor_id || this.currentUser?.id;
      await window.CarePulseDB.callNextPatientInQueue(doctorId, appointmentId);
      window.showToast('Patient called! Realtime alert & audio chime sent to patient.', 'success');
      if (document.getElementById('doctor-dashboard-view')) await this.initDashboard();
      if (document.getElementById('doctor-appointments-view')) await this.initAppointmentsManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async completeConsultation(appointmentId) {
    const notes = document.getElementById('active-consultation-notes')?.value || '';
    try {
      await window.CarePulseDB.updateAppointmentStatus(appointmentId, 'completed', notes);
      window.showToast('Consultation marked as completed successfully!', 'success');
      this.initDashboard();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // DOCTOR DELAY MANAGEMENT (Feature 5)
  // --------------------------------------------------------------------------
  openDelayModal() {
    const modal = document.getElementById('doctor-delay-modal');
    if (modal) modal.classList.remove('hidden');
  },

  closeDelayModal() {
    const modal = document.getElementById('doctor-delay-modal');
    if (modal) {
      modal.classList.add('hidden');
      const form = document.getElementById('doctor-delay-form');
      if (form) form.reset();
      const custom = document.getElementById('doctor-delay-reason-custom');
      if (custom) custom.classList.add('hidden');
    }
  },

  setDelayPreset(min) {
    const input = document.getElementById('doctor-delay-minutes');
    if (input) input.value = min;
  },

  handleDelayReasonChange(val) {
    const custom = document.getElementById('doctor-delay-reason-custom');
    if (!custom) return;
    if (val === 'Custom') {
      custom.classList.remove('hidden');
      custom.required = true;
    } else {
      custom.classList.add('hidden');
      custom.required = false;
    }
  },

  async submitDelay(e) {
    e.preventDefault();
    const minutes = parseInt(document.getElementById('doctor-delay-minutes')?.value, 10);
    const selectReason = document.getElementById('doctor-delay-reason-select')?.value;
    const customReason = document.getElementById('doctor-delay-reason-custom')?.value?.trim();
    const reason = (selectReason === 'Custom' && customReason) ? customReason : selectReason;

    const docId = this.doctorRecord?.id || this.currentUser?.doctor_id || this.currentUser?.id;
    try {
      await window.CarePulseDB.reportDoctorDelay(docId, minutes, reason);
      window.showToast(`OPD Delay of ${minutes} mins reported & patients notified!`, 'success');
      this.closeDelayModal();
      await this.renderDashboardDelayBanner();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async clearDelay() {
    const docId = this.doctorRecord?.id || this.currentUser?.doctor_id || this.currentUser?.id;
    try {
      await window.CarePulseDB.clearDoctorDelay(docId);
      window.showToast('Doctor delay cleared. Schedule resumed normally!', 'success');
      await this.renderDashboardDelayBanner();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async renderDashboardDelayBanner() {
    const docId = this.doctorRecord?.id || this.currentUser?.doctor_id || this.currentUser?.id;
    const banner = document.getElementById('doctor-dashboard-delay-banner');
    if (!banner || !docId) return;

    const delayInfo = await window.CarePulseDB.getDoctorDelay(docId);
    if (delayInfo && delayInfo.delay_minutes > 0) {
      banner.className = 'p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-orange-500/10 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm';
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
            <i data-lucide="clock" class="w-5 h-5 animate-spin"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-black uppercase tracking-wider text-amber-700">Active OPD Delay Broadcast</span>
              <span class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">+${delayInfo.delay_minutes} MINS</span>
            </div>
            <p class="text-xs font-medium text-amber-800 mt-0.5">${delayInfo.delay_reason || 'Doctor delayed'}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.DoctorApp.openDelayModal()" class="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-bold shadow-sm transition">
            Update Delay
          </button>
          <button onclick="window.DoctorApp.clearDelay()" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1">
            <i data-lucide="check" class="w-3.5 h-3.5"></i> Clear / On Schedule
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    } else {
      banner.className = 'hidden';
      banner.innerHTML = '';
    }
  },

  // --------------------------------------------------------------------------
  // 2. APPOINTMENTS MANAGER (ACCEPT / REJECT / FILTER)
  // --------------------------------------------------------------------------
  async initAppointmentsManager() {
    const container = document.getElementById('doctor-appointments-view');
    if (!container) return;

    const appointments = await window.CarePulseDB.getAppointments();
    const myAppointments = appointments.filter(a => a.doctor_id === this.doctorRecord.id);

    const dateFilter = document.getElementById('filter-appt-date');
    const statusFilter = document.getElementById('filter-appt-status');

    const render = () => {
      const selectedDate = dateFilter?.value;
      const selectedStatus = statusFilter?.value || 'all';

      const filtered = myAppointments.filter(a => {
        const matchesDate = !selectedDate || a.appointment_date === selectedDate;
        const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus;
        return matchesDate && matchesStatus;
      });

      const listEl = document.getElementById('doctor-appointments-table-body');
      if (!listEl) return;

      if (filtered.length === 0) {
        listEl.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-xs text-slate-400">No appointments found matching filter criteria.</td></tr>`;
        return;
      }

      listEl.innerHTML = filtered.map(a => `
        <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
          <td class="py-3.5 px-4 font-bold text-sky-700 font-mono text-xs">${a.token_number}</td>
          <td class="py-3.5 px-4">
            <div class="font-bold text-slate-900 text-xs">${a.patient_name}</div>
            <div class="text-[11px] text-slate-500">${a.patient_phone || a.patient_email}</div>
          </td>
          <td class="py-3.5 px-4 text-xs text-slate-600">
            <div>${a.appointment_date}</div>
            <div class="text-[11px] text-slate-400">${a.appointment_time}</div>
          </td>
          <td class="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate" title="${a.reason}">
            ${a.reason}
          </td>
          <td class="py-3.5 px-4">
            <span class="status-badge ${a.status}">${a.status}</span>
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${a.status === 'pending' ? `
                <button onclick="window.DoctorApp.handleRequest('${a.id}', 'confirmed')" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Accept Appointment">
                  <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
                </button>
                <button onclick="window.DoctorApp.handleRequest('${a.id}', 'rejected')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Reject Appointment">
                  <i data-lucide="x" class="w-4 h-4 stroke-[3]"></i>
                </button>
              ` : ''}

              ${a.status === 'confirmed' ? `
                <button onclick="window.DoctorApp.callNextPatient('${a.id}')" class="px-2.5 py-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition" title="Start Consultation">
                  Start
                </button>
                <button onclick="window.DoctorApp.openDirectCallModal('${a.id}', '${a.patient_name || 'Patient'}', '${a.patient_phone || ''}', '${a.token_number}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Direct Phone / Chime Call">
                  <i data-lucide="phone-call" class="w-4 h-4"></i>
                </button>
              ` : ''}

              ${a.status === 'in-progress' ? `
                <button onclick="window.DoctorApp.openCompleteModal('${a.id}', '${a.patient_name}')" class="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
                  Complete
                </button>
                <button onclick="window.DoctorApp.openDirectCallModal('${a.id}', '${a.patient_name || 'Patient'}', '${a.patient_phone || ''}', '${a.token_number}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Direct Phone / Chime Call">
                  <i data-lucide="phone-call" class="w-4 h-4"></i>
                </button>
              ` : ''}

              <button onclick="window.DoctorApp.openChatWithPatient('${a.id}', '${a.patient_name || 'Patient'}', '${a.patient_id}', '${a.token_number}')" class="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition" title="Chat with Patient">
                <i data-lucide="message-square" class="w-4 h-4"></i>
              </button>

              <button onclick="window.generateAppointmentReceiptPDF(${JSON.stringify(a).replace(/"/g, '&quot;')})" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition" title="Download Token Slip with QR">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    };

    render();
    dateFilter?.addEventListener('change', render);
    statusFilter?.addEventListener('change', render);
  },

  async handleRequest(appointmentId, status) {
    let rejectionReason = '';
    if (status === 'rejected') {
      rejectionReason = prompt('Please provide reason for rejecting this appointment:') || 'Doctor unavailable at requested time';
    }

    try {
      await window.CarePulseDB.updateAppointmentStatus(appointmentId, status, '', rejectionReason);
      window.showToast(`Appointment ${status} successfully!`, 'success');
      this.initAppointmentsManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  openCompleteModal(appointmentId, patientName) {
    const notes = prompt(`Enter consultation notes / prescription for ${patientName}:`);
    if (notes !== null) {
      window.CarePulseDB.updateAppointmentStatus(appointmentId, 'completed', notes)
        .then(() => {
          window.showToast('Consultation completed successfully!', 'success');
          this.initAppointmentsManager();
        })
        .catch(err => window.showToast(err.message, 'error'));
    }
  },

  async confirmPendingRequest(appointmentId) {
    try {
      await window.CarePulseDB.updateAppointmentStatus(appointmentId, 'confirmed');
      window.showToast('Appointment confirmed! Realtime web notification sent to patient & digital slip unlocked.', 'success');
      if (document.getElementById('doctor-dashboard-view')) await this.initDashboard();
      if (document.getElementById('doctor-appointments-view')) await this.initAppointmentsManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async rejectPendingRequest(appointmentId) {
    const reason = prompt('Please specify reason for declining this appointment:') || 'Doctor unavailable at requested time';
    try {
      await window.CarePulseDB.updateAppointmentStatus(appointmentId, 'rejected', '', reason);
      window.showToast('Appointment declined & patient notified.', 'info');
      if (document.getElementById('doctor-dashboard-view')) await this.initDashboard();
      if (document.getElementById('doctor-appointments-view')) await this.initAppointmentsManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // DOCTOR QR SCANNER ENGINE
  // --------------------------------------------------------------------------
  doctorHtml5QrCode: null,

  async openDoctorQRScannerModal() {
    const modal = document.getElementById('doctor-qr-scanner-modal');
    const resultBox = document.getElementById('doctor-qr-result-box');
    if (resultBox) resultBox.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');

    try {
      if (!this.doctorHtml5QrCode) {
        this.doctorHtml5QrCode = new Html5Qrcode("doctor-qr-reader");
      }
      await this.doctorHtml5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          await this.handleDoctorQRScanned(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.warn('Camera scan not started or permission denied:', err);
    }
  },

  async closeDoctorQRScannerModal() {
    if (this.doctorHtml5QrCode && this.doctorHtml5QrCode.isScanning) {
      try { await this.doctorHtml5QrCode.stop(); } catch (e) {}
    }
    const modal = document.getElementById('doctor-qr-scanner-modal');
    if (modal) modal.classList.add('hidden');
  },

  async handleDoctorQRScanned(qrData) {
    if (this.doctorHtml5QrCode && this.doctorHtml5QrCode.isScanning) {
      try { await this.doctorHtml5QrCode.stop(); } catch (e) {}
    }
    await this.processDoctorVerification(qrData);
  },

  async verifyManualDoctorToken() {
    const input = document.getElementById('doctor-qr-manual-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
      window.showToast('Please enter token or verification code', 'warning');
      return;
    }
    await this.processDoctorVerification(val);
  },

  async processDoctorVerification(payloadOrToken) {
    const resultBox = document.getElementById('doctor-qr-result-box');
    if (!resultBox) return;
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">Verifying appointment pass with database...</div>';

    try {
      const res = await window.CarePulseDB.verifyAppointmentQR(payloadOrToken);
      if (!res.valid) {
        resultBox.innerHTML = `
          <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <div class="font-bold mb-1">❌ Verification Failed</div>
            <div>${res.message || 'Invalid or expired QR token pass.'}</div>
          </div>
        `;
        return;
      }

      const appt = res.appointment;
      resultBox.innerHTML = `
        <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-3">
          <div class="flex items-center justify-between border-b border-emerald-200/60 pb-2">
            <span class="font-bold text-emerald-800 flex items-center gap-1.5"><i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i> Verified Patient Pass</span>
            <span class="token-badge font-mono">${appt.token_number}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div><strong>Patient:</strong> ${appt.patient_name || 'Patient'}</div>
            <div><strong>Status:</strong> <span class="status-badge ${appt.status}">${appt.status}</span></div>
            <div><strong>Date:</strong> ${appt.appointment_date}</div>
            <div><strong>Time:</strong> ${appt.time_slot || appt.appointment_time}</div>
          </div>
          <div class="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
            <button onclick="window.DoctorApp.admitScannedPatient('${appt.id}')" class="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition">
              Admit into Consultation Room
            </button>
            <button onclick="window.DoctorApp.closeDoctorQRScannerModal(); if(window.DoctorApp.initDashboard) window.DoctorApp.initDashboard();" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs">
              Done
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      resultBox.innerHTML = `<div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">Error: ${err.message}</div>`;
    }
  },

  async admitScannedPatient(appointmentId) {
    try {
      const docId = this.doctorRecord?.id || this.currentUser?.id;
      await window.CarePulseDB.callNextPatientInQueue(docId, appointmentId);
      window.showToast('Patient admitted into consultation room!', 'success');
      this.closeDoctorQRScannerModal();
      if (document.getElementById('doctor-dashboard-view')) await this.initDashboard();
      if (document.getElementById('doctor-appointments-view')) await this.initAppointmentsManager();
    } catch (e) {
      window.showToast(e.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // DOCTOR DIRECT CALL & CHAT HANDLERS
  // --------------------------------------------------------------------------
  currentDirectCallAppt: null,

  openDirectCallModal(appointmentId, patientName, patientPhone, tokenNumber) {
    this.currentDirectCallAppt = { appointmentId, patientName, patientPhone, tokenNumber };
    document.getElementById('direct-call-token').innerText = tokenNumber || 'APPT';
    document.getElementById('direct-call-patient').innerText = patientName || 'Patient';
    document.getElementById('direct-call-phone-text').innerText = patientPhone || 'No phone recorded';

    const phoneLink = document.getElementById('direct-call-phone-link');
    if (patientPhone) {
      phoneLink.href = `tel:${patientPhone.replace(/[^0-9+]/g, '')}`;
      phoneLink.classList.remove('opacity-50', 'pointer-events-none');
    } else {
      phoneLink.href = '#';
      phoneLink.classList.add('opacity-50', 'pointer-events-none');
    }

    document.getElementById('doctor-direct-call-modal').classList.remove('hidden');
  },

  closeDirectCallModal() {
    const modal = document.getElementById('doctor-direct-call-modal');
    if (modal) modal.classList.add('hidden');
    this.currentDirectCallAppt = null;
  },

  async triggerDirectCall() {
    if (!this.currentDirectCallAppt) return;
    const btn = document.getElementById('direct-call-chime-btn');
    if (btn) btn.disabled = true;

    try {
      const docId = this.doctorRecord?.id || this.currentUser?.id;
      await window.CarePulseDB.directCallPatient(this.currentDirectCallAppt.appointmentId, docId);
      window.showToast(`📢 Calling ${this.currentDirectCallAppt.patientName}! Loud chime & room alert broadcasted.`, 'success');
      this.closeDirectCallModal();
      if (document.getElementById('doctor-dashboard-view')) await this.initDashboard();
      if (document.getElementById('doctor-appointments-view')) await this.initAppointmentsManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  openChatWithPatient(appointmentId, patientName, patientId, tokenNumber) {
    if (!window.CarePulseChat) {
      window.showToast('Chat module is loading...', 'info');
      return;
    }
    const docName = this.doctorRecord?.full_name || this.currentUser?.full_name || 'Doctor';
    const docId = this.doctorRecord?.id || this.currentUser?.id;

    window.CarePulseChat.openChat({
      appointmentId,
      doctorId: docId,
      patientId,
      otherPartyName: patientName || 'Patient',
      otherPartyRole: 'patient',
      otherPartySubtitle: 'Patient Consultation',
      tokenNumber: tokenNumber || 'APPT'
    });
  },

  // --------------------------------------------------------------------------
  // 3. SCHEDULE AVAILABILITY MANAGER
  // --------------------------------------------------------------------------
  async initScheduleManager() {
    const container = document.getElementById('doctor-schedule-view');
    if (!container) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const availability = await window.CarePulseDB.getDoctorAvailability(this.doctorRecord.id);

    const form = document.getElementById('doctor-schedule-form');
    const scheduleContainer = document.getElementById('schedule-days-container');

    if (!scheduleContainer) return;

    scheduleContainer.innerHTML = days.map(day => {
      const existing = availability.find(a => a.day_of_week.toLowerCase() === day.toLowerCase());
      const isAvailable = existing ? existing.is_available : false;
      const startTime = existing ? existing.start_time.substring(0, 5) : '09:00';
      const endTime = existing ? existing.end_time.substring(0, 5) : '17:00';

      return `
        <div class="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <input type="checkbox" id="check-${day}" name="day_available_${day}" ${isAvailable ? 'checked' : ''} class="w-4 h-4 text-sky-600 rounded focus:ring-sky-500">
            <label for="check-${day}" class="font-bold text-slate-800 text-sm">${day}</label>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Start:</span>
              <input type="time" name="start_${day}" value="${startTime}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500">
            </div>
            <div class="flex items-center gap-1.5 text-xs text-slate-500">
              <span>End:</span>
              <input type="time" name="end_${day}" value="${endTime}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500">
            </div>
          </div>
        </div>
      `;
    }).join('');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updatedSchedules = [];

      days.forEach(day => {
        const isChecked = document.getElementById(`check-${day}`)?.checked;
        const startTime = document.querySelector(`input[name="start_${day}"]`)?.value || '09:00';
        const endTime = document.querySelector(`input[name="end_${day}"]`)?.value || '17:00';

        if (isChecked) {
          updatedSchedules.push({
            day_of_week: day,
            start_time: startTime,
            end_time: endTime,
            slot_duration_minutes: 30,
            is_available: true
          });
        }
      });

      try {
        await window.CarePulseDB.saveDoctorAvailability(this.doctorRecord.id, updatedSchedules);
        window.showToast('Weekly schedule availability updated!', 'success');
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  },

  // --------------------------------------------------------------------------
  // 4. PATIENT RECORDS & HISTORY
  // --------------------------------------------------------------------------
  async initPatientsList() {
    const listContainer = document.getElementById('doctor-patients-table-body');
    if (!listContainer) return;

    const appointments = await window.CarePulseDB.getAppointments();
    const myAppointments = appointments.filter(a => a.doctor_id === this.doctorRecord.id);

    // Group by unique patients
    const patientMap = new Map();
    myAppointments.forEach(a => {
      if (!patientMap.has(a.patient_id)) {
        patientMap.set(a.patient_id, {
          id: a.patient_id,
          name: a.patient_name,
          phone: a.patient_phone,
          email: a.patient_email,
          gender: a.patient_gender,
          totalVisits: 0,
          lastVisit: a.appointment_date,
          history: []
        });
      }
      const record = patientMap.get(a.patient_id);
      record.totalVisits += 1;
      record.history.push(a);
    });

    const uniquePatients = Array.from(patientMap.values());

    if (uniquePatients.length === 0) {
      listContainer.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-xs text-slate-400">No patient records yet.</td></tr>`;
      return;
    }

    listContainer.innerHTML = uniquePatients.map(p => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-900 text-xs">${p.name}</div>
          <div class="text-[11px] text-slate-400">${p.email}</div>
        </td>
        <td class="py-3.5 px-4 text-xs text-slate-600">${p.phone || 'N/A'}</td>
        <td class="py-3.5 px-4 text-xs text-slate-600 font-semibold">${p.totalVisits} Consultations</td>
        <td class="py-3.5 px-4 text-xs text-slate-500">${p.lastVisit}</td>
        <td class="py-3.5 px-4 text-right">
          <button onclick="alert('Patient Medical Notes:\\n' + ${JSON.stringify(p.history.map(h => `${h.appointment_date}: ${h.reason} (Status: ${h.status})`).join('\\n'))})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition">
            View History
          </button>
        </td>
      </tr>
    `).join('');
  },

  // --------------------------------------------------------------------------
  // 5. REVIEWS & RATINGS
  // --------------------------------------------------------------------------
  async initReviews() {
    const listContainer = document.getElementById('doctor-reviews-list');
    if (!listContainer) return;

    const reviews = await window.CarePulseDB.getReviews(this.doctorRecord.id);

    if (reviews.length === 0) {
      listContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-10 border border-slate-200 text-center">
          <i data-lucide="star-off" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
          <h4 class="text-sm font-bold text-slate-700">No Reviews Yet</h4>
          <p class="text-xs text-slate-400 mt-1">Patient reviews will appear here once consultations are completed.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listContainer.innerHTML = reviews.map(r => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
              ${r.patient_name.charAt(0)}
            </div>
            <div>
              <h5 class="text-xs font-bold text-slate-900">${r.patient_name}</h5>
              <span class="text-[10px] text-slate-400">${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 text-amber-500 font-bold text-xs">
            <span>${r.rating}</span>
            <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 stroke-amber-400"></i>
          </div>
        </div>
        <p class="text-xs text-slate-600 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
          "${r.comment}"
        </p>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 6. PROFILE & BIO FORM
  // --------------------------------------------------------------------------
  async initProfileForm() {
    const profile = (await window.CarePulseDB.getProfileById(this.currentUser.id)) || this.currentUser || {};
    const doc = this.doctorRecord || {};

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };

    setVal('doc-name', profile.full_name);
    setVal('doc-email', profile.email);
    setVal('doc-phone', profile.phone);
    setVal('doc-specialization', doc.specialization);
    setVal('doc-qualification', doc.qualification);
    setVal('doc-experience', doc.experience_years);
    setVal('doc-fee', doc.consultation_fee);
    setVal('doc-room', doc.room_number);
    setVal('doc-about', doc.about);
    setVal('profile-image', profile.profile_image);

    // Direct Image Upload Handler
    const fileInput = document.getElementById('profile-file-input');
    const uploadThumb = document.getElementById('upload-preview-thumb');
    const resetAvatarBtn = document.getElementById('reset-avatar-btn');
    const hiddenAvatarInput = document.getElementById('profile-image');

    if (uploadThumb && profile.profile_image) {
      uploadThumb.src = profile.profile_image;
    }

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        window.showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 300;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          if (uploadThumb) uploadThumb.src = compressedDataUrl;
          if (hiddenAvatarInput) hiddenAvatarInput.value = compressedDataUrl;

          window.showToast('Doctor photo selected! Click "Save" to apply.', 'info');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    resetAvatarBtn?.addEventListener('click', () => {
      const defaultAvatar = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400';
      if (uploadThumb) uploadThumb.src = defaultAvatar;
      if (hiddenAvatarInput) hiddenAvatarInput.value = defaultAvatar;
    });

    const form = document.getElementById('doctor-profile-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving...';
      }

      try {
        const aboutEl = document.getElementById('doc-about');
        const updatedDoc = {
          full_name: document.getElementById('doc-name')?.value.trim() || profile.full_name,
          phone: document.getElementById('doc-phone')?.value.trim() || '',
          specialization: document.getElementById('doc-specialization')?.value.trim(),
          qualification: document.getElementById('doc-qualification')?.value.trim(),
          experience_years: Number(document.getElementById('doc-experience')?.value || 0),
          consultation_fee: Number(document.getElementById('doc-fee')?.value || 50),
          room_number: document.getElementById('doc-room')?.value.trim(),
          profile_image: document.getElementById('profile-image')?.value.trim() || profile.profile_image
        };
        if (aboutEl) {
          updatedDoc.about = aboutEl.value.trim();
        }

        const saved = await window.CarePulseDB.updateDoctor(doc.id || this.currentUser.id, updatedDoc);
        this.doctorRecord = { ...doc, ...saved };

        // Sync session & update navbar
        const updatedSession = {
          ...this.currentUser,
          full_name: updatedDoc.full_name,
          phone: updatedDoc.phone,
          specialization: updatedDoc.specialization,
          profile_image: updatedDoc.profile_image,
          doctor_id: saved?.id || this.currentUser.doctor_id
        };
        window.Auth.setCurrentUser(updatedSession);
        this.currentUser = updatedSession;
        window.Auth.renderAuthNav();

        window.showToast('Doctor profile details updated!', 'success');
      } catch (err) {
        window.showToast(err.message || 'Error updating doctor profile', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.DoctorApp.init();
});
