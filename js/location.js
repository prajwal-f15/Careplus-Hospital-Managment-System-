/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Location Directory & Geolocation Service (Module 1)
 * Supports All-India, State, District, City, and Nearby Radius Discovery
 * ==============================================================================
 */

(function (window) {
  'use strict';

  // Master Seed Dataset for All-India Medical Hubs & Districts (Offline + Fallback)
  const MASTER_CITIES = [
    // Maharashtra
    { id: '10000000-0000-0000-0000-000000000001', country: 'India', state: 'Maharashtra', district: 'Mumbai', city: 'Mumbai', pincode: '400001', lat: 18.9388, lng: 72.8354, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000002', country: 'India', state: 'Maharashtra', district: 'Pune', city: 'Pune', pincode: '411001', lat: 18.5204, lng: 73.8567, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000003', country: 'India', state: 'Maharashtra', district: 'Nagpur', city: 'Nagpur', pincode: '440001', lat: 21.1458, lng: 79.0882, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000004', country: 'India', state: 'Maharashtra', district: 'Yavatmal', city: 'Yavatmal', pincode: '445001', lat: 20.3888, lng: 78.1204, tier: 3 },
    { id: '10000000-0000-0000-0000-000000000005', country: 'India', state: 'Maharashtra', district: 'Amravati', city: 'Amravati', pincode: '444601', lat: 20.9320, lng: 77.7523, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000006', country: 'India', state: 'Maharashtra', district: 'Nashik', city: 'Nashik', pincode: '422001', lat: 19.9975, lng: 73.7898, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000007', country: 'India', state: 'Maharashtra', district: 'Chhatrapati Sambhajinagar', city: 'Aurangabad', pincode: '431001', lat: 19.8762, lng: 75.3433, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000008', country: 'India', state: 'Maharashtra', district: 'Thane', city: 'Thane', pincode: '400601', lat: 19.2183, lng: 72.9781, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000009', country: 'India', state: 'Maharashtra', district: 'Kolhapur', city: 'Kolhapur', pincode: '416001', lat: 16.7050, lng: 74.2433, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000010', country: 'India', state: 'Maharashtra', district: 'Solapur', city: 'Solapur', pincode: '413001', lat: 17.6599, lng: 75.9064, tier: 2 },

    // National Hubs
    { id: '10000000-0000-0000-0000-000000000011', country: 'India', state: 'Delhi', district: 'New Delhi', city: 'New Delhi', pincode: '110001', lat: 28.6139, lng: 77.2090, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000012', country: 'India', state: 'Karnataka', district: 'Bengaluru Urban', city: 'Bengaluru', pincode: '560001', lat: 12.9716, lng: 77.5946, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000013', country: 'India', state: 'Tamil Nadu', district: 'Chennai', city: 'Chennai', pincode: '600001', lat: 13.0827, lng: 80.2707, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000014', country: 'India', state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad', pincode: '500001', lat: 17.3850, lng: 78.4867, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000015', country: 'India', state: 'Gujarat', district: 'Ahmedabad', city: 'Ahmedabad', pincode: '380001', lat: 23.0225, lng: 72.5714, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000016', country: 'India', state: 'West Bengal', district: 'Kolkata', city: 'Kolkata', pincode: '700001', lat: 22.5726, lng: 88.3639, tier: 1 },
    { id: '10000000-0000-0000-0000-000000000017', country: 'India', state: 'Rajasthan', district: 'Jaipur', city: 'Jaipur', pincode: '302001', lat: 26.9124, lng: 75.7873, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000018', country: 'India', state: 'Uttar Pradesh', district: 'Lucknow', city: 'Lucknow', pincode: '226001', lat: 26.8467, lng: 80.9462, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000019', country: 'India', state: 'Madhya Pradesh', district: 'Indore', city: 'Indore', pincode: '452001', lat: 22.7196, lng: 75.8577, tier: 2 },
    { id: '10000000-0000-0000-0000-000000000020', country: 'India', state: 'Kerala', district: 'Ernakulam', city: 'Kochi', pincode: '682001', lat: 9.9312, lng: 76.2673, tier: 2 }
  ];

  const STORAGE_KEY = 'carepulse_discovery_location';

  const LocationService = {
    cachedCities: null,

    /**
     * Fetch all active cities (from Supabase or local seed cache)
     */
    async getCities(filters = {}) {
      if (this.cachedCities && !filters.forceRefresh) {
        return this._filterCities(this.cachedCities, filters);
      }

      try {
        const sb = window.CarePulseDB?.getClient?.();
        if (sb) {
          const { data, error } = await sb
            .from('cities')
            .select('*')
            .eq('is_active', true)
            .order('state_name', { ascending: true })
            .order('city_name', { ascending: true });

          if (!error && Array.isArray(data) && data.length > 0) {
            this.cachedCities = data.map(c => ({
              id: c.id,
              country: c.country || 'India',
              state: c.state_name,
              district: c.district_name,
              city: c.city_name,
              pincode: c.pincode,
              lat: Number(c.latitude),
              lng: Number(c.longitude),
              tier: c.tier || 2
            }));
            return this._filterCities(this.cachedCities, filters);
          }
        }
      } catch (e) {
        console.warn('Supabase cities query note:', e.message);
      }

      // Fallback to embedded seed dataset
      this.cachedCities = [...MASTER_CITIES];
      return this._filterCities(this.cachedCities, filters);
    },

    _filterCities(cities, filters) {
      let result = [...cities];
      if (filters.state) {
        const s = filters.state.toLowerCase();
        result = result.filter(c => c.state.toLowerCase() === s);
      }
      if (filters.district) {
        const d = filters.district.toLowerCase();
        result = result.filter(c => c.district.toLowerCase() === d);
      }
      if (filters.city) {
        const cityQuery = filters.city.toLowerCase();
        result = result.filter(c => c.city.toLowerCase() === cityQuery);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        result = result.filter(c =>
          c.city.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          (c.pincode && c.pincode.includes(q))
        );
      }
      return result;
    },

    /**
     * Get distinct list of states
     */
    async getStates() {
      const cities = await this.getCities();
      const states = Array.from(new Set(cities.map(c => c.state))).sort();
      return states;
    },

    /**
     * Get distinct districts for a state
     */
    async getDistricts(stateName) {
      const cities = await this.getCities({ state: stateName });
      const districts = Array.from(new Set(cities.map(c => c.district))).sort();
      return districts;
    },

    /**
     * Get cities in a district
     */
    async getCitiesByDistrict(districtName, stateName = null) {
      const filters = { district: districtName };
      if (stateName) filters.state = stateName;
      return await this.getCities(filters);
    },

    /**
     * Find city by ID
     */
    async getCityById(id) {
      const cities = await this.getCities();
      return cities.find(c => c.id === id) || null;
    },

    /**
     * Find city by Name
     */
    async getCityByName(name) {
      if (!name) return null;
      const cities = await this.getCities();
      const lower = name.trim().toLowerCase();
      return cities.find(c => c.city.toLowerCase() === lower || c.district.toLowerCase() === lower) || null;
    },

    /**
     * Calculate spherical distance between two coordinates using Haversine formula
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
      const R = 6371; // Earth radius in KM
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10; // 1 decimal place
    },

    /**
     * Request browser geolocation with user permission
     * Strictly requires explicit user interaction
     */
    async getCurrentPosition() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (err) => {
            let msg = 'Unable to access your location.';
            switch (err.code) {
              case err.PERMISSION_DENIED:
                msg = 'Location permission denied by user. You can select your city manually.';
                break;
              case err.POSITION_UNAVAILABLE:
                msg = 'Location information is currently unavailable.';
                break;
              case err.TIMEOUT:
                msg = 'Location request timed out. Please try again or select city manually.';
                break;
            }
            reject(new Error(msg));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      });
    },

    /**
     * Match nearest city from user coordinates
     */
    async getNearestCity(userLat, userLng) {
      const cities = await this.getCities();
      let nearest = null;
      let minDistance = Infinity;

      for (const c of cities) {
        if (c.lat && c.lng) {
          const dist = this.calculateDistance(userLat, userLng, c.lat, c.lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearest = { ...c, distanceKm: dist };
          }
        }
      }
      return nearest;
    },

    /**
     * Filter items by nearby distance radius (Doctors or Hospitals)
     * Items must contain lat and lng properties (or latitude/longitude)
     */
    filterNearby(items, userLat, userLng, radiusKm = 50) {
      if (!userLat || !userLng) return items;

      return items
        .map(item => {
          const itemLat = item.lat != null ? item.lat : (item.latitude != null ? Number(item.latitude) : null);
          const itemLng = item.lng != null ? item.lng : (item.longitude != null ? Number(item.longitude) : null);
          const distanceKm = this.calculateDistance(userLat, userLng, itemLat, itemLng);
          return {
            ...item,
            distanceKm
          };
        })
        .filter(item => item.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    },

    /**
     * Get active discovery location without modifying user profile address
     */
    getActiveDiscoveryLocation() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { mode: 'all_india', label: 'All India', state: null, district: null, city: null, lat: null, lng: null };
    },

    /**
     * Set active discovery location (persisted purely in browser localStorage)
     */
    setActiveDiscoveryLocation(loc) {
      try {
        const payload = {
          mode: loc.mode || 'city',
          label: loc.label || `${loc.city || ''}, ${loc.state || ''}`.trim().replace(/^,|,$/g, ''),
          state: loc.state || null,
          district: loc.district || null,
          city: loc.city || null,
          pincode: loc.pincode || null,
          lat: loc.lat || null,
          lng: loc.lng || null,
          radiusKm: loc.radiusKm || null,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('carepulse_location_changed', { detail: payload }));
        return payload;
      } catch (e) {
        console.warn('Unable to persist discovery location:', e);
        return loc;
      }
    },

    /**
     * Clear / Reset to All India
     */
    clearActiveDiscoveryLocation() {
      try {
        localStorage.removeItem(STORAGE_KEY);
        const payload = { mode: 'all_india', label: 'All India', state: null, district: null, city: null, lat: null, lng: null };
        window.dispatchEvent(new CustomEvent('carepulse_location_changed', { detail: payload }));
        return payload;
      } catch (e) {
        return null;
      }
    }
  };

  window.LocationService = LocationService;

})(window);

