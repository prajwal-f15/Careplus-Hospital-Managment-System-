/**
 * ==============================================================================
 * CAREPULSE - HOSPITALS DIRECTORY CONTROLLER
 * All-India Hospital & Medical Center Discovery Engine (Modules 1, 3 & 5)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  const hospitalsContainer = document.getElementById('hospitals-container');
  const countLabel = document.getElementById('hospital-count-label');
  const searchInput = document.getElementById('hospital-search-input');
  const stateFilter = document.getElementById('state-filter');
  const cityFilter = document.getElementById('city-filter');
  const radiusFilter = document.getElementById('radius-filter');
  const typeFilter = document.getElementById('type-filter');
  const facilityFilter = document.getElementById('facility-filter');
  const activeLocationLabel = document.getElementById('active-location-label');
  const btnNearMe = document.getElementById('btn-use-geolocation');
  const btnOpenLocationModal = document.getElementById('btn-open-location-modal');
  const btnResetLocation = document.getElementById('btn-reset-location');

  // Location Modal Elements
  const locationModal = document.getElementById('location-modal');
  const btnCloseLocationModal = document.getElementById('btn-close-location-modal');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalApply = document.getElementById('btn-modal-apply');
  const modalStateSelect = document.getElementById('modal-state-select');
  const modalCitySelect = document.getElementById('modal-city-select');

  let allHospitals = [];

  // 1. Initialize State & City Dropdowns
  async function initLocationDropdowns() {
    if (!window.LocationService) return;
    const states = await window.LocationService.getStates();

    // Populate Sidebar State Filter
    stateFilter.innerHTML = '<option value="all">All States (India)</option>';
    states.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      stateFilter.appendChild(opt);
    });

    // Populate Modal State Select
    modalStateSelect.innerHTML = '<option value="">Select State</option>';
    states.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      modalStateSelect.appendChild(opt);
    });

    updateActiveLocationUI();
  }

  // Update Top Location Bar UI
  function updateActiveLocationUI() {
    const loc = window.LocationService ? window.LocationService.getActiveDiscoveryLocation() : null;
    if (loc && (loc.city || loc.isGeolocation)) {
      activeLocationLabel.textContent = loc.city 
        ? `${loc.city}, ${loc.state || 'India'}` 
        : `GPS (${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)})`;
      btnResetLocation.classList.remove('hidden');
    } else {
      activeLocationLabel.textContent = 'All India';
      btnResetLocation.classList.add('hidden');
    }
  }

  // 2. Fetch and Render Hospitals
  async function loadHospitals() {
    hospitalsContainer.innerHTML = '<div class="col-span-full text-center py-12 text-xs text-slate-400">Loading hospitals directory...</div>';

    const activeLoc = window.LocationService ? window.LocationService.getActiveDiscoveryLocation() : null;
    const stateVal = stateFilter.value;
    const cityVal = cityFilter.value;
    const typeVal = typeFilter.value;
    const facilityVal = facilityFilter.value;
    const radiusKm = parseInt(radiusFilter.value, 10) || 0;
    const query = searchInput.value.trim();

    try {
      allHospitals = await window.CarePulseDB.searchHospitalsByLocation({
        search: query,
        state: stateVal,
        city: cityVal,
        hospitalType: typeVal,
        facility: facilityVal,
        userLat: activeLoc?.latitude,
        userLng: activeLoc?.longitude,
        radiusKm: radiusKm
      });

      renderHospitalCards(allHospitals, activeLoc);
    } catch (err) {
      console.error('Error fetching hospitals:', err);
      hospitalsContainer.innerHTML = `<div class="col-span-full text-center py-12 text-xs text-rose-500 font-bold">Failed to load hospitals: ${err.message}</div>`;
    }
  }

  function renderHospitalCards(hospitals, activeLoc) {
    if (!hospitals || hospitals.length === 0) {
      countLabel.textContent = 'No matching hospitals found.';
      hospitalsContainer.innerHTML = `
        <div class="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <i data-lucide="building-2" class="w-6 h-6"></i>
          </div>
          <h3 class="font-bold text-slate-800 text-sm">No hospitals matched your search criteria</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto">Try widening your search radius, selecting 'All India', or exploring another city.</p>
          <button type="button" id="btn-clear-hosp-filters" class="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-sm transition">
            Reset All Filters
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      const clearBtn = document.getElementById('btn-clear-hosp-filters');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          stateFilter.value = 'all';
          cityFilter.value = 'all';
          radiusFilter.value = '0';
          typeFilter.value = 'all';
          facilityFilter.value = 'all';
          if (window.LocationService) window.LocationService.resetDiscoveryLocation();
          updateActiveLocationUI();
          loadHospitals();
        });
      }
      return;
    }

    countLabel.textContent = `Showing ${hospitals.length} verified hospital${hospitals.length === 1 ? '' : 's'}`;

    hospitalsContainer.innerHTML = hospitals.map(h => {
      let distanceBadge = '';
      if (activeLoc && activeLoc.latitude && activeLoc.longitude && h.latitude && h.longitude && window.LocationService) {
        const d = window.LocationService.calculateDistance(activeLoc.latitude, activeLoc.longitude, h.latitude, h.longitude);
        distanceBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
            <i data-lucide="navigation" class="w-3 h-3"></i> ${d} km away
          </span>
        `;
      }

      const facilitiesList = Array.isArray(h.facilities) ? h.facilities : (typeof h.facilities === 'string' ? JSON.parse(h.facilities || '[]') : []);

      return `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition group">
          <!-- Hospital Cover Image -->
          <div class="relative h-44 bg-slate-100 overflow-hidden">
            <img src="${h.cover_image || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800'}" alt="${h.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            
            <div class="absolute top-3 left-3 flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 backdrop-blur-sm shadow-sm">
                ${h.hospital_type || 'Super-specialty'}
              </span>
              ${h.verification_status === 'approved' ? `
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1 shadow-sm">
                  <i data-lucide="shield-check" class="w-3 h-3"></i> Verified
                </span>
              ` : ''}
            </div>

            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <span class="text-xs font-semibold flex items-center gap-1">
                <i data-lucide="bed" class="w-3.5 h-3.5"></i> ${h.total_beds || 100}+ Beds Capacity
              </span>
              ${distanceBadge}
            </div>
          </div>

          <!-- Hospital Body -->
          <div class="p-6 flex-grow flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <div class="flex items-start gap-3">
                <img src="${h.logo_url || 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'}" alt="${h.name}" class="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100 shadow-sm shrink-0">
                <div>
                  <h3 class="font-black text-base text-slate-900 group-hover:text-sky-600 transition leading-snug">
                    <a href="hospital-profile.html?id=${h.id}">${h.name}</a>
                  </h3>
                  <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> ${h.city_name || 'Mumbai'}, ${h.state_name || 'Maharashtra'} &bull; PIN: ${h.pincode || '400001'}
                  </p>
                </div>
              </div>

              <p class="text-xs text-slate-600 line-clamp-2 mt-2">
                ${h.address || 'Full address available on profile'}
              </p>

              <!-- Facilities Pills -->
              <div class="flex flex-wrap gap-1.5 pt-2">
                ${facilitiesList.slice(0, 4).map(f => `
                  <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700">
                    ${f}
                  </span>
                `).join('')}
                ${facilitiesList.length > 4 ? `
                  <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-50 text-slate-400 border border-slate-200">
                    +${facilitiesList.length - 4} more
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Contact & CTA Actions -->
            <div class="pt-4 border-t border-slate-100 space-y-3">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 flex items-center gap-1">
                  <i data-lucide="phone" class="w-3.5 h-3.5 text-slate-400"></i> ${h.phone || '+91 22 2600 0000'}
                </span>
                ${h.emergency_phone ? `
                  <span class="text-rose-600 font-bold flex items-center gap-1" title="24x7 Emergency Line">
                    <i data-lucide="ambulance" class="w-3.5 h-3.5"></i> ${h.emergency_phone}
                  </span>
                ` : ''}
              </div>

              <div class="grid grid-cols-2 gap-2">
                <a href="hospital-profile.html?id=${h.id}" class="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold text-center transition">
                  View Profile
                </a>
                <a href="doctors.html?hospitalId=${h.id}" class="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 text-xs font-bold text-center transition">
                  Explore Doctors
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // Event Listeners for Filters
  searchInput.addEventListener('input', () => {
    loadHospitals();
  });

  stateFilter.addEventListener('change', async () => {
    const st = stateFilter.value;
    cityFilter.innerHTML = '<option value="all">All Cities</option>';
    if (st !== 'all' && window.LocationService) {
      const cities = await window.LocationService.getCitiesByState(st);
      cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.city;
        opt.textContent = `${c.city} (${c.district})`;
        cityFilter.appendChild(opt);
      });
    }
    loadHospitals();
  });

  cityFilter.addEventListener('change', () => loadHospitals());
  radiusFilter.addEventListener('change', () => loadHospitals());
  typeFilter.addEventListener('change', () => loadHospitals());
  facilityFilter.addEventListener('change', () => loadHospitals());

  // Geolocation Button (Module 1)
  btnNearMe.addEventListener('click', async () => {
    if (!window.LocationService) return;
    btnNearMe.disabled = true;
    btnNearMe.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Locating...';
    if (window.lucide) window.lucide.createIcons();

    try {
      const pos = await window.LocationService.requestBrowserGeolocation();
      updateActiveLocationUI();
      if (radiusFilter.value === '0') radiusFilter.value = '50';
      await loadHospitals();
    } catch (err) {
      alert(`Location Access: ${err.message}. You can manually choose your state and city using the 'Change' button.`);
    } finally {
      btnNearMe.disabled = false;
      btnNearMe.innerHTML = '<i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Near Me';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Location Modal Listeners
  btnOpenLocationModal.addEventListener('click', () => {
    locationModal.classList.remove('hidden');
  });

  const closeLocationModal = () => locationModal.classList.add('hidden');
  btnCloseLocationModal.addEventListener('click', closeLocationModal);
  btnModalCancel.addEventListener('click', closeLocationModal);

  modalStateSelect.addEventListener('change', async () => {
    const st = modalStateSelect.value;
    modalCitySelect.innerHTML = '<option value="">Select City / District</option>';
    if (st && window.LocationService) {
      const cities = await window.LocationService.getCitiesByState(st);
      cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify(c);
        opt.textContent = `${c.city} (${c.district})`;
        modalCitySelect.appendChild(opt);
      });
      modalCitySelect.disabled = false;
    } else {
      modalCitySelect.disabled = true;
      btnModalApply.disabled = true;
    }
  });

  modalCitySelect.addEventListener('change', () => {
    btnModalApply.disabled = !modalCitySelect.value;
  });

  btnModalApply.addEventListener('click', () => {
    if (!modalCitySelect.value) return;
    const cityObj = JSON.parse(modalCitySelect.value);
    if (window.LocationService) {
      window.LocationService.setActiveDiscoveryLocation({
        city: cityObj.city,
        state: cityObj.state,
        district: cityObj.district,
        pincode: cityObj.pincode,
        latitude: cityObj.lat,
        longitude: cityObj.lng
      });
    }
    closeLocationModal();
    updateActiveLocationUI();
    stateFilter.value = cityObj.state || 'all';
    loadHospitals();
  });

  btnResetLocation.addEventListener('click', () => {
    if (window.LocationService) window.LocationService.resetDiscoveryLocation();
    updateActiveLocationUI();
    stateFilter.value = 'all';
    cityFilter.value = 'all';
    radiusFilter.value = '0';
    loadHospitals();
  });

  // Initialization
  await initLocationDropdowns();
  await loadHospitals();
});

