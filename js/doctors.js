/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * Doctor Discovery & Profile Controller
 * ==============================================================================
 */

window.DoctorDirectory = {
  doctors: [],
  departments: [],

  async init() {
    this.departments = await window.CarePulseDB.getDepartments();
    this.doctors = await window.CarePulseDB.getDoctors();
    
    this.renderDepartmentFilter();
    this.renderDoctorCards(this.doctors);
    this.attachEvents();
  },

  renderDepartmentFilter() {
    const filterContainer = document.getElementById('department-filter-options');
    if (!filterContainer) return;

    filterContainer.innerHTML = `
      <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition">
        <input type="radio" name="dept-filter" value="all" checked class="text-sky-600 focus:ring-sky-500 rounded">
        <span class="text-sm font-medium text-slate-700">All Departments</span>
        <span class="ml-auto text-xs text-slate-400">(${this.doctors.length})</span>
      </label>
      ${this.departments.map(d => {
        const count = this.doctors.filter(doc => doc.department_id === d.id).length;
        return `
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition">
            <input type="radio" name="dept-filter" value="${d.id}" class="text-sky-600 focus:ring-sky-500 rounded">
            <span class="text-sm font-medium text-slate-700">${d.name}</span>
            <span class="ml-auto text-xs text-slate-400">(${count})</span>
          </label>
        `;
      }).join('')}
    `;
  },

  async renderDoctorCards(doctorsToRender) {
    const grid = document.getElementById('doctors-grid');
    const emptyState = document.getElementById('doctors-empty-state');
    const countDisplay = document.getElementById('doctors-count-display');

    if (countDisplay) {
      countDisplay.innerText = `Showing ${doctorsToRender.length} Specialists`;
    }

    if (!grid) return;

    if (doctorsToRender.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Calculate live availability for each doctor (Feature 3)
    const cardsWithAvail = await Promise.all(doctorsToRender.map(async (doc) => {
      let avail = { status: 'Available', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' };
      try {
        avail = await window.CarePulseDB.calculateDoctorAvailability(doc.id);
      } catch (e) {}

      return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 hover:border-sky-300 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
        <div>
          <div class="flex items-start gap-4">
            <div class="relative flex-shrink-0">
              <img src="${doc.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400'}" alt="${doc.full_name}" class="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 group-hover:border-sky-400 transition">
              ${doc.is_verified ? `
                <span class="absolute -bottom-1 -right-1 bg-sky-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="Verified Specialist">
                  <i data-lucide="check" class="w-3 h-3 stroke-[3]"></i>
                </span>
              ` : ''}
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                  ${doc.department_name || 'General Medicine'}
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${avail.badgeClass}">
                  <span class="w-1.5 h-1.5 rounded-full ${avail.dotColor}"></span>
                  ${avail.status}
                </span>
                <span class="flex items-center gap-1 text-xs font-bold text-amber-500 ml-auto">
                  <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 stroke-amber-400"></i>
                  ${doc.rating || 5.0} (${doc.total_reviews || 0})
                </span>
              </div>

              <h3 class="text-lg font-bold text-slate-900 mt-1 truncate group-hover:text-sky-600 transition">
                <a href="doctor-profile.html?id=${doc.id}">${doc.full_name}</a>
              </h3>
              
              <p class="text-xs text-slate-500 truncate">${doc.qualification}</p>
              <p class="text-xs font-medium text-slate-600 mt-0.5">${doc.specialization}</p>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div class="flex items-center gap-1.5">
              <i data-lucide="briefcase" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>${doc.experience_years}+ Yrs Experience</span>
            </div>
            <div class="flex items-center gap-1.5">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i>
              <span class="truncate">${doc.room_number || 'Room 101'}</span>
            </div>
          </div>

          <p class="mt-3 text-xs text-slate-500 line-clamp-2">${doc.about || 'Dedicated specialist providing comprehensive patient evaluation and individualized care.'}</p>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400">Consultation</span>
            <div class="text-base font-extrabold text-slate-900">$${doc.consultation_fee || 50}</div>
          </div>

          <div class="flex items-center gap-2">
            <a href="doctor-profile.html?id=${doc.id}" class="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition">
              Profile
            </a>
            <a href="patient/book-appointment.html?doctorId=${doc.id}" class="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5">
              <i data-lucide="calendar" class="w-3.5 h-3.5"></i> Book
            </a>
          </div>
        </div>
      </div>
      `;
    }));

    grid.innerHTML = cardsWithAvail.join('');
    if (window.lucide) window.lucide.createIcons();
  },

  attachEvents() {
    const searchInput = document.getElementById('doctor-search-input');
    const filterContainer = document.getElementById('department-filter-options');
    const experienceFilter = document.getElementById('experience-filter');

    const handleFilter = () => {
      const query = (searchInput?.value || '').toLowerCase().trim();
      const selectedDept = document.querySelector('input[name="dept-filter"]:checked')?.value || 'all';
      const minExp = parseInt(experienceFilter?.value || '0', 10);

      const filtered = this.doctors.filter(doc => {
        const matchesQuery = !query || 
          doc.full_name.toLowerCase().includes(query) ||
          doc.specialization.toLowerCase().includes(query) ||
          (doc.department_name && doc.department_name.toLowerCase().includes(query));

        const matchesDept = selectedDept === 'all' || doc.department_id === selectedDept;
        const matchesExp = (doc.experience_years || 0) >= minExp;

        return matchesQuery && matchesDept && matchesExp;
      });

      this.renderDoctorCards(filtered);
    };

    searchInput?.addEventListener('input', handleFilter);
    filterContainer?.addEventListener('change', handleFilter);
    experienceFilter?.addEventListener('change', handleFilter);
  }
};
