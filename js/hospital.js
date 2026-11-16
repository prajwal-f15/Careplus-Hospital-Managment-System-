/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Hospital & Clinic Portal Controller (js/hospital.js)
 * ==============================================================================
 */

window.HospitalPortal = {
  currentHospital: null,
  affiliatedDoctors: [],
  appointments: [],
  departments: [],

  async init(page = 'dashboard') {
    // 1. Enforce Role Authentication
    if (window.Auth && !window.Auth.requireAuth(['hospital', 'hospital_admin', 'admin'])) {
      return;
    }

    const user = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!user) return;

    // 2. Resolve Active Hospital
    await this.resolveCurrentHospital(user);

    // 3. Render Navbar Profile & Facility Brand
    this.renderBrandHeader();

    // 4. Trigger Page-Specific View
    if (page === 'dashboard') {
      await this.loadDashboard();
    } else if (page === 'doctors') {
      await this.loadDoctors();
    } else if (page === 'appointments') {
      await this.loadAppointments();
    } else if (page === 'departments') {
      await this.loadDepartments();
    } else if (page === 'profile') {
      await this.loadProfile();
    }

    if (window.lucide) window.lucide.createIcons();
  },

  async resolveCurrentHospital(user) {
    if (this.currentHospital) return this.currentHospital;

    // Check user.hospital_id or query by profile_id
    let hosp = null;
    if (user.hospital_id) {
      hosp = await window.CarePulseDB.getHospitalById(user.hospital_id);
    }
    if (!hosp && user.id) {
      hosp = await window.CarePulseDB.getHospitalByProfileId(user.id);
    }
    if (!hosp) {
      const all = await window.CarePulseDB.getHospitals({ includeUnapproved: true });
      hosp = all[0];
    }

    this.currentHospital = hosp;
    return hosp;
  },

  renderBrandHeader() {
    const hosp = this.currentHospital;
    if (!hosp) return;

    const brandName = document.getElementById('hospital-brand-name');
    const brandType = document.getElementById('hospital-brand-type');
    const brandBadge = document.getElementById('hospital-status-badge');
    const brandLicense = document.getElementById('hospital-brand-license');

    if (brandName) brandName.innerText = hosp.name || 'CarePulse Partner Facility';
    if (brandType) brandType.innerText = `${hosp.hospital_type || 'Multi-specialty Hospital'} • ${hosp.city_name || 'Mumbai'}`;
    if (brandLicense) brandLicense.innerText = `License: ${hosp.license_number || 'LIC-VERIFIED'}`;

    if (brandBadge) {
      const isApproved = (hosp.verification_status === 'approved');
      brandBadge.className = isApproved
        ? 'px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1'
        : 'px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1';
      brandBadge.innerHTML = isApproved
        ? `<i data-lucide="check-circle" class="w-3 h-3"></i> Verified & Publicly Searchable`
        : `<i data-lucide="clock" class="w-3 h-3"></i> Verification Pending Admin Review`;
    }
  },

  // ============================================================================
  // 1. DASHBOARD
  // ============================================================================
  async loadDashboard() {
    const hosp = this.currentHospital;
    if (!hosp) return;

    // Load affiliated doctors & appointments
    this.affiliatedDoctors = await window.CarePulseDB.getHospitalDoctors(hosp.id);
    this.appointments = await window.CarePulseDB.getHospitalAppointments(hosp.id);
    this.departments = await window.CarePulseDB.getDepartments();

    // Today's appointments
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAppts = this.appointments.filter(a => a.appointment_date === todayStr);

    // Update KPI counters
    const kpiDoctors = document.getElementById('kpi-hosp-doctors');
    const kpiToday = document.getElementById('kpi-hosp-today-appts');
    const kpiBeds = document.getElementById('kpi-hosp-beds');
    const kpiDepartments = document.getElementById('kpi-hosp-departments');

    if (kpiDoctors) kpiDoctors.innerText = this.affiliatedDoctors.length;
    if (kpiToday) kpiToday.innerText = todayAppts.length;
    if (kpiBeds) kpiBeds.innerText = hosp.total_beds || 150;
    if (kpiDepartments) kpiDepartments.innerText = this.departments.length;

    // Render Today's OPD appointments table
    const tbody = document.getElementById('hosp-today-appts-tbody');
    if (tbody) {
      if (todayAppts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-xs">No OPD consultations scheduled for today yet.</td></tr>`;
      } else {
        tbody.innerHTML = todayAppts.map(a => `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
            <td class="py-3 px-4 font-mono font-bold text-sky-700">${a.token_number || a.appointment_number || 'APT-001'}</td>
            <td class="py-3 px-4 font-semibold text-slate-900">${a.patient_name || a.profiles?.full_name || 'Patient'}</td>
            <td class="py-3 px-4 text-slate-700 font-medium">${a.doctor_name || a.doctors?.profiles?.full_name || 'Specialist'}</td>
            <td class="py-3 px-4 font-mono text-slate-500">${a.time_slot || a.appointment_time || '09:00'}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                a.status === 'confirmed' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                a.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                a.status === 'completed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                'bg-slate-100 text-slate-600'
              }">${a.status ? a.status.toUpperCase() : 'PENDING'}</span>
            </td>
            <td class="py-3 px-4 text-right">
              ${a.status === 'confirmed' ? `
                <button onclick="window.HospitalPortal.updateStatus('${a.id}', 'checked_in')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition">
                  Check In
                </button>
              ` : (a.status === 'checked_in' ? `
                <button onclick="window.HospitalPortal.updateStatus('${a.id}', 'completed')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition">
                  Complete
                </button>
              ` : `<span class="text-slate-400 font-medium text-[11px]">Ready</span>`)}
            </td>
          </tr>
        `).join('');
      }
    }
  },

  async updateStatus(appointmentId, newStatus) {
    try {
      await window.CarePulseDB.updateAppointmentStatus(appointmentId, newStatus);
      if (window.showToast) window.showToast(`Appointment status updated to ${newStatus.toUpperCase()}`, 'success');
      await this.loadDashboard();
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      alert(`Error updating appointment: ${e.message}`);
    }
  },

  // ============================================================================
  // 2. DOCTORS & PRACTICE AFFILIATIONS
  // ============================================================================
  async loadDoctors() {
    const hosp = this.currentHospital;
    if (!hosp) return;

    this.affiliatedDoctors = await window.CarePulseDB.getHospitalDoctors(hosp.id);
    const tbody = document.getElementById('hosp-doctors-tbody');
    if (!tbody) return;

    if (this.affiliatedDoctors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-xs">No doctors currently affiliated with this facility. Click "Affiliate Doctor" to link specialists.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.affiliatedDoctors.map(d => `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="py-3 px-4">
          <div class="flex items-center gap-3">
            <img src="${d.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400'}" class="w-9 h-9 rounded-xl object-cover border border-slate-200">
            <div>
              <span class="font-bold text-slate-900 block">${d.full_name}</span>
              <span class="text-[11px] text-slate-500">${d.qualification || 'MBBS'} • ${d.specialization}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-4 font-mono font-bold text-slate-700">${d.room_number || 'OPD-101'}</td>
        <td class="py-3 px-4 font-bold text-slate-900">$${d.consultation_fee || 50}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${d.is_primary_hospital ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
            ${d.is_primary_hospital ? 'Primary Base' : 'Visiting Specialist'}
          </span>
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
            (d.verification_status || 'approved') === 'approved' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }">${(d.verification_status || 'approved').toUpperCase()}</span>
        </td>
        <td class="py-3 px-4 text-right">
          <a href="../doctor-profile.html?id=${d.id}" target="_blank" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1">
            <i data-lucide="external-link" class="w-3 h-3"></i> Public Profile
          </a>
        </td>
      </tr>
    `).join('');
  },

  async openAffiliateModal() {
    const modal = document.getElementById('affiliate-doctor-modal');
    const select = document.getElementById('affiliate-doctor-select');
    if (!modal || !select) return;

    // Populate all approved doctors not already affiliated
    const allDocs = await window.CarePulseDB.getDoctors();
    const existingIds = new Set(this.affiliatedDoctors.map(d => d.id));

    select.innerHTML = allDocs.map(d => `
      <option value="${d.id}" ${existingIds.has(d.id) ? 'disabled' : ''}>
        ${d.full_name} (${d.specialization} - ${d.city_name || 'Mumbai'}) ${existingIds.has(d.id) ? '• Already Affiliated' : ''}
      </option>
    `).join('');

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  closeAffiliateModal() {
    const modal = document.getElementById('affiliate-doctor-modal');
    if (modal) modal.classList.add('hidden');
  },

  async submitAffiliation(event) {
    event.preventDefault();
    const hosp = this.currentHospital;
    if (!hosp) return;

    const doctorId = document.getElementById('affiliate-doctor-select').value;
    const opdRoomNumber = document.getElementById('affiliate-room').value.trim() || 'Room 101';
    const consultationFee = parseFloat(document.getElementById('affiliate-fee').value) || 50;
    const isPrimary = document.getElementById('affiliate-is-primary')?.checked || false;

    try {
      await window.CarePulseDB.addDoctorAffiliation({
        doctorId,
        hospitalId: hosp.id,
        opdRoomNumber,
        consultationFee,
        isPrimary
      });

      this.closeAffiliateModal();
      if (window.showToast) window.showToast('Doctor successfully affiliated with hospital!', 'success');
      await this.loadDoctors();
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      alert(`Failed to affiliate doctor: ${e.message}`);
    }
  },

  // ============================================================================
  // 3. APPOINTMENTS DIRECTORY
  // ============================================================================
  async loadAppointments() {
    const hosp = this.currentHospital;
    if (!hosp) return;

    const statusFilter = document.getElementById('hosp-appts-status-filter')?.value || 'all';
    const dateFilter = document.getElementById('hosp-appts-date-filter')?.value || '';

    this.appointments = await window.CarePulseDB.getHospitalAppointments(hosp.id, {
      status: statusFilter,
      date: dateFilter
    });

    const tbody = document.getElementById('hosp-appointments-tbody');
    if (!tbody) return;

    if (this.appointments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 text-xs">No appointments found matching filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.appointments.map(a => `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="py-3 px-4 font-mono font-bold text-sky-700">${a.token_number || a.appointment_number || 'APT-001'}</td>
        <td class="py-3 px-4 font-semibold text-slate-900">${a.patient_name || a.profiles?.full_name || 'Patient'}</td>
        <td class="py-3 px-4 text-slate-700 font-medium">${a.doctor_name || a.doctors?.profiles?.full_name || 'Specialist'}</td>
        <td class="py-3 px-4 font-mono text-slate-500">${a.appointment_date}</td>
        <td class="py-3 px-4 font-mono text-slate-500">${a.time_slot || a.appointment_time || '09:00'}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
            a.status === 'confirmed' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
            a.status === 'checked_in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            a.status === 'completed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
            a.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
            'bg-slate-100 text-slate-600'
          }">${a.status ? a.status.toUpperCase() : 'PENDING'}</span>
        </td>
        <td class="py-3 px-4 text-right">
          ${a.status === 'confirmed' ? `
            <button onclick="window.HospitalPortal.updateAppointmentStatusDirect('${a.id}', 'checked_in')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] shadow-sm transition">
              Check-In
            </button>
          ` : (a.status === 'checked_in' ? `
            <button onclick="window.HospitalPortal.updateAppointmentStatusDirect('${a.id}', 'completed')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] shadow-sm transition">
              Complete
            </button>
          ` : `<span class="text-slate-400 text-[11px] font-medium">-</span>`)}
        </td>
      </tr>
    `).join('');
  },

  async updateAppointmentStatusDirect(id, status) {
    try {
      await window.CarePulseDB.updateAppointmentStatus(id, status);
      if (window.showToast) window.showToast(`Appointment status updated to ${status.toUpperCase()}`, 'success');
      await this.loadAppointments();
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      alert(`Error updating appointment: ${e.message}`);
    }
  },

  // ============================================================================
  // 4. CLINICAL DEPARTMENTS
  // ============================================================================
  async loadDepartments() {
    this.departments = await window.CarePulseDB.getDepartments();
    const grid = document.getElementById('hosp-departments-grid');
    if (!grid) return;

    grid.innerHTML = this.departments.map(d => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-100">${d.code || 'DEPT'}</span>
          <span class="text-xs font-semibold text-slate-400">${d.room_number || 'Wing A'}</span>
        </div>
        <h4 class="font-bold text-slate-900 text-base">${d.name}</h4>
        <p class="text-xs text-slate-500 line-clamp-2">${d.description || 'Specialized clinical care unit equipped with certified specialists.'}</p>
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-emerald-600 font-bold flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Operational</span>
          <a href="../doctors.html?dept=${d.id}" target="_blank" class="text-sky-600 font-bold hover:underline">View Doctors &rarr;</a>
        </div>
      </div>
    `).join('');
  },

  // ============================================================================
  // 5. PROFILE & INFRASTRUCTURE
  // ============================================================================
  async loadProfile() {
    const hosp = this.currentHospital;
    if (!hosp) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('prof-hosp-name', hosp.name);
    setVal('prof-hosp-type', hosp.hospital_type);
    setVal('prof-hosp-license', hosp.license_number);
    setVal('prof-hosp-emergency', hosp.emergency_phone || hosp.phone);
    setVal('prof-hosp-phone', hosp.phone);
    setVal('prof-hosp-email', hosp.email);
    setVal('prof-hosp-address', hosp.address);
    setVal('prof-hosp-city', hosp.city_name);
    setVal('prof-hosp-pin', hosp.pincode);
    setVal('prof-hosp-beds', hosp.total_beds || 50);

    // Facilities Checkboxes
    const currentFacilities = new Set(Array.isArray(hosp.facilities) ? hosp.facilities : []);
    document.querySelectorAll('input[name="hosp-prof-facility"]').forEach(cb => {
      cb.checked = currentFacilities.has(cb.value);
    });
  },

  async saveProfile(event) {
    event.preventDefault();
    const hosp = this.currentHospital;
    if (!hosp) return;

    const btn = document.getElementById('save-profile-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Saving Changes...';
    }

    const selectedFacilities = Array.from(document.querySelectorAll('input[name="hosp-prof-facility"]:checked')).map(cb => cb.value);

    const updates = {
      name: document.getElementById('prof-hosp-name').value.trim(),
      hospital_type: document.getElementById('prof-hosp-type').value,
      license_number: document.getElementById('prof-hosp-license').value.trim(),
      emergency_phone: document.getElementById('prof-hosp-emergency').value.trim(),
      phone: document.getElementById('prof-hosp-phone').value.trim(),
      address: document.getElementById('prof-hosp-address').value.trim(),
      city_name: document.getElementById('prof-hosp-city').value.trim(),
      pincode: document.getElementById('prof-hosp-pin').value.trim(),
      total_beds: parseInt(document.getElementById('prof-hosp-beds').value, 10) || 50,
      facilities: selectedFacilities
    };

    try {
      const updated = await window.CarePulseDB.updateHospital(hosp.id, updates);
      this.currentHospital = { ...this.currentHospital, ...updated };
      if (window.showToast) window.showToast('Hospital profile and facility infrastructure updated!', 'success');
      this.renderBrandHeader();
    } catch (e) {
      alert(`Error saving profile: ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Save Changes';
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }
};

