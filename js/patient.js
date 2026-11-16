/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * Patient Module Controller
 * ==============================================================================
 */

window.PatientApp = {
  currentUser: null,

  async init() {
    this.currentUser = window.Auth.getCurrentUser();
    if (!this.currentUser) return;

    // Route-specific initializations based on DOM elements present
    if (document.getElementById('patient-dashboard-view')) {
      await this.initDashboard();
    }
    if (document.getElementById('booking-wizard-container')) {
      await this.initBookingWizard();
    }
    if (document.getElementById('patient-appointments-list')) {
      await this.initAppointmentsList();
    }
    if (document.getElementById('patient-queue-view')) {
      await this.initQueueTracker();
    }
    if (document.getElementById('patient-profile-form')) {
      await this.initProfileForm();
    }
    if (document.getElementById('patient-notifications-container')) {
      await this.initNotifications();
    }

    // Auto-render mobile bottom bar on smartphones & tablets
    this.renderMobileBottomNav();

    // Listen to unified Supabase Realtime, cross-tab BroadcastChannel & smart auto-refresh polling
    const refreshViews = async () => {
      if (document.getElementById('patient-dashboard-view')) await this.initDashboard();
      if (document.getElementById('booking-wizard-container') && typeof this._reloadWizardSlots === 'function') {
        await this._reloadWizardSlots();
      }
      if (document.getElementById('patient-appointments-list')) await this.initAppointmentsList();
      if (document.getElementById('patient-queue-view')) {
        const selectedQueueId = document.getElementById('queue-appointment-select')?.value;
        if (selectedQueueId) await this.renderQueueDetails(selectedQueueId, true);
        else await this.initQueueTracker();
      }
      if (document.getElementById('patient-notifications-container')) await this.initNotifications();
    };

    if (window.CarePulseDB?.enableAutoRealtimeSync) {
      this._realtimeSync = window.CarePulseDB.enableAutoRealtimeSync({
        tables: [
          'appointments', 'doctors', 'doctor_availability',
          'doctor_leaves', 'waiting_list', 'notifications', 'reviews'
        ],
        userId: this.currentUser.id,
        intervalMs: 12000,
        onRefresh: refreshViews,
        onAppointmentEvent: (payload) => {
          const appt = payload?.new;
          if (!appt || appt.patient_id !== this.currentUser.id) return;
          if (appt.is_called === true || appt.queue_status === 'called') {
            this.triggerCallChimeOnce(
              `call_${appt.id}_${appt.called_at || 'called'}`,
              appt.token_number,
              appt.room_number
            );
          }
        },
        onNotificationEvent: (notif) => {
          const rec = notif?.new;
          if (!rec) return;
          if (rec.type === 'queue' && /calling|called/i.test(rec.title || '')) {
            this.triggerCallChimeOnce(`notif_${rec.id}`, '', '');
          } else if (window.showToast) {
            window.showToast(`${rec.title}: ${rec.message}`, 'info');
          }
        }
      });
    } else {
      window.addEventListener('carepulse_db_change', refreshViews);
      window.CarePulseDB.subscribeToAppointments(() => { refreshViews(); });
      if (this.currentUser?.id) {
        window.CarePulseDB.subscribeToNotifications(this.currentUser.id, (notif) => {
          if (window.showToast && notif.new) {
            window.showToast(`${notif.new.title}: ${notif.new.message}`, 'info');
          }
          refreshViews();
        });
      }
    }
  },

  triggerCallChimeOnce(eventKey, tokenNumber = '', roomNumber = '') {
    try {
      this._chimedEventKeys = this._chimedEventKeys || new Set();
      if (this._chimedEventKeys.has(eventKey)) return;

      let stored = [];
      try {
        stored = JSON.parse(sessionStorage.getItem('carepulse_chimed_keys') || '[]');
      } catch (e) {}
      if (stored.includes(eventKey)) {
        this._chimedEventKeys.add(eventKey);
        return;
      }

      this._chimedEventKeys.add(eventKey);
      stored.push(eventKey);
      try {
        sessionStorage.setItem('carepulse_chimed_keys', JSON.stringify(stored.slice(-30)));
      } catch (e) {}
    } catch (e) {}

    if (typeof this.playHospitalChime === 'function') {
      this.playHospitalChime();
    } else if (typeof playHospitalChime === 'function') {
      playHospitalChime();
    }

    if (window.showToast) {
      const tokenLabel = tokenNumber ? `Token ${tokenNumber}` : 'Your Token';
      const roomLabel = roomNumber ? ` to ${roomNumber}` : ' to Consultation Room';
      window.showToast(`🔔 ${tokenLabel}: Doctor is calling you now! Please proceed${roomLabel}.`, 'success');
    }
  },

  // Render Mobile Bottom Bar on small screens
  renderMobileBottomNav() {
    if (document.getElementById('patient-mobile-bottom-nav')) return;
    const currentPath = window.location.pathname;
    const nav = document.createElement('nav');
    nav.id = 'patient-mobile-bottom-nav';
    nav.className = 'mobile-nav-bar';
    nav.innerHTML = `
      <a href="index.html" class="mobile-nav-item ${currentPath.endsWith('index.html') ? 'active' : ''}">
        <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
        <span>Home</span>
      </a>
      <a href="book-appointment.html" class="mobile-nav-item ${currentPath.includes('book-appointment') ? 'active' : ''}">
        <i data-lucide="calendar-plus" class="w-5 h-5"></i>
        <span>Book</span>
      </a>
      <a href="appointments.html" class="mobile-nav-item ${currentPath.includes('appointments') ? 'active' : ''}">
        <i data-lucide="calendar" class="w-5 h-5"></i>
        <span>Appts</span>
      </a>
      <a href="queue-status.html" class="mobile-nav-item ${currentPath.includes('queue-status') ? 'active' : ''}">
        <i data-lucide="activity" class="w-5 h-5"></i>
        <span>Queue</span>
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
  // 1. PATIENT DASHBOARD
  // --------------------------------------------------------------------------
  async initDashboard() {
    const appointments = await window.CarePulseDB.getAppointments();
    const myAppointments = appointments.filter(a => a.patient_id === this.currentUser.id);

    const upcoming = myAppointments.filter(a => ['pending', 'confirmed'].includes(a.status));
    const completed = myAppointments.filter(a => a.status === 'completed');
    const nextApt = upcoming.sort((a, b) => new Date(`${a.appointment_date}T${a.appointment_time}`) - new Date(`${b.appointment_date}T${b.appointment_time}`))[0];

    // Update Counters
    const upcomingCount = document.getElementById('stat-upcoming-count');
    const completedCount = document.getElementById('stat-completed-count');
    const totalCount = document.getElementById('stat-total-count');

    if (upcomingCount) upcomingCount.innerText = upcoming.length;
    if (completedCount) completedCount.innerText = completed.length;
    if (totalCount) totalCount.innerText = myAppointments.length;

    // Render Next Appointment Hero Card
    const nextCardContainer = document.getElementById('next-appointment-card');
    if (nextCardContainer) {
      if (nextApt) {
        const queueInfo = await window.AppointmentEngine.getQueueStatus(nextApt.id);
        const isConfirmedPass = !['pending', 'cancelled', 'rejected'].includes(nextApt.status);
        nextCardContainer.innerHTML = `
          <div class="bg-gradient-to-r from-sky-900 via-sky-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-sky-300">Upcoming Consultation</span>
                <h3 class="text-2xl font-bold mt-1">${nextApt.appointment_date} at ${window.CarePulseDB.formatTime12Hour(nextApt.time_slot || nextApt.appointment_time)}</h3>
              </div>
              <div class="flex items-center gap-3">
                <span class="token-badge text-base px-4 py-1.5 shadow-lg">Token: ${nextApt.token_number}</span>
                <span class="status-badge ${nextApt.status} text-xs uppercase">${nextApt.status}</span>
              </div>
            </div>

            ${nextApt.status === 'pending' ? `
              <div class="mt-4 p-3.5 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-100 text-xs flex items-center gap-2.5">
                <i data-lucide="clock" class="w-4 h-4 text-amber-300 flex-shrink-0"></i>
                <span><strong>Pending Doctor Confirmation:</strong> Your booking request has been sent to ${nextApt.doctor_name}. Your A5 PDF Token Slip and Scannable QR Pass will unlock immediately once confirmed.</span>
              </div>
            ` : ''}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
              <div class="flex items-center gap-4">
                <img src="${nextApt.doctor_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}" class="w-14 h-14 rounded-2xl object-cover border-2 border-white/20">
                <div>
                  <h4 class="font-bold text-lg">${nextApt.doctor_name}</h4>
                  <p class="text-xs text-sky-200">${nextApt.specialization}</p>
                  <p class="text-xs text-sky-300 mt-0.5">${nextApt.room_number || 'Room 101'}</p>
                </div>
              </div>

              <div class="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <span class="text-xs text-sky-200">Live Queue Position</span>
                <div class="text-2xl font-black text-white mt-0.5">${queueInfo ? queueInfo.patientsAhead : 0} Ahead</div>
                <p class="text-[11px] text-sky-300 mt-1">Est. wait: ~${queueInfo ? queueInfo.estimatedWaitMinutes : 0} mins</p>
              </div>

              <div class="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <span class="text-xs text-sky-200">Serving Now</span>
                <div class="text-xl font-bold text-teal-300 mt-0.5 truncate">${queueInfo ? queueInfo.currentServingToken : 'Standby'}</div>
                <p class="text-[11px] text-sky-300 mt-1">Real-time room update</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
              ${isConfirmedPass ? `
                <a href="appointment-details.html?id=${nextApt.id}" class="px-4 py-2 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded-xl transition flex items-center gap-1.5 border border-white/20" title="View Digital QR Pass">
                  <i data-lucide="qr-code" class="w-4 h-4"></i> View QR Pass
                </a>
                <button onclick="window.generateAppointmentReceiptPDF(window.PatientApp.currentNextApt)" class="px-4 py-2 text-xs font-bold bg-white hover:bg-sky-50 text-sky-900 rounded-xl transition flex items-center gap-1.5 shadow-md" title="Download Token Slip with QR Code">
                  <i data-lucide="download" class="w-4 h-4"></i> Download Slip (QR)
                </button>
              ` : `
                <span class="px-4 py-2 text-xs font-bold bg-amber-500/20 text-amber-200 rounded-xl border border-amber-300/30 flex items-center gap-1.5">
                  <i data-lucide="lock" class="w-3.5 h-3.5"></i> Slip & QR Locked (Pending Approval)
                </span>
              `}
              <button onclick="window.PatientApp.openDoctorChat(window.PatientApp.currentNextApt.id, window.PatientApp.currentNextApt.doctor_name, window.PatientApp.currentNextApt.doctor_id, window.PatientApp.currentNextApt.token_number)" class="px-4 py-2 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded-xl transition flex items-center gap-1.5 border border-white/20" title="Two-way Chat with Doctor">
                <i data-lucide="message-square" class="w-4 h-4"></i> Chat with Doctor
              </button>
              <a href="queue-status.html?id=${nextApt.id}" class="px-5 py-2 text-xs font-black bg-teal-400 text-slate-900 hover:bg-teal-300 rounded-xl transition flex items-center gap-1.5 shadow-lg">
                <i data-lucide="activity" class="w-4 h-4"></i> Open Live Queue
              </a>
            </div>
          </div>
        `;
        window.PatientApp.currentNextApt = nextApt;
      } else {
        nextCardContainer.innerHTML = `
          <div class="bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-sm">
            <div class="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 mx-auto flex items-center justify-center mb-3">
              <i data-lucide="calendar-check" class="w-7 h-7"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800">No Upcoming Appointments</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">You have no active doctor consultations scheduled. Browse our specialists and book anytime.</p>
            <a href="book-appointment.html" class="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition">
              <i data-lucide="plus" class="w-4 h-4"></i> Book An Appointment
            </a>
          </div>
        `;
      }
    }

    // Render Recent Appointments Table
    const recentTable = document.getElementById('recent-appointments-body');
    if (recentTable) {
      if (myAppointments.length === 0) {
        recentTable.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-xs text-slate-400">No appointments found.</td></tr>`;
      } else {
        recentTable.innerHTML = myAppointments.slice(0, 5).map(a => {
          const isSlipReady = !['pending', 'cancelled', 'rejected'].includes(a.status);
          return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
            <td class="py-3 px-4 font-bold text-sky-700 text-xs">${a.token_number}</td>
            <td class="py-3 px-4">
              <div class="font-semibold text-slate-900 text-xs">${a.doctor_name}</div>
              <div class="text-[11px] text-slate-500">${a.specialization}</div>
            </td>
            <td class="py-3 px-4 text-xs text-slate-600">
              <div>${a.appointment_date}</div>
              <div class="text-[11px] text-slate-400">${window.CarePulseDB.formatTime12Hour(a.time_slot || a.appointment_time)}</div>
            </td>
            <td class="py-3 px-4">
              <span class="status-badge ${a.status}">${a.status}</span>
            </td>
            <td class="py-3 px-4 text-right">
              ${isSlipReady ? `
                <button onclick="window.generateAppointmentReceiptPDF(${JSON.stringify(a).replace(/"/g, '&quot;')})" class="px-2.5 py-1 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition inline-flex items-center gap-1 text-[11px] font-bold" title="Download Slip with QR">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i> Slip (QR)
                </button>
              ` : `
                <span class="text-[11px] font-semibold text-amber-600">${a.status === 'pending' ? '⏳ Awaiting Confirm' : 'N/A'}</span>
              `}
            </td>
          </tr>
        `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();

    // Render Visiting Specialist Campaigns (Section 9)
    await this.renderVisitingCampaigns();
  },

  async renderVisitingCampaigns(filters = {}) {
    const container = document.getElementById('visiting-campaigns-grid');
    if (!container) return;

    const specialty = filters.specialty || document.getElementById('campaign-specialty-filter')?.value || 'all';
    const radiusVal = filters.radius || document.getElementById('campaign-radius-filter')?.value || 'all';

    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-xs text-slate-400">
        <div class="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mx-auto mb-2"></div>
        Discovering visiting doctors & medical camps in your region...
      </div>
    `;

    let userLat = 20.3888;
    let userLng = 78.1204;
    let locationLabel = 'Yavatmal & Region';

    if (typeof localStorage !== 'undefined') {
      try {
        const storedLoc = JSON.parse(localStorage.getItem('carepulse_user_location') || 'null');
        if (storedLoc?.latitude && storedLoc?.longitude) {
          userLat = Number(storedLoc.latitude);
          userLng = Number(storedLoc.longitude);
          locationLabel = storedLoc.city_name || locationLabel;
        }
      } catch (e) {}
    }

    const locLabelEl = document.getElementById('campaign-location-label');
    if (locLabelEl) locLabelEl.innerText = locationLabel;

    const radiusKm = radiusVal === 'all' ? null : Number(radiusVal);
    const campaigns = await window.CarePulseDB.getCampaigns({
      status: 'approved',
      userLat: radiusKm ? userLat : null,
      userLng: radiusKm ? userLng : null,
      radiusKm: radiusKm,
      specialization: specialty === 'all' ? null : specialty
    });

    if (campaigns.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200">
          <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 mx-auto flex items-center justify-center mb-2">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <p class="font-bold text-slate-700 text-xs">No Visiting Doctor Campaigns Matching Current Radius</p>
          <p class="text-slate-400 text-[11px] mt-1">Try selecting <strong>"All India / All Distances"</strong> or a different specialization to see visiting doctors from Mumbai and Pune.</p>
          <button onclick="document.getElementById('campaign-radius-filter').value='all'; document.getElementById('campaign-specialty-filter').value='all'; window.PatientApp.renderVisitingCampaigns();" class="mt-3 px-4 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl text-xs font-bold transition">
            View All Active Campaigns Across India
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = campaigns.map(c => {
      if (window.CarePulseDB.recordCampaignImpression) {
        window.CarePulseDB.recordCampaignImpression(c.id);
      }

      const isCamp = c.campaign_type === 'medical_camp' || c.fee === 0;
      const typeBadge = isCamp
        ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm flex items-center gap-1"><i data-lucide="gift" class="w-3 h-3"></i> Free Medical Camp</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-600 text-white shadow-sm flex items-center gap-1"><i data-lucide="award" class="w-3 h-3"></i> Visiting Specialist</span>`;

      const feeDisplay = (Number(c.fee) === 0)
        ? `<span class="text-xs font-black text-emerald-600">FREE Consultation</span>`
        : `<span class="text-xs font-black text-slate-900">$${c.fee} <span class="text-[10px] text-slate-400 font-normal">OPD fee</span></span>`;

      const bookUrl = `book-appointment.html?doctorId=${c.doctor_id}&hospitalId=${c.hospital_id}&campaignId=${c.id}&date=${c.start_date}&reason=${encodeURIComponent('Visiting Specialist OPD: ' + (c.specialization || c.title))}&source=doctor`;

      return `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-sky-300 transition overflow-hidden flex flex-col justify-between">
          <div>
            <div class="relative h-36 bg-slate-100 overflow-hidden">
              <img src="${c.banner_url || 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800'}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
              <div class="absolute top-3 left-3">
                ${typeBadge}
              </div>
              ${c.target_radius_km ? `
                <div class="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold">
                  Within ${c.target_radius_km} KM
                </div>
              ` : ''}
              <div class="absolute bottom-2.5 left-3 right-3 text-white">
                <span class="text-[10px] font-bold uppercase tracking-wider text-sky-300">${c.specialization || 'Super Specialist'}</span>
                <h4 class="font-bold text-xs text-white line-clamp-1">${c.title}</h4>
              </div>
            </div>

            <div class="p-5 space-y-3">
              <div class="flex items-center gap-3">
                <img src="${c.doctor_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}" class="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm flex-shrink-0">
                <div class="min-w-0">
                  <h5 class="font-bold text-sm text-slate-900 truncate">${c.doctor_name}</h5>
                  <p class="text-[11px] text-slate-500 truncate">${c.doctor_qualification || 'MD, Super Specialist'}</p>
                  <p class="text-[10px] text-sky-600 font-bold">${c.doctor_experience || 10}+ Years Experience</p>
                </div>
              </div>

              <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                <div class="flex items-start gap-1.5 text-slate-700">
                  <i data-lucide="building-2" class="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5"></i>
                  <span class="font-bold leading-tight line-clamp-1">${c.hospital_name}</span>
                </div>
                <div class="flex items-start gap-1.5 text-slate-500 text-[10px]">
                  <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5"></i>
                  <span class="line-clamp-1">${c.venue_address || (c.city_name + ', ' + c.state_name)}</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div class="p-2 rounded-xl bg-sky-50/70 border border-sky-100/60">
                  <span class="text-[9px] uppercase font-bold text-sky-600 block">Visiting Dates</span>
                  <strong class="text-slate-800 text-[10px] block mt-0.5">${c.start_date}</strong>
                  <span class="text-[9px] text-slate-500">to ${c.end_date}</span>
                </div>
                <div class="p-2 rounded-xl bg-teal-50/70 border border-teal-100/60">
                  <span class="text-[9px] uppercase font-bold text-teal-600 block">Available Slots</span>
                  <strong class="text-teal-900 text-[10px] block mt-0.5">${c.available_slots || 20} Slots</strong>
                  <span class="text-[9px] text-teal-700 font-medium">Limited capacity</span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
            <div>
              ${feeDisplay}
            </div>
            <a href="${bookUrl}" onclick="window.CarePulseDB.recordCampaignClick('${c.id}')" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5">
              <span>Book Visit</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 2. MULTI-STEP BOOKING WIZARD WITH DOUBLE BOOKING PREVENTION
  // --------------------------------------------------------------------------
  bookingState: {
    departmentId: null,
    doctorId: null,
    date: null,
    time: null,
    reason: '',
    symptoms: ''
  },

  async initBookingWizard() {
    const departments = await window.CarePulseDB.getDepartments();
    const doctors = await window.CarePulseDB.getDoctors();

    // Check URL params for pre-selected doctor
    const urlParams = new URLSearchParams(window.location.search);
    const preDoctorId = urlParams.get('doctorId');

    const deptSelect = document.getElementById('wizard-dept-select');
    const doctorSelect = document.getElementById('wizard-doctor-select');
    const dateInput = document.getElementById('wizard-date-input');
    const slotsGrid = document.getElementById('wizard-slots-grid');
    const slotsMessage = document.getElementById('wizard-slots-message');
    const bookingForm = document.getElementById('booking-confirm-form');

    // Live Local Clock Display in Step 2
    const updateLiveClock = () => {
      const clockText = document.getElementById('wizard-live-clock-text');
      if (!clockText) return;
      const now = new Date();
      const timeStr12 = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      clockText.innerText = `Current Time: ${timeStr12}`;
    };
    updateLiveClock();
    if (!window._carepulseBookingClockTimer) {
      window._carepulseBookingClockTimer = setInterval(updateLiveClock, 15000);
    }

    // Set min date to local today (timezone-safe)
    const todayStr = window.CarePulseDB.getLocalTodayDate();
    const preDate = urlParams.get('date');
    if (dateInput) {
      dateInput.min = todayStr;
      dateInput.value = (preDate && preDate >= todayStr) ? preDate : todayStr;
      this.bookingState.date = dateInput.value;
    }

    const preReason = urlParams.get('reason');
    if (preReason && document.getElementById('wizard-reason-input')) {
      document.getElementById('wizard-reason-input').value = decodeURIComponent(preReason);
    }

    // Populate Family Members if present
    const patientTypeSelect = document.getElementById('wizard-patient-type');
    if (patientTypeSelect && this.currentUser?.id) {
      try {
        const family = await window.CarePulseDB.getFamilyMembers(this.currentUser.id);
        const preFamilyId = urlParams.get('family_member_id');
        family.forEach(fm => {
          const opt = document.createElement('option');
          opt.value = fm.id;
          opt.innerText = `${fm.name} (${fm.relationship})`;
          if (preFamilyId && fm.id === preFamilyId) opt.selected = true;
          patientTypeSelect.appendChild(opt);
        });
      } catch (e) {}
    }

    // Populate Departments
    if (deptSelect) {
      deptSelect.innerHTML = `<option value="">-- Choose Department --</option>` + 
        departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    }

    // Populate Doctors
    const populateDoctors = (deptId = null) => {
      if (!doctorSelect) return;
      const targetDeptObj = deptId ? departments.find(x => x.id === deptId) : null;
      const filtered = deptId 
        ? doctors.filter(d => d.department_id === deptId || (targetDeptObj && d.department_name === targetDeptObj.name)) 
        : doctors;
      doctorSelect.innerHTML = `<option value="">-- Choose Specialist --</option>` + 
        filtered.map(d => `<option value="${d.id}">${d.full_name} (${d.specialization})</option>`).join('');
      
      if (preDoctorId && doctors.some(d => d.id === preDoctorId)) {
        doctorSelect.value = preDoctorId;
        this.bookingState.doctorId = preDoctorId;
        const targetDoc = doctors.find(d => d.id === preDoctorId);
        if (targetDoc && deptSelect) {
          deptSelect.value = targetDoc.department_id || (departments.find(x => x.name === targetDoc.department_name)?.id || '');
        }
      }
    };

    populateDoctors();

    // Helper: pick tomorrow local YYYY-MM-DD
    const getTomorrowStr = () => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return window.CarePulseDB.getLocalTodayDate(t);
    };

    // Render Slots based on Selected Doctor & Date
    const loadSlots = async (isSilent = false) => {
      const docId = this.bookingState.doctorId;
      const date = this.bookingState.date;

      if (!docId || !date || !slotsGrid) return;

      if (!isSilent) {
        slotsGrid.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-slate-400">Loading available slots...</div>`;
        if (slotsMessage) slotsMessage.innerText = '';
      }

      const slotData = await window.AppointmentEngine.getDoctorSlotsForDate(docId, date);

      if (this.bookingState.time) {
        const stillOpen = (slotData.slots || []).some(
          s => s.timeValue === this.bookingState.time && s.isAvailable && !s.isPast
        );
        if (!stillOpen) {
          this.bookingState.time = null;
          const previewTime = document.getElementById('summary-selected-time');
          if (previewTime) previewTime.innerText = '--';
        }
      }

      if (!slotData.available) {
        slotsGrid.innerHTML = `
          <div class="col-span-full p-4 rounded-xl bg-amber-50 border border-amber-200 text-center text-amber-800 text-xs">
            <i data-lucide="clock" class="w-4 h-4 mx-auto mb-1 text-amber-600"></i>
            ${slotData.message || 'No slots available on this day. Please select another date.'}
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      if (slotData.allRemainingPassed) {
        const tomorrowStr = getTomorrowStr();
        slotsGrid.innerHTML = `
          <div class="col-span-full p-6 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 space-y-3">
            <div class="flex items-center gap-2">
              <i data-lucide="clock" class="w-5 h-5 text-sky-600"></i>
              <span class="font-bold text-xs uppercase tracking-wide">Today's Clinic Hours Ended (Current Time: ${slotData.currentTimeDisplay})</span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              Today's OPD hours (${slotData.scheduleStartDisplay} – ${slotData.scheduleEndDisplay}) have already passed for <strong>${date}</strong>. Past time slots cannot be booked. Please pick tomorrow or an upcoming working day.
            </p>
            <button type="button" id="wizard-pick-tomorrow-btn" class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-2">
              <i data-lucide="calendar-plus" class="w-4 h-4"></i> Switch to Tomorrow (${tomorrowStr}) →
            </button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        if (slotsMessage) slotsMessage.innerText = `0 of ${slotData.totalSlots} slots open today (OPD Hours: ${slotData.scheduleStartDisplay} – ${slotData.scheduleEndDisplay})`;
        document.getElementById('wizard-pick-tomorrow-btn')?.addEventListener('click', () => {
          if (dateInput) dateInput.value = tomorrowStr;
          this.bookingState.date = tomorrowStr;
          this.bookingState.time = null;
          loadSlots();
          this.updateDoctorSummaryCard(docId);
        });
        return;
      }

      if (slotData.isFullyBooked) {
        // Feature 6: Priority Waiting List when upcoming slots are actually fully booked
        slotsGrid.innerHTML = `
          <div class="col-span-full p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
            <div class="flex items-center gap-2">
              <i data-lucide="users" class="w-5 h-5 text-amber-600"></i>
              <span class="font-bold text-xs uppercase tracking-wide">All Slots Fully Booked for this Date</span>
            </div>
            <p class="text-xs text-amber-800 leading-relaxed">
              All 30-minute appointment slots for this specialist are currently occupied. Join our <strong>Priority Waiting List</strong> to be automatically offered any slot released due to cancellations or rescheduling.
            </p>
            <button type="button" onclick="window.PatientApp.openJoinWaitingListModal('${docId}', '${date}')" class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2">
              <i data-lucide="user-plus" class="w-4 h-4"></i> Join Priority Waiting List
            </button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        if (slotsMessage) slotsMessage.innerText = `0 of ${slotData.totalSlots} slots available (Fully Booked)`;
        return;
      }

      slotsGrid.innerHTML = slotData.slots.map(s => {
        if (s.isBooked) {
          return `
            <div class="slot-btn booked" title="Already booked by another patient">
              <span>${s.displayTime}</span>
            </div>
          `;
        }
        if (s.isPast) {
          return `
            <div class="slot-btn opacity-45 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400" title="This time slot has already passed today (${slotData.currentTimeDisplay})">
              <span>${s.displayTime}</span>
              <span class="text-[10px] text-slate-400 font-normal">Time Passed</span>
            </div>
          `;
        }
        return `
          <div class="slot-btn${this.bookingState.time === s.timeValue ? ' selected' : ''}" onclick="window.PatientApp.selectSlot('${s.timeValue}', this)">
            <span>${s.displayTime}</span>
            <span class="text-[10px] text-emerald-600 font-normal">✓ Available</span>
          </div>
        `;
      }).join('');

      if (slotsMessage) {
        slotsMessage.innerText = `${slotData.availableSlotsCount} of ${slotData.totalSlots} slots available (${slotData.scheduleStartDisplay} – ${slotData.scheduleEndDisplay})`;
      }
    };

    this._reloadWizardSlots = async () => {
      if (this.bookingState.doctorId && this.bookingState.date) {
        await loadSlots(true);
        await this.updateDoctorSummaryCard(this.bookingState.doctorId);
      }
    };

    window.addEventListener('pagehide', () => {
      if (window._carepulseBookingClockTimer) {
        clearInterval(window._carepulseBookingClockTimer);
        window._carepulseBookingClockTimer = null;
      }
    }, { once: true });

    deptSelect?.addEventListener('change', (e) => {
      this.bookingState.departmentId = e.target.value;
      this.bookingState.doctorId = null;
      this.bookingState.time = null;
      populateDoctors(e.target.value);
      if (slotsGrid) slotsGrid.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-slate-400">Select a doctor to view time slots.</div>`;
    });

    doctorSelect?.addEventListener('change', async (e) => {
      this.bookingState.doctorId = e.target.value;
      this.bookingState.time = null;
      await this.updatePracticeLocations(e.target.value);
      loadSlots();
      this.updateDoctorSummaryCard(e.target.value);
    });

    dateInput?.addEventListener('change', (e) => {
      this.bookingState.date = e.target.value;
      this.bookingState.time = null;
      loadSlots();
      if (this.bookingState.doctorId) {
        this.updateDoctorSummaryCard(this.bookingState.doctorId);
      }
    });

    if (preDoctorId) {
      this.updatePracticeLocations(preDoctorId);
      loadSlots();
      this.updateDoctorSummaryCard(preDoctorId);
    }

    // Submit Booking
    bookingForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = document.getElementById('wizard-reason-input')?.value;
      const symptoms = document.getElementById('wizard-symptoms-input')?.value;

      if (!this.bookingState.doctorId) {
        window.showToast('Please select a doctor.', 'warning');
        return;
      }
      if (!this.bookingState.date) {
        window.showToast('Please select an appointment date.', 'warning');
        return;
      }
      if (!this.bookingState.time) {
        window.showToast('Please select an available time slot.', 'warning');
        return;
      }
      if (!reason || !reason.trim()) {
        window.showToast('Please specify the reason for consultation.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('submit-booking-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Submitting Request...';
      }

      const familyVal = document.getElementById('wizard-patient-type')?.value;
      const familyMemberId = (familyVal && familyVal !== 'self') ? familyVal : null;

      try {
        const preReferralId = urlParams.get('referralId') || null;
        const preHospitalId = urlParams.get('hospitalId') || null;
        const preCampaignId = urlParams.get('campaignId') || null;
        const preSource = urlParams.get('source') || (preHospitalId ? 'hospital' : 'doctor');
        const selectedHospitalId = document.getElementById('wizard-hospital-select')?.value || preHospitalId || null;

        const appointment = await window.CarePulseDB.createAppointment({
          patient_id: this.currentUser.id,
          family_member_id: familyMemberId,
          doctor_id: this.bookingState.doctorId,
          appointment_date: this.bookingState.date,
          appointment_time: this.bookingState.time,
          reason: reason.trim(),
          symptoms: symptoms ? symptoms.trim() : '',
          referral_id: preReferralId,
          hospital_id: selectedHospitalId,
          booking_source: preSource,
          campaign_id: preCampaignId
        });

        // Track conversion if booked from a visiting doctor campaign
        if (preCampaignId && window.CarePulseDB.recordCampaignConversion) {
          await window.CarePulseDB.recordCampaignConversion(preCampaignId);
        }

        // Show Booking Request Modal (Pending Doctor Confirmation)
        this.showBookingSuccessModal(appointment);
      } catch (err) {
        window.showToast(err.message || 'Failed to book appointment', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Submit Appointment Request';
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });
  },

  selectSlot(timeValue, element) {
    this.bookingState.time = timeValue;
    document.querySelectorAll('.slot-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');

    const previewTime = document.getElementById('summary-selected-time');
    if (previewTime) previewTime.innerText = element.querySelector('span').innerText;
  },

  async updateDoctorSummaryCard(doctorId) {
    const card = document.getElementById('doctor-summary-card');
    if (!card) return;

    if (!doctorId) {
      card.classList.add('hidden');
      return;
    }

    const doc = await window.CarePulseDB.getDoctorById(doctorId);
    if (!doc) return;

    // Feature 3: Doctor Availability Auto Calculation
    const avail = await window.CarePulseDB.calculateDoctorAvailability(doctorId, this.bookingState.date);

    card.classList.remove('hidden');
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <img src="${doc.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}" class="w-16 h-16 rounded-2xl object-cover border border-slate-200">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">${doc.department_name}</span>
              ${avail.badgeHtml || ''}
            </div>
            <h4 class="font-bold text-slate-900 text-base mt-1">${doc.full_name}</h4>
            <p class="text-xs text-slate-500">${doc.qualification}</p>
            <div class="flex items-center gap-3 text-xs text-slate-600 mt-1">
              <span><strong>Room:</strong> ${doc.room_number || 'Room 101'}</span>
              <span><strong>Fee:</strong> $${doc.consultation_fee || 50}</span>
            </div>
          </div>
        </div>
        <div class="text-xs text-slate-500 bg-white/80 p-3 rounded-xl border border-sky-100/60 max-w-xs">
          <div class="font-bold text-slate-700">Availability Summary:</div>
          <div>${avail.message}</div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  async updatePracticeLocations(doctorId) {
    const locContainer = document.getElementById('wizard-practice-location-container');
    const hospSelect = document.getElementById('wizard-hospital-select');
    if (!locContainer || !hospSelect) return;

    if (!doctorId) {
      locContainer.classList.add('hidden');
      return;
    }

    const affiliations = await window.CarePulseDB.getDoctorHospitals(doctorId);
    if (!affiliations || affiliations.length === 0) {
      locContainer.classList.add('hidden');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const preHospId = urlParams.get('hospitalId');

    hospSelect.innerHTML = affiliations.map(a => {
      const isSelected = preHospId ? (a.hospital_id === preHospId) : a.is_primary;
      const hospName = a.hospitals?.name || a.hospital_name || 'CarePulse Partner Network';
      const city = a.hospitals?.city_name || 'Main Campus';
      const room = a.opd_room_number || a.opd_room || 'OPD-1';
      const fee = a.consultation_fee || 50;
      return `<option value="${a.hospital_id}" ${isSelected ? 'selected' : ''}>${hospName} (${city}) • ${room} • $${fee}</option>`;
    }).join('');

    locContainer.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  // Waiting List Joining (Feature 6)
  openJoinWaitingListModal(doctorId, preferredDate) {
    let modal = document.getElementById('join-waiting-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'join-waiting-modal';
      modal.className = 'modal-overlay active';
      modal.innerHTML = `
        <div class="modal-box p-6 sm:p-8 max-w-md space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="users" class="w-5 h-5 text-amber-600"></i>
              Join Priority Waiting List
            </h3>
            <button onclick="document.getElementById('join-waiting-modal').classList.remove('active')" class="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <p class="text-xs text-slate-600">
            If an appointment slot is cancelled or rescheduled for this doctor on your chosen date, you will automatically be queued for priority slot reallocation.
          </p>

          <form id="join-waiting-form" onsubmit="window.PatientApp.submitJoinWaitingList(event)" class="space-y-4">
            <input type="hidden" id="waiting-doc-id" value="${doctorId}">
            <input type="hidden" id="waiting-date" value="${preferredDate}">

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Preferred Time Window</label>
              <select id="waiting-time-range" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="any">Any Available Slot (Highest Chance)</option>
                <option value="morning">Morning (09:00 AM - 12:00 PM)</option>
                <option value="afternoon">Afternoon (12:00 PM - 03:00 PM)</option>
                <option value="evening">Evening (03:00 PM - 06:00 PM)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Primary Reason / Symptoms *</label>
              <textarea id="waiting-reason" required rows="2" placeholder="Describe symptoms or reason for visit..." class="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white"></textarea>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <button type="button" onclick="document.getElementById('join-waiting-modal').classList.remove('active')" class="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition">
                Cancel
              </button>
              <button type="submit" id="confirm-waiting-btn" class="w-1/2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5">
                <i data-lucide="check" class="w-4 h-4"></i> Join Waiting List
              </button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      document.getElementById('waiting-doc-id').value = doctorId;
      document.getElementById('waiting-date').value = preferredDate;
      modal.classList.add('active');
    }
    if (window.lucide) window.lucide.createIcons();
  },

  async submitJoinWaitingList(e) {
    e.preventDefault();
    const doctorId = document.getElementById('waiting-doc-id').value;
    const preferredDate = document.getElementById('waiting-date').value;
    const preferredTimeRange = document.getElementById('waiting-time-range').value;
    const reason = document.getElementById('waiting-reason').value.trim();

    const submitBtn = document.getElementById('confirm-waiting-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline"></i> Adding...';

    try {
      await window.CarePulseDB.addToWaitingList({
        patientId: this.currentUser.id,
        doctorId,
        preferredDate,
        preferredTimeRange,
        reason
      });
      document.getElementById('join-waiting-modal')?.classList.remove('active');
      window.showToast('✓ Successfully added to Priority Waiting List! You will be notified when a slot opens.', 'success');
      setTimeout(() => { window.location.href = 'appointments.html?filter=waiting'; }, 1200);
    } catch (err) {
      window.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Join Waiting List';
    }
  },

  showBookingSuccessModal(appointment) {
    const modal = document.getElementById('booking-success-modal');
    const isPending = !appointment.status || appointment.status === 'pending';

    if (!modal) {
      window.showToast(
        isPending
          ? `Appointment request sent (Pending Doctor Confirmation)! Token: ${appointment.token_number}`
          : `Appointment confirmed! Token: ${appointment.token_number}`,
        'success'
      );
      setTimeout(() => { window.location.href = 'appointments.html'; }, 1500);
      return;
    }

    const tokenDisplay = document.getElementById('success-token-display');
    const dateDisplay = document.getElementById('success-date-display');
    const timeDisplay = document.getElementById('success-time-display');
    const iconBox = document.getElementById('success-modal-icon');
    const statusPill = document.getElementById('success-status-pill');
    const modalTitle = document.getElementById('success-modal-title');
    const modalDesc = document.getElementById('success-modal-desc');
    const pendingNote = document.getElementById('success-pending-qr-note');
    const downloadBtn = document.getElementById('success-download-btn');

    if (tokenDisplay) tokenDisplay.innerText = appointment.token_number;
    if (dateDisplay) dateDisplay.innerText = appointment.appointment_date;
    if (timeDisplay) timeDisplay.innerText = window.CarePulseDB.formatTime12Hour(appointment.time_slot || appointment.appointment_time);

    if (isPending) {
      if (iconBox) {
        iconBox.className = 'w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-md';
        iconBox.innerHTML = '<i data-lucide="clock" class="w-8 h-8"></i>';
      }
      if (statusPill) statusPill.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 mb-2';
      if (statusPill) statusPill.innerText = '⏳ Pending Doctor Confirmation';
      if (modalTitle) modalTitle.innerText = 'Appointment Request Submitted!';
      if (modalDesc) modalDesc.innerText = 'Your request has been sent to your doctor for confirmation. You will receive a web notification and your Slip + QR Pass will unlock once confirmed.';
      if (pendingNote) pendingNote.classList.remove('hidden');
      if (downloadBtn) downloadBtn.classList.add('hidden');
    } else {
      if (iconBox) {
        iconBox.className = 'w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md';
        iconBox.innerHTML = '<i data-lucide="check-circle" class="w-8 h-8"></i>';
      }
      if (statusPill) statusPill.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 mb-2';
      if (statusPill) statusPill.innerText = '✓ Confirmed';
      if (modalTitle) modalTitle.innerText = 'Appointment Confirmed!';
      if (modalDesc) modalDesc.innerText = 'Your consultation is confirmed and your scannable QR Token Slip is ready to download.';
      if (pendingNote) pendingNote.classList.add('hidden');
      if (downloadBtn) {
        downloadBtn.classList.remove('hidden');
        downloadBtn.onclick = async () => {
          const fullApt = await window.CarePulseDB.getAppointmentById(appointment.id);
          window.generateAppointmentReceiptPDF(fullApt || appointment);
        };
      }
    }

    if (window.lucide) window.lucide.createIcons();
    modal.classList.add('active');
  },

  // --------------------------------------------------------------------------
  // 3. APPOINTMENTS LIST & ACTIONS (RESCHEDULE, QR PASS, CANCEL, REVIEW, WAITING LIST)
  // --------------------------------------------------------------------------
  async initAppointmentsList() {
    const listContainer = document.getElementById('patient-appointments-list');
    if (!listContainer) return;

    // Check Priority Waiting List Slot Offers (Feature 6)
    await this.renderPriorityOffers();

    const appointments = await window.CarePulseDB.getAppointments();
    const myAppointments = appointments.filter(a => a.patient_id === this.currentUser.id);

    const filterTab = document.querySelector('input[name="appt-filter"]:checked')?.value || 'all';

    const render = async (filter = 'all') => {
      if (filter === 'waiting') {
        await this.renderMyWaitingList(listContainer);
        return;
      }

      let filtered = myAppointments;
      if (filter === 'upcoming') filtered = myAppointments.filter(a => ['pending', 'confirmed', 'in-progress'].includes(a.status));
      if (filter === 'completed') filtered = myAppointments.filter(a => a.status === 'completed');
      if (filter === 'cancelled') filtered = myAppointments.filter(a => ['cancelled', 'rejected'].includes(a.status));

      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="bg-white rounded-2xl p-12 border border-slate-200 text-center">
            <i data-lucide="calendar-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
            <h4 class="text-sm font-bold text-slate-700">No appointments found</h4>
            <p class="text-xs text-slate-400 mt-1">No consultations matching the selected category.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      listContainer.innerHTML = filtered.map(apt => {
        const canReschedule = window.CarePulseDB.canRescheduleAppointment(apt);
        const isUpcoming = ['pending', 'confirmed', 'checked_in', 'checked-in', 'called', 'in-progress'].includes(apt.status);
        const isConfirmedPass = !['pending', 'cancelled', 'rejected'].includes(apt.status);

        return `
          <div class="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="flex items-start gap-4">
              <img src="${apt.doctor_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}" class="w-16 h-16 rounded-2xl object-cover border border-slate-100 flex-shrink-0">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="token-badge text-xs px-2.5 py-0.5">Token: ${apt.token_number}</span>
                  <span class="status-badge ${apt.status}">${apt.status === 'pending' ? 'Pending Confirmation' : apt.status}</span>
                  ${apt.reschedule_count > 0 ? `
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">Rescheduled (${apt.reschedule_count}x)</span>
                  ` : ''}
                </div>
                <h3 class="text-base font-bold text-slate-900 mt-1.5">${apt.doctor_name}</h3>
                <p class="text-xs text-slate-500">${apt.specialization} &bull; ${apt.department_name}</p>
                
                <div class="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
                  <span class="flex items-center gap-1 font-semibold text-slate-800">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-sky-600"></i> ${apt.appointment_date}
                  </span>
                  <span class="flex items-center gap-1 font-semibold text-slate-800">
                    <i data-lucide="clock" class="w-3.5 h-3.5 text-sky-600"></i> ${window.CarePulseDB.formatTime12Hour(apt.time_slot || apt.appointment_time)}
                  </span>
                  <span class="flex items-center gap-1 text-slate-500">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> ${apt.room_number || 'Room 101'}
                  </span>
                </div>

                ${apt.status === 'pending' ? `
                  <div class="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                    <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-600 flex-shrink-0"></i>
                    <span>Awaiting doctor confirmation. Your PDF Slip & Scannable QR Pass will unlock automatically once approved.</span>
                  </div>
                ` : ''}

                <p class="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <strong>Reason:</strong> ${apt.reason}
                  ${apt.doctor_notes ? `<br><strong class="text-sky-700">Doctor Note:</strong> ${apt.doctor_notes}` : ''}
                  ${apt.cancellation_reason ? `<br><strong class="text-rose-700">Reason / Remarks:</strong> ${apt.cancellation_reason}` : ''}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap md:flex-col items-center md:items-end justify-end gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
              <a href="appointment-details.html?id=${apt.id}" class="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition flex items-center gap-1.5 border border-sky-100">
                <i data-lucide="file-text" class="w-3.5 h-3.5"></i> View Details
              </a>

              ${isConfirmedPass ? `
                <button onclick="window.generateAppointmentReceiptPDF(${JSON.stringify(apt).replace(/"/g, '&quot;')})" class="px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition flex items-center gap-1.5 border border-teal-200">
                  <i data-lucide="printer" class="w-3.5 h-3.5"></i> Download Slip (QR)
                </button>

                <button onclick="window.PatientApp.openQRPassModal('${apt.id}')" class="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1">
                  <i data-lucide="qr-code" class="w-3.5 h-3.5 text-sky-600"></i> QR Pass
                </button>
              ` : apt.status === 'pending' ? `
                <span class="px-3 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-1">
                  <i data-lucide="lock" class="w-3 h-3"></i> Slip & QR Pending Approval
                </span>
              ` : ''}

              ${canReschedule ? `
                <button onclick="window.PatientApp.openRescheduleModal('${apt.id}')" class="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition flex items-center gap-1 border border-sky-200">
                  <i data-lucide="calendar-clock" class="w-3.5 h-3.5"></i> Reschedule
                </button>
              ` : ''}

              ${isUpcoming ? `
                <a href="queue-status.html?id=${apt.id}" class="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition flex items-center gap-1">
                  <i data-lucide="activity" class="w-3.5 h-3.5"></i> Live Queue
                </a>
                <button onclick="window.PatientApp.openCancelModal('${apt.id}')" class="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition">
                  Cancel
                </button>
              ` : ''}

              ${apt.status === 'completed' ? `
                <button onclick="window.PatientApp.openReviewModal('${apt.id}', '${apt.doctor_id}', '${apt.doctor_name}')" class="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition flex items-center gap-1">
                  <i data-lucide="star" class="w-3.5 h-3.5"></i> Rate & Review
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    };

    render(filterTab);

    document.querySelectorAll('input[name="appt-filter"]').forEach(radio => {
      radio.addEventListener('change', (e) => render(e.target.value));
    });
  },

  async renderPriorityOffers() {
    const offerContainer = document.getElementById('priority-slot-offers-container');
    if (!offerContainer || !this.currentUser) return;

    try {
      const waitingList = await window.CarePulseDB.getWaitingList({
        patientId: this.currentUser.id,
        status: 'offered'
      });

      const now = new Date();
      const activeOffers = (waitingList || []).filter(o => !o.offer_expires_at || new Date(o.offer_expires_at) > now);

      if (activeOffers.length === 0) {
        offerContainer.innerHTML = '';
        return;
      }

      offerContainer.innerHTML = activeOffers.map(o => `
        <div class="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg border border-emerald-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
              <i data-lucide="sparkles" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white text-emerald-800">Priority Slot Released!</span>
              <h4 class="font-bold text-sm sm:text-base mt-1">A slot for ${o.doctor_name || 'Dr. Specialist'} opened up on ${o.preferred_date} at ${window.CarePulseDB.formatTime12Hour(o.offered_time_slot)}</h4>
              <p class="text-xs text-emerald-100">Claim this released slot before offer expires.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 self-end sm:self-auto">
            <button onclick="window.PatientApp.declineWaitingOffer('${o.id}')" class="px-3.5 py-2 rounded-xl bg-emerald-800/60 hover:bg-emerald-800 text-white text-xs font-bold transition">
              Decline
            </button>
            <button onclick="window.PatientApp.acceptWaitingOffer('${o.id}')" class="px-4 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-black shadow-md transition flex items-center gap-1.5">
              <i data-lucide="check" class="w-4 h-4"></i> Accept & Book Slot
            </button>
          </div>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      console.warn('renderPriorityOffers note:', e);
    }
  },

  async renderMyWaitingList(container) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Loading your waiting list requests...</div>`;
    const list = await window.CarePulseDB.getWaitingList({ patientId: this.currentUser.id });

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl p-12 border border-slate-200 text-center">
          <i data-lucide="clock" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
          <h4 class="text-sm font-bold text-slate-700">No Waiting List Entries</h4>
          <p class="text-xs text-slate-400 mt-1">When appointment slots are fully booked, you can join the waiting list to automatically receive released slots.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${item.status === 'offered' ? 'bg-emerald-100 text-emerald-800' : item.status === 'booked' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'} uppercase">
              ${item.status}
            </span>
            <span class="text-xs text-slate-400">Priority #${item.priority || 1}</span>
          </div>
          <h3 class="text-base font-bold text-slate-900 mt-1">${item.doctor_name}</h3>
          <p class="text-xs text-slate-500">${item.doctor_specialization || 'Medical Specialist'}</p>
          <div class="text-xs text-slate-600 mt-2 space-y-0.5">
            <div>Preferred Date: <span class="font-bold text-slate-800">${item.preferred_date}</span> (${item.preferred_time_range || 'Any Slot'})</div>
            <div>Reason: <span class="text-slate-700">${item.reason || 'General checkup'}</span></div>
            ${item.offered_time_slot ? `<div class="text-emerald-700 font-bold">Offered Time: ${window.CarePulseDB.formatTime12Hour(item.offered_time_slot)}</div>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          ${item.status === 'offered' ? `
            <button onclick="window.PatientApp.acceptWaitingOffer('${item.id}')" class="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition">
              Accept Slot
            </button>
            <button onclick="window.PatientApp.declineWaitingOffer('${item.id}')" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
              Decline
            </button>
          ` : item.status === 'waiting' ? `
            <button onclick="window.PatientApp.cancelWaitingListEntry('${item.id}')" class="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition">
              Leave Waiting List
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  async acceptWaitingOffer(waitingId) {
    try {
      await window.CarePulseDB.acceptWaitingListOffer(waitingId);
      window.showToast('✓ Slot accepted! Your appointment is confirmed.', 'success');
      this.initAppointmentsList();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async declineWaitingOffer(waitingId) {
    if (!confirm('Are you sure you want to decline this slot offer? It will be offered to the next waiting patient.')) return;
    try {
      await window.CarePulseDB.declineWaitingListOffer(waitingId);
      window.showToast('Slot offer declined.', 'info');
      this.initAppointmentsList();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async cancelWaitingListEntry(waitingId) {
    if (!confirm('Leave the priority waiting list for this date?')) return;
    try {
      await window.CarePulseDB.declineWaitingListOffer(waitingId, 'Cancelled by patient');
      window.showToast('Removed from waiting list.', 'info');
      this.initAppointmentsList();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  // QR Pass Modal (Feature 1)
  async openQRPassModal(appointmentId) {
    const appointments = await window.CarePulseDB.getAppointments();
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;

    document.getElementById('modal-qr-token').innerText = apt.token_number;
    document.getElementById('modal-qr-doc-name').innerText = apt.doctor_name;
    document.getElementById('modal-qr-schedule').innerText = `Scheduled on ${apt.appointment_date} at ${window.CarePulseDB.formatTime12Hour(apt.time_slot || apt.appointment_time)}`;
    const hash = apt.verification_hash || window.CarePulseDB.generateVerificationHash(apt);
    document.getElementById('modal-qr-hash').innerText = hash;

    const qrBox = document.getElementById('modal-qr-code-box');
    if (qrBox && window.QRCode) {
      qrBox.innerHTML = '';
      const payload = window.CarePulseDB.generateAppointmentQRCodeData(apt);
      new window.QRCode(qrBox, {
        text: payload,
        width: 140,
        height: 140,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }

    document.getElementById('qr-pass-modal').classList.add('active');
  },

  // Reschedule Modal Logic (Feature 2)
  async openRescheduleModal(appointmentId) {
    const appointments = await window.CarePulseDB.getAppointments();
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;

    document.getElementById('reschedule-modal-appt-id').value = apt.id;
    document.getElementById('reschedule-modal-doc-id').value = apt.doctor_id;
    document.getElementById('reschedule-modal-doc-name').innerText = apt.doctor_name;
    document.getElementById('reschedule-modal-current-time').innerText = `${apt.appointment_date} at ${window.CarePulseDB.formatTime12Hour(apt.time_slot || apt.appointment_time)}`;

    const dateInput = document.getElementById('reschedule-modal-date');
    const todayStr = window.CarePulseDB.getLocalTodayDate();
    dateInput.min = todayStr;

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    dateInput.max = window.CarePulseDB.getLocalTodayDate(maxDate);
    dateInput.value = '';

    document.getElementById('reschedule-modal-selected-slot').value = '';
    document.getElementById('reschedule-modal-slots-container').innerHTML = '<div class="col-span-full py-4 text-center text-[11px] text-slate-400">Please choose a date above</div>';
    document.getElementById('reschedule-modal').classList.add('active');
  },

  async handleRescheduleDateChange(dateStr) {
    const docId = document.getElementById('reschedule-modal-doc-id').value;
    const slotsContainer = document.getElementById('reschedule-modal-slots-container');
    if (!dateStr || !docId) return;

    slotsContainer.innerHTML = '<div class="col-span-full py-4 text-center text-xs text-slate-400"><i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> Checking availability...</div>';
    if (window.lucide) window.lucide.createIcons();

    try {
      const slotData = await window.AppointmentEngine.getDoctorSlotsForDate(docId, dateStr);

      if (!slotData.available) {
        slotsContainer.innerHTML = `<div class="col-span-full py-4 text-center text-xs font-semibold text-rose-600">${slotData.message}</div>`;
        return;
      }

      if (slotData.allRemainingPassed) {
        slotsContainer.innerHTML = `<div class="col-span-full py-4 text-center text-xs font-semibold text-slate-600">Today's clinic hours have ended (Current Time: ${slotData.currentTimeDisplay}). Please choose tomorrow or a future date.</div>`;
        return;
      }

      const openSlots = slotData.slots.filter(s => !s.isBooked && !s.isPast);

      if (openSlots.length === 0) {
        slotsContainer.innerHTML = '<div class="col-span-full py-4 text-center text-xs text-slate-500">All slots for this date are booked.</div>';
        return;
      }

      slotsContainer.innerHTML = openSlots.map(s => `
        <button type="button" onclick="window.PatientApp.selectRescheduleSlot('${s.timeValue}', this)" class="reschedule-slot-pill py-2 px-1 text-center rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-sky-500 hover:bg-sky-50 transition">
          ${s.displayTime}
        </button>
      `).join('');
    } catch (err) {
      slotsContainer.innerHTML = `<div class="col-span-full py-3 text-center text-xs text-rose-500">${err.message}</div>`;
    }
  },

  selectRescheduleSlot(timeValue, btnElem) {
    document.getElementById('reschedule-modal-selected-slot').value = timeValue;
    document.querySelectorAll('.reschedule-slot-pill').forEach(b => {
      b.className = 'reschedule-slot-pill py-2 px-1 text-center rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-sky-500 hover:bg-sky-50 transition';
    });
    btnElem.className = 'reschedule-slot-pill py-2 px-1 text-center rounded-xl border-2 border-sky-600 bg-sky-600 text-white text-xs font-bold shadow-xs transition';
  },

  async submitReschedule(e) {
    e.preventDefault();
    const apptId = document.getElementById('reschedule-modal-appt-id').value;
    const newDate = document.getElementById('reschedule-modal-date').value;
    const newSlot = document.getElementById('reschedule-modal-selected-slot').value;
    const reason = document.getElementById('reschedule-modal-reason').value.trim();

    if (!newDate || !newSlot) {
      window.showToast('Please select a date and time slot.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('reschedule-modal-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline"></i> Rescheduling...';

    try {
      await window.CarePulseDB.rescheduleAppointment(apptId, newDate, newSlot, reason);
      document.getElementById('reschedule-modal').classList.remove('active');
      window.showToast('✓ Appointment rescheduled successfully!', 'success');
      this.initAppointmentsList();
    } catch (err) {
      window.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Confirm Reschedule';
    }
  },

  openCancelModal(appointmentId) {
    const reason = prompt('Please enter the reason for cancelling this appointment:');
    if (reason !== null) {
      window.CarePulseDB.updateAppointmentStatus(appointmentId, 'cancelled', '', reason || 'Cancelled by patient')
        .then(() => {
          window.showToast('Appointment has been cancelled.', 'info');
          this.initAppointmentsList();
        })
        .catch(err => window.showToast(err.message, 'error'));
    }
  },

  openReviewModal(appointmentId, doctorId, doctorName) {
    const modal = document.getElementById('review-modal');
    if (!modal) return;

    document.getElementById('review-doctor-name').innerText = doctorName;
    document.getElementById('review-appointment-id').value = appointmentId;
    document.getElementById('review-doctor-id').value = doctorId;
    modal.classList.add('active');
  },

  async submitReview(e) {
    e.preventDefault();
    const appointmentId = document.getElementById('review-appointment-id').value;
    const doctorId = document.getElementById('review-doctor-id').value;
    const rating = document.querySelector('input[name="review-rating"]:checked')?.value || 5;
    const comment = document.getElementById('review-comment').value;

    try {
      await window.CarePulseDB.createReview({
        patient_id: this.currentUser.id,
        doctor_id: doctorId,
        appointment_id: appointmentId,
        rating: Number(rating),
        comment: comment.trim()
      });

      window.showToast('Thank you! Your review has been published.', 'success');
      document.getElementById('review-modal')?.classList.remove('active');
      this.initAppointmentsList();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 4. LIVE QUEUE TRACKER
  // --------------------------------------------------------------------------
  async initQueueTracker() {
    const urlParams = new URLSearchParams(window.location.search);
    const appointmentId = urlParams.get('id');

    const appointments = await window.CarePulseDB.getAppointments();
    const myUpcoming = appointments.filter(a => a.patient_id === this.currentUser.id && ['pending', 'confirmed', 'in-progress'].includes(a.status));

    const selector = document.getElementById('queue-appointment-select');
    const trackerContainer = document.getElementById('queue-tracker-content');

    if (!trackerContainer) return;

    if (myUpcoming.length === 0) {
      trackerContainer.innerHTML = `
        <div class="bg-white rounded-3xl p-12 border border-slate-200 text-center max-w-lg mx-auto">
          <i data-lucide="check-circle" class="w-12 h-12 text-teal-500 mx-auto mb-3"></i>
          <h3 class="text-lg font-bold text-slate-800">No Active Queue</h3>
          <p class="text-xs text-slate-500 mt-1">You do not have any pending or confirmed consultations right now.</p>
          <a href="book-appointment.html" class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold">
            Book Appointment
          </a>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Populate Selector if multiple appointments
    if (selector) {
      selector.innerHTML = myUpcoming.map(a => `
        <option value="${a.id}" ${a.id === appointmentId ? 'selected' : ''}>
          ${a.token_number} - ${a.doctor_name} (${a.appointment_date} ${a.appointment_time})
        </option>
      `).join('');

      selector.onchange = (e) => {
        window.history.replaceState(null, '', `queue-status.html?id=${e.target.value}`);
        this.renderQueueDetails(e.target.value);
      };
    }

    const targetId = appointmentId || myUpcoming[0].id;
    await this.renderQueueDetails(targetId);

    // Setup Reactive 5-second Visibility-Aware Countdown Polling (Realtime WebSocket runs via init())
    if (!this._queueSyncInterval) {
      this._queueSyncInterval = setInterval(async () => {
        if (document.visibilityState !== 'visible' || window.CarePulseDB?.hasActiveModalOrInputFocus?.()) return;
        const currentSelectedId = document.getElementById('queue-appointment-select')?.value || targetId;
        if (currentSelectedId) {
          await this.renderQueueDetails(currentSelectedId, true);
        }
      }, 5000);
      window.addEventListener('pagehide', () => {
        if (this._queueSyncInterval) {
          clearInterval(this._queueSyncInterval);
          this._queueSyncInterval = null;
        }
      }, { once: true });
    }
  },

  playHospitalChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2: C5 (523.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(523.25, now + 0.25);
      gain2.gain.setValueAtTime(0.25, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.9);
    } catch (e) {}
  },

  async renderQueueDetails(appointmentId, isSilentSync = false) {
    const trackerContainer = document.getElementById('queue-tracker-content');
    if (!trackerContainer) return;

    const queueData = await window.AppointmentEngine.getQueueStatus(appointmentId);
    if (!queueData) return;

    const apt = queueData.appointment;
    const isMyTurn = (apt.is_called || apt.queue_status === 'called' || apt.queue_status === 'in-room' || apt.status === 'in-progress' || apt.status === 'in_consultation' || apt.status === 'in-consultation');

    // Trigger chime and notification if called for the first time
    if (isMyTurn && !this._hasChimedForAppointment) {
      this._hasChimedForAppointment = apt.id;
      this.triggerCallChimeOnce(
        `call_${apt.id}_${apt.called_at || 'called'}`,
        apt.token_number,
        apt.room_number
      );
    }

    const callerBannerHTML = isMyTurn ? `
      <div class="mb-6 p-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl shadow-emerald-500/20 border-2 border-emerald-300 animate-pulse flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-4 text-center sm:text-left">
          <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
            <i data-lucide="bell-ring" class="w-8 h-8"></i>
          </div>
          <div>
            <span class="inline-block px-2.5 py-0.5 rounded-full bg-white text-emerald-800 font-extrabold text-[11px] uppercase tracking-wider mb-1">🎉 Please Enter Now</span>
            <h2 class="text-xl sm:text-2xl font-black">YOUR TOKEN IS BEING CALLED!</h2>
            <p class="text-xs text-emerald-100 mt-0.5">Please proceed immediately to <strong>${apt.room_number || 'Room 101'}</strong> for your consultation with <strong>${apt.doctor_name}</strong>.</p>
          </div>
        </div>
        <div class="flex-shrink-0">
          <span class="px-5 py-2.5 rounded-2xl bg-white text-emerald-900 font-black text-sm shadow-md font-mono">Token: ${apt.token_number}</span>
        </div>
      </div>
    ` : '';

    const delayBannerHTML = queueData.hasDelay ? `
      <div class="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 animate-in fade-in">
        <div class="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700">
          <i data-lucide="clock" class="w-5 h-5"></i>
        </div>
        <div class="text-xs">
          <span class="font-bold">OPD Schedule Delay Notice:</span> Dr. ${apt.doctor_name} is running approximately <span class="font-bold underline">${queueData.delayMinutes} minutes</span> behind schedule (${queueData.delayReason || 'OPD Delay'}). Estimated waiting time has been updated automatically.
        </div>
      </div>
    ` : '';

    trackerContainer.innerHTML = `
      ${callerBannerHTML}
      ${delayBannerHTML}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <!-- Live Token Counter Box -->
        <div class="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-slate-600">Live Consultation Queue</span>
              </div>
              <span class="status-badge ${apt.status}">${apt.status}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 my-8">
              <div class="bg-gradient-to-br from-sky-50 to-sky-100/50 rounded-2xl p-6 border border-sky-200/60 text-center">
                <span class="text-xs font-bold uppercase text-sky-700 tracking-wider">Your Token Number</span>
                <div class="text-4xl font-extrabold text-sky-900 mt-2 font-mono">${queueData.patientToken}</div>
                <p class="text-xs text-sky-600 mt-1">Queue Slot #${queueData.tokenSequence || 1}</p>
              </div>

              <div class="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-2xl p-6 border border-teal-200/60 text-center">
                <span class="text-xs font-bold uppercase text-teal-700 tracking-wider">Now Serving In Room</span>
                <div class="text-2xl font-extrabold text-teal-900 mt-3 truncate font-mono">${queueData.currentServingToken}</div>
                <p class="text-xs text-teal-600 mt-1">${apt.room_number || 'Room 101'}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-center">
              <div class="p-3 bg-slate-50 rounded-xl">
                <span class="text-[11px] text-slate-400">Patients Ahead</span>
                <div class="text-xl font-bold text-slate-800">${queueData.patientsAhead}</div>
              </div>
              <div class="p-3 bg-slate-50 rounded-xl">
                <span class="text-[11px] text-slate-400">Estimated Wait</span>
                <div class="text-xl font-bold ${queueData.hasDelay ? 'text-amber-700' : 'text-slate-800'}">~${queueData.estimatedWaitMinutes} mins</div>
                ${queueData.hasDelay ? `<span class="text-[10px] text-amber-600 font-bold block">(incl. +${queueData.delayMinutes}m delay)</span>` : ''}
              </div>
              <div class="p-3 bg-slate-50 rounded-xl col-span-2 sm:col-span-1">
                <span class="text-[11px] text-slate-400">Scheduled Time</span>
                <div class="text-base font-bold text-slate-800">${window.CarePulseDB.formatTime12Hour(apt.time_slot || apt.appointment_time)}</div>
              </div>
            </div>
          </div>

          <div class="mt-8 flex items-center justify-between pt-4 border-t border-slate-100">
            <span class="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live WebSocket Connected
            </span>
            <button onclick="window.generateAppointmentReceiptPDF(window.PatientApp.currentQueueApt)" class="px-4 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition flex items-center gap-1.5 shadow-sm">
              <i data-lucide="download" class="w-4 h-4"></i> Download Slip (PDF)
            </button>
          </div>
        </div>

        <!-- Doctor Details Sidebar -->
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Doctor In Attendance</h4>
            <div class="flex items-center gap-4">
              <img src="${apt.doctor_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}" class="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm">
              <div>
                <h3 class="font-bold text-slate-900 text-base">${apt.doctor_name}</h3>
                <p class="text-xs text-sky-600 font-medium">${apt.specialization}</p>
                <p class="text-xs text-slate-400 mt-0.5">${apt.department_name}</p>
              </div>
            </div>

            <div class="mt-6 space-y-3 text-xs text-slate-600">
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-400">Consultation Date</span>
                <span class="font-semibold text-slate-800">${apt.appointment_date}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-400">Consultation Wing</span>
                <span class="font-semibold text-slate-800">${apt.room_number || 'Room 101'}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-slate-100">
                <span class="text-slate-400">Consultation Reason</span>
                <span class="font-semibold text-slate-800 max-w-[140px] truncate text-right">${apt.reason}</span>
              </div>
            </div>
          </div>

          <div class="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/60 text-xs text-amber-800">
            <i data-lucide="info" class="w-4 h-4 text-amber-600 mb-1 inline"></i>
            Please be seated in the <strong>${apt.room_number || 'Room 101'}</strong> waiting lounge when you are within 2 tokens of being called.
          </div>
        </div>
      </div>
    `;

    window.PatientApp.currentQueueApt = apt;
    if (window.lucide) window.lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 5. PROFILE FORM
  // --------------------------------------------------------------------------
  async initProfileForm() {
    const profile = await window.CarePulseDB.getProfileById(this.currentUser.id);
    const activeProfile = profile || this.currentUser;
    if (!activeProfile) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('profile-name', activeProfile.full_name);
    setVal('profile-email', activeProfile.email);
    setVal('profile-phone', activeProfile.phone);
    setVal('profile-gender', activeProfile.gender || 'Female');
    setVal('profile-dob', activeProfile.date_of_birth);
    setVal('profile-blood', activeProfile.blood_group || 'O+');
    setVal('profile-address', activeProfile.address);
    setVal('profile-emergency-name', activeProfile.emergency_contact_name);
    setVal('profile-emergency-phone', activeProfile.emergency_contact_phone);
    setVal('profile-allergies', activeProfile.allergies);
    setVal('profile-conditions', activeProfile.chronic_conditions);
    setVal('profile-image', activeProfile.profile_image);

    // Update Header Display
    const headerName = document.getElementById('header-display-name');
    const headerEmail = document.getElementById('header-display-email');
    const avatarImg = document.getElementById('avatar-preview');

    if (headerName) headerName.innerText = activeProfile.full_name || 'Patient';
    if (headerEmail) headerEmail.innerText = activeProfile.email || '';
    if (avatarImg && activeProfile.profile_image) avatarImg.src = activeProfile.profile_image;

    // File input handler for direct image upload
    const fileInput = document.getElementById('profile-file-input');
    const uploadThumb = document.getElementById('upload-preview-thumb');
    const resetAvatarBtn = document.getElementById('reset-avatar-btn');
    const hiddenAvatarInput = document.getElementById('profile-image');

    if (uploadThumb && activeProfile.profile_image) {
      uploadThumb.src = activeProfile.profile_image;
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
          // Resize/compress to max 300px for optimal loading
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

          // Update previews & hidden input
          if (avatarImg) avatarImg.src = compressedDataUrl;
          if (uploadThumb) uploadThumb.src = compressedDataUrl;
          if (hiddenAvatarInput) hiddenAvatarInput.value = compressedDataUrl;

          window.showToast('Photo selected! Click "Save Changes" to save to your profile.', 'info');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    resetAvatarBtn?.addEventListener('click', () => {
      const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
      if (avatarImg) avatarImg.src = defaultAvatar;
      if (uploadThumb) uploadThumb.src = defaultAvatar;
      if (hiddenAvatarInput) hiddenAvatarInput.value = defaultAvatar;
    });

    const form = document.getElementById('patient-profile-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('save-profile-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Saving...';
        if (window.lucide) window.lucide.createIcons();
      }

      try {
        const updatedFields = {
          full_name: document.getElementById('profile-name').value.trim(),
          phone: document.getElementById('profile-phone').value.trim(),
          gender: document.getElementById('profile-gender').value,
          date_of_birth: document.getElementById('profile-dob').value,
          blood_group: document.getElementById('profile-blood').value,
          address: document.getElementById('profile-address').value.trim(),
          emergency_contact_name: document.getElementById('profile-emergency-name')?.value.trim() || '',
          emergency_contact_phone: document.getElementById('profile-emergency-phone')?.value.trim() || '',
          allergies: document.getElementById('profile-allergies')?.value.trim() || '',
          chronic_conditions: document.getElementById('profile-conditions')?.value.trim() || '',
          profile_image: document.getElementById('profile-image')?.value.trim() || activeProfile.profile_image
        };

        // 1. Update in Database
        await window.CarePulseDB.updateProfile(activeProfile.id, updatedFields);

        // 2. Update Active Session in Memory & LocalStorage
        const updatedSession = {
          ...this.currentUser,
          ...updatedFields
        };
        window.Auth.setCurrentUser(updatedSession);
        this.currentUser = updatedSession;

        // 3. Immediately Refresh Navbar Icon & Name Badge!
        window.Auth.renderAuthNav();

        // 4. Update Header Preview
        if (headerName) headerName.innerText = updatedFields.full_name;
        if (avatarImg && updatedFields.profile_image) avatarImg.src = updatedFields.profile_image;

        window.showToast('Profile updated successfully! Name and info updated.', 'success');
      } catch (err) {
        window.showToast(err.message || 'Error updating profile', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Changes';
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });
  },

  // --------------------------------------------------------------------------
  // 6. NOTIFICATIONS
  // --------------------------------------------------------------------------
  async initNotifications() {
    const container = document.getElementById('patient-notifications-container');
    if (!container) return;

    const notifications = await window.CarePulseDB.getNotifications(this.currentUser.id);

    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-2xl p-12 border border-slate-200 text-center">
          <i data-lucide="bell-off" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
          <h4 class="text-sm font-bold text-slate-700">No Notifications</h4>
          <p class="text-xs text-slate-400 mt-1">You are all caught up!</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = notifications.map(n => {
      const cleanLink = n.link ? n.link.replace(/^\/?patient\//, '') : '';
      return `
      <div class="bg-white rounded-2xl p-5 border ${n.is_read ? 'border-slate-200' : 'border-sky-300 bg-sky-50/20'} flex items-start gap-4 transition">
        <div class="p-2.5 rounded-xl ${n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-sky-100 text-sky-600'}">
          <i data-lucide="bell" class="w-5 h-5"></i>
        </div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-bold text-slate-900">${n.title}</h4>
            <span class="text-[11px] text-slate-400">${new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <p class="text-xs text-slate-600 mt-1">${n.message}</p>
          ${cleanLink ? `
            <a href="${cleanLink}" class="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 mt-2">
              View Details <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </a>
          ` : ''}
        </div>
      </div>
    `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  // Consultation Chat with Doctor
  openDoctorChat(appointmentId, doctorName, doctorId, tokenNumber) {
    if (!window.CarePulseChat) {
      window.showToast('Chat module is initializing...', 'info');
      return;
    }
    const user = this.currentUser || window.Auth?.getCurrentUser();
    window.CarePulseChat.openChat({
      appointmentId,
      doctorId: doctorId || null,
      patientId: user ? user.id : null,
      otherPartyName: doctorName ? `Dr. ${doctorName.replace(/^Dr\.\s*/i, '')}` : 'Specialist Doctor',
      otherPartyRole: 'doctor',
      otherPartySubtitle: 'Direct Doctor Channel',
      tokenNumber: tokenNumber || 'APPT'
    });
  }
};

// Web Audio API Hospital Call Chime (Ding-Dong)
function playHospitalChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // High Note: F5 (698.46 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(698.46, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.8);

    // Chime Note: C6 (1046.50 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.28);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.28);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.28);
    osc2.stop(ctx.currentTime + 1.2);
  } catch (e) {
    console.warn('Audio chime note:', e);
  }
}

// Global listener for patient called into doctor consultation room
window.addEventListener('carepulse_patient_called', (e) => {
  const token = e.detail?.token || 'YOUR TOKEN';
  playHospitalChime();
  window.showToast(`📢 Token ${token}: Doctor is calling you now! Please enter the consultation room.`, 'info');
});

document.addEventListener('DOMContentLoaded', () => {
  window.PatientApp.init();
});
