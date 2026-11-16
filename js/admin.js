/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * Admin Portal Controller & Comprehensive Management Suite
 * (Strictly NO revenue/billing)
 * ==============================================================================
 */

window.AdminApp = {
  charts: {},
  cachedDoctors: [],
  cachedPatients: [],
  cachedAppointments: [],
  cachedDepartments: [],

  async init() {
    const user = window.Auth.getCurrentUser();
    if (!user) return;

    if (document.getElementById('admin-dashboard-view')) {
      await this.initDashboard();
    }
    if (document.getElementById('admin-doctors-table-body')) {
      await this.initDoctorManager();
    }
    if (document.getElementById('admin-patients-table-body')) {
      await this.initPatientManager();
    }
    if (document.getElementById('admin-appointments-table-body')) {
      await this.initAppointmentManager();
    }
    if (document.getElementById('admin-departments-table-body')) {
      await this.initDepartmentManager();
    }
    if (document.getElementById('admin-reports-view')) {
      await this.initReports();
    }

    // Auto-render admin mobile bottom navigation
    this.renderMobileBottomNav();

    // Unified Realtime Database Listeners & Visibility-Aware Auto-Refresh
    const refreshAdminViews = async () => {
      if (document.getElementById('admin-dashboard-view')) await this.initDashboard();
      if (document.getElementById('admin-doctors-table-body')) await this.initDoctorManager();
      if (document.getElementById('admin-patients-table-body')) await this.initPatientManager();
      if (document.getElementById('admin-appointments-table-body')) await this.initAppointmentManager();
      if (document.getElementById('admin-departments-table-body')) await this.initDepartmentManager();
      if (document.getElementById('admin-reports-view')) await this.initReports();
    };

    if (window.CarePulseDB?.enableAutoRealtimeSync) {
      this._realtimeSync = window.CarePulseDB.enableAutoRealtimeSync({
        tables: [
          'appointments', 'doctors', 'doctor_availability', 'doctor_leaves',
          'waiting_list', 'notifications', 'departments', 'opd_rooms',
          'profiles', 'reviews', 'audit_logs'
        ],
        userId: user.id,
        intervalMs: 12000,
        onRefresh: refreshAdminViews,
        onNotificationEvent: (notif) => {
          if (window.showToast && notif?.new) {
            window.showToast(`${notif.new.title}: ${notif.new.message}`, 'info');
          }
        }
      });
    } else {
      window.addEventListener('carepulse_db_change', refreshAdminViews);
    }
  },

  // Render Admin Mobile Bottom Bar
  renderMobileBottomNav() {
    if (document.getElementById('admin-mobile-bottom-nav')) return;
    const currentPath = window.location.pathname;
    const nav = document.createElement('nav');
    nav.id = 'admin-mobile-bottom-nav';
    nav.className = 'mobile-nav-bar';
    nav.innerHTML = `
      <a href="index.html" class="mobile-nav-item ${currentPath.endsWith('index.html') ? 'active' : ''}">
        <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
        <span>Home</span>
      </a>
      <a href="hospitals.html" class="mobile-nav-item ${currentPath.includes('hospitals') ? 'active' : ''}">
        <i data-lucide="building" class="w-5 h-5"></i>
        <span>Hospitals</span>
      </a>
      <a href="doctors.html" class="mobile-nav-item ${currentPath.includes('doctors') ? 'active' : ''}">
        <i data-lucide="stethoscope" class="w-5 h-5"></i>
        <span>Doctors</span>
      </a>
      <a href="verification.html" class="mobile-nav-item ${currentPath.includes('verification') ? 'active' : ''}">
        <i data-lucide="shield-check" class="w-5 h-5"></i>
        <span>Verify</span>
      </a>
      <a href="appointments.html" class="mobile-nav-item ${currentPath.includes('appointments') ? 'active' : ''}">
        <i data-lucide="calendar" class="w-5 h-5"></i>
        <span>Appts</span>
      </a>
    `;
    document.body.appendChild(nav);
    if (window.lucide) window.lucide.createIcons();
  },

  activeQueueTab: 'hospitals',
  pendingHosps: [],
  pendingDocs: [],
  pendingCamps: [],

  // --------------------------------------------------------------------------
  // 1. ADMIN DASHBOARD & CHART.JS ANALYTICS
  // --------------------------------------------------------------------------
  async initDashboard() {
    const profiles = await window.CarePulseDB.getProfiles();
    const doctors = await window.CarePulseDB.getDoctors({ includeUnapproved: true });
    const hospitals = await window.CarePulseDB.getHospitals({ includeUnapproved: true });
    const appointments = await window.CarePulseDB.getAppointments();
    const campaigns = await window.CarePulseDB.getCampaigns({ includeUnapproved: true });

    const patients = profiles.filter(p => p.role === 'patient');
    const pending = appointments.filter(a => a.status === 'pending');
    const confirmed = appointments.filter(a => a.status === 'confirmed');
    const completed = appointments.filter(a => a.status === 'completed');
    const cancelled = appointments.filter(a => ['cancelled', 'rejected'].includes(a.status));

    const pendingDocs = doctors.filter(d => d.verification_status === 'pending' || d.verification_status === 'under_review' || (!d.is_verified && d.verification_status !== 'rejected'));
    const pendingHosps = hospitals.filter(h => h.verification_status === 'pending' || h.verification_status === 'under_review');
    const pendingCamps = campaigns.filter(c => c.status === 'pending' || c.status === 'under_review');

    this.pendingDocs = pendingDocs;
    this.pendingHosps = pendingHosps;
    this.pendingCamps = pendingCamps;

    const totalPendingVerify = pendingDocs.length + pendingHosps.length + pendingCamps.length;

    // Update Counter Stats
    const setStat = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setStat('stat-admin-hospitals', hospitals.length);
    setStat('stat-admin-doctors', doctors.length);
    setStat('stat-admin-patients', patients.length);
    setStat('stat-admin-pending-verifications', totalPendingVerify);
    setStat('stat-admin-appointments', appointments.length);
    setStat('stat-admin-pending', pending.length);
    setStat('stat-admin-confirmed', confirmed.length);
    setStat('stat-admin-completed', completed.length);
    setStat('stat-admin-cancelled', cancelled.length);

    // Update verification badge in header
    const navBadge = document.getElementById('nav-pending-badge');
    if (navBadge) {
      if (totalPendingVerify > 0) {
        navBadge.classList.remove('hidden');
        navBadge.innerText = totalPendingVerify;
      } else {
        navBadge.classList.add('hidden');
      }
    }

    // Update verification alert banner on dashboard
    const alertBanner = document.getElementById('admin-verification-alert-banner');
    const bannerText = document.getElementById('admin-verification-banner-text');
    if (alertBanner) {
      if (totalPendingVerify > 0) {
        alertBanner.classList.remove('hidden');
        if (bannerText) {
          bannerText.innerText = `${pendingHosps.length} hospital(s), ${pendingDocs.length} doctor(s), and ${pendingCamps.length} visiting campaign(s) are awaiting verification. They will not appear in patient searches until approved.`;
        }
      } else {
        alertBanner.classList.add('hidden');
      }
    }

    // Render Pending Verification Queue on Dashboard
    this.renderQueue();

    // Render Recent Appointments Table in Admin Dashboard
    const recentTable = document.getElementById('admin-recent-appointments');
    if (recentTable) {
      if (appointments.length === 0) {
        recentTable.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-xs text-slate-400">No appointments recorded yet.</td></tr>`;
      } else {
        recentTable.innerHTML = appointments.slice(0, 8).map(a => `
          <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
            <td class="py-3 px-4 font-mono font-bold text-sky-700 text-xs">${a.token_number}</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-800">${a.patient_name}</td>
            <td class="py-3 px-4 text-xs text-slate-600">${a.doctor_name}</td>
            <td class="py-3 px-4 text-xs text-slate-500">${a.appointment_date} at ${window.CarePulseDB.formatTime12Hour(a.time_slot || a.appointment_time)}</td>
            <td class="py-3 px-4">
              <span class="status-badge ${a.status}">${a.status}</span>
            </td>
          </tr>
        `).join('');
      }
    }

    // Chart.js Visualizations
    if (window.Chart) {
      this.renderCharts(appointments, doctors);
    }
    if (window.lucide) window.lucide.createIcons();
  },

  renderCharts(appointments, doctors) {
    // 1. Status Breakdown Doughnut Chart
    const statusCtx = document.getElementById('chart-status-breakdown')?.getContext('2d');
    if (statusCtx) {
      const statusCounts = {
        Pending: appointments.filter(a => a.status === 'pending').length,
        Confirmed: appointments.filter(a => a.status === 'confirmed').length,
        'In-Consultation': appointments.filter(a => ['in-consultation', 'in_consultation', 'in-progress'].includes(a.status)).length,
        Completed: appointments.filter(a => a.status === 'completed').length,
        Cancelled: appointments.filter(a => ['cancelled', 'rejected'].includes(a.status)).length
      };

      if (this.charts.status) this.charts.status.destroy();
      this.charts.status = new window.Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusCounts),
          datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ['#f59e0b', '#0284c7', '#8b5cf6', '#10b981', '#ef4444'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }
          },
          cutout: '70%'
        }
      });
    }

    // 2. Doctors by Specialization Chart
    const specCtx = document.getElementById('chart-specialization-distribution')?.getContext('2d');
    if (specCtx) {
      const specMap = {};
      doctors.forEach(d => {
        const dept = d.department_name || 'General';
        specMap[dept] = (specMap[dept] || 0) + 1;
      });

      if (this.charts.spec) this.charts.spec.destroy();
      this.charts.spec = new window.Chart(specCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(specMap),
          datasets: [{
            label: 'Specialists',
            data: Object.values(specMap),
            backgroundColor: '#0284c7',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { ticks: { font: { size: 10 } } }
          }
        }
      });
    }

    // 3. Daily Appointments Volume Chart
    const dailyCtx = document.getElementById('chart-daily-appointments')?.getContext('2d');
    if (dailyCtx) {
      const days = [];
      const counts = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        const dayLabel = new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        days.push(dayLabel);
        counts.push(appointments.filter(a => a.appointment_date === d).length);
      }

      if (this.charts.daily) this.charts.daily.destroy();
      this.charts.daily = new window.Chart(dailyCtx, {
        type: 'line',
        data: {
          labels: days,
          datasets: [{
            label: 'Appointments Booked',
            data: counts,
            borderColor: '#0d9488',
            backgroundColor: 'rgba(13, 148, 136, 0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#0d9488'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }
  },

  // --------------------------------------------------------------------------
  // 1B. DASHBOARD VERIFICATION QUEUE CONTROLLER
  // --------------------------------------------------------------------------
  switchQueueTab(tab) {
    this.activeQueueTab = tab;
    const tabHosp = document.getElementById('admin-queue-tab-hospitals');
    const tabDoc = document.getElementById('admin-queue-tab-doctors');
    const tabCamp = document.getElementById('admin-queue-tab-campaigns');

    const setActive = (el, active) => {
      if (!el) return;
      if (active) {
        el.className = 'px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 bg-sky-600 text-white shadow-sm';
      } else {
        el.className = 'px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    };

    setActive(tabHosp, tab === 'hospitals');
    setActive(tabDoc, tab === 'doctors');
    setActive(tabCamp, tab === 'campaigns');

    this.renderQueue();
  },

  async loadPendingVerifications() {
    const doctors = await window.CarePulseDB.getDoctors({ includeUnapproved: true });
    const hospitals = await window.CarePulseDB.getHospitals({ includeUnapproved: true });
    const campaigns = await window.CarePulseDB.getCampaigns({ includeUnapproved: true });

    this.pendingDocs = doctors.filter(d => d.verification_status === 'pending' || d.verification_status === 'under_review' || (!d.is_verified && d.verification_status !== 'rejected'));
    this.pendingHosps = hospitals.filter(h => h.verification_status === 'pending' || h.verification_status === 'under_review');
    this.pendingCamps = campaigns.filter(c => c.status === 'pending' || c.status === 'under_review');

    const total = this.pendingDocs.length + this.pendingHosps.length + this.pendingCamps.length;
    const statEl = document.getElementById('stat-admin-pending-verifications');
    if (statEl) statEl.innerText = total;

    const navBadge = document.getElementById('nav-pending-badge');
    if (navBadge) {
      if (total > 0) {
        navBadge.classList.remove('hidden');
        navBadge.innerText = total;
      } else {
        navBadge.classList.add('hidden');
      }
    }

    this.renderQueue();
  },

  renderQueue() {
    const container = document.getElementById('admin-queue-content');
    if (!container) return;

    const hospBadge = document.getElementById('badge-queue-hospitals');
    const docBadge = document.getElementById('badge-queue-doctors');
    const campBadge = document.getElementById('badge-queue-campaigns');
    const totalPill = document.getElementById('admin-pending-total-pill');

    const hCount = (this.pendingHosps || []).length;
    const dCount = (this.pendingDocs || []).length;
    const cCount = (this.pendingCamps || []).length;
    const total = hCount + dCount + cCount;

    if (hospBadge) hospBadge.innerText = hCount;
    if (docBadge) docBadge.innerText = dCount;
    if (campBadge) campBadge.innerText = cCount;
    if (totalPill) {
      totalPill.innerText = `${total} Pending Action`;
      totalPill.className = total > 0
        ? 'px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 animate-pulse'
        : 'px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800';
    }

    // Auto-switch to tab that has pending items if current is empty
    if (this.activeQueueTab === 'hospitals' && hCount === 0 && (dCount > 0 || cCount > 0)) {
      this.activeQueueTab = dCount > 0 ? 'doctors' : 'campaigns';
      this.switchQueueTab(this.activeQueueTab);
      return;
    }

    if (this.activeQueueTab === 'hospitals') {
      if (hCount === 0) {
        container.innerHTML = `
          <div class="py-10 text-center space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <i data-lucide="check-circle" class="w-6 h-6"></i>
            </div>
            <p class="text-xs font-bold text-slate-800">No Hospitals Awaiting Verification</p>
            <p class="text-[11px] text-slate-400">All registered hospitals and clinics have been reviewed and approved.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/75 text-slate-400 uppercase text-[10px] font-bold">
                <th class="py-3 px-4">Hospital Name & Type</th>
                <th class="py-3 px-4">Establishment License</th>
                <th class="py-3 px-4">Location (City & State)</th>
                <th class="py-3 px-4">Beds & Facilities</th>
                <th class="py-3 px-4 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.pendingHosps.map(h => `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td class="py-3 px-4">
                    <span class="font-bold text-slate-900 block">${h.name}</span>
                    <span class="text-[10px] text-sky-600 uppercase font-semibold">${h.hospital_type || 'Private Healthcare'}</span>
                  </td>
                  <td class="py-3 px-4 font-mono font-semibold text-slate-700">
                    ${h.license_number || h.registration_number || 'LIC-PENDING'}
                  </td>
                  <td class="py-3 px-4 text-slate-600">
                    <span class="font-bold text-slate-800">${h.city_name || 'Pune'}</span>, ${h.state_name || 'Maharashtra'}
                  </td>
                  <td class="py-3 px-4 text-slate-500">
                    <span class="font-bold text-slate-700">${h.total_beds || 40} Beds</span> • ${(Array.isArray(h.facilities) ? h.facilities.slice(0, 3).join(', ') : 'ICU, Emergency')}
                  </td>
                  <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="window.AdminApp.quickApproveHospital('${h.id}', '${(h.name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-1">
                      <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
                    </button>
                    <button onclick="window.AdminApp.quickRejectHospital('${h.id}', '${(h.name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1">
                      <i data-lucide="x" class="w-3.5 h-3.5"></i> Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } else if (this.activeQueueTab === 'doctors') {
      if (dCount === 0) {
        container.innerHTML = `
          <div class="py-10 text-center space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <i data-lucide="check-circle" class="w-6 h-6"></i>
            </div>
            <p class="text-xs font-bold text-slate-800">No Doctors Awaiting Verification</p>
            <p class="text-[11px] text-slate-400">All medical practitioners have valid medical council registrations approved.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/75 text-slate-400 uppercase text-[10px] font-bold">
                <th class="py-3 px-4">Doctor & Specialization</th>
                <th class="py-3 px-4">Council & Reg Number</th>
                <th class="py-3 px-4">City / Primary Practice</th>
                <th class="py-3 px-4">Experience & Mode</th>
                <th class="py-3 px-4 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.pendingDocs.map(d => `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td class="py-3 px-4">
                    <span class="font-bold text-slate-900 block">${d.full_name}</span>
                    <span class="text-[10px] text-teal-600 font-semibold">${d.specialization || 'Specialist'}</span>
                  </td>
                  <td class="py-3 px-4 font-mono font-semibold text-slate-700">
                    <div>${d.medical_registration_number || 'PENDING'}</div>
                    <div class="text-[10px] text-slate-400 font-normal">${d.medical_council_name || 'State Medical Council'}</div>
                  </td>
                  <td class="py-3 px-4 text-slate-600">
                    <span class="font-bold text-slate-800">${d.city_name || 'Mumbai'}</span>
                  </td>
                  <td class="py-3 px-4 text-slate-500">
                    ${d.experience_years || 5} Years • <span class="capitalize">${d.consultation_modes || 'both'}</span>
                  </td>
                  <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="window.AdminApp.quickApproveDoctor('${d.id}', '${(d.full_name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-1">
                      <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
                    </button>
                    <button onclick="window.AdminApp.quickRejectDoctor('${d.id}', '${(d.full_name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1">
                      <i data-lucide="x" class="w-3.5 h-3.5"></i> Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } else if (this.activeQueueTab === 'campaigns') {
      if (cCount === 0) {
        container.innerHTML = `
          <div class="py-10 text-center space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <i data-lucide="check-circle" class="w-6 h-6"></i>
            </div>
            <p class="text-xs font-bold text-slate-800">No Visiting Campaigns Awaiting Review</p>
            <p class="text-[11px] text-slate-400">All visiting specialist OPDs and medical camps are reviewed.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/75 text-slate-400 uppercase text-[10px] font-bold">
                <th class="py-3 px-4">Campaign Title & Type</th>
                <th class="py-3 px-4">Doctor & Host Facility</th>
                <th class="py-3 px-4">Location (City & State)</th>
                <th class="py-3 px-4">Dates & Available Slots</th>
                <th class="py-3 px-4 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.pendingCamps.map(c => `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td class="py-3 px-4">
                    <span class="font-bold text-slate-900 block">${c.title}</span>
                    <span class="text-[10px] text-teal-600 font-semibold uppercase">${c.campaign_type === 'medical_camp' ? 'Free Medical Camp' : 'Visiting Specialist OPD'}</span>
                  </td>
                  <td class="py-3 px-4 text-slate-700">
                    <div class="font-semibold">${c.doctor_name || 'Dr. Specialist'}</div>
                    <div class="text-[10px] text-slate-400">${c.hospital_name || 'Partner Facility'}</div>
                  </td>
                  <td class="py-3 px-4 text-slate-600">
                    <span class="font-bold text-slate-800">${c.city_name || 'Regional City'}</span>, ${c.state_name || 'Maharashtra'}
                  </td>
                  <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    ${c.start_date} to ${c.end_date} <br><strong class="text-slate-800">${c.available_slots || 30} Slots</strong>
                  </td>
                  <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="window.AdminApp.quickApproveCampaign('${c.id}', '${(c.title || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-1">
                      <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
                    </button>
                    <button onclick="window.AdminApp.quickRejectCampaign('${c.id}', '${(c.title || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1">
                      <i data-lucide="x" class="w-3.5 h-3.5"></i> Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    if (window.lucide) window.lucide.createIcons();
  },

  async quickApproveHospital(id, name) {
    if (!confirm(`Approve hospital "${name}" and make it publicly searchable across CarePulse?`)) return;
    const currentAdmin = window.Auth?.getCurrentUser();
    await window.CarePulseDB.verifyHospital({
      hospitalId: id,
      adminId: currentAdmin?.id || 'a0000000-0000-0000-0000-000000000001',
      decision: 'approved',
      reason: 'Administrative verification completed from main dashboard queue.'
    });
    if (window.showToast) window.showToast(`Hospital "${name}" approved and active!`, 'success');
    await this.loadPendingVerifications();
  },

  async quickRejectHospital(id, name) {
    const reason = prompt(`Enter rejection reason for "${name}":`, 'Clinical establishment license incomplete or invalid.');
    if (!reason) return;
    const currentAdmin = window.Auth?.getCurrentUser();
    await window.CarePulseDB.verifyHospital({
      hospitalId: id,
      adminId: currentAdmin?.id || 'a0000000-0000-0000-0000-000000000001',
      decision: 'rejected',
      reason: reason.trim()
    });
    if (window.showToast) window.showToast(`Hospital "${name}" marked as rejected.`, 'info');
    await this.loadPendingVerifications();
  },

  async quickApproveDoctor(id, name) {
    if (!confirm(`Approve doctor "${name}" and make their profile publicly bookable?`)) return;
    const currentAdmin = window.Auth?.getCurrentUser();
    await window.CarePulseDB.verifyDoctor({
      doctorId: id,
      adminId: currentAdmin?.id || 'a0000000-0000-0000-0000-000000000001',
      decision: 'approved',
      reason: 'Medical council registration verified from main dashboard queue.'
    });
    if (window.showToast) window.showToast(`Doctor "${name}" approved and verified!`, 'success');
    await this.loadPendingVerifications();
  },

  async quickRejectDoctor(id, name) {
    const reason = prompt(`Enter rejection reason for "${name}":`, 'Medical council registration number verification failed.');
    if (!reason) return;
    const currentAdmin = window.Auth?.getCurrentUser();
    await window.CarePulseDB.verifyDoctor({
      doctorId: id,
      adminId: currentAdmin?.id || 'a0000000-0000-0000-0000-000000000001',
      decision: 'rejected',
      reason: reason.trim()
    });
    if (window.showToast) window.showToast(`Doctor "${name}" marked as rejected.`, 'info');
    await this.loadPendingVerifications();
  },

  async quickApproveCampaign(id, title) {
    if (!confirm(`Approve and publish visiting campaign "${title}" to patients?`)) return;
    const currentAdmin = window.Auth?.getCurrentUser();
    await window.CarePulseDB.verifyCampaign({
      campaignId: id,
      adminId: currentAdmin?.id || 'a0000000-0000-0000-0000-000000000001',
      decision: 'approved',
      reason: 'Outreach campaign verified from main dashboard queue.'
    });
    if (window.showToast) window.showToast(`Campaign "${title}" approved and live!`, 'success');
    await this.loadPendingVerifications();
  },

  async quickRejectCampaign(id, title) {
    const reason = prompt(`Enter rejection reason for campaign "${title}":`, 'Outreach facility details or dates require revision.');
    if (!reason) return;
    const currentAdmin = window.Auth?.getCurrentUser();
    await window.CarePulseDB.verifyCampaign({
      campaignId: id,
      adminId: currentAdmin?.id || 'a0000000-0000-0000-0000-000000000001',
      decision: 'rejected',
      reason: reason.trim()
    });
    if (window.showToast) window.showToast(`Campaign "${title}" marked as rejected.`, 'info');
    await this.loadPendingVerifications();
  },

  // --------------------------------------------------------------------------
  // 2. DOCTOR MANAGEMENT (FULL EDITABLE & VERIFICATION)
  // --------------------------------------------------------------------------
  async initDoctorManager() {
    const tableBody = document.getElementById('admin-doctors-table-body');
    if (!tableBody) return;

    this.cachedDoctors = await window.CarePulseDB.getDoctors({ includeUnapproved: true });
    this.cachedDepartments = await window.CarePulseDB.getDepartments();

    // Populate department select in Add Doctor Modal
    const deptSelect = document.getElementById('modal-doctor-dept');
    if (deptSelect) {
      deptSelect.innerHTML = this.cachedDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }

    // Populate department filter in Search Bar while preserving active selection
    const deptFilter = document.getElementById('admin-doc-dept-filter');
    if (deptFilter) {
      const prevDept = deptFilter.value || 'all';
      deptFilter.innerHTML = `<option value="all">All Departments</option>` +
        this.cachedDepartments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
      if ([...deptFilter.options].some(o => o.value === prevDept)) {
        deptFilter.value = prevDept;
      }
    }

    this.filterDoctors();
  },

  renderDoctorsTable(doctors) {
    const tableBody = document.getElementById('admin-doctors-table-body');
    if (!tableBody) return;

    if (!doctors || doctors.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-xs text-slate-400">No doctors match your criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = doctors.map(d => {
      const isApprv = d.verification_status === 'approved' || (d.is_verified && d.verification_status !== 'rejected');
      const badgeCls = isApprv ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200';
      const badgeIcon = isApprv ? 'shield-check' : 'shield-alert';
      const badgeText = isApprv ? 'Approved' : (d.verification_status === 'rejected' ? 'Rejected' : 'Pending Review');

      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-3">
            <img src="${d.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm">
            <div>
              <div class="font-bold text-slate-900 text-xs">${d.full_name}</div>
              <div class="text-[11px] text-slate-400">${d.email}</div>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4">
          <span class="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">${d.department_name}</span>
          <div class="text-[11px] text-slate-500 mt-0.5">${d.specialization} &bull; ${d.qualification}</div>
        </td>
        <td class="py-3.5 px-4 text-xs text-slate-600">
          <div class="font-semibold text-slate-700">${d.room_number || 'Room 101'}</div>
          <div class="text-[11px] text-slate-400">${d.phone || 'No phone'}</div>
        </td>
        <td class="py-3.5 px-4 text-xs text-slate-600">${d.experience_years} Years</td>
        <td class="py-3.5 px-4">
          <button onclick="window.AdminApp.toggleDoctorVerification('${d.id}', ${!isApprv})" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${badgeCls}" title="Click to toggle verification status">
            <i data-lucide="${badgeIcon}" class="w-3.5 h-3.5"></i>
            ${badgeText}
          </button>
        </td>
        <td class="py-3.5 px-4">
          <button onclick="window.AdminApp.toggleDoctorAvailability('${d.id}', ${!d.is_available_today})" class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${d.is_available_today !== false ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" title="Click to toggle today's OPD presence">
            <span class="w-2 h-2 rounded-full ${d.is_available_today !== false ? 'bg-teal-500' : 'bg-slate-400'}"></span>
            ${d.is_available_today !== false ? 'Available' : 'Off-Duty'}
          </button>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <a href="verification.html?tab=doctors" class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Inspect Credentials & Council Certificate">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </a>
            <button onclick="window.AdminApp.openEditDoctorModal('${d.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition" title="Edit Doctor Profile">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="window.AdminApp.deleteDoctor('${d.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete Doctor">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  filterDoctors() {
    const searchVal = document.getElementById('admin-doc-search')?.value.toLowerCase().trim() || '';
    const deptVal = document.getElementById('admin-doc-dept-filter')?.value || 'all';
    const verifyVal = document.getElementById('admin-doc-verify-filter')?.value || 'all';

    const filtered = this.cachedDoctors.filter(d => {
      const matchSearch = !searchVal || 
        d.full_name?.toLowerCase().includes(searchVal) ||
        d.email?.toLowerCase().includes(searchVal) ||
        d.specialization?.toLowerCase().includes(searchVal) ||
        d.room_number?.toLowerCase().includes(searchVal);

      const matchDept = (deptVal === 'all') || (d.department_name === deptVal);
      const isApprv = d.verification_status === 'approved' || (d.is_verified && d.verification_status !== 'rejected');
      const matchVerify = (verifyVal === 'all') ||
        (verifyVal === 'verified' && isApprv) ||
        (verifyVal === 'unverified' && !isApprv);

      return matchSearch && matchDept && matchVerify;
    });

    this.renderDoctorsTable(filtered);
  },

  async toggleDoctorVerification(doctorId, isVerified) {
    try {
      const user = window.Auth.getCurrentUser();
      await window.CarePulseDB.verifyDoctor({
        doctorId,
        adminId: user?.id || 'a0000000-0000-0000-0000-000000000001',
        decision: isVerified ? 'approved' : 'under_review',
        reason: isVerified ? 'Administrative approval from Doctor Manager' : 'Administrative hold placed from Doctor Manager'
      });
      window.showToast(`Doctor verification updated: ${isVerified ? 'APPROVED' : 'UNDER REVIEW'}`, 'success');
      await this.initDoctorManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async toggleDoctorAvailability(doctorId, isAvailable) {
    try {
      await window.CarePulseDB.updateDoctor(doctorId, { is_available_today: isAvailable });
      window.showToast(`Doctor daily OPD status updated: ${isAvailable ? 'AVAILABLE' : 'OFF-DUTY'}`, 'info');
      await this.initDoctorManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async deleteDoctor(doctorId) {
    if (confirm('Are you sure you want to permanently remove this doctor from the hospital registry?')) {
      try {
        await window.CarePulseDB.deleteDoctor(doctorId);
        window.showToast('Doctor deleted successfully.', 'info');
        await this.initDoctorManager();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    }
  },

  async saveDoctorForm(e) {
    e.preventDefault();
    const docId = document.getElementById('modal-doctor-id')?.value;
    const name = document.getElementById('modal-doctor-name')?.value;
    const email = document.getElementById('modal-doctor-email')?.value;
    const phone = document.getElementById('modal-doctor-phone')?.value;
    const deptId = document.getElementById('modal-doctor-dept')?.value;
    const spec = document.getElementById('modal-doctor-spec')?.value;
    const qual = document.getElementById('modal-doctor-qual')?.value;
    const exp = document.getElementById('modal-doctor-exp')?.value;
    const room = document.getElementById('modal-doctor-room')?.value;
    const fee = document.getElementById('modal-doctor-fee')?.value;
    const photo = document.getElementById('modal-doctor-image')?.value;
    const about = document.getElementById('modal-doctor-about')?.value;
    const isVerified = document.getElementById('modal-doctor-verified')?.checked;
    const isAvailable = document.getElementById('modal-doctor-available')?.checked;

    const payload = {
      full_name: name,
      email,
      phone,
      department_id: deptId,
      specialization: spec,
      qualification: qual,
      experience_years: Number(exp) || 0,
      room_number: room,
      consultation_fee: Number(fee) || 50,
      profile_image: photo || undefined,
      about: about || '',
      is_verified: isVerified,
      is_available_today: isAvailable
    };

    try {
      if (docId) {
        // Edit
        await window.CarePulseDB.updateDoctor(docId, payload);
        window.showToast('Doctor profile updated successfully!', 'success');
      } else {
        // Add new
        await window.CarePulseDB.addDoctor(payload);
        window.showToast('New specialist doctor added to hospital!', 'success');
      }

      document.getElementById('add-doctor-modal')?.classList.remove('active');
      await this.initDoctorManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async openEditDoctorModal(doctorId) {
    const doc = await window.CarePulseDB.getDoctorById(doctorId);
    if (!doc) return;

    const modal = document.getElementById('add-doctor-modal');
    if (!modal) return;

    document.getElementById('modal-doctor-title').innerText = 'Edit Doctor Profile';
    document.getElementById('modal-doctor-id').value = doc.id;
    document.getElementById('modal-doctor-name').value = doc.full_name;
    document.getElementById('modal-doctor-email').value = doc.email;
    document.getElementById('modal-doctor-phone').value = doc.phone || '';
    document.getElementById('modal-doctor-dept').value = doc.department_id;
    document.getElementById('modal-doctor-spec').value = doc.specialization;
    document.getElementById('modal-doctor-qual').value = doc.qualification;
    document.getElementById('modal-doctor-exp').value = doc.experience_years;
    document.getElementById('modal-doctor-room').value = doc.room_number || '';
    document.getElementById('modal-doctor-fee').value = doc.consultation_fee || 50;
    if (document.getElementById('modal-doctor-image')) document.getElementById('modal-doctor-image').value = doc.profile_image || '';
    if (document.getElementById('modal-doctor-about')) document.getElementById('modal-doctor-about').value = doc.about || '';
    if (document.getElementById('modal-doctor-verified')) document.getElementById('modal-doctor-verified').checked = !!doc.is_verified;
    if (document.getElementById('modal-doctor-available')) document.getElementById('modal-doctor-available').checked = (doc.is_available_today !== false);

    modal.classList.add('active');
  },

  // --------------------------------------------------------------------------
  // 3. PATIENT MANAGEMENT (FULL EDITABLE & CREATE)
  // --------------------------------------------------------------------------
  async initPatientManager() {
    const tableBody = document.getElementById('admin-patients-table-body');
    if (!tableBody) return;

    const profiles = await window.CarePulseDB.getProfiles();
    const appointments = await window.CarePulseDB.getAppointments();
    this.cachedPatients = profiles.filter(p => p.role === 'patient');

    // Attach bookings count to each patient
    this.cachedPatients.forEach(p => {
      p.booking_count = appointments.filter(a => a.patient_id === p.id).length;
    });

    this.filterPatients();
  },

  renderPatientsTable(patients) {
    const tableBody = document.getElementById('admin-patients-table-body');
    if (!tableBody) return;

    if (!patients || patients.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-xs text-slate-400">No patient records found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = patients.map(p => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-900 text-xs">${p.full_name}</div>
          <div class="text-[11px] text-slate-400">${p.email}</div>
        </td>
        <td class="py-3.5 px-4 text-xs text-slate-600">${p.phone || 'N/A'}</td>
        <td class="py-3.5 px-4 text-xs text-slate-600">${p.gender || 'Other'} &bull; <span class="font-bold text-rose-600">${p.blood_group || 'O+'}</span></td>
        <td class="py-3.5 px-4 text-xs text-slate-500">${p.date_of_birth || 'N/A'}</td>
        <td class="py-3.5 px-4 text-xs font-semibold text-sky-700">${p.booking_count || 0} Bookings</td>
        <td class="py-3.5 px-4">
          <button onclick="window.AdminApp.togglePatientStatus('${p.id}', ${p.is_active === false})" class="px-2.5 py-1 rounded-full text-xs font-bold transition ${p.is_active !== false ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}">
            ${p.is_active !== false ? 'Active' : 'Suspended'}
          </button>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="window.AdminApp.openEditPatientModal('${p.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition" title="Edit Patient Details">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="window.AdminApp.deletePatient('${p.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete Patient Record">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  filterPatients() {
    const searchVal = document.getElementById('admin-patient-search')?.value.toLowerCase().trim() || '';
    const statusVal = document.getElementById('admin-patient-status-filter')?.value || 'all';

    const filtered = this.cachedPatients.filter(p => {
      const matchSearch = !searchVal ||
        p.full_name?.toLowerCase().includes(searchVal) ||
        p.email?.toLowerCase().includes(searchVal) ||
        p.phone?.toLowerCase().includes(searchVal);

      const matchStatus = (statusVal === 'all') ||
        (statusVal === 'active' && p.is_active !== false) ||
        (statusVal === 'suspended' && p.is_active === false);

      return matchSearch && matchStatus;
    });

    this.renderPatientsTable(filtered);
  },

  async togglePatientStatus(profileId, setActive) {
    try {
      await window.CarePulseDB.updateProfile(profileId, { is_active: setActive });
      window.showToast(`Patient status changed to: ${setActive ? 'ACTIVE' : 'SUSPENDED'}`, 'info');
      await this.initPatientManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async deletePatient(patientId) {
    if (confirm('Delete this patient profile and all associated medical history?')) {
      try {
        await window.CarePulseDB.deleteProfile(patientId);
        window.showToast('Patient record deleted.', 'info');
        await this.initPatientManager();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    }
  },

  async savePatientForm(e) {
    e.preventDefault();
    const patientId = document.getElementById('modal-patient-id')?.value;
    const name = document.getElementById('modal-patient-name')?.value;
    const email = document.getElementById('modal-patient-email')?.value;
    const phone = document.getElementById('modal-patient-phone')?.value;
    const gender = document.getElementById('modal-patient-gender')?.value;
    const blood = document.getElementById('modal-patient-blood')?.value;
    const dob = document.getElementById('modal-patient-dob')?.value;
    const active = document.getElementById('modal-patient-active')?.value === 'true';

    const payload = {
      full_name: name,
      email,
      phone,
      gender,
      blood_group: blood,
      date_of_birth: dob || null,
      is_active: active
    };

    try {
      if (patientId) {
        await window.CarePulseDB.updateProfile(patientId, payload);
        window.showToast('Patient details updated successfully!', 'success');
      } else {
        await window.CarePulseDB.addPatientProfile(payload);
        window.showToast('New patient record created!', 'success');
      }

      document.getElementById('patient-modal')?.classList.remove('active');
      await this.initPatientManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async openEditPatientModal(patientId) {
    const patient = this.cachedPatients.find(p => p.id === patientId);
    if (!patient) return;

    const modal = document.getElementById('patient-modal');
    if (!modal) return;

    document.getElementById('modal-patient-title').innerText = 'Edit Patient Record';
    document.getElementById('modal-patient-id').value = patient.id;
    document.getElementById('modal-patient-name').value = patient.full_name;
    document.getElementById('modal-patient-email').value = patient.email;
    document.getElementById('modal-patient-phone').value = patient.phone || '';
    document.getElementById('modal-patient-gender').value = patient.gender || 'Male';
    document.getElementById('modal-patient-blood').value = patient.blood_group || 'O+';
    document.getElementById('modal-patient-dob').value = patient.date_of_birth || '';
    document.getElementById('modal-patient-active').value = (patient.is_active !== false) ? 'true' : 'false';

    modal.classList.add('active');
  },

  // --------------------------------------------------------------------------
  // 4. MASTER APPOINTMENT MANAGER (FULL EDITABLE, BOOK & STATUS)
  // --------------------------------------------------------------------------
  async initAppointmentManager() {
    const tableBody = document.getElementById('admin-appointments-table-body');
    if (!tableBody) return;

    this.cachedAppointments = await window.CarePulseDB.getAppointments();
    this.cachedDoctors = await window.CarePulseDB.getDoctors();
    const profiles = await window.CarePulseDB.getProfiles();
    this.cachedPatients = profiles.filter(p => p.role === 'patient');

    // Populate filter doctor select while preserving active selection
    const doctorFilter = document.getElementById('admin-filter-doctor');
    if (doctorFilter) {
      const prevDocFilter = doctorFilter.value || 'all';
      doctorFilter.innerHTML = `<option value="all">All Doctors</option>` + 
        this.cachedDoctors.map(d => `<option value="${d.id}">${d.full_name} (${d.department_name})</option>`).join('');
      if ([...doctorFilter.options].some(o => o.value === prevDocFilter)) {
        doctorFilter.value = prevDocFilter;
      }
    }

    // Populate Modal Doctor and Patient dropdowns
    const modalDoc = document.getElementById('modal-appt-doctor');
    if (modalDoc) {
      modalDoc.innerHTML = this.cachedDoctors.map(d => `<option value="${d.id}">${d.full_name} - ${d.department_name} (${d.room_number})</option>`).join('');
    }
    const editDoc = document.getElementById('edit-appt-doctor');
    if (editDoc) {
      editDoc.innerHTML = this.cachedDoctors.map(d => `<option value="${d.id}">${d.full_name} - ${d.department_name}</option>`).join('');
    }
    const modalPat = document.getElementById('modal-appt-patient');
    if (modalPat) {
      modalPat.innerHTML = this.cachedPatients.map(p => `<option value="${p.id}">${p.full_name} (${p.email})</option>`).join('');
    }

    this.filterAppointments();
    const countAllEl = document.getElementById('count-all-appts');
    if (countAllEl) countAllEl.innerText = this.cachedAppointments.length;

    await this.renderWaitingListTable();
    await this.renderDoctorDelayTable();
  },

  renderAppointmentsTable(appointments) {
    const tableBody = document.getElementById('admin-appointments-table-body');
    if (!tableBody) return;

    if (!appointments || appointments.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-xs text-slate-400">No appointments match the criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = appointments.map(a => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
        <td class="py-3.5 px-4 font-mono font-bold text-sky-700 text-xs">
          <div>${a.token_number}</div>
          <div class="text-[10px] text-slate-400 font-normal">${a.appointment_number || ''}</div>
        </td>
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-900 text-xs">${a.patient_name}</div>
          <div class="text-[11px] text-slate-400">${a.patient_phone || a.patient_email}</div>
        </td>
        <td class="py-3.5 px-4">
          <div class="font-semibold text-slate-800 text-xs">${a.doctor_name}</div>
          <div class="text-[11px] text-slate-400">${a.department_name} &bull; ${a.room_number}</div>
        </td>
        <td class="py-3.5 px-4 text-xs text-slate-600">
          <div class="font-semibold text-slate-700">${a.appointment_date}</div>
          <div class="text-[11px] text-slate-400">${window.CarePulseDB.formatTime12Hour(a.time_slot || a.appointment_time)}</div>
        </td>
        <td class="py-3.5 px-4 text-xs text-slate-500 max-w-xs">
          <span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${a.priority === 'emergency' ? 'bg-rose-100 text-rose-700' : a.priority === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}">${(a.priority || 'normal').toUpperCase()}</span>
          <div class="truncate mt-0.5 text-slate-700">${a.reason || 'General Consultation'}</div>
        </td>
        <td class="py-3.5 px-4">
          <select onchange="window.AdminApp.quickChangeStatus('${a.id}', this.value)" class="text-[11px] font-bold py-1 px-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 status-badge ${a.status}">
            <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="confirmed" ${a.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="in_consultation" ${['in-consultation', 'in_consultation'].includes(a.status) ? 'selected' : ''}>In Consultation</option>
            <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="window.AdminApp.printReceiptSlip('${a.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition" title="Print Appointment Slip">
              <i data-lucide="printer" class="w-4 h-4"></i>
            </button>
            <button onclick="window.AdminApp.openEditAppointmentModal('${a.id}')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Edit Appointment">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="window.AdminApp.deleteAppointment('${a.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete Record">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  filterAppointments() {
    const searchVal = document.getElementById('admin-appt-search')?.value.toLowerCase().trim() || '';
    const selectedDoc = document.getElementById('admin-filter-doctor')?.value || 'all';
    const selectedStatus = document.getElementById('admin-filter-status')?.value || 'all';
    const selectedDate = document.getElementById('admin-filter-date')?.value;

    const filtered = this.cachedAppointments.filter(a => {
      const matchSearch = !searchVal ||
        a.token_number?.toLowerCase().includes(searchVal) ||
        a.patient_name?.toLowerCase().includes(searchVal) ||
        a.doctor_name?.toLowerCase().includes(searchVal) ||
        a.reason?.toLowerCase().includes(searchVal);

      const matchDoc = (selectedDoc === 'all') || (a.doctor_id === selectedDoc);
      const matchStatus = (selectedStatus === 'all') || 
        (a.status === selectedStatus) ||
        (selectedStatus === 'in_consultation' && ['in-consultation', 'in_consultation'].includes(a.status));
      const matchDate = !selectedDate || (a.appointment_date === selectedDate);

      return matchSearch && matchDoc && matchStatus && matchDate;
    });

    this.renderAppointmentsTable(filtered);
  },

  async quickChangeStatus(appointmentId, newStatus) {
    try {
      await window.CarePulseDB.updateAppointmentStatus(appointmentId, newStatus);
      window.showToast(`Appointment status updated to: ${newStatus.toUpperCase()}`, 'success');
      await this.initAppointmentManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async deleteAppointment(appointmentId) {
    if (confirm('Delete this appointment completely from hospital database?')) {
      try {
        await window.CarePulseDB.deleteAppointment(appointmentId);
        window.showToast('Appointment record removed.', 'info');
        await this.initAppointmentManager();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    }
  },

  printReceiptSlip(appointmentId) {
    const appt = this.cachedAppointments.find(a => a.id === appointmentId);
    if (appt && window.generateAppointmentReceiptPDF) {
      window.generateAppointmentReceiptPDF(appt);
    } else {
      window.showToast('PDF slip generator is loading...', 'info');
    }
  },

  async saveNewAppointmentForm(e) {
    e.preventDefault();
    const patientId = document.getElementById('modal-appt-patient')?.value;
    const doctorId = document.getElementById('modal-appt-doctor')?.value;
    const date = document.getElementById('modal-appt-date')?.value;
    const time = document.getElementById('modal-appt-time')?.value;
    const priority = document.getElementById('modal-appt-priority')?.value || 'normal';
    const reason = document.getElementById('modal-appt-reason')?.value;

    try {
      await window.CarePulseDB.createAppointment({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: date,
        time_slot: time,
        priority,
        reason
      });
      window.showToast('New appointment booked successfully by Admin!', 'success');
      document.getElementById('add-appointment-modal')?.classList.remove('active');
      await this.initAppointmentManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async openEditAppointmentModal(appointmentId) {
    const appt = this.cachedAppointments.find(a => a.id === appointmentId);
    if (!appt) return;

    const modal = document.getElementById('edit-appointment-modal');
    if (!modal) return;

    document.getElementById('edit-appt-id').value = appt.id;
    document.getElementById('edit-appt-doctor').value = appt.doctor_id;
    document.getElementById('edit-appt-status').value = appt.status;
    document.getElementById('edit-appt-date').value = appt.appointment_date;
    document.getElementById('edit-appt-time').value = (appt.time_slot || appt.appointment_time || '09:00').substring(0, 5);
    document.getElementById('edit-appt-priority').value = appt.priority || 'normal';
    document.getElementById('edit-appt-reason').value = appt.reason || '';
    document.getElementById('edit-appt-notes').value = appt.doctor_notes || '';

    modal.classList.add('active');
  },

  async saveEditAppointmentForm(e) {
    e.preventDefault();
    const apptId = document.getElementById('edit-appt-id')?.value;
    const doctorId = document.getElementById('edit-appt-doctor')?.value;
    const status = document.getElementById('edit-appt-status')?.value;
    const date = document.getElementById('edit-appt-date')?.value;
    const time = document.getElementById('edit-appt-time')?.value;
    const priority = document.getElementById('edit-appt-priority')?.value;
    const reason = document.getElementById('edit-appt-reason')?.value;
    const notes = document.getElementById('edit-appt-notes')?.value;

    try {
      await window.CarePulseDB.updateAppointment(apptId, {
        doctor_id: doctorId,
        status,
        appointment_date: date,
        time_slot: time,
        appointment_time: time,
        priority,
        reason,
        doctor_notes: notes
      });
      window.showToast('Appointment record updated successfully!', 'success');
      document.getElementById('edit-appointment-modal')?.classList.remove('active');
      await this.initAppointmentManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // WAITING LIST & DOCTOR DELAY TABS & CONTROLS (Features 5 & 6)
  // --------------------------------------------------------------------------
  switchAppointmentView(viewName) {
    const tabs = ['appointments', 'waiting-list', 'doctor-delay'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const container = document.getElementById(`admin-${t}-view-container`);
      if (t === viewName) {
        if (btn) {
          btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 text-white shadow-sm flex items-center gap-1.5 transition flex-shrink-0';
        }
        if (container) container.classList.remove('hidden');
      } else {
        if (btn) {
          btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition flex-shrink-0';
        }
        if (container) container.classList.add('hidden');
      }
    });
    if (window.lucide) window.lucide.createIcons();
  },

  async renderWaitingListTable() {
    const tableBody = document.getElementById('admin-waiting-list-table-body');
    const badgeEl = document.getElementById('count-waiting-list');
    if (!tableBody) return;

    try {
      const list = await window.CarePulseDB.getWaitingList();
      if (badgeEl) badgeEl.innerText = list.length;

      if (!list || list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-xs text-slate-400">No patients currently on priority waiting list.</td></tr>`;
        return;
      }

      tableBody.innerHTML = list.map(item => {
        const doc = this.cachedDoctors?.find(d => d.id === item.doctor_id);
        const statusColors = {
          waiting: 'bg-amber-100 text-amber-800 border-amber-200',
          offered: 'bg-sky-100 text-sky-800 border-sky-200 animate-pulse',
          allocated: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          expired: 'bg-slate-100 text-slate-600 border-slate-200',
          declined: 'bg-rose-100 text-rose-800 border-rose-200'
        };

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition text-xs">
            <td class="py-3.5 px-4 font-bold text-slate-900">
              <div>${item.patient_name || 'Patient'}</div>
              <div class="text-[11px] text-slate-400 font-normal">${item.patient_phone || item.patient_email || ''}</div>
            </td>
            <td class="py-3.5 px-4">
              <div class="font-semibold text-slate-800">${doc?.full_name || item.doctor_name || 'Specialist'}</div>
              <div class="text-[11px] text-slate-400">${doc?.department_name || ''}</div>
            </td>
            <td class="py-3.5 px-4 font-semibold text-slate-700">${item.preferred_date}</td>
            <td class="py-3.5 px-4 capitalize text-slate-600">${item.preferred_time_range || 'Any'}</td>
            <td class="py-3.5 px-4 font-bold text-sky-700">${item.priority_score || 100}</td>
            <td class="py-3.5 px-4">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusColors[item.status] || 'bg-slate-100 text-slate-600'}">
                ${item.status}
              </span>
              ${item.offered_slot ? `<div class="text-[10px] text-sky-600 font-bold mt-0.5">Offered: ${item.offered_slot}</div>` : ''}
            </td>
            <td class="py-3.5 px-4 text-slate-400 text-[11px]">${item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}</td>
            <td class="py-3.5 px-4 text-right">
              ${item.status === 'waiting' ? `
                <button onclick="window.AdminApp.manualAllocateSlot('${item.id}', '${item.doctor_id}', '${item.preferred_date}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition" title="Offer available slot">
                  Offer Slot
                </button>
              ` : `<span class="text-slate-400 text-[11px]">Logged</span>`}
            </td>
          </tr>
        `;
      }).join('');
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-xs text-rose-500">Error loading waiting list: ${e.message}</td></tr>`;
    }
  },

  async adminCheckExpiredOffers() {
    try {
      const expiredCount = await window.CarePulseDB.checkExpiredWaitingOffers();
      window.showToast(`Checked waiting list: ${expiredCount} expired offers released.`, 'info');
      await this.renderWaitingListTable();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async manualAllocateSlot(waitingId, doctorId, date) {
    const slot = prompt(`Enter available time slot to offer this patient (e.g. 10:00:00 or 10:00 AM):`, '10:00:00');
    if (!slot) return;
    try {
      await window.CarePulseDB.processWaitingListForVacatedSlot(doctorId, date, slot);
      window.showToast('Priority offer dispatched to patient with 30-min window!', 'success');
      await this.renderWaitingListTable();
    } catch (e) {
      window.showToast(e.message, 'error');
    }
  },

  async renderDoctorDelayTable() {
    const tableBody = document.getElementById('admin-doctor-delay-table-body');
    if (!tableBody) return;

    try {
      const doctors = this.cachedDoctors || await window.CarePulseDB.getDoctors();
      
      const rows = await Promise.all(doctors.map(async (doc) => {
        let delayInfo = { delay_minutes: 0, delay_reason: '' };
        let liveAvail = { status: 'Available', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        try {
          delayInfo = await window.CarePulseDB.getDoctorDelay(doc.id);
          liveAvail = await window.CarePulseDB.calculateDoctorAvailability(doc.id);
        } catch (e) {}

        const isDelayed = delayInfo && delayInfo.delay_minutes > 0;

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition text-xs">
            <td class="py-3.5 px-4 font-bold text-slate-900">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[11px] overflow-hidden">
                  ${doc.profile_image ? `<img src="${doc.profile_image}" class="w-full h-full object-cover">` : doc.full_name.charAt(0)}
                </div>
                <div>
                  <div class="font-bold text-slate-900">${doc.full_name}</div>
                  <div class="text-[11px] text-slate-400">${doc.qualification || ''}</div>
                </div>
              </div>
            </td>
            <td class="py-3.5 px-4">
              <div class="font-semibold text-slate-800">${doc.department_name || 'General'}</div>
              <div class="text-[11px] text-slate-400">${doc.room_number || 'Room 101'}</div>
            </td>
            <td class="py-3.5 px-4 text-slate-600">
              ${doc.consultation_hours || '09:00 AM - 05:00 PM'}
            </td>
            <td class="py-3.5 px-4">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${liveAvail.badgeClass}">
                ${liveAvail.status}
              </span>
            </td>
            <td class="py-3.5 px-4 font-bold">
              ${isDelayed ? `
                <span class="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
                  <i data-lucide="clock" class="w-3 h-3"></i> +${delayInfo.delay_minutes} Mins
                </span>
              ` : `<span class="text-emerald-600 text-xs font-semibold">On Schedule</span>`}
            </td>
            <td class="py-3.5 px-4 text-slate-600 max-w-xs truncate">
              ${isDelayed ? delayInfo.delay_reason : 'Normal clinic hours'}
            </td>
            <td class="py-3.5 px-4 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="window.AdminApp.openAdminDelayModal('${doc.id}', '${doc.full_name.replace(/'/g, "\\'")}', ${delayInfo?.delay_minutes || 0}, '${(delayInfo?.delay_reason || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition" title="Adjust Delay">
                  Set Delay
                </button>
                ${isDelayed ? `
                  <button onclick="window.AdminApp.adminClearDelay('${doc.id}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition" title="Clear delay & resume normal schedule">
                    Clear
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }));

      tableBody.innerHTML = rows.join('');
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-xs text-rose-500">Error loading doctor delay overview: ${e.message}</td></tr>`;
    }
  },

  openAdminDelayModal(doctorId, doctorName, currentDelay, currentReason) {
    document.getElementById('admin-delay-doctor-id').value = doctorId;
    document.getElementById('admin-delay-doctor-name').value = doctorName;
    document.getElementById('admin-delay-minutes').value = currentDelay || 15;
    document.getElementById('admin-delay-reason').value = currentReason || 'OPD delay / extended consultations';
    document.getElementById('admin-delay-modal')?.classList.add('active');
  },

  async saveDoctorDelay(e) {
    e.preventDefault();
    const docId = document.getElementById('admin-delay-doctor-id')?.value;
    const minutes = parseInt(document.getElementById('admin-delay-minutes')?.value, 10);
    const reason = document.getElementById('admin-delay-reason')?.value?.trim();

    try {
      if (minutes <= 0) {
        await window.CarePulseDB.clearDoctorDelay(docId);
        window.showToast('Doctor delay cleared. Clinic schedule resumed.', 'success');
      } else {
        await window.CarePulseDB.reportDoctorDelay(docId, minutes, reason);
        window.showToast(`Doctor delay of ${minutes} mins broadcasted to patients!`, 'success');
      }
      document.getElementById('admin-delay-modal')?.classList.remove('active');
      await this.renderDoctorDelayTable();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async adminClearDelay(doctorId) {
    try {
      await window.CarePulseDB.clearDoctorDelay(doctorId);
      window.showToast('Doctor delay cleared. Clinic schedule resumed.', 'success');
      await this.renderDoctorDelayTable();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 5. DEPARTMENT MANAGEMENT (FULL EDITABLE & CREATE)
  // --------------------------------------------------------------------------
  async initDepartmentManager() {
    const tableBody = document.getElementById('admin-departments-table-body');
    if (!tableBody) return;

    this.cachedDepartments = await window.CarePulseDB.getDepartments();
    const doctors = await window.CarePulseDB.getDoctors();

    tableBody.innerHTML = this.cachedDepartments.map(d => {
      const docCount = doctors.filter(doc => doc.department_id === d.id || doc.department_name === d.name).length;
      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
          <td class="py-3.5 px-4">
            <span class="font-bold text-sky-700 text-xs font-mono bg-sky-50 px-2 py-0.5 rounded">${d.code}</span>
          </td>
          <td class="py-3.5 px-4 font-bold text-slate-900 text-xs">${d.name}</td>
          <td class="py-3.5 px-4 text-xs text-slate-500 max-w-sm truncate">${d.description}</td>
          <td class="py-3.5 px-4 text-xs text-slate-600">${d.room_number || 'Wing A'}</td>
          <td class="py-3.5 px-4 text-xs font-semibold text-slate-700">${docCount} Specialists</td>
          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="window.AdminApp.openEditDepartmentModal('${d.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition" title="Edit Department">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="window.AdminApp.deleteDepartment('${d.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete Department">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  openEditDepartmentModal(deptId) {
    const dept = this.cachedDepartments.find(d => d.id === deptId);
    if (!dept) return;

    const modal = document.getElementById('add-dept-modal');
    if (!modal) return;

    document.getElementById('modal-dept-title').innerText = 'Edit Medical Department';
    document.getElementById('dept-id').value = dept.id;
    document.getElementById('dept-name').value = dept.name;
    document.getElementById('dept-code').value = dept.code;
    document.getElementById('dept-room').value = dept.room_number || '';
    document.getElementById('dept-desc').value = dept.description || '';

    modal.classList.add('active');
  },

  async saveDepartmentForm(e) {
    e.preventDefault();
    const deptId = document.getElementById('dept-id')?.value;
    const name = document.getElementById('dept-name')?.value;
    const code = document.getElementById('dept-code')?.value;
    const room = document.getElementById('dept-room')?.value;
    const desc = document.getElementById('dept-desc')?.value;

    const payload = {
      name,
      code,
      room_number: room,
      description: desc
    };

    try {
      if (deptId) {
        await window.CarePulseDB.updateDepartment(deptId, payload);
        window.showToast('Department details updated!', 'success');
      } else {
        await window.CarePulseDB.addDepartment(payload);
        window.showToast('New department added to hospital!', 'success');
      }

      document.getElementById('add-dept-modal')?.classList.remove('active');
      await this.initDepartmentManager();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  },

  async deleteDepartment(deptId) {
    if (confirm('Delete this department? Doctors assigned to this department will need reassignment.')) {
      try {
        await window.CarePulseDB.deleteDepartment(deptId);
        window.showToast('Department removed successfully.', 'info');
        await this.initDepartmentManager();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    }
  },

  // --------------------------------------------------------------------------
  // 6. REPORTS & EXPORTS
  // --------------------------------------------------------------------------
  async initReports() {
    const container = document.getElementById('admin-reports-view');
    if (!container) return;

    const appointments = await window.CarePulseDB.getAppointments();
    const doctors = await window.CarePulseDB.getDoctors();
    const departments = await window.CarePulseDB.getDepartments();

    const reportTable = document.getElementById('department-utilization-report');
    if (reportTable) {
      reportTable.innerHTML = departments.map(dept => {
        const deptDoctors = doctors.filter(d => d.department_id === dept.id || d.department_name === dept.name);
        const deptDocIds = deptDoctors.map(d => d.id);
        const deptAppointments = appointments.filter(a => deptDocIds.includes(a.doctor_id));
        const completed = deptAppointments.filter(a => a.status === 'completed').length;
        const cancelled = deptAppointments.filter(a => ['cancelled', 'rejected'].includes(a.status)).length;

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/75 transition">
            <td class="py-3 px-4 font-bold text-slate-800 text-xs">${dept.name} (${dept.code})</td>
            <td class="py-3 px-4 text-xs text-slate-600">${deptDoctors.length}</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-800">${deptAppointments.length}</td>
            <td class="py-3 px-4 text-xs text-emerald-600 font-semibold">${completed}</td>
            <td class="py-3 px-4 text-xs text-rose-500 font-semibold">${cancelled}</td>
          </tr>
        `;
      }).join('');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.AdminApp.init();
});
