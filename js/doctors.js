/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * Doctor Discovery & Profile Controller
 * Integrated with Module 1: Location Directory & Geolocation Services
 * ==============================================================================
 */

window.DoctorDirectory = {
  doctors: [],
  departments: [],
  cities: [],
  activeLocation: null,
  userCoordinates: null,

  async init() {
    this.activeLocation = window.LocationService ? window.LocationService.getActiveDiscoveryLocation() : { mode: 'all_india', label: 'All India' };
    await this.initLocationUI();
    await this.refreshData();
    this.attachEvents();

    if (window.CarePulseDB?.enableAutoRealtimeSync) {
      this._realtimeSync = window.CarePulseDB.enableAutoRealtimeSync({
        tables: ['doctors', 'departments', 'doctor_availability', 'doctor_leaves', 'appointments', 'reviews', 'cities', 'hospitals'],
        intervalMs: 15000,
        onRefresh: () => this.refreshData()
      });
    }

    // Listen to global location changes
    window.addEventListener('carepulse_location_changed', (e) => {
      this.activeLocation = e.detail;
      this.updateLocationBadgeUI();
      this.applyFilters();
    });
  },

  async initLocationUI() {
    if (!window.LocationService) return;

    this.cities = await window.LocationService.getCities();
    const states = await window.LocationService.getStates();

    // Populate Sidebar State Selector
    const stateFilter = document.getElementById('state-filter');
    const modalStateSelect = document.getElementById('modal-state-select');

    const stateOptions = `<option value="all">All States (India)</option>` + states.map(s => `<option value="${s}">${s}</option>`).join('');
    if (stateFilter) stateFilter.innerHTML = stateOptions;
    if (modalStateSelect) modalStateSelect.innerHTML = `<option value="">Select State</option>` + states.map(s => `<option value="${s}">${s}</option>`).join('');

    this.populateCityDropdown('all');
    this.updateLocationBadgeUI();
  },

  async populateCityDropdown(selectedState = 'all') {
    if (!window.LocationService) return;
    const cityFilter = document.getElementById('city-filter');
    const modalCitySelect = document.getElementById('modal-city-select');

    let citiesToUse = this.cities;
    if (selectedState && selectedState !== 'all') {
      citiesToUse = this.cities.filter(c => c.state.toLowerCase() === selectedState.toLowerCase());
    }

    const cityOptions = `<option value="all">All Cities</option>` + citiesToUse.map(c => `<option value="${c.city}">${c.city} (${c.district})</option>`).join('');
    if (cityFilter) cityFilter.innerHTML = cityOptions;
    if (modalCitySelect) modalCitySelect.innerHTML = `<option value="">Select City</option>` + citiesToUse.map(c => `<option value="${c.city}">${c.city} (${c.district})</option>`).join('');
  },

  updateLocationBadgeUI() {
    const badgeLabel = document.getElementById('active-location-label');
    const activePill = document.getElementById('location-active-badge-pill');
    const resetBtn = document.getElementById('btn-reset-location');

    const loc = this.activeLocation || { mode: 'all_india', label: 'All India' };

    if (badgeLabel) {
      badgeLabel.innerText = loc.label || 'All India';
    }

    if (resetBtn) {
      if (loc.mode === 'all_india') {
        resetBtn.classList.add('hidden');
      } else {
        resetBtn.classList.remove('hidden');
      }
    }

    if (activePill) {
      if (loc.mode === 'all_india') {
        activePill.innerHTML = `Showing verified doctors across <span class="text-sky-600 font-bold">India</span>`;
      } else if (loc.mode === 'nearby' && loc.radiusKm) {
        activePill.innerHTML = `Showing doctors within <span class="text-sky-600 font-bold">${loc.radiusKm} km</span> of your GPS location`;
      } else {
        activePill.innerHTML = `Showing verified doctors in <span class="text-sky-600 font-bold">${loc.city || loc.state || 'Selected Area'}</span>`;
      }
    }
  },

  async refreshData() {
    this.departments = await window.CarePulseDB.getDepartments();
    this.doctors = await window.CarePulseDB.getDoctors();

    const prevSelectedDept = document.querySelector('input[name="dept-filter"]:checked')?.value || 'all';
    this.renderDepartmentFilter(prevSelectedDept);
    this.applyFilters();
  },

  renderDepartmentFilter(selectedDept = 'all') {
    const filterContainer = document.getElementById('department-filter-options');
    if (!filterContainer) return;

    filterContainer.innerHTML = `
      <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition">
        <input type="radio" name="dept-filter" value="all" ${selectedDept === 'all' ? 'checked' : ''} class="text-sky-600 focus:ring-sky-500 rounded">
        <span class="text-sm font-medium text-slate-700">All Departments</span>
        <span class="ml-auto text-xs text-slate-400">(${this.doctors.length})</span>
      </label>
      ${this.departments.map(d => {
        const count = this.doctors.filter(doc => doc.department_id === d.id).length;
        return `
          <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition">
            <input type="radio" name="dept-filter" value="${d.id}" ${selectedDept === d.id ? 'checked' : ''} class="text-sky-600 focus:ring-sky-500 rounded">
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

    // Calculate live availability & location badges for each doctor
    const cardsWithAvail = await Promise.all(doctorsToRender.map(async (doc) => {
      let avail = { status: 'Available', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' };
      try {
        avail = await window.CarePulseDB.calculateDoctorAvailability(doc.id);
      } catch (e) {}

      // Calculate distance if user location is available
      let distanceBadge = '';
      if (this.userCoordinates && doc.latitude && doc.longitude && window.LocationService) {
        const distKm = window.LocationService.calculateDistance(
          this.userCoordinates.lat,
          this.userCoordinates.lng,
          Number(doc.latitude),
          Number(doc.longitude)
        );
        distanceBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <i data-lucide="navigation" class="w-3 h-3"></i> ${distKm} km away
          </span>
        `;
      }

      // Consultation mode badge
      const mode = doc.consultation_modes || 'both';
      let modeBadge = '';
      if (mode === 'in_person') {
        modeBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">🏥 Clinic Visit</span>`;
      } else if (mode === 'video') {
        modeBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">📹 Video Consult</span>`;
      } else {
        modeBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">🏥 Clinic & 📹 Video</span>`;
      }

      const docCity = doc.city_name || (doc.hospital_name && doc.hospital_name.includes('Yavatmal') ? 'Yavatmal' : 'Mumbai');

      return `
      <div class="bg-white rounded-3xl p-6 border border-slate-200 hover:border-sky-300 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
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
                ${distanceBadge}
                <span class="flex items-center gap-1 text-xs font-bold text-amber-500 ml-auto">
                  <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 stroke-amber-400"></i>
                  ${doc.rating || 5.0} (${doc.total_reviews || 0})
                </span>
              </div>

              <h3 class="text-lg font-bold text-slate-900 mt-1.5 truncate group-hover:text-sky-600 transition">
                <a href="doctor-profile.html?id=${doc.id}">${doc.full_name}</a>
              </h3>
              
              <p class="text-xs text-slate-500 truncate">${doc.qualification}</p>
              <p class="text-xs font-medium text-slate-600 mt-0.5">${doc.specialization}</p>

              <div class="mt-2 flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                  <i data-lucide="map-pin" class="w-3 h-3 text-sky-600"></i> ${docCity}
                </span>
                ${modeBadge}
              </div>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div class="flex items-center gap-1.5">
              <i data-lucide="briefcase" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>${doc.experience_years}+ Yrs Experience</span>
            </div>
            <div class="flex items-center gap-1.5 truncate">
              <i data-lucide="building-2" class="w-3.5 h-3.5 text-slate-400"></i>
              <span class="truncate">${doc.hospital_name || 'CarePulse Hospital'}</span>
            </div>
          </div>

          <p class="mt-3 text-xs text-slate-500 line-clamp-2">${doc.about || 'Dedicated medical consultant providing patient-centered healthcare evaluation.'}</p>
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

  applyFilters() {
    const searchInput = document.getElementById('doctor-search-input');
    const experienceFilter = document.getElementById('experience-filter');
    const stateFilter = document.getElementById('state-filter');
    const cityFilter = document.getElementById('city-filter');
    const radiusFilter = document.getElementById('radius-filter');
    const modeFilter = document.getElementById('mode-filter');

    const query = (searchInput?.value || '').toLowerCase().trim();
    const selectedDept = document.querySelector('input[name="dept-filter"]:checked')?.value || 'all';
    const minExp = parseInt(experienceFilter?.value || '0', 10);
    const selectedState = stateFilter?.value || 'all';
    const selectedCity = cityFilter?.value || 'all';
    const radiusKm = parseInt(radiusFilter?.value || '0', 10);
    const selectedMode = modeFilter?.value || 'all';

    let filtered = (this.doctors || []).filter(doc => {
      // Basic text search
      const matchesQuery = !query ||
        doc.full_name.toLowerCase().includes(query) ||
        doc.specialization.toLowerCase().includes(query) ||
        (doc.department_name && doc.department_name.toLowerCase().includes(query)) ||
        (doc.hospital_name && doc.hospital_name.toLowerCase().includes(query));

      const matchesDept = selectedDept === 'all' || doc.department_id === selectedDept;
      const matchesExp = (doc.experience_years || 0) >= minExp;

      // Consultation mode filter
      let matchesMode = true;
      if (selectedMode !== 'all') {
        const dMode = doc.consultation_modes || 'both';
        matchesMode = (dMode === 'both' || dMode === selectedMode);
      }

      // Location Filter (State & City)
      let matchesLocation = true;
      if (selectedCity !== 'all') {
        const cityLower = selectedCity.toLowerCase();
        matchesLocation =
          (doc.city_name && doc.city_name.toLowerCase() === cityLower) ||
          (doc.address && doc.address.toLowerCase().includes(cityLower)) ||
          (doc.hospital_name && doc.hospital_name.toLowerCase().includes(cityLower));
      } else if (selectedState !== 'all') {
        const stateLower = selectedState.toLowerCase();
        matchesLocation =
          (doc.state_name && doc.state_name.toLowerCase() === stateLower) ||
          (doc.address && doc.address.toLowerCase().includes(stateLower)) ||
          (doc.hospital_name && doc.hospital_name.toLowerCase().includes(stateLower));
      } else if (this.activeLocation && this.activeLocation.mode === 'city' && this.activeLocation.city) {
        const activeCity = this.activeLocation.city.toLowerCase();
        matchesLocation =
          (doc.city_name && doc.city_name.toLowerCase() === activeCity) ||
          (doc.address && doc.address.toLowerCase().includes(activeCity)) ||
          (doc.hospital_name && doc.hospital_name.toLowerCase().includes(activeCity));
      }

      return matchesQuery && matchesDept && matchesExp && matchesMode && matchesLocation;
    });

    // Nearby Geolocation distance radius filter (Module 1)
    if (radiusKm > 0 && this.userCoordinates && window.LocationService) {
      filtered = window.LocationService.filterNearby(
        filtered,
        this.userCoordinates.lat,
        this.userCoordinates.lng,
        radiusKm
      );
    }

    this.renderDoctorCards(filtered);
  },

  attachEvents() {
    const searchInput = document.getElementById('doctor-search-input');
    const filterContainer = document.getElementById('department-filter-options');
    const experienceFilter = document.getElementById('experience-filter');
    const stateFilter = document.getElementById('state-filter');
    const cityFilter = document.getElementById('city-filter');
    const radiusFilter = document.getElementById('radius-filter');
    const modeFilter = document.getElementById('mode-filter');

    const handleFilter = () => this.applyFilters();

    searchInput?.addEventListener('input', handleFilter);
    filterContainer?.addEventListener('change', handleFilter);
    experienceFilter?.addEventListener('change', handleFilter);
    modeFilter?.addEventListener('change', handleFilter);

    stateFilter?.addEventListener('change', async (e) => {
      const selectedState = e.target.value;
      await this.populateCityDropdown(selectedState);
      handleFilter();
    });

    cityFilter?.addEventListener('change', handleFilter);
    radiusFilter?.addEventListener('change', handleFilter);

    // Geolocation trigger button
    document.getElementById('btn-use-geolocation')?.addEventListener('click', () => {
      this.useDeviceGeolocation();
    });

    // Modal triggers
    document.getElementById('btn-open-location-modal')?.addEventListener('click', () => {
      this.openLocationModal();
    });

    document.getElementById('btn-reset-location')?.addEventListener('click', () => {
      this.resetLocation();
    });

    document.getElementById('modal-state-select')?.addEventListener('change', async (e) => {
      const selectedState = e.target.value;
      await this.populateCityDropdown(selectedState);
    });
  },

  openLocationModal() {
    const modal = document.getElementById('location-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  closeLocationModal() {
    const modal = document.getElementById('location-modal');
    if (modal) modal.classList.add('hidden');
  },

  async applyModalLocation() {
    const stateSelect = document.getElementById('modal-state-select');
    const citySelect = document.getElementById('modal-city-select');

    const state = stateSelect?.value || '';
    const city = citySelect?.value || '';

    if (!state && !city) {
      this.resetLocation();
      return;
    }

    if (window.LocationService) {
      const cityObj = await window.LocationService.getCityByName(city);
      window.LocationService.setActiveDiscoveryLocation({
        mode: 'city',
        label: city ? `${city}, ${state}` : state,
        state: state,
        city: city,
        lat: cityObj?.lat || null,
        lng: cityObj?.lng || null
      });
    }

    // Sync sidebar dropdowns
    const stateFilter = document.getElementById('state-filter');
    const cityFilter = document.getElementById('city-filter');
    if (stateFilter && state) stateFilter.value = state;
    if (cityFilter && city) {
      await this.populateCityDropdown(state);
      cityFilter.value = city;
    }

    this.closeLocationModal();
    this.applyFilters();
  },

  async useDeviceGeolocation() {
    if (!window.LocationService) return;

    const btn = document.getElementById('btn-use-geolocation');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Locating...`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const coords = await window.LocationService.getCurrentPosition();
      this.userCoordinates = coords;

      const nearest = await window.LocationService.getNearestCity(coords.lat, coords.lng);
      const label = nearest ? `Near ${nearest.city} (${nearest.state})` : `GPS (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`;

      window.LocationService.setActiveDiscoveryLocation({
        mode: 'nearby',
        label: label,
        state: nearest?.state || null,
        city: nearest?.city || null,
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: 50
      });

      // Default radius filter to 50km
      const radiusFilter = document.getElementById('radius-filter');
      if (radiusFilter) radiusFilter.value = '50';

      this.closeLocationModal();
      this.applyFilters();

      if (window.showToast) {
        window.showToast(`Location set to ${label}. Showing nearby specialists.`, 'success');
      }
    } catch (err) {
      alert(err.message || 'Unable to access your location. You can select your city manually.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Near Me`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  resetLocation() {
    if (window.LocationService) {
      window.LocationService.clearActiveDiscoveryLocation();
    }
    this.userCoordinates = null;
    this.activeLocation = { mode: 'all_india', label: 'All India' };

    const stateFilter = document.getElementById('state-filter');
    const cityFilter = document.getElementById('city-filter');
    const radiusFilter = document.getElementById('radius-filter');

    if (stateFilter) stateFilter.value = 'all';
    if (cityFilter) cityFilter.value = 'all';
    if (radiusFilter) radiusFilter.value = '0';

    this.closeLocationModal();
    this.updateLocationBadgeUI();
    this.applyFilters();

    if (window.showToast) {
      window.showToast('Reset to All India specialist search.', 'info');
    }
  }
};
