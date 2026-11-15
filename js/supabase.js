/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * 100% Realtime Supabase Database & Service Engine
 * ==============================================================================
 */

// Supabase Client Initialization
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const config = window.SUPABASE_CONFIG || {};
  const url = (config.url && config.url.trim()) || localStorage.getItem('carepulse_supabase_url');
  const key = (config.anonKey && config.anonKey.trim()) || localStorage.getItem('carepulse_supabase_anon_key');

  if (url && key && url.startsWith('http') && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log('⚡ Connected to Realtime Supabase Project:', url);
    } catch (err) {
      console.error('Error creating Supabase client:', err);
    }
  }
  return supabaseClient;
}

window.CarePulseDB = {
  getClient() {
    return getSupabaseClient();
  },

  isLiveSupabase() {
    return !!getSupabaseClient();
  },

  getCredentials() {
    const config = window.SUPABASE_CONFIG || {};
    return {
      url: config.url || localStorage.getItem('carepulse_supabase_url') || '',
      key: config.anonKey || localStorage.getItem('carepulse_supabase_anon_key') || ''
    };
  },

  saveCredentials(url, key) {
    if (url && key) {
      localStorage.setItem('carepulse_supabase_url', url.trim());
      localStorage.setItem('carepulse_supabase_anon_key', key.trim());
      if (window.SUPABASE_CONFIG) {
        window.SUPABASE_CONFIG.url = url.trim();
        window.SUPABASE_CONFIG.anonKey = key.trim();
      }
      supabaseClient = null;
      return true;
    }
    return false;
  },

  // ============================================================================
  // 1. DEPARTMENTS
  // ============================================================================
  async getDepartments() {
    const sb = getSupabaseClient();
    const CORE_DEPARTMENTS = [
      {
        id: 'd1111111-1111-1111-1111-111111111111',
        name: 'Cardiology',
        code: 'CARD',
        description: 'Comprehensive heart and cardiovascular care with modern diagnostic labs.',
        icon: 'heart',
        room_number: 'Wing A - Room 101'
      },
      {
        id: 'd2222222-2222-2222-2222-222222222222',
        name: 'Neurology',
        code: 'NEUR',
        description: 'Advanced diagnosis and treatment for brain, spine, and nerve disorders.',
        icon: 'brain',
        room_number: 'Wing B - Room 204'
      },
      {
        id: 'd3333333-3333-3333-3333-333333333333',
        name: 'Orthopedics',
        code: 'ORTH',
        description: 'Joint replacement, fracture care, and musculoskeletal rehabilitation.',
        icon: 'bone',
        room_number: 'Wing C - Room 105'
      },
      {
        id: 'd4444444-4444-4444-4444-444444444444',
        name: 'Dermatology',
        code: 'DERM',
        description: 'Clinical skin treatments, acne care, and cosmetic dermatology.',
        icon: 'sparkles',
        room_number: 'Wing A - Room 302'
      },
      {
        id: 'd5555555-5555-5555-5555-555555555555',
        name: 'Pediatrics',
        code: 'PED',
        description: 'Compassionate pediatric healthcare and developmental wellness for children.',
        icon: 'baby',
        room_number: 'Wing D - Room 108'
      },
      {
        id: 'd6666666-6666-6666-6666-666666666666',
        name: 'General Medicine',
        code: 'GEN',
        description: 'Primary healthcare, preventive wellness, and infectious disease management.',
        icon: 'stethoscope',
        room_number: 'Wing B - Room 102'
      },
      {
        id: 'd7777777-7777-7777-7777-777777777777',
        name: 'Dentistry',
        code: 'DENT',
        description: 'Complete oral health, root canals, orthodontics, and smile design.',
        icon: 'smile',
        room_number: 'Wing C - Room 205'
      },
      {
        id: 'd8888888-8888-8888-8888-888888888888',
        name: 'Ophthalmology',
        code: 'OPHT',
        description: 'Eye care, laser vision correction, cataract surgery, and retinal care.',
        icon: 'eye',
        room_number: 'Wing A - Room 208'
      }
    ];

    if (!sb) return CORE_DEPARTMENTS;
    try {
      const { data, error } = await sb
        .from('departments')
        .select('*')
        .order('name', { ascending: true });
      if (error || !data || data.length === 0) {
        if (error) console.warn('getDepartments note:', error.message || error);
        return CORE_DEPARTMENTS;
      }
      return data;
    } catch (err) {
      console.warn('getDepartments error, using core fallback:', err);
      return CORE_DEPARTMENTS;
    }
  },

  async getDepartmentById(id) {
    const sb = getSupabaseClient();
    const depts = await this.getDepartments();
    const localMatch = depts.find(d => d.id === id);
    if (!sb) return localMatch || null;
    try {
      const { data, error } = await sb
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        return localMatch || null;
      }
      return data;
    } catch (err) {
      return localMatch || null;
    }
  },

  async addDepartment(deptData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const { data, error } = await sb
      .from('departments')
      .insert([{
        name: deptData.name,
        code: deptData.code.toUpperCase(),
        description: deptData.description,
        icon: deptData.icon || 'activity',
        room_number: deptData.room_number || 'Wing A'
      }])
      .select()
      .single();
    if (error) throw error;
    this.emitSyncEvent('departments');
    return data;
  },

  async deleteDepartment(departmentId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const { error } = await sb
      .from('departments')
      .delete()
      .eq('id', departmentId);
    if (error) throw error;
    this.emitSyncEvent('departments');
    return true;
  },

  async updateDepartment(departmentId, deptData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const updatePayload = {
      name: deptData.name,
      code: deptData.code ? deptData.code.toUpperCase() : undefined,
      description: deptData.description,
      icon: deptData.icon || 'activity',
      room_number: deptData.room_number || 'Wing A'
    };
    Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

    const { data, error } = await sb
      .from('departments')
      .update(updatePayload)
      .eq('id', departmentId)
      .select()
      .single();
    if (error) throw error;
    this.emitSyncEvent('departments');
    return data;
  },

  // ============================================================================
  // 2. DOCTORS & SPECIALISTS
  // ============================================================================
  async getDoctors(filters = {}) {
    const sb = getSupabaseClient();
    const CORE_DOCTORS = [
      {
        id: 'd0c11111-1111-1111-1111-111111111111',
        profile_id: '11111111-1111-1111-1111-111111111111',
        full_name: 'Dr. Rahul Sharma',
        email: 'rahul.sharma@hospital.com',
        phone: '+91 9876500002',
        gender: 'Male',
        specialization: 'Senior Cardiologist',
        qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
        experience_years: 15,
        department_id: 'd1111111-1111-1111-1111-111111111111',
        department_name: 'Cardiology',
        department_code: 'CARD',
        room_number: 'Wing A, OPD 102',
        consultation_fee: 75.00,
        rating: 4.9,
        total_reviews: 42,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2010-0442',
        registration_year: 2010,
        consultation_modes: 'both',
        city_name: 'Mumbai',
        profile_image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400'
      },
      {
        id: 'd0c22222-2222-2222-2222-222222222222',
        profile_id: '22222222-2222-2222-2222-222222222222',
        full_name: 'Dr. Priya Patel',
        email: 'priya.patel@hospital.com',
        phone: '+91 9876500004',
        gender: 'Female',
        specialization: 'Consultant Neurologist',
        qualification: 'MBBS, MD, DM (Neurology)',
        experience_years: 12,
        department_id: 'd2222222-2222-2222-2222-222222222222',
        department_name: 'Neurology',
        department_code: 'NEUR',
        room_number: 'Wing B, Room 204',
        consultation_fee: 80.00,
        rating: 4.8,
        total_reviews: 38,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2012-0881',
        registration_year: 2012,
        consultation_modes: 'both',
        city_name: 'Pune',
        profile_image: 'https://images.unsplash.com/photo-1594824813629-456cb04c3547?w=400'
      },
      {
        id: 'd0c33333-3333-3333-3333-333333333333',
        profile_id: '33333333-3333-3333-3333-333333333333',
        full_name: 'Dr. Vikram Sethi',
        email: 'vikram.sethi@hospital.com',
        phone: '+91 9876500005',
        gender: 'Male',
        specialization: 'Orthopedic Surgeon',
        qualification: 'MBBS, MS (Ortho), M.Ch',
        experience_years: 14,
        department_id: 'd3333333-3333-3333-3333-333333333333',
        department_name: 'Orthopedics',
        department_code: 'ORTH',
        room_number: 'Wing C, Room 301',
        consultation_fee: 70.00,
        rating: 4.7,
        total_reviews: 29,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2011-0329',
        registration_year: 2011,
        consultation_modes: 'in_person',
        city_name: 'Nagpur',
        profile_image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400'
      },
      {
        id: 'd0c44444-4444-4444-4444-444444444444',
        profile_id: '44444444-4444-4444-4444-444444444444',
        full_name: 'Dr. Anand Deshpande',
        email: 'anand.deshpande@carepulse.local',
        phone: '+91 94221 99887',
        gender: 'Male',
        specialization: 'Consultant Interventional Cardiologist',
        qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
        experience_years: 12,
        department_id: 'd1111111-1111-1111-1111-111111111111',
        department_name: 'Cardiology',
        department_code: 'CARD',
        room_number: 'OPD Block 1, Room 104',
        consultation_fee: 60.00,
        rating: 4.9,
        total_reviews: 18,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2012-0941',
        registration_year: 2012,
        consultation_modes: 'both',
        city_name: 'Yavatmal',
        profile_image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400'
      },
      {
        id: 'd0c55555-5555-5555-5555-555555555555',
        profile_id: '55555555-5555-5555-5555-555555555555',
        full_name: 'Dr. Ananya Roy',
        email: 'ananya.roy@hospital.com',
        phone: '+91 9876500006',
        gender: 'Female',
        specialization: 'Consultant Dermatologist',
        qualification: 'MBBS, MD (Dermatology)',
        experience_years: 9,
        department_id: 'd4444444-4444-4444-4444-444444444444',
        department_name: 'Dermatology',
        department_code: 'DERM',
        room_number: 'Wing A, Room 302',
        consultation_fee: 55.00,
        rating: 4.8,
        total_reviews: 31,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2015-0612',
        registration_year: 2015,
        consultation_modes: 'both',
        city_name: 'Mumbai',
        profile_image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400'
      },
      {
        id: 'd0c66666-6666-6666-6666-666666666666',
        profile_id: '66666666-6666-6666-6666-666666666666',
        full_name: 'Dr. Aris Thorne',
        email: 'aris.thorne@hospital.com',
        phone: '+91 9876500007',
        gender: 'Male',
        specialization: 'Lead Pediatrician',
        qualification: 'MBBS, MD (Pediatrics), DNB',
        experience_years: 12,
        department_id: 'd5555555-5555-5555-5555-555555555555',
        department_name: 'Pediatrics',
        department_code: 'PED',
        room_number: 'Wing D, Room 108',
        consultation_fee: 50.00,
        rating: 4.9,
        total_reviews: 47,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2013-0491',
        registration_year: 2013,
        consultation_modes: 'both',
        city_name: 'Pune',
        profile_image: 'https://images.unsplash.com/photo-1622902046580-2b47f47f5471?w=400'
      },
      {
        id: 'd0c77777-7777-7777-7777-777777777777',
        profile_id: '77777777-7777-7777-7777-777777777777',
        full_name: 'Dr. Meera Joshi',
        email: 'meera.joshi@carepulse.local',
        phone: '+91 94221 88776',
        gender: 'Female',
        specialization: 'Senior Consultant Physician',
        qualification: 'MBBS, MD (General Medicine)',
        experience_years: 16,
        department_id: 'd6666666-6666-6666-6666-666666666666',
        department_name: 'General Medicine',
        department_code: 'GEN',
        room_number: 'Wing B, Room 102',
        consultation_fee: 45.00,
        rating: 4.8,
        total_reviews: 26,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2009-0211',
        registration_year: 2009,
        consultation_modes: 'in_person',
        city_name: 'Yavatmal',
        profile_image: 'https://images.unsplash.com/photo-1594824813629-456cb04c3547?w=400'
      },
      {
        id: 'd0c88888-8888-8888-8888-888888888888',
        profile_id: '88888888-8888-8888-8888-888888888888',
        full_name: 'Dr. Sneha Kulkarni',
        email: 'sneha.kulkarni@carepulse.local',
        phone: '+91 98221 66554',
        gender: 'Female',
        specialization: 'Chief Dental Surgeon',
        qualification: 'BDS, MDS (Conservative Dentistry)',
        experience_years: 10,
        department_id: 'd7777777-7777-7777-7777-777777777777',
        department_name: 'Dentistry',
        department_code: 'DENT',
        room_number: 'Wing C, Room 205',
        consultation_fee: 40.00,
        rating: 4.7,
        total_reviews: 19,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Dental Council',
        medical_registration_number: 'MDC-2014-0732',
        registration_year: 2014,
        consultation_modes: 'in_person',
        city_name: 'Nagpur',
        profile_image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400'
      },
      {
        id: 'd0c99999-9999-9999-9999-999999999999',
        profile_id: '99999999-9999-9999-9999-999999999999',
        full_name: 'Dr. Amit Bansal',
        email: 'amit.bansal@hospital.com',
        phone: '+91 9876500008',
        gender: 'Male',
        specialization: 'Consultant Ophthalmologist',
        qualification: 'MBBS, MS (Ophthalmology)',
        experience_years: 13,
        department_id: 'd8888888-8888-8888-8888-888888888888',
        department_name: 'Ophthalmology',
        department_code: 'OPHT',
        room_number: 'Wing A, Room 208',
        consultation_fee: 55.00,
        rating: 4.8,
        total_reviews: 33,
        is_verified: true,
        verification_status: 'approved',
        is_available_today: true,
        is_active: true,
        medical_council_name: 'Maharashtra Medical Council',
        medical_registration_number: 'MMC-2011-0520',
        registration_year: 2011,
        consultation_modes: 'both',
        city_name: 'Mumbai',
        profile_image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400'
      }
    ];

    if (!sb) {
      return filters.includeUnapproved ? CORE_DOCTORS : CORE_DOCTORS.filter(d => (d.verification_status || 'approved') === 'approved' && d.is_active !== false);
    }

    try {
      // 1. Fetch doctors joined with profiles and departments
      let query = sb
        .from('doctors')
        .select(`
          *,
          profiles (
            id,
            full_name,
            email,
            phone,
            profile_image,
            gender
          ),
          departments (
            id,
            name,
            code,
            room_number
          )
        `);

      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }
      if (filters.availableToday !== undefined) {
        query = query.eq('is_available_today', filters.availableToday);
      }

      const { data: docData, error: docError } = await query.order('created_at', { ascending: false });
      
      let list = [];
      if (!docError && docData) {
        list = docData.map(d => ({
          ...d,
          full_name: d.profiles?.full_name || 'Dr. Specialist',
          email: d.profiles?.email || '',
          phone: d.profiles?.phone || '',
          gender: d.profiles?.gender || 'Other',
          profile_image: d.profiles?.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400',
          department_name: d.departments?.name || 'General Medicine',
          department_code: d.departments?.code || 'GEN'
        }));
      }

      // 2. Cross-check with 'profiles' table for any doctors missing from 'doctors' table
      const { data: doctorProfiles } = await sb
        .from('profiles')
        .select('*')
        .eq('role', 'doctor');

      if (doctorProfiles && doctorProfiles.length > 0) {
        const existingProfileIds = new Set(list.map(d => d.profile_id));
        for (const p of doctorProfiles) {
          if (!existingProfileIds.has(p.id)) {
            // Missing doctor record - create an in-memory entry and persist to database
            const fallbackDoc = {
              id: p.id,
              profile_id: p.id,
              full_name: p.full_name,
              email: p.email,
              phone: p.phone || '',
              gender: p.gender || 'Other',
              profile_image: p.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400',
              specialization: 'Medical Specialist',
              qualification: 'MBBS, MD',
              experience_years: 5,
              department_name: 'General Medicine',
              department_code: 'GEN',
              rating: 5.0,
              total_reviews: 0,
              is_verified: true,
              is_available_today: true
            };
            list.push(fallbackDoc);

            // Silently try to insert into doctors table for future queries
            sb.from('doctors').insert([{
              profile_id: p.id,
              specialization: 'Medical Specialist',
              qualification: 'MBBS, MD',
              experience_years: 5,
              is_verified: true,
              is_available_today: true
            }]).then(() => {}).catch(() => {});
          }
        }
      }

      if (!filters.includeUnapproved) {
        list = list.filter(d => (d.verification_status || 'approved') === 'approved' && d.is_active !== false);
      }

      return list;
    } catch (err) {
      console.error('getDoctors error:', err);
      return [];
    }
  },

  async getDoctorById(id) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('doctors')
        .select(`
          *,
          profiles (
            id,
            full_name,
            email,
            phone,
            profile_image,
            gender
          ),
          departments (
            id,
            name,
            code,
            room_number
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        // Check if id is a profile id
        const docByProfile = await this.getDoctorByProfileId(id);
        if (docByProfile) return docByProfile;
        return null;
      }

      return {
        ...data,
        full_name: data.profiles?.full_name || 'Dr. Specialist',
        email: data.profiles?.email || '',
        phone: data.profiles?.phone || '',
        gender: data.profiles?.gender || 'Other',
        profile_image: data.profiles?.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400',
        department_name: data.departments?.name || 'General Medicine',
        department_code: data.departments?.code || 'GEN'
      };
    } catch (e) {
      console.error('getDoctorById error:', e);
      return null;
    }
  },

  async getDoctorByProfileId(profileId) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('doctors')
      .select('*, departments(name, code)')
      .eq('profile_id', profileId)
      .single();
    if (error) return null;
    return data;
  },

  async addDoctor(docData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    // First insert profile if profile_id not supplied
    let profileId = docData.profile_id;
    if (!profileId) {
      // In real supabase, profile is created via signup, but fallback if added via admin:
      profileId = docData.auth_id || crypto.randomUUID();
      const { error: pErr } = await sb.from('profiles').insert([{
        id: profileId,
        full_name: docData.full_name,
        email: docData.email,
        phone: docData.phone || '',
        role: 'doctor',
        gender: docData.gender || 'Other',
        profile_image: docData.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400'
      }]);
      if (pErr) console.warn('Profile create note:', pErr.message);
    }

    const { data: newDoc, error: dErr } = await sb.from('doctors').insert([{
      profile_id: profileId,
      department_id: docData.department_id,
      specialization: docData.specialization,
      qualification: docData.qualification,
      experience_years: parseInt(docData.experience_years, 10) || 0,
      hospital_name: docData.hospital_name || 'CarePulse Central Hospital',
      room_number: docData.room_number || 'Room 101',
      consultation_fee: parseFloat(docData.consultation_fee) || 50.00,
      about: docData.about || '',
      is_verified: true,
      is_available_today: true
    }]).select().single();

    if (dErr) throw dErr;

    // Insert standard weekly schedules
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const schedules = days.map(day => ({
      doctor_id: newDoc.id,
      day_of_week: day,
      start_time: '09:00',
      end_time: '14:00',
      slot_duration_minutes: 30,
      is_available: true
    }));
    await sb.from('doctor_availability').insert(schedules);

    this.emitSyncEvent('doctors');
    this.emitSyncEvent('doctor_availability');
    return newDoc;
  },

  async updateDoctor(doctorId, docData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    try {
      // Split fields across 'profiles' and 'doctors' tables to prevent schema mismatch (PGRST204)
      const profileKeys = ['full_name', 'phone', 'profile_image', 'email', 'gender', 'address'];
      const doctorKeys = [
        'department_id', 'specialization', 'qualification', 'experience_years',
        'hospital_name', 'room_number', 'consultation_fee', 'about', 'rating',
        'total_reviews', 'is_verified', 'is_active', 'is_available_today',
        'delay_minutes', 'delay_reason', 'delay_reported_at', 'live_opd_status'
      ];

      const profileUpdates = {};
      for (const k of profileKeys) {
        if (docData[k] !== undefined) {
          profileUpdates[k] = docData[k];
        }
      }

      const doctorUpdates = {};
      for (const k of doctorKeys) {
        if (docData[k] !== undefined) {
          if (k === 'department_id' && docData[k] === '') continue;
          doctorUpdates[k] = docData[k];
        }
      }

      const nowIso = new Date().toISOString();

      // 1. Resolve existing doctor row (by doctor.id OR profile_id)
      let existingDoc = null;
      const { data: byId } = await sb
        .from('doctors')
        .select('*')
        .eq('id', doctorId)
        .maybeSingle();

      if (byId) {
        existingDoc = byId;
      } else {
        const { data: byProf } = await sb
          .from('doctors')
          .select('*')
          .eq('profile_id', doctorId)
          .maybeSingle();
        if (byProf) existingDoc = byProf;
      }

      const targetDoctorId = existingDoc ? existingDoc.id : null;
      const targetProfileId = existingDoc ? existingDoc.profile_id : doctorId;

      // 2. Update linked 'profiles' row when profile fields are present
      let updatedProfile = null;
      if (Object.keys(profileUpdates).length > 0 && targetProfileId) {
        profileUpdates.updated_at = nowIso;
        const { data: pData, error: pErr } = await sb
          .from('profiles')
          .update(profileUpdates)
          .eq('id', targetProfileId)
          .select()
          .maybeSingle();
        if (pErr) throw pErr;
        updatedProfile = pData;
      }

      // 3. Update or upsert 'doctors' row when doctor fields are present
      let updatedDoctor = existingDoc;
      if (Object.keys(doctorUpdates).length > 0) {
        doctorUpdates.updated_at = nowIso;
        if (targetDoctorId) {
          const { data: dData, error: dErr } = await sb
            .from('doctors')
            .update(doctorUpdates)
            .eq('id', targetDoctorId)
            .select()
            .maybeSingle();
          if (dErr) throw dErr;
          updatedDoctor = dData;
        } else {
          const { data: upsertData, error: uErr } = await sb
            .from('doctors')
            .upsert({
              profile_id: targetProfileId,
              ...doctorUpdates
            }, { onConflict: 'profile_id' })
            .select()
            .maybeSingle();
          if (uErr) throw uErr;
          updatedDoctor = upsertData;
        }
      }

      this.emitSyncEvent('doctors');
      return {
        ...(updatedDoctor || {}),
        ...(updatedProfile ? {
          full_name: updatedProfile.full_name,
          phone: updatedProfile.phone,
          email: updatedProfile.email,
          profile_image: updatedProfile.profile_image
        } : {})
      };
    } catch (err) {
      console.error('updateDoctor error:', err);
      throw err;
    }
  },

  async deleteDoctor(doctorId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const { error } = await sb
      .from('doctors')
      .delete()
      .eq('id', doctorId);
    if (error) throw error;
    this.emitSyncEvent('doctors');
    return true;
  },

  // ============================================================================
  // 3. DOCTOR AVAILABILITY & SLOTS
  // ============================================================================
  async getDoctorAvailability(doctorId) {
    const sb = getSupabaseClient();
    if (!sb) return [];

    try {
      // 1. Resolve actual doctor id if profile_id was passed
      let cleanDocId = doctorId;
      if (typeof cleanDocId === 'string') cleanDocId = cleanDocId.trim().toLowerCase().replace(/[^0-9a-f-]/g, '0');
      let targetDoctorId = cleanDocId;

      if (cleanDocId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanDocId)) {
        const { data: doc } = await sb
          .from('doctors')
          .select('id')
          .or(`id.eq.${cleanDocId},profile_id.eq.${cleanDocId}`)
          .maybeSingle();

        if (doc) {
          targetDoctorId = doc.id;
        }
      }

      const { data, error } = await sb
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', targetDoctorId);

      if (error) {
        console.warn('getDoctorAvailability note:', error.message);
        return [];
      }

      // If empty in DB, return standard default weekday availability
      if (!data || data.length === 0) {
        const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        return defaultDays.map(d => ({
          doctor_id: targetDoctorId,
          day_of_week: d,
          start_time: '09:00',
          end_time: '17:00',
          slot_duration_minutes: 30,
          is_available: true
        }));
      }

      return data;
    } catch (err) {
      console.warn('getDoctorAvailability error:', err);
      return [];
    }
  },

  async saveDoctorAvailability(doctorId, schedules) {
    return this.updateDoctorAvailability(doctorId, schedules);
  },

  async updateDoctorAvailability(doctorId, schedules) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    try {
      // 1. Resolve actual doctor id if profile_id was passed
      let targetDoctorId = doctorId;
      const { data: doc } = await sb
        .from('doctors')
        .select('id')
        .or(`id.eq.${doctorId},profile_id.eq.${doctorId}`)
        .maybeSingle();

      if (doc) {
        targetDoctorId = doc.id;
      }

      // 2. Remove existing schedules
      await sb.from('doctor_availability').delete().eq('doctor_id', targetDoctorId);

      // 3. Insert updated schedules
      if (schedules && schedules.length > 0) {
        const rowsToInsert = schedules.map(s => ({
          doctor_id: targetDoctorId,
          day_of_week: s.day_of_week,
          start_time: s.start_time || '09:00',
          end_time: s.end_time || '17:00',
          slot_duration_minutes: s.slot_duration_minutes || 30,
          is_available: s.is_available !== false
        }));

        const { data, error } = await sb
          .from('doctor_availability')
          .insert(rowsToInsert)
          .select();

        if (error) {
          console.warn('doctor_availability insert error:', error.message);
          throw error;
        }
        this.emitSyncEvent('doctor_availability');
        return data;
      }

      this.emitSyncEvent('doctor_availability');
      return [];
    } catch (err) {
      console.error('saveDoctorAvailability error:', err);
      throw err;
    }
  },

  async getAvailableSlots(doctorId, dateString) {
    const targetDate = new Date(dateString + 'T00:00:00');
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = daysMap[targetDate.getDay()];

    const sb = getSupabaseClient();
    if (!sb) return [];

    // Get doctor availability schedule
    const { data: availList } = await sb
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', dayName)
      .eq('is_available', true);

    if (!availList || availList.length === 0) return [];

    const schedule = availList[0];
    const duration = schedule.slot_duration_minutes || 30;

    // Generate slots
    const slots = [];
    const [startH, startM] = schedule.start_time.split(':').map(Number);
    const [endH, endM] = schedule.end_time.split(':').map(Number);

    let currMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currMinutes + duration <= endMinutes) {
      const h = Math.floor(currMinutes / 60);
      const m = currMinutes % 60;
      const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(formatted);
      currMinutes += duration;
    }

    // Get existing bookings on that date for this doctor to filter out occupied slots
    const bookedTimes = new Set();
    try {
      const { data: bookedAppointments } = await sb
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', dateString)
        .not('status', 'in', '("cancelled","rejected")');

      (bookedAppointments || []).forEach(a => {
        const t = a.time_slot || a.appointment_time;
        if (t && typeof t === 'string') {
          bookedTimes.add(t.substring(0, 5));
        }
      });
    } catch (e) {
      console.warn('Error fetching booked slots:', e);
    }

    return slots.map(slot => ({
      time: slot,
      display: this.formatTime12Hour(slot),
      available: !bookedTimes.has(slot)
    }));
  },

  // ============================================================================
  // 4. APPOINTMENTS & REALTIME QUEUE
  // ============================================================================
  async getAppointments(filters = {}) {
    const sb = getSupabaseClient();
    if (!sb) return [];

    let query = sb
      .from('appointments')
    try {
      let query = sb
        .from('appointments')
        .select(`
          *,
          profiles (
            id, full_name, email, phone, gender, date_of_birth, blood_group
          ),
          doctors (
            id, specialization, room_number, consultation_fee,
            profiles (full_name, profile_image)
          ),
          departments (
            id, name, code, room_number
          )
        `);

      if (filters.patientId) {
        let pId = filters.patientId;
        if (typeof pId === 'string') pId = pId.trim().toLowerCase().replace(/[^0-9a-f-]/g, '0');
        query = query.eq('patient_id', pId);
      }
      if (filters.doctorId) {
        let dId = filters.doctorId;
        if (typeof dId === 'string') dId = dId.trim().toLowerCase().replace(/[^0-9a-f-]/g, '0');
        query = query.eq('doctor_id', dId);
      }
      if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.date) query = query.eq('appointment_date', filters.date);

      const { data, error } = await query.order('appointment_date', { ascending: false });

      if (error) {
        console.warn('getAppointments error, trying direct query:', error.message);
        const { data: rawData } = await sb.from('appointments').select('*').order('appointment_date', { ascending: false });
        return (rawData || []).map(a => ({
          ...a,
          appointment_time: a.time_slot || a.appointment_time || '09:00',
          time_slot: a.time_slot || a.appointment_time || '09:00',
          patient_name: 'Patient',
          doctor_name: 'Dr. Specialist',
          department_name: 'General Medicine',
          room_number: 'Room 101'
        }));
      }

      return (data || []).map(a => ({
        ...a,
        appointment_time: a.time_slot || a.appointment_time || '09:00',
        time_slot: a.time_slot || a.appointment_time || '09:00',
        patient_name: a.profiles?.full_name || 'Patient',
        patient_email: a.profiles?.email || '',
        patient_phone: a.profiles?.phone || '',
        patient_gender: a.profiles?.gender || '',
        patient_dob: a.profiles?.date_of_birth || '',
        patient_blood: a.profiles?.blood_group || '',
        doctor_name: a.doctors?.profiles?.full_name || 'Dr. Specialist',
        doctor_image: a.doctors?.profiles?.profile_image || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400',
        doctor_specialization: a.doctors?.specialization || 'Medical Specialist',
        doctor_fee: a.doctors?.consultation_fee || 50,
        department_name: a.departments?.name || 'General Medicine',
        department_code: a.departments?.code || 'GEN',
        room_number: a.doctors?.room_number || a.departments?.room_number || 'Room 101'
      }));
    } catch (err) {
      console.error('getAppointments general error:', err);
      return [];
    }
  },

  async getAppointmentById(id) {
    const list = await this.getAppointments();
    return list.find(a => a.id === id) || null;
  },

  async createAppointment(payload) {
    return this.bookAppointment(payload);
  },

  async bookAppointment({
    patient_id,
    doctor_id,
    department_id,
    appointment_date,
    time_slot,
    appointment_time,
    reason,
    symptoms,
    priority = 'normal',
    status = 'pending',
    hospital_id = null,
    referral_id = null
  }) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const initialStatus = status || 'pending';
    const cleanTime = (time_slot || appointment_time || '09:00').substring(0, 5);

    // Normalize and sanitize UUID helper (PostgreSQL requires hex 0-9, a-f)
    const toValidHexUUID = (id, fallback = null) => {
      if (!id || typeof id !== 'string') return fallback;
      let clean = id.trim().toLowerCase().replace(/[^0-9a-f-]/g, '0');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(clean)) {
        return fallback;
      }
      return clean;
    };

    // 1. Resolve actual patient record & ensure valid foreign key to profiles(id)
    const currentUser = window.Auth?.getCurrentUser() || {};
    const userEmail = (currentUser.email || '').trim().toLowerCase();
    let targetPatientId = null;

    // A. Query profile by current user email (best match with existing seed data)
    if (userEmail) {
      try {
        const { data: profByEmail } = await sb.from('profiles').select('id').eq('email', userEmail).maybeSingle();
        if (profByEmail?.id) {
          targetPatientId = profByEmail.id;
        }
      } catch (e) {}
    }

    // B. Check profile by passed patient_id
    if (!targetPatientId && patient_id) {
      const cleanId = toValidHexUUID(patient_id);
      if (cleanId) {
        try {
          const { data: profById } = await sb.from('profiles').select('id').eq('id', cleanId).maybeSingle();
          if (profById?.id) {
            targetPatientId = profById.id;
          }
        } catch (e) {}
      }
    }

    // C. Check Supabase Auth user
    if (!targetPatientId) {
      try {
        const { data: authData } = await sb.auth.getUser();
        if (authData?.user?.id) {
          targetPatientId = authData.user.id;
          // Ensure profile row exists
          const { data: authProf } = await sb.from('profiles').select('id').eq('id', authData.user.id).maybeSingle();
          if (!authProf) {
            await sb.from('profiles').insert([{
              id: authData.user.id,
              email: authData.user.email || userEmail || `patient_${Date.now()}@example.com`,
              full_name: authData.user.user_metadata?.full_name || currentUser.full_name || 'Patient',
              role: 'patient'
            }]);
          }
        }
      } catch (e) {}
    }

    // D. Fallback: get any patient profile from DB
    if (!targetPatientId) {
      try {
        const { data: firstPatient } = await sb.from('profiles').select('id').eq('role', 'patient').limit(1).maybeSingle();
        if (firstPatient?.id) {
          targetPatientId = firstPatient.id;
        }
      } catch (e) {}
    }

    // 2. Resolve actual doctor record & department
    let targetDoctorId = doctor_id;
    let targetDeptId = department_id;
    let deptCode = 'GEN';

    try {
      const cleanDocId = toValidHexUUID(doctor_id);
      let query = sb.from('doctors').select('id, department_id, departments(code)');
      if (cleanDocId) {
        query = query.or(`id.eq.${cleanDocId},profile_id.eq.${cleanDocId}`);
      }
      const { data: doc } = await query.maybeSingle();

      if (doc) {
        targetDoctorId = doc.id;
        if (!targetDeptId && doc.department_id) {
          targetDeptId = doc.department_id;
        }
        if (doc.departments?.code) {
          deptCode = doc.departments.code;
        }
      } else {
        // Pick first doctor if not found
        const { data: firstDoc } = await sb.from('doctors').select('id, department_id, departments(code)').limit(1).maybeSingle();
        if (firstDoc) {
          targetDoctorId = firstDoc.id;
          if (!targetDeptId) targetDeptId = firstDoc.department_id;
          if (firstDoc.departments?.code) deptCode = firstDoc.departments.code;
        }
      }
    } catch (e) {
      console.warn('Doctor lookup note:', e);
    }

    // Ensure valid dept ID or null
    if (targetDeptId) {
      try {
        const { data: deptRow } = await sb.from('departments').select('id, code').eq('id', targetDeptId).maybeSingle();
        if (deptRow) {
          targetDeptId = deptRow.id;
          deptCode = deptRow.code || deptCode;
        } else {
          targetDeptId = null;
        }
      } catch (e) {
        targetDeptId = null;
      }
    }

    // 3. Count today's tokens to issue sequential token
    let tokenSeq = 1;
    try {
      let countQuery = sb
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('appointment_date', appointment_date);

      if (targetDeptId) {
        countQuery = countQuery.eq('department_id', targetDeptId);
      }

      const { count } = await countQuery;
      tokenSeq = (count || 0) + 1;
    } catch (e) {
      tokenSeq = Math.floor(Math.random() * 80) + 1;
    }

    const token_number = `${deptCode}-${String(tokenSeq).padStart(3, '0')}`;
    const appointment_number = `APT-${Date.now().toString().slice(-6)}`;
    const fullReason = [reason, symptoms ? `(Symptoms: ${symptoms})` : ''].filter(Boolean).join(' ');
    const randomHashToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? `CP-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
      : `CP-${Math.random().toString(36).slice(2, 10).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // 4. Insert Appointment into Supabase (defaults to 'pending' so Doctor can Confirm / Decline)
    let insertPayload = {
      appointment_number,
      token_number,
      patient_id: targetPatientId,
      doctor_id: targetDoctorId,
      department_id: targetDeptId || null,
      appointment_date,
      time_slot: cleanTime,
      reason: fullReason,
      priority,
      status: initialStatus,
      queue_status: 'waiting',
      is_called: false,
      verification_hash: randomHashToken
    };

    if (hospital_id) insertPayload.hospital_id = hospital_id;
    if (referral_id) insertPayload.referral_id = referral_id;

    let appt = null;
    let apptError = null;
    let attempts = 0;

    while (attempts < 6) {
      attempts++;
      const res = await sb.from('appointments').insert([insertPayload]).select();
      if (!res.error) {
        appt = res.data;
        apptError = null;

        // If booked via an approved cross-city referral, update referral status
        if (referral_id) {
          try {
            await this.updateReferralStatus({
              referralId: referral_id,
              status: 'appointment_booked',
              decisionReason: `Linked to appointment #${appointment_number}`
            });
          } catch (refErr) {
            console.debug('Referral status link note:', refErr);
          }
        }
        break;
      }

      apptError = res.error;
      const errMsg = res.error.message || '';

      // Check if double-booking constraint triggered
      if (res.error.code === '23505' || errMsg.includes('idx_prevent_double_booking') || errMsg.includes('unique constraint')) {
        throw new Error('This time slot is already booked for this doctor. Please choose another slot.');
      }

      // Check if a specific column is missing in Supabase schema cache
      const colMatch = errMsg.match(/Could not find the '([^']+)' column of 'appointments' in the schema cache/i);
      if (colMatch && colMatch[1]) {
        const missingCol = colMatch[1];
        delete insertPayload[missingCol];

        // If time_slot is missing in schema, swap to appointment_time
        if (missingCol === 'time_slot') {
          insertPayload.appointment_time = cleanTime;
        } else if (missingCol === 'appointment_time') {
          insertPayload.time_slot = cleanTime;
        }
        continue;
      }

      // Check if status constraint failed, retry with 'pending'
      if (errMsg.includes('appointments_status_check') || errMsg.includes('check constraint')) {
        insertPayload.status = 'pending';
        continue;
      }

      // If other unexpected column error occurred, try fallback with minimal essential fields
      if (attempts === 3) {
        insertPayload = {
          patient_id: targetPatientId || patient_id,
          doctor_id: targetDoctorId,
          appointment_date,
          token_number,
          reason: fullReason,
          status: 'pending'
        };
        // Add time slot under whichever column name is supported
        if (!errMsg.includes('time_slot')) {
          insertPayload.time_slot = cleanTime;
        } else {
          insertPayload.appointment_time = cleanTime;
        }
        continue;
      }

      break;
    }

    if (apptError) {
      throw apptError;
    }

    const createdRecord = (appt && appt.length > 0) ? appt[0] : {
      appointment_number,
      token_number,
      patient_id: targetPatientId || patient_id,
      doctor_id: targetDoctorId,
      appointment_date,
      time_slot: cleanTime,
      reason: fullReason,
      status: initialStatus,
      verification_hash: randomHashToken
    };

    // 5. Create Realtime Notifications safely
    try {
      const doc = await this.getDoctorById(targetDoctorId);
      const notifyPatientId = createdRecord.patient_id || targetPatientId || patient_id;

      if (createdRecord.status === 'confirmed') {
        await this.createNotification({
          user_id: notifyPatientId,
          title: '✅ Appointment Confirmed! Slip & QR Ready',
          message: `Your appointment is confirmed for ${appointment_date} at ${this.formatTime12Hour(cleanTime)}. Token Number: ${token_number}. Download your Slip with QR code now.`,
          type: 'appointment',
          link: createdRecord.id ? `appointment-details.html?id=${createdRecord.id}` : 'appointments.html'
        });
      } else {
        await this.createNotification({
          user_id: notifyPatientId,
          title: '⏳ Appointment Request Sent (Pending Confirmation)',
          message: `Your booking request with ${doc?.full_name || 'Specialist Doctor'} on ${appointment_date} at ${this.formatTime12Hour(cleanTime)} (Token: ${token_number}) is pending doctor confirmation. Your PDF Slip & QR Code will unlock once confirmed.`,
          type: 'appointment',
          link: 'appointments.html'
        });
      }

      if (doc && doc.profile_id) {
        await this.createNotification({
          user_id: doc.profile_id,
          title: createdRecord.status === 'pending' ? '📋 New Appointment Request Pending Approval' : 'New Appointment Booked',
          message: `Patient has booked ${appointment_date} at ${this.formatTime12Hour(cleanTime)} (Token: ${token_number}). ${createdRecord.status === 'pending' ? 'Please Confirm or Decline from your dashboard.' : ''}`,
          type: 'appointment',
          link: 'appointments.html'
        });
      }
    } catch (notifErr) {
      console.warn('Notification create note:', notifErr);
    }

    this.emitSyncEvent('appointments');
    return createdRecord;
  },

  async updateAppointmentStatus(appointmentId, status, notes = null, rejectionReason = null) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const updatePayload = {
      status: status,
      updated_at: new Date().toISOString()
    };
    if (notes) updatePayload.doctor_notes = notes;
    if (rejectionReason) updatePayload.cancellation_reason = rejectionReason;

    // Ensure a verification_hash exists when confirming so QR & PDF slip are immediately ready
    if (status === 'confirmed') {
      try {
        const { data: existing } = await sb
          .from('appointments')
          .select('id, verification_hash')
          .eq('id', appointmentId)
          .maybeSingle();
        if (existing && !existing.verification_hash) {
          updatePayload.verification_hash = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? `CP-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
            : `CP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        }
      } catch (e) {}
    }

    // Synchronize queue fields
    if (status === 'in-progress' || status === 'in_consultation' || status === 'called') {
      updatePayload.queue_status = 'in-room';
      updatePayload.is_called = true;
      updatePayload.called_at = new Date().toISOString();
      updatePayload.consultation_started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updatePayload.queue_status = 'completed';
      updatePayload.completed_at = new Date().toISOString();
    }

    let { data, error } = await sb
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    // If check constraint failed, try alternative status values
    if (error && (error.message?.includes('appointments_status_check') || error.message?.includes('check constraint'))) {
      const altCandidates = (status === 'in-progress' || status === 'in_consultation' || status === 'in_progress')
        ? ['in_consultation', 'in-progress', 'in_progress', 'confirmed']
        : [status];

      for (const alt of altCandidates) {
        if (alt === updatePayload.status) continue;
        updatePayload.status = alt;
        const retryRes = await sb
          .from('appointments')
          .update(updatePayload)
          .eq('id', appointmentId)
          .select()
          .maybeSingle();

        if (!retryRes.error) {
          data = retryRes.data;
          error = null;
          break;
        }
      }
    }

    if (error) throw error;

    // Send notification to patient
    if (data && data.patient_id) {
      try {
        let notifTitle = `Appointment ${status.toUpperCase()}`;
        let notifMsg = `Your appointment status was updated to: ${status}. ${notes ? `Doctor Note: ${notes}` : ''}`;
        let notifLink = `appointment-details.html?id=${data.id}`;

        if (status === 'confirmed') {
          notifTitle = '✅ Appointment Confirmed! Slip & QR Ready';
          notifMsg = `Great news! Your appointment (Token: ${data.token_number}) on ${data.appointment_date} at ${this.formatTime12Hour(data.time_slot || data.appointment_time)} is CONFIRMED by your doctor. Open details to download your PDF Slip with QR Code!`;
        } else if (status === 'rejected') {
          notifTitle = '❌ Appointment Request Declined';
          notifMsg = `Your appointment request (Token: ${data.token_number}) for ${data.appointment_date} was declined by the doctor.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
          notifLink = 'book-appointment.html';
        } else if (status === 'completed') {
          notifTitle = '🩺 Consultation Completed';
          notifMsg = `Your consultation (Token: ${data.token_number}) is completed. View doctor notes, prescription & leave a review.`;
        }

        await this.createNotification({
          user_id: data.patient_id,
          title: notifTitle,
          message: notifMsg,
          type: 'appointment',
          link: notifLink
        });
      } catch (e) {}
    }

    // Auto Slot Reallocation for Waiting List (Feature 6)
    if (status === 'cancelled' || status === 'rejected') {
      try {
        await this.processWaitingListForCancelledSlot(appointmentId);
      } catch (err) {
        console.debug('Waiting list reallocation note:', err);
      }
    }

    this.emitSyncEvent('appointments');
    return data || updatePayload;
  },

  async callNextPatientInQueue(doctorId, appointmentId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    // 1. Mark previous called patients for this doctor as in-room
    try {
      await sb
        .from('appointments')
        .update({ queue_status: 'in-room' })
        .eq('doctor_id', doctorId)
        .eq('queue_status', 'called');
    } catch (e) {}

    // 2. Set this appointment as called & in-progress
    // Standard status in PostgreSQL schema is 'in-progress'
    const candidates = ['in-progress', 'in_consultation', 'in-consultation', 'confirmed'];
    let data = null;
    let lastError = null;

    for (const st of candidates) {
      const payload = {
        queue_status: 'called',
        is_called: true,
        status: st,
        updated_at: new Date().toISOString()
      };
      const res = await sb
        .from('appointments')
        .update(payload)
        .eq('id', appointmentId)
        .select()
        .maybeSingle();

      if (!res.error) {
        data = res.data;
        lastError = null;
        break;
      } else {
        lastError = res.error;
        if (!res.error.message?.includes('appointments_status_check') && !res.error.message?.includes('check constraint')) {
          break;
        }
      }
    }

    // Fallback: If status constraint fails, update queue_status without touching status
    if (lastError && (lastError.message?.includes('appointments_status_check') || lastError.message?.includes('check constraint'))) {
      const fb = await sb
        .from('appointments')
        .update({
          queue_status: 'called',
          is_called: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .maybeSingle();
      if (!fb.error) {
        data = fb.data;
        lastError = null;
      }
    }

    if (lastError) throw lastError;

    // Notify Patient of call
    if (data && data.patient_id) {
      await this.createNotification({
        user_id: data.patient_id,
        title: '🔔 You are Called to Consultation Room!',
        message: `Token ${data.token_number}: Doctor is ready for you now. Please proceed to the room.`,
        type: 'queue',
        link: 'queue-status.html'
      });
    }

    this.emitSyncEvent('appointments');
    return data;
  },

  async updateAppointment(appointmentId, apptData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const updatePayload = { ...apptData, updated_at: new Date().toISOString() };
    const { data, error } = await sb
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw error;
    this.emitSyncEvent('appointments');
    return data;
  },

  async deleteAppointment(appointmentId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const { error } = await sb
      .from('appointments')
      .delete()
      .eq('id', appointmentId);
    if (error) throw error;
    this.emitSyncEvent('appointments');
    return true;
  },

  async addPatientProfile(patientData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const id = patientData.id || crypto.randomUUID();
    const newProfile = {
      id,
      full_name: patientData.full_name,
      email: patientData.email,
      phone: patientData.phone || '',
      role: 'patient',
      gender: patientData.gender || 'Other',
      date_of_birth: patientData.date_of_birth || null,
      blood_group: patientData.blood_group || 'O+',
      is_active: patientData.is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb
      .from('profiles')
      .insert([newProfile])
      .select()
      .single();
    if (error) throw error;
    this.emitSyncEvent('profiles');
    return data;
  },

  async deleteProfile(profileId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const { error } = await sb
      .from('profiles')
      .delete()
      .eq('id', profileId);
    if (error) throw error;
    this.emitSyncEvent('profiles');
    return true;
  },

  // ============================================================================
  // 5. NOTIFICATIONS (Realtime)
  // ============================================================================
  async getNotifications(userId) {
    const sb = getSupabaseClient();
    if (!sb || !userId) return [];
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('getNotifications error:', error);
      return [];
    }
    return data || [];
  },

  async createNotification({ user_id, title, message, type = 'appointment', link = '' }) {
    const sb = getSupabaseClient();
    if (!sb || !user_id) return null;
    const { data, error } = await sb
      .from('notifications')
      .insert([{
        user_id,
        title,
        message,
        type,
        link,
        is_read: false
      }])
      .select()
      .single();
    if (error) console.error('createNotification error:', error);
    if (!error) this.emitSyncEvent('notifications');
    return data;
  },

  async markNotificationAsRead(id) {
    const sb = getSupabaseClient();
    if (!sb) return false;
    const { error } = await sb
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) this.emitSyncEvent('notifications');
    return !error;
  },

  async markAllNotificationsRead(userId) {
    const sb = getSupabaseClient();
    if (!sb || !userId) return false;
    const { error } = await sb
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
    if (!error) this.emitSyncEvent('notifications');
    return !error;
  },

  // ============================================================================
  // 6. REVIEWS & RATINGS
  // ============================================================================
  async getReviews(doctorId = null) {
    const sb = getSupabaseClient();
    if (!sb) return [];
    let query = sb
      .from('reviews')
      .select(`
        *,
        profiles (full_name, profile_image)
      `);
    if (doctorId) query = query.eq('doctor_id', doctorId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('getReviews error:', error);
      return [];
    }
    return (data || []).map(r => ({
      ...r,
      patient_name: r.profiles?.full_name || 'Verified Patient',
      patient_avatar: r.profiles?.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
    }));
  },

  async addReview({ doctor_id, patient_id, appointment_id, rating, comment }) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    const { data, error } = await sb
      .from('reviews')
      .insert([{
        doctor_id,
        patient_id,
        appointment_id: appointment_id || null,
        rating: parseInt(rating, 10),
        comment: comment || '',
        is_verified: true
      }])
      .select()
      .single();
    if (error) throw error;
    this.emitSyncEvent('reviews');
    this.emitSyncEvent('doctors');
    return data;
  },

  // ============================================================================
  // 7. USER PROFILES
  // ============================================================================
  async getProfiles() {
    const sb = getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('getProfiles error:', error);
      return [];
    }
    return data || [];
  },

  async getProfileById(id) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async updateProfile(id, profileData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    // 1. First attempt update with all fields
    const { data, error } = await sb
      .from('profiles')
      .update(profileData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Profile update note, retrying with standard columns:', error.message);
      // Fallback to standard columns in case custom columns are pending migration
      const coreFields = {
        full_name: profileData.full_name,
        phone: profileData.phone,
        gender: profileData.gender,
        date_of_birth: profileData.date_of_birth || null,
        blood_group: profileData.blood_group || null,
        address: profileData.address || null,
        profile_image: profileData.profile_image || null
      };
      const { data: coreData, error: coreErr } = await sb
        .from('profiles')
        .update(coreFields)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (coreErr) throw coreErr;
      this.emitSyncEvent('profiles');
      return coreData;
    }
    this.emitSyncEvent('profiles');
    return data;
  },

  // ============================================================================
  // 8. PATIENT CHECK-IN, QUEUE & CONSULTATION WORKFLOW
  // ============================================================================
  async checkInAppointment(appointmentId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const now = new Date().toISOString();
    let data = null;
    let res = await sb
      .from('appointments')
      .update({
        status: 'checked_in',
        queue_status: 'waiting',
        check_in_status: 'checked_in',
        checked_in_at: now,
        updated_at: now
      })
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    // If status check constraint rejects 'checked_in', keep current status & update check_in_status
    if (res.error && (res.error.message?.includes('appointments_status_check') || res.error.message?.includes('check constraint'))) {
      res = await sb
        .from('appointments')
        .update({
          queue_status: 'waiting',
          check_in_status: 'checked_in',
          checked_in_at: now,
          updated_at: now
        })
        .eq('id', appointmentId)
        .select()
        .maybeSingle();
    }

    if (res.error) throw res.error;
    data = res.data;

    if (data && data.patient_id) {
      await this.createNotification({
        user_id: data.patient_id,
        title: 'Check-In Confirmed! 🏥',
        message: `You have successfully checked in for Token ${data.token_number}. Please wait in the OPD waiting area.`,
        type: 'queue',
        link: 'queue-status.html'
      });
    }

    // Audit log
    await this.logAuditEvent({
      action: 'PATIENT_CHECKED_IN',
      entity_type: 'appointment',
      entity_id: appointmentId,
      details: { token: data?.token_number }
    });

    this.emitSyncEvent('appointments');
    return data;
  },

  async startConsultation(appointmentId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const now = new Date().toISOString();
    const candidates = ['in-progress', 'in_consultation', 'in-consultation', 'confirmed'];
    let data = null;
    let lastErr = null;

    for (const st of candidates) {
      const res = await sb
        .from('appointments')
        .update({
          status: st,
          queue_status: 'in-room',
          consultation_started_at: now,
          updated_at: now
        })
        .eq('id', appointmentId)
        .select()
        .maybeSingle();

      if (!res.error) {
        data = res.data;
        lastErr = null;
        break;
      }
      lastErr = res.error;
      if (!res.error.message?.includes('appointments_status_check') && !res.error.message?.includes('check constraint')) break;
    }

    if (lastErr && (lastErr.message?.includes('appointments_status_check') || lastErr.message?.includes('check constraint'))) {
      const fb = await sb
        .from('appointments')
        .update({
          queue_status: 'in-room',
          consultation_started_at: now,
          updated_at: now
        })
        .eq('id', appointmentId)
        .select()
        .maybeSingle();
      if (!fb.error) data = fb.data;
      else throw lastErr;
    } else if (lastErr) {
      throw lastErr;
    }

    this.emitSyncEvent('appointments');
    return data;
  },

  async completeConsultation({ appointmentId, doctorId, patientId, diagnosis, notes, follow_up_date, prescriptions = [] }) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const now = new Date().toISOString();

    // 1. Mark appointment as completed
    const { data: appt, error: aErr } = await sb
      .from('appointments')
      .update({
        status: 'completed',
        queue_status: 'completed',
        doctor_notes: notes || diagnosis || 'Consultation completed.',
        completed_at: now,
        updated_at: now
      })
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    if (aErr) throw aErr;

    // 2. Create Consultation Record
    let consultationRecord = null;
    try {
      const { data: consData, error: cErr } = await sb
        .from('consultations')
        .upsert({
          appointment_id: appointmentId,
          doctor_id: doctorId,
          patient_id: patientId,
          diagnosis: diagnosis || 'General Diagnosis',
          notes: notes || '',
          follow_up_date: follow_up_date || null,
          updated_at: now
        }, { onConflict: 'appointment_id' })
        .select()
        .maybeSingle();

      consultationRecord = consData;

      // 3. Save Prescriptions if any
      if (consultationRecord && prescriptions && prescriptions.length > 0) {
        await sb.from('prescriptions').delete().eq('consultation_id', consultationRecord.id);
        const rows = prescriptions.map(p => ({
          consultation_id: consultationRecord.id,
          medicine: p.medicine,
          dosage: p.dosage || '1 Tablet',
          frequency: p.frequency || 'Twice Daily',
          duration: p.duration || '5 Days',
          instructions: p.instructions || 'After meals'
        }));
        await sb.from('prescriptions').insert(rows);
      }
    } catch (e) {
      console.warn('Consultation/prescription write note:', e);
    }

    // 4. Notify patient
    if (patientId) {
      await this.createNotification({
        user_id: patientId,
        title: 'Consultation Completed 🩺',
        message: `Your consultation is completed. View your prescription & doctor notes in your portal.`,
        type: 'appointment',
        link: 'appointments.html'
      });
    }

    // Audit log
    await this.logAuditEvent({
      action: 'CONSULTATION_COMPLETED',
      entity_type: 'appointment',
      entity_id: appointmentId,
      details: { doctor_id: doctorId, patient_id: patientId, prescription_count: prescriptions.length }
    });

    this.emitSyncEvent('appointments');
    return appt;
  },

  async getConsultationByAppointment(appointmentId) {
    const sb = getSupabaseClient();
    if (!sb) return null;

    try {
      const { data: cons } = await sb
        .from('consultations')
        .select(`
          *,
          prescriptions (*)
        `)
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      return cons;
    } catch (e) {
      console.warn('getConsultationByAppointment note:', e);
      return null;
    }
  },

  async cancelAppointment(appointmentId, reason = '') {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { data, error } = await sb
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (data && data.patient_id) {
      await this.createNotification({
        user_id: data.patient_id,
        title: 'Appointment Cancelled',
        message: `Your appointment on ${data.appointment_date} has been cancelled.`,
        type: 'cancellation',
        link: 'appointments.html'
      });
    }

    this.emitSyncEvent('appointments');
    return data;
  },

  // ============================================================================
  // 9. DOCTOR LEAVES & UNAVAILABILITY
  // ============================================================================
  async getDoctorLeaves(doctorId) {
    const sb = getSupabaseClient();
    if (!sb) return [];

    try {
      const { data, error } = await sb
        .from('doctor_leaves')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('leave_date', { ascending: true });

      if (error) return [];
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async addDoctorLeave({ doctorId, leaveDate, reason }) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { data, error } = await sb
      .from('doctor_leaves')
      .insert([{
        doctor_id: doctorId,
        leave_date: leaveDate,
        reason: reason || 'Personal Leave'
      }])
      .select()
      .maybeSingle();

    if (error) throw error;
    this.emitSyncEvent('doctor_leaves');
    return data;
  },

  async deleteDoctorLeave(leaveId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { error } = await sb
      .from('doctor_leaves')
      .delete()
      .eq('id', leaveId);

    if (error) throw error;
    this.emitSyncEvent('doctor_leaves');
    return true;
  },

  // ============================================================================
  // 10. FAMILY MEMBERS
  // ============================================================================
  async getFamilyMembers(patientId) {
    const sb = getSupabaseClient();
    if (!sb || !patientId) return [];

    let cleanPatientId = patientId;
    if (typeof cleanPatientId === 'string') {
      cleanPatientId = cleanPatientId.trim().toLowerCase().replace(/[^0-9a-f-]/g, '0');
    }

    try {
      const { data, error } = await sb
        .from('family_members')
        .select('*')
        .eq('patient_id', cleanPatientId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async addFamilyMember(memberData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const currentUser = window.Auth?.getCurrentUser() || {};
    const userEmail = (currentUser.email || '').trim().toLowerCase();

    let targetPatientId = memberData.patient_id;
    if (userEmail) {
      try {
        const { data: profByEmail } = await sb.from('profiles').select('id').eq('email', userEmail).maybeSingle();
        if (profByEmail?.id) targetPatientId = profByEmail.id;
      } catch (e) {}
    }

    if (typeof targetPatientId === 'string') {
      targetPatientId = targetPatientId.trim().toLowerCase().replace(/[^0-9a-f-]/g, '0');
    }

    const payload = {
      ...memberData,
      patient_id: targetPatientId
    };

    const { data, error } = await sb
      .from('family_members')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) throw error;
    this.emitSyncEvent('profiles');
    return data;
  },

  async deleteFamilyMember(memberId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { error } = await sb
      .from('family_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    this.emitSyncEvent('profiles');
    return true;
  },

  // ============================================================================
  // 11. OPD ROOMS
  // ============================================================================
  async getRooms() {
    const sb = getSupabaseClient();
    if (!sb) return [];

    try {
      const { data, error } = await sb
        .from('opd_rooms')
        .select(`
          *,
          departments (name, code)
        `)
        .order('room_number', { ascending: true });

      if (error) return [];
      return (data || []).map(r => ({
        ...r,
        department_name: r.departments?.name || 'General'
      }));
    } catch (e) {
      return [];
    }
  },

  async addRoom(roomData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { data, error } = await sb
      .from('opd_rooms')
      .insert([roomData])
      .select()
      .maybeSingle();

    if (error) throw error;
    this.emitSyncEvent('opd_rooms');
    return data;
  },

  async updateRoom(id, roomData) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { data, error } = await sb
      .from('opd_rooms')
      .update(roomData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    this.emitSyncEvent('opd_rooms');
    return data;
  },

  async deleteRoom(id) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const { error } = await sb
      .from('opd_rooms')
      .delete()
      .eq('id', id);

    if (error) throw error;
    this.emitSyncEvent('opd_rooms');
    return true;
  },

  // ============================================================================
  // 12. QR CODE GENERATION & SECURE APPOINTMENT VERIFICATION (Feature 1)
  // ============================================================================
  generateVerificationHash(appt) {
    if (!appt) return '';
    const raw = `${appt.id || ''}:${appt.appointment_number || ''}:${appt.token_number || ''}:${appt.patient_id || ''}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `CP-${hex.toUpperCase()}`;
  },

  generateAppointmentQRCodeData(appt) {
    if (!appt) return '';
    const hash = appt.verification_hash || this.generateVerificationHash(appt);
    // Secure Payload: contains verification identifier, token & signature hash with zero personal data
    return `CAREPULSE:VERIFY:${appt.id}:${appt.token_number || ''}:${hash}`;
  },

  async verifyAppointmentQR(identifier) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');
    if (!identifier || typeof identifier !== 'string') {
      return { valid: false, message: 'Invalid or empty QR code / Token.' };
    }

    const cleanInput = identifier.trim();
    let targetId = cleanInput;
    let targetToken = cleanInput;
    let providedHash = '';

    // 1. Parse structured CAREPULSE:VERIFY payload: CAREPULSE:VERIFY:<id>:<token>:<hash>
    if (cleanInput.startsWith('CAREPULSE:VERIFY:')) {
      const parts = cleanInput.split(':');
      targetId = parts[2] || '';
      targetToken = parts[3] || '';
      providedHash = parts[4] || '';
    } else if (cleanInput.startsWith('CAREPULSE|')) {
      // Legacy format: CAREPULSE|<id>|<token>|<date>
      const parts = cleanInput.split('|');
      targetId = parts[1] || '';
      targetToken = parts[2] || '';
    } else {
      // Check if JSON payload
      try {
        const parsed = JSON.parse(cleanInput);
        if (parsed.id) targetId = parsed.id;
        if (parsed.appointment_id) targetId = parsed.appointment_id;
        if (parsed.token) targetToken = parsed.token;
        if (parsed.token_number) targetToken = parsed.token_number;
        if (parsed.verification_hash) providedHash = parsed.verification_hash;
      } catch (e) {}
    }

    const appointments = await this.getAppointments();
    const cleanId = (targetId || '').toLowerCase().trim();
    const cleanToken = (targetToken || '').toLowerCase().trim();
    const cleanRaw = cleanInput.toLowerCase().trim();

    const matched = appointments.find(a => 
      (cleanId && a.id.toLowerCase() === cleanId) ||
      (cleanToken && a.token_number && a.token_number.toLowerCase() === cleanToken) ||
      (a.verification_hash && a.verification_hash.toLowerCase() === cleanRaw) ||
      (a.appointment_number && a.appointment_number.toLowerCase() === cleanRaw) ||
      (a.token_number && a.token_number.toLowerCase() === cleanRaw) ||
      a.id.toLowerCase() === cleanRaw
    );

    if (!matched) {
      return { 
        valid: false, 
        message: 'No appointment found in hospital registry matching this QR code or Token.' 
      };
    }

    // Verify hash signature when structured payload contains a hash
    if (providedHash) {
      const expectedHash = matched.verification_hash || this.generateVerificationHash(matched);
      if (expectedHash && providedHash.trim().toUpperCase() !== expectedHash.trim().toUpperCase()) {
        return {
          valid: false,
          errorType: 'invalid_hash',
          message: 'Invalid or tampered QR security token. Verification rejected.'
        };
      }
    }

    // Block unconfirmed / pending bookings from QR check-in
    if (matched.status === 'pending') {
      return {
        valid: false,
        errorType: 'pending',
        appointment: matched,
        message: `Appointment (Token ${matched.token_number}) is still PENDING Doctor Confirmation. Doctor must confirm it first before check-in.`
      };
    }

    // Check cancellation
    if (matched.status === 'cancelled' || matched.status === 'rejected') {
      return {
        valid: false,
        errorType: 'cancelled',
        appointment: matched,
        message: `Appointment is ${matched.status.toUpperCase()}${matched.cancellation_reason ? ': ' + matched.cancellation_reason : ''}. Check-in cannot proceed.`
      };
    }

    // Check completed
    if (matched.status === 'completed' || matched.queue_status === 'completed') {
      return {
        valid: false,
        errorType: 'completed',
        appointment: matched,
        message: `Consultation for Token ${matched.token_number} is already COMPLETED. Check-in is not required.`
      };
    }

    // Prevent duplicate check-in
    const isCheckedIn = matched.status === 'checked_in' || matched.status === 'checked-in' || !!matched.checked_in_at;
    if (isCheckedIn) {
      const checkInTime = matched.checked_in_at ? this.formatTime12Hour(new Date(matched.checked_in_at).toTimeString().slice(0, 5)) : 'Earlier';
      return {
        valid: true,
        isAlreadyCheckedIn: true,
        appointment: matched,
        message: `⚠️ DUPLICATE CHECK-IN PREVENTED: Patient ${matched.patient_name} (Token ${matched.token_number}) was already checked-in at ${checkInTime}. Currently waiting for consultation.`
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = matched.appointment_date === todayStr;

    return {
      valid: true,
      isAlreadyCheckedIn: false,
      isToday,
      appointment: matched,
      message: isToday 
        ? '✓ Appointment Verified Successfully - Ready for Reception Check-in' 
        : `✓ Appointment Verified (Note: Scheduled for ${matched.appointment_date})`
    };
  },

  // ============================================================================
  // 13. AUDIT LOGS
  // ============================================================================
  async logAuditEvent({ action, entity_type, entity_id, details = {} }) {
    const sb = getSupabaseClient();
    if (!sb) return null;

    try {
      const user = window.Auth ? window.Auth.getCurrentUser() : null;
      await sb.from('audit_logs').insert([{
        user_id: user?.id || null,
        action,
        entity_type,
        entity_id: String(entity_id || ''),
        details
      }]);
      this.emitSyncEvent('audit_logs');
    } catch (e) {
      console.debug('Audit log note:', e);
    }
  },

  async getAuditLogs(limit = 50) {
    const sb = getSupabaseClient();
    if (!sb) return [];

    try {
      const { data, error } = await sb
        .from('audit_logs')
        .select(`
          *,
          profiles (full_name, email, role)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return [];
      return (data || []).map(l => ({
        ...l,
        user_name: l.profiles?.full_name || 'System / Admin',
        user_email: l.profiles?.email || '',
        user_role: l.profiles?.role || 'system'
      }));
    } catch (e) {
      return [];
    }
  },

  // ============================================================================
  // 14. REALTIME SUBSCRIPTION CHANNELS (WebSockets)
  // ============================================================================
  subscribeToAppointments(onEvent) {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const channel = sb
      .channel('realtime_appointments_channel_' + Math.random().toString(36).slice(2))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('⚡ Realtime Appointment Event:', payload);
          if (typeof onEvent === 'function') onEvent(payload);
        }
      )
      .subscribe();
    return channel;
  },

  subscribeToNotifications(userId, onEvent) {
    const sb = getSupabaseClient();
    if (!sb || !userId) return null;
    const channel = sb
      .channel(`realtime_notifications_${userId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('⚡ Realtime Notification Received:', payload);
          if (typeof onEvent === 'function') onEvent(payload);
        }
      )
      .subscribe();
    return channel;
  },

  /**
   * Broadcasts DB mutations within the active tab and across same-origin tabs.
   */
  emitSyncEvent(table = '*') {
    const detail = { table, timestamp: Date.now() };
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carepulse_db_change', { detail }));
    }
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        if (!this._syncBroadcastChannel) {
          this._syncBroadcastChannel = new BroadcastChannel('carepulse_realtime_sync');
        }
        this._syncBroadcastChannel.postMessage({ type: 'db_change', ...detail });
      } catch (e) {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('carepulse_last_sync', JSON.stringify(detail));
      } catch (e) {}
    }
  },

  /**
   * Returns true if a modal overlay/dialog is open or user focus is inside a text/form input,
   * preventing auto-refresh from wiping unsaved notes, search text, or active dialogs.
   */
  hasActiveModalOrInputFocus() {
    if (typeof document === 'undefined') return false;

    if (document.querySelector('.modal-overlay.active, .modal.active, [role="dialog"]:not(.hidden)')) {
      return true;
    }

    const idModals = document.querySelectorAll('[id$="-modal"]');
    for (const m of idModals) {
      if (!m.classList.contains('hidden') && m.style.display !== 'none') {
        if (!m.classList.contains('modal-overlay') || m.classList.contains('active')) {
          return true;
        }
      }
    }

    const activeNotes = document.getElementById('active-consultation-notes');
    if (activeNotes && typeof activeNotes.value === 'string' && activeNotes.value.trim().length > 0) {
      return true;
    }

    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName) {
      const tag = activeEl.tagName.toLowerCase();
      if (tag === 'textarea' || activeEl.isContentEditable) return true;
      if (tag === 'input') {
        const inputType = (activeEl.type || 'text').toLowerCase();
        if (['text', 'search', 'email', 'tel', 'password', 'number', 'url'].includes(inputType)) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Unified Realtime & Visibility-Aware Auto-Refresh Coordinator.
   * Multiplexes Supabase Postgres Changes + BroadcastChannel + Smart Background Polling.
   */
  enableAutoRealtimeSync({
    tables = [
      'appointments', 'doctors', 'doctor_availability', 'doctor_leaves',
      'waiting_list', 'notifications', 'reviews', 'departments',
      'opd_rooms', 'profiles', 'audit_logs'
    ],
    userId = null,
    onRefresh = null,
    onAppointmentEvent = null,
    onNotificationEvent = null,
    intervalMs = 12000,
    channelName = null
  } = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { destroy() {}, triggerRefresh() {} };
    }

    const uniqueTables = Array.from(new Set(tables));
    const sb = getSupabaseClient();
    let destroyed = false;
    let inFlight = false;
    let deferred = false;
    let debounceTimer = null;
    let pollTimer = null;
    let sbChannel = null;
    let bc = null;

    const runRefresh = async (source = 'realtime') => {
      if (destroyed || typeof onRefresh !== 'function') return;
      if (document.visibilityState === 'hidden' || this.hasActiveModalOrInputFocus()) {
        deferred = true;
        return;
      }
      if (inFlight) {
        deferred = true;
        return;
      }
      inFlight = true;
      deferred = false;
      try {
        await onRefresh(source);
      } catch (err) {
        console.warn('Auto-refresh sync warning:', err);
      } finally {
        inFlight = false;
        if (deferred && !destroyed) {
          deferred = false;
          scheduleRefresh('queued', 250);
        }
      }
    };

    const scheduleRefresh = (source = 'realtime', delay = 250) => {
      if (destroyed) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runRefresh(source);
      }, delay);
    };

    const tableMatches = (table) => !table || table === '*' || uniqueTables.includes(table);

    if (sb) {
      try {
        const chName = channelName || ('carepulse_sync_' + Math.random().toString(36).slice(2));
        sbChannel = sb.channel(chName);

        uniqueTables.forEach((tbl) => {
          const filterConfig = (tbl === 'notifications' && userId)
            ? { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }
            : { event: '*', schema: 'public', table: tbl };

          sbChannel = sbChannel.on('postgres_changes', filterConfig, (payload) => {
            if (tbl === 'appointments' && typeof onAppointmentEvent === 'function') {
              try { onAppointmentEvent(payload); } catch (e) {}
            }
            if (tbl === 'notifications' && payload.eventType === 'INSERT' && typeof onNotificationEvent === 'function') {
              try { onNotificationEvent(payload); } catch (e) {}
            }
            scheduleRefresh(`supabase:${tbl}`);
          });
        });

        sbChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`⚡ CarePulse Unified Realtime Subscribed [${uniqueTables.join(', ')}]`);
          }
        });
      } catch (e) {
        console.warn('Supabase unified realtime setup note:', e);
      }
    }

    const localDbHandler = (e) => {
      const tbl = e?.detail?.table || '*';
      if (tableMatches(tbl)) scheduleRefresh(`local:${tbl}`, 120);
    };
    window.addEventListener('carepulse_db_change', localDbHandler);

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('carepulse_realtime_sync');
        bc.onmessage = (msg) => {
          const tbl = msg?.data?.table || '*';
          if (msg?.data?.type === 'db_change' && tableMatches(tbl)) {
            scheduleRefresh(`broadcast:${tbl}`, 120);
          }
        };
      } catch (e) {}
    }

    const storageHandler = (e) => {
      if (e.key !== 'carepulse_last_sync' || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (tableMatches(parsed?.table)) scheduleRefresh(`storage:${parsed.table}`, 120);
      } catch (err) {}
    };
    window.addEventListener('storage', storageHandler);

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh('visibility', 100);
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    const onlineHandler = () => scheduleRefresh('online', 200);
    window.addEventListener('online', onlineHandler);

    const flushDeferredHandler = () => {
      if (!deferred || destroyed) return;
      setTimeout(() => {
        if (deferred && !destroyed && document.visibilityState === 'visible' && !this.hasActiveModalOrInputFocus()) {
          scheduleRefresh('deferred_flush', 100);
        }
      }, 150);
    };
    document.addEventListener('focusout', flushDeferredHandler);
    document.addEventListener('click', flushDeferredHandler);

    if (intervalMs && intervalMs > 0) {
      pollTimer = setInterval(() => {
        if (!destroyed && document.visibilityState === 'visible' && !this.hasActiveModalOrInputFocus()) {
          runRefresh('poll');
        }
      }, intervalMs);
    }

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('carepulse_db_change', localDbHandler);
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('online', onlineHandler);
      document.removeEventListener('visibilitychange', visibilityHandler);
      document.removeEventListener('focusout', flushDeferredHandler);
      document.removeEventListener('click', flushDeferredHandler);
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
      if (sbChannel && sb) {
        try { sb.removeChannel(sbChannel); } catch (e) {}
      }
    };

    window.addEventListener('pagehide', destroy, { once: true });
    window.addEventListener('beforeunload', destroy, { once: true });

    return {
      destroy,
      triggerRefresh: (src = 'manual') => scheduleRefresh(src, 0)
    };
  },

  // Local Date & Time Formatters (Timezone-safe)
  getLocalTodayDate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  getLocalCurrentTimeHHMM(d = new Date()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  formatTime12Hour(time24) {
    if (!time24) return '';
    const str = String(time24).trim();
    if (/am|pm/i.test(str)) return str.toUpperCase();
    const parts = str.split(':').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return str;
    const [h, m] = parts;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  },

  // ============================================================================
  // 15. APPOINTMENT RESCHEDULING (Feature 2)
  // ============================================================================
  canRescheduleAppointment(appointment) {
    if (!appointment) return false;
    const isEligibleStatus = ['pending', 'confirmed'].includes(appointment.status);
    const todayStr = this.getLocalTodayDate();
    const isFutureOrToday = appointment.appointment_date >= todayStr;
    return isEligibleStatus && isFutureOrToday;
  },

  async rescheduleAppointment(appointmentId, newDate, newTimeSlot, reason = '') {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const appt = await this.getAppointmentById(appointmentId);
    if (!appt) throw new Error('Appointment not found.');

    if (!this.canRescheduleAppointment(appt)) {
      throw new Error(`Cannot reschedule appointment with status "${appt.status}". Only pending or confirmed upcoming appointments can be rescheduled.`);
    }

    // Double-Booking Guard: Check if the target slot is already occupied by another active appointment
    const allAppointments = await this.getAppointments();
    const cleanTime = (newTimeSlot || '').substring(0, 5);
    const slotConflict = allAppointments.find(a => 
      a.id !== appointmentId &&
      a.doctor_id === appt.doctor_id &&
      a.appointment_date === newDate &&
      (a.time_slot || a.appointment_time || '').substring(0, 5) === cleanTime &&
      !['cancelled', 'rejected'].includes(a.status)
    );

    if (slotConflict) {
      throw new Error(`The selected slot (${this.formatTime12Hour(cleanTime)}) on ${newDate} is already booked by another patient. Please choose a different slot.`);
    }

    const oldDate = appt.appointment_date;
    const oldSlot = appt.time_slot || appt.appointment_time;
    const newRescheduleCount = (appt.reschedule_count || 0) + 1;
    const nowIso = new Date().toISOString();

    const updatePayload = {
      appointment_date: newDate,
      time_slot: cleanTime,
      appointment_time: cleanTime,
      status: 'confirmed',
      reschedule_count: newRescheduleCount,
      rescheduled_from_date: oldDate,
      rescheduled_from_slot: oldSlot,
      updated_at: nowIso
    };

    const { data, error } = await sb
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('idx_prevent_double_booking')) {
        throw new Error('This time slot was just booked by another patient. Please select another slot.');
      }
      throw error;
    }

    // 1. Audit Log Event
    await this.logAuditEvent({
      action: 'APPOINTMENT_RESCHEDULED',
      entity_type: 'appointment',
      entity_id: appointmentId,
      details: {
        previous_date: oldDate,
        previous_slot: oldSlot,
        new_date: newDate,
        new_slot: cleanTime,
        reschedule_reason: reason,
        reschedule_count: newRescheduleCount
      }
    });

    // 2. Notify Patient
    await this.createNotification({
      user_id: appt.patient_id,
      title: 'Appointment Rescheduled Successfully',
      message: `Your appointment with Dr. ${appt.doctor_name || 'Specialist'} has been rescheduled to ${newDate} at ${this.formatTime12Hour(cleanTime)}. Token: ${appt.token_number}.`,
      type: 'appointment',
      link: `patient/appointment-details.html?id=${appointmentId}`
    });

    // 3. Notify Doctor
    try {
      const doc = await this.getDoctorById(appt.doctor_id);
      if (doc && doc.profile_id) {
        await this.createNotification({
          user_id: doc.profile_id,
          title: 'Patient Rescheduled Appointment',
          message: `Patient ${appt.patient_name || 'Patient'} rescheduled their consultation to ${newDate} at ${this.formatTime12Hour(cleanTime)} (Reason: ${reason || 'Patient request'}).`,
          type: 'appointment',
          link: 'doctor/appointments.html'
        });
      }
    } catch (e) {}

    // 4. Trigger Waiting List check for the vacated old slot
    try {
      await this.processWaitingListForVacatedSlot(appt.doctor_id, oldDate, oldSlot);
    } catch (e) {
      console.debug('Waiting list reallocation on reschedule note:', e);
    }

    this.emitSyncEvent('appointments');
    return data || { ...appt, ...updatePayload };
  },

  // ============================================================================
  // 16. DOCTOR AVAILABILITY AUTO CALCULATION (Feature 3)
  // ============================================================================
  async calculateDoctorAvailability(doctorId, targetDateStr = null, targetTimeStr = null) {
    const today = new Date();
    const localTodayStr = this.getLocalTodayDate(today);
    const dateStr = targetDateStr || localTodayStr;
    const targetDate = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[targetDate.getDay()];
    const isToday = dateStr === localTodayStr;

    const doctor = await this.getDoctorById(doctorId);
    if (!doctor || !doctor.is_active || !doctor.is_verified) {
      return {
        status: 'Not Available',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        badgeHtml: '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200"><span class="w-2 h-2 rounded-full bg-slate-400"></span>Not Available</span>',
        message: 'Doctor is currently inactive or unverified.',
        openSlotsCount: 0,
        totalSlots: 0,
        nextSlot: null
      };
    }

    // 1. Check Approved Leaves
    try {
      const leaves = await this.getDoctorLeaves(doctorId);
      const leave = (leaves || []).find(l => l.leave_date === dateStr);
      if (leave) {
        return {
          status: 'On Leave',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          badgeHtml: `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200"><span class="w-2 h-2 rounded-full bg-purple-500"></span>On Leave</span>`,
          message: `Doctor is on approved leave (${leave.reason || 'Personal Leave'}).`,
          openSlotsCount: 0,
          totalSlots: 0,
          nextSlot: null
        };
      }
    } catch (e) {}

    // 2. Check Doctor Schedule for this Day of Week
    const schedules = await this.getDoctorAvailability(doctorId);
    const daySchedule = (schedules || []).find(s => 
      s.day_of_week.toLowerCase() === dayName.toLowerCase() && s.is_available
    );

    if (!daySchedule) {
      return {
        status: 'Not Available',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        badgeHtml: `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200"><span class="w-2 h-2 rounded-full bg-slate-400"></span>Not Available</span>`,
        message: `Doctor does not have OPD scheduled on ${dayName}s.`,
        openSlotsCount: 0,
        totalSlots: 0,
        nextSlot: null
      };
    }

    // 3. Generate all slots
    const slotDuration = daySchedule.slot_duration_minutes || 30;
    const [startH, startM] = daySchedule.start_time.split(':').map(Number);
    const [endH, endM] = daySchedule.end_time.split(':').map(Number);

    let cur = new Date(targetDate);
    cur.setHours(startH, startM, 0, 0);
    const end = new Date(targetDate);
    end.setHours(endH, endM, 0, 0);

    const allSlots = [];
    while (cur < end) {
      const timeVal = cur.toTimeString().substring(0, 5);
      allSlots.push({
        timeVal,
        time12: this.formatTime12Hour(timeVal)
      });
      cur = new Date(cur.getTime() + slotDuration * 60000);
    }

    // 4. Check active appointments on this date
    const allAppointments = await this.getAppointments();
    const dayBookings = allAppointments.filter(a => 
      a.doctor_id === doctorId &&
      a.appointment_date === dateStr &&
      !['cancelled', 'rejected'].includes(a.status)
    );

    const currentTimeStr = targetTimeStr || this.getLocalCurrentTimeHHMM(today);
    const bookedTimeMap = new Set(dayBookings.map(b => (b.time_slot || b.appointment_time || '').substring(0, 5)));

    // Check if doctor currently has a patient in consultation room right now
    const activeInRoomApt = isToday ? dayBookings.find(b => 
      b.queue_status === 'in-room' || b.queue_status === 'called' || 
      b.status === 'in-consultation' || b.status === 'in_consultation' || b.status === 'in-progress' ||
      b.is_called === true
    ) : null;

    // Separate passed slots vs future slots for today
    const futureSlots = isToday ? allSlots.filter(s => s.timeVal > currentTimeStr) : allSlots;
    const availableSlots = futureSlots.filter(s => !bookedTimeMap.has(s.timeVal));

    const start12 = this.formatTime12Hour(daySchedule.start_time);
    const end12 = this.formatTime12Hour(daySchedule.end_time);
    const current12 = this.formatTime12Hour(currentTimeStr);

    if (allSlots.length > 0 && isToday && futureSlots.length === 0) {
      return {
        status: 'Not Available',
        allTodayPassed: true,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        badgeHtml: `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200"><span class="w-2 h-2 rounded-full bg-slate-400"></span>Hours Ended Today</span>`,
        message: `Today's OPD hours (${start12} – ${end12}) ended before ${current12}. Please select another date.`,
        openSlotsCount: 0,
        totalSlots: allSlots.length,
        nextSlot: null,
        scheduleWindow: `${start12} – ${end12}`
      };
    }

    if (futureSlots.length > 0 && availableSlots.length === 0) {
      return {
        status: 'Fully Booked',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeHtml: `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Fully Booked</span>`,
        message: 'All remaining appointment slots are fully booked for this date.',
        openSlotsCount: 0,
        totalSlots: allSlots.length,
        nextSlot: null,
        activeInRoomPatient: activeInRoomApt,
        scheduleWindow: `${start12} – ${end12}`
      };
    }

    if (activeInRoomApt) {
      return {
        status: 'Busy',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeHtml: `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Busy (In Consultation)</span>`,
        message: `Doctor is currently attending Token ${activeInRoomApt.token_number} in Room ${doctor.room_number || '101'}.`,
        openSlotsCount: availableSlots.length,
        totalSlots: allSlots.length,
        nextSlot: availableSlots[0]?.time12 || null,
        activeInRoomPatient: activeInRoomApt,
        scheduleWindow: `${start12} – ${end12}`
      };
    }

    return {
      status: 'Available',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeHtml: `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Available</span>`,
      message: `${availableSlots.length} slot(s) open for booking (${start12} – ${end12}).`,
      openSlotsCount: availableSlots.length,
      totalSlots: allSlots.length,
      nextSlot: availableSlots[0]?.time12 || null,
      scheduleWindow: `${start12} – ${end12}`
    };
  },

  // ============================================================================
  // 17. APPOINTMENT REMINDERS (Feature 4)
  // ============================================================================
  async checkAndSendAppointmentReminders() {
    const sb = getSupabaseClient();
    if (!sb) return { sent24h: 0, sent1h: 0 };

    const appointments = await this.getAppointments();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Only active upcoming appointments
    const activeUpcoming = appointments.filter(a => 
      ['confirmed', 'pending'].includes(a.status) &&
      a.appointment_date >= todayStr
    );

    let sent24h = 0;
    let sent1h = 0;

    let sentReminders = [];
    try {
      const { data, error } = await sb.from('appointment_reminders').select('*');
      if (!error && data) sentReminders = data;
    } catch (e) {}

    let localReminderStore = {};
    try {
      localReminderStore = JSON.parse(localStorage.getItem('carepulse_sent_reminders') || '{}');
    } catch (e) {}

    for (const appt of activeUpcoming) {
      const timeStr = appt.time_slot || appt.appointment_time || '09:00';
      const apptDateTime = new Date(`${appt.appointment_date}T${timeStr}:00`);
      const diffMs = apptDateTime - today;
      const hoursUntil = diffMs / (1000 * 60 * 60);

      const hasSent24h = sentReminders.some(r => r.appointment_id === appt.id && r.reminder_type === '24h') ||
                         localReminderStore[`${appt.id}_24h`];

      const hasSent1h = sentReminders.some(r => r.appointment_id === appt.id && r.reminder_type === '1h') ||
                        localReminderStore[`${appt.id}_1h`];

      // 24 Hour Reminder: between 1 and 24 hours prior
      if (hoursUntil <= 24 && hoursUntil > 1 && !hasSent24h) {
        try {
          await this.createNotification({
            user_id: appt.patient_id,
            title: 'Appointment Reminder: Tomorrow',
            message: `Reminder: You have an appointment tomorrow with Dr. ${appt.doctor_name} at ${this.formatTime12Hour(timeStr)}. Token: ${appt.token_number}. Please arrive 15 minutes prior.`,
            type: 'reminder',
            link: `patient/appointment-details.html?id=${appt.id}`
          });

          try {
            await sb.from('appointment_reminders').insert([{
              appointment_id: appt.id,
              patient_id: appt.patient_id,
              reminder_type: '24h',
              scheduled_for: apptDateTime.toISOString(),
              sent_at: new Date().toISOString(),
              status: 'sent'
            }]);
          } catch (e) {}

          localReminderStore[`${appt.id}_24h`] = true;
          sent24h++;
        } catch (err) {
          console.warn('Error sending 24h reminder:', err);
        }
      }

      // 1 Hour Reminder: between 0 and 1 hour prior
      if (hoursUntil <= 1 && hoursUntil > 0 && !hasSent1h) {
        try {
          await this.createNotification({
            user_id: appt.patient_id,
            title: 'Appointment Reminder: Starting in 1 Hour',
            message: `Reminder: Your consultation with Dr. ${appt.doctor_name} starts in approximately 1 hour at ${this.formatTime12Hour(timeStr)}. Token: ${appt.token_number}. Room: ${appt.room_number || 'Room 101'}. Track your live queue status.`,
            type: 'reminder',
            link: `patient/queue-status.html?id=${appt.id}`
          });

          try {
            await sb.from('appointment_reminders').insert([{
              appointment_id: appt.id,
              patient_id: appt.patient_id,
              reminder_type: '1h',
              scheduled_for: apptDateTime.toISOString(),
              sent_at: new Date().toISOString(),
              status: 'sent'
            }]);
          } catch (e) {}

          localReminderStore[`${appt.id}_1h`] = true;
          sent1h++;
        } catch (err) {
          console.warn('Error sending 1h reminder:', err);
        }
      }
    }

    try {
      localStorage.setItem('carepulse_sent_reminders', JSON.stringify(localReminderStore));
    } catch (e) {}

    return { sent24h, sent1h };
  },

  startReminderScheduler() {
    if (window._carepulseReminderTimer) return;
    this.checkAndSendAppointmentReminders().catch(() => {});
    window._carepulseReminderTimer = setInterval(() => {
      this.checkAndSendAppointmentReminders().catch(() => {});
    }, 60000);
  },

  // ============================================================================
  // 18. DOCTOR DELAY MANAGEMENT (Feature 5)
  // ============================================================================
  async reportDoctorDelay(doctorId, delayMinutes, reason = '', broadcast = true) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const cleanDelay = Math.max(0, parseInt(delayMinutes, 10) || 0);
    const nowIso = new Date().toISOString();

    const doctor = await this.getDoctorById(doctorId);
    if (!doctor) throw new Error('Doctor not found');

    // 1. Update doctors table
    try {
      await sb
        .from('doctors')
        .update({
          delay_minutes: cleanDelay,
          delay_reason: reason,
          delay_reported_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', doctorId);
    } catch (e) {
      console.warn('Doctor delay column update note:', e);
    }

    // Fallback store
    try {
      const delaysMap = JSON.parse(localStorage.getItem('carepulse_doctor_delays') || '{}');
      delaysMap[doctorId] = {
        delay_minutes: cleanDelay,
        delay_reason: reason,
        delay_reported_at: nowIso
      };
      localStorage.setItem('carepulse_doctor_delays', JSON.stringify(delaysMap));
    } catch (e) {}

    // 2. Audit Log
    await this.logAuditEvent({
      action: cleanDelay > 0 ? 'DOCTOR_DELAY_REPORTED' : 'DOCTOR_DELAY_CLEARED',
      entity_type: 'doctor',
      entity_id: doctorId,
      details: {
        doctor_name: doctor.doctor_name || 'Doctor',
        delay_minutes: cleanDelay,
        reason
      }
    });

    // 3. Broadcast notification to affected patients today
    if (broadcast && cleanDelay > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const allAppointments = await this.getAppointments();
      const affectedPatients = allAppointments.filter(a => 
        a.doctor_id === doctorId &&
        a.appointment_date === todayStr &&
        ['pending', 'confirmed', 'checked_in'].includes(a.status)
      );

      for (const appt of affectedPatients) {
        try {
          await this.createNotification({
            user_id: appt.patient_id,
            title: 'OPD Schedule Delay Notice',
            message: `Notice: Dr. ${doctor.doctor_name || 'Specialist'} is running approximately ${cleanDelay} minutes behind schedule (${reason || 'OPD Delay'}). Your estimated waiting time has been adjusted.`,
            type: 'queue',
            link: `patient/queue-status.html?id=${appt.id}`
          });
        } catch (e) {}
      }
    }

    this.emitSyncEvent('doctors');

    return {
      doctorId,
      delay_minutes: cleanDelay,
      delay_reason: reason,
      delay_reported_at: nowIso
    };
  },

  async clearDoctorDelay(doctorId) {
    return this.reportDoctorDelay(doctorId, 0, 'Schedule cleared - running on time', true);
  },

  async getDoctorDelay(doctorId) {
    const sb = getSupabaseClient();
    let delayInfo = { delay_minutes: 0, delay_reason: '', delay_reported_at: null };

    if (sb) {
      try {
        const { data, error } = await sb
          .from('doctors')
          .select('delay_minutes, delay_reason, delay_reported_at')
          .eq('id', doctorId)
          .maybeSingle();
        if (!error && data) {
          delayInfo = {
            delay_minutes: data.delay_minutes || 0,
            delay_reason: data.delay_reason || '',
            delay_reported_at: data.delay_reported_at || null
          };
        }
      } catch (e) {}
    }

    try {
      const delaysMap = JSON.parse(localStorage.getItem('carepulse_doctor_delays') || '{}');
      if (delaysMap[doctorId] && (delaysMap[doctorId].delay_minutes || delaysMap[doctorId].delay_minutes === 0)) {
        delayInfo = delaysMap[doctorId];
      }
    } catch (e) {}

    return delayInfo;
  },

  // ============================================================================
  // 19. WAITING LIST & AUTO SLOT REALLOCATION (Feature 6)
  // ============================================================================
  async addToWaitingList({ patientId, doctorId, preferredDate, preferredTimeRange = 'any', reason = '', symptoms = '' }) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const cleanDate = preferredDate;
    const cleanTimeRange = preferredTimeRange || 'any';
    const cleanReason = reason || symptoms || 'Consultation request';

    const doctor = await this.getDoctorById(doctorId);
    const doctorName = doctor ? doctor.doctor_name : 'Specialist';

    let entry = null;

    try {
      const { data, error } = await sb
        .from('waiting_list')
        .insert([{
          patient_id: patientId,
          doctor_id: doctorId,
          preferred_date: cleanDate,
          preferred_time_range: cleanTimeRange,
          reason: cleanReason,
          symptoms: symptoms,
          status: 'waiting',
          priority: 1
        }])
        .select()
        .single();

      if (!error && data) entry = data;
    } catch (e) {
      console.warn('waiting_list table insert note:', e);
    }

    if (!entry) {
      const localList = JSON.parse(localStorage.getItem('carepulse_waiting_list') || '[]');
      entry = {
        id: 'wait-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        patient_id: patientId,
        doctor_id: doctorId,
        preferred_date: cleanDate,
        preferred_time_range: cleanTimeRange,
        reason: cleanReason,
        symptoms: symptoms,
        status: 'waiting',
        priority: 1,
        created_at: new Date().toISOString()
      };
      localList.push(entry);
      localStorage.setItem('carepulse_waiting_list', JSON.stringify(localList));
    }

    // 1. Audit Log
    await this.logAuditEvent({
      action: 'WAITING_LIST_JOINED',
      entity_type: 'waiting_list',
      entity_id: entry.id,
      details: {
        patient_id: patientId,
        doctor_id: doctorId,
        preferred_date: cleanDate,
        preferred_time_range: cleanTimeRange
      }
    });

    // 2. Notify Patient
    await this.createNotification({
      user_id: patientId,
      title: 'Joined Priority Waiting List',
      message: `You are on the waiting list for Dr. ${doctorName} on ${cleanDate}. You will receive an instant alert if an appointment slot opens up.`,
      type: 'queue',
      link: 'patient/appointments.html'
    });

    this.emitSyncEvent('waiting_list');
    return entry;
  },

  async getWaitingList(filters = {}) {
    const sb = getSupabaseClient();
    let list = [];

    if (sb) {
      try {
        let query = sb.from('waiting_list').select(`
          *,
          profiles:patient_id (full_name, email, phone),
          doctors:doctor_id (
            id, specialization, room_number,
            profiles (full_name)
          )
        `).order('created_at', { ascending: true });

        if (filters.patientId) query = query.eq('patient_id', filters.patientId);
        if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.date) query = query.eq('preferred_date', filters.date);

        const { data, error } = await query;
        if (!error && data) {
          list = data.map(item => ({
            ...item,
            patient_name: item.profiles?.full_name || 'Patient',
            patient_phone: item.profiles?.phone || '',
            doctor_name: item.doctors?.profiles?.full_name || 'Dr. Specialist',
            doctor_specialization: item.doctors?.specialization || 'Specialist'
          }));
        }
      } catch (e) {}
    }

    try {
      const localList = JSON.parse(localStorage.getItem('carepulse_waiting_list') || '[]');
      if (localList.length > 0) {
        const existingIds = new Set(list.map(i => i.id));
        for (const item of localList) {
          if (!existingIds.has(item.id)) {
            if (filters.patientId && item.patient_id !== filters.patientId) continue;
            if (filters.doctorId && item.doctor_id !== filters.doctorId) continue;
            if (filters.status && item.status !== filters.status) continue;
            if (filters.date && item.preferred_date !== filters.date) continue;
            list.push(item);
          }
        }
      }
    } catch (e) {}

    return list;
  },

  async processWaitingListForVacatedSlot(doctorId, dateStr, timeSlotStr) {
    const sb = getSupabaseClient();
    const cleanSlot = (timeSlotStr || '').substring(0, 5);

    const waitingEntries = await this.getWaitingList({
      doctorId,
      date: dateStr,
      status: 'waiting'
    });

    if (waitingEntries.length === 0) {
      return { reallocated: false, message: 'No waiting list entries for this slot.' };
    }

    const targetEntry = waitingEntries[0];
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();

    const doctor = await this.getDoctorById(doctorId);
    const doctorName = doctor ? doctor.doctor_name : 'Specialist';

    if (sb) {
      try {
        await sb.from('waiting_list').update({
          status: 'offered',
          offered_time_slot: cleanSlot,
          offer_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }).eq('id', targetEntry.id);
      } catch (e) {}
    }

    try {
      const localList = JSON.parse(localStorage.getItem('carepulse_waiting_list') || '[]');
      const match = localList.find(i => i.id === targetEntry.id);
      if (match) {
        match.status = 'offered';
        match.offered_time_slot = cleanSlot;
        match.offer_expires_at = expiresAt;
        localStorage.setItem('carepulse_waiting_list', JSON.stringify(localList));
      }
    } catch (e) {}

    await this.createNotification({
      user_id: targetEntry.patient_id,
      title: 'Priority Slot Released!',
      message: `A released appointment slot for Dr. ${doctorName} on ${dateStr} at ${this.formatTime12Hour(cleanSlot)} is now available for you! Click to accept within 30 minutes.`,
      type: 'queue',
      link: `patient/appointments.html?offer=${targetEntry.id}`
    });

    this.emitSyncEvent('waiting_list');

    return {
      reallocated: true,
      waitingId: targetEntry.id,
      patientId: targetEntry.patient_id,
      slot: cleanSlot,
      expiresAt
    };
  },

  async processWaitingListForCancelledSlot(appointmentId) {
    const appt = await this.getAppointmentById(appointmentId);
    if (!appt) return;
    return this.processWaitingListForVacatedSlot(
      appt.doctor_id,
      appt.appointment_date,
      appt.time_slot || appt.appointment_time
    );
  },

  async acceptWaitingListOffer(waitingId) {
    const list = await this.getWaitingList();
    const entry = list.find(i => i.id === waitingId);
    if (!entry) throw new Error('Waiting list offer not found.');

    if (entry.status !== 'offered') {
      throw new Error(`This offer is no longer valid (current status: ${entry.status}).`);
    }

    if (entry.offer_expires_at && new Date(entry.offer_expires_at) < new Date()) {
      await this.declineWaitingListOffer(waitingId, 'Offer expired');
      throw new Error('This slot offer has expired (30-minute window exceeded).');
    }

    // Book the appointment as confirmed (released slot allocation)
    const newAppointment = await this.createAppointment({
      patient_id: entry.patient_id,
      doctor_id: entry.doctor_id,
      appointment_date: entry.preferred_date,
      time_slot: entry.offered_time_slot,
      reason: entry.reason || 'Priority Waiting List Allocation',
      priority: 'normal',
      status: 'confirmed'
    });

    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.from('waiting_list').update({
          status: 'booked',
          updated_at: new Date().toISOString()
        }).eq('id', waitingId);
      } catch (e) {}
    }

    try {
      const localList = JSON.parse(localStorage.getItem('carepulse_waiting_list') || '[]');
      const match = localList.find(i => i.id === waitingId);
      if (match) {
        match.status = 'booked';
        localStorage.setItem('carepulse_waiting_list', JSON.stringify(localList));
      }
    } catch (e) {}

    await this.logAuditEvent({
      action: 'WAITING_LIST_OFFER_ACCEPTED',
      entity_type: 'waiting_list',
      entity_id: waitingId,
      details: {
        appointment_id: newAppointment.id,
        token_number: newAppointment.token_number
      }
    });

    await this.createNotification({
      user_id: entry.patient_id,
      title: 'Appointment Confirmed from Waiting List',
      message: `Your appointment has been confirmed! Token: ${newAppointment.token_number} on ${entry.preferred_date} at ${this.formatTime12Hour(entry.offered_time_slot)}.`,
      type: 'appointment',
      link: `patient/appointment-details.html?id=${newAppointment.id}`
    });

    this.emitSyncEvent('waiting_list');
    this.emitSyncEvent('appointments');
    return newAppointment;
  },

  async declineWaitingListOffer(waitingId, reason = 'Declined by patient') {
    const list = await this.getWaitingList();
    const entry = list.find(i => i.id === waitingId);
    if (!entry) return;

    const sb = getSupabaseClient();
    const isExpired = reason.toLowerCase().includes('expired');
    const newStatus = isExpired ? 'expired' : 'declined';

    if (sb) {
      try {
        await sb.from('waiting_list').update({
          status: newStatus,
          updated_at: new Date().toISOString()
        }).eq('id', waitingId);
      } catch (e) {}
    }

    try {
      const localList = JSON.parse(localStorage.getItem('carepulse_waiting_list') || '[]');
      const match = localList.find(i => i.id === waitingId);
      if (match) {
        match.status = newStatus;
        localStorage.setItem('carepulse_waiting_list', JSON.stringify(localList));
      }
    } catch (e) {}

    if (entry.offered_time_slot) {
      try {
        await this.processWaitingListForVacatedSlot(
          entry.doctor_id,
          entry.preferred_date,
          entry.offered_time_slot
        );
      } catch (e) {}
    }

    this.emitSyncEvent('waiting_list');
  },

  async checkExpiredWaitingOffers() {
    const list = await this.getWaitingList({ status: 'offered' });
    const now = new Date();
    for (const item of list) {
      if (item.offer_expires_at && new Date(item.offer_expires_at) < now) {
        await this.declineWaitingListOffer(item.id, 'Offer expired (30 mins exceeded)');
      }
    }
  },

  // ============================================================================
  // 20. DIRECT PATIENT CALL & REALTIME TWO-WAY CHAT API
  // ============================================================================
  async directCallPatient(appointmentId, doctorId) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client not connected');

    const now = new Date().toISOString();
    const { data: appt, error } = await sb
      .from('appointments')
      .update({
        queue_status: 'called',
        is_called: true,
        called_at: now,
        updated_at: now
      })
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (appt && appt.patient_id) {
      await this.createNotification({
        user_id: appt.patient_id,
        title: '🔔 Consultation Calling!',
        message: `Dr. is now calling Token ${appt.token_number} into ${appt.room_number || 'Room 101'}. Please proceed inside immediately!`,
        type: 'queue',
        link: 'queue-status.html'
      });
    }

    // Dispatch real-time DB change event & patient called event
    this.emitSyncEvent('appointments');
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carepulse_patient_called', { detail: { appointmentId, token: appt?.token_number } }));
    }

    return appt;
  },

  async sendChatMessage({ appointmentId, doctorId, patientId, senderId, senderRole, senderName, message }) {
    const sb = getSupabaseClient();
    const payload = {
      appointment_id: appointmentId,
      doctor_id: doctorId || null,
      patient_id: patientId || null,
      sender_id: senderId,
      sender_role: senderRole,
      sender_name: senderName,
      message: message.trim(),
      created_at: new Date().toISOString()
    };

    let result = null;
    if (sb) {
      try {
        const { data, error } = await sb
          .from('chat_messages')
          .insert([payload])
          .select()
          .maybeSingle();
        if (!error && data) {
          result = data;
        }
      } catch (e) {
        console.warn('Chat remote insert note, using resilient local storage:', e);
      }
    }

    if (!result) {
      // Offline fallback: save to localStorage
      result = { id: 'local-' + Date.now(), ...payload };
      try {
        const key = `carepulse_chat_${appointmentId}`;
        const local = JSON.parse(localStorage.getItem(key) || '[]');
        local.push(result);
        localStorage.setItem(key, JSON.stringify(local));
      } catch (e) {}
    }

    // Trigger Notification for the recipient
    try {
      const recipientId = (senderRole === 'patient') ? doctorId : patientId;
      if (recipientId) {
        await this.createNotification({
          user_id: recipientId,
          title: `💬 New Message from ${senderName}`,
          message: message.length > 60 ? message.substring(0, 57) + '...' : message,
          type: 'chat',
          link: senderRole === 'patient' ? 'doctor/appointments.html' : 'patient/appointments.html'
        });
      }
    } catch (e) {}

    // Dispatch local UI event & cross-tab sync
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carepulse_new_chat_message', { detail: result }));
    }
    this.emitSyncEvent('chat_messages');

    return result;
  },

  async getChatMessages(appointmentId) {
    const sb = getSupabaseClient();
    let remoteMsgs = [];

    if (sb) {
      try {
        const { data, error } = await sb
          .from('chat_messages')
          .select('*')
          .eq('appointment_id', appointmentId)
          .order('created_at', { ascending: true });
        if (!error && data) {
          remoteMsgs = data;
        }
      } catch (e) {
        console.warn('Chat messages query error:', e);
      }
    }

    // Merge with local fallback
    let localMsgs = [];
    try {
      const key = `carepulse_chat_${appointmentId}`;
      localMsgs = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {}

    const all = [...remoteMsgs];
    localMsgs.forEach(lm => {
      if (!all.some(rm => rm.id === lm.id || (rm.created_at === lm.created_at && rm.message === lm.message))) {
        all.push(lm);
      }
    });

    return all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },

  subscribeToChat(appointmentId, callback) {
    const sb = getSupabaseClient();
    let channel = null;

    if (sb) {
      try {
        channel = sb
          .channel(`chat_${appointmentId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `appointment_id=eq.${appointmentId}` },
            (payload) => {
              if (callback && payload.new) callback(payload.new);
            }
          )
          .subscribe();
      } catch (e) {}
    }

    // Local event listener fallback
    const localHandler = (e) => {
      if (e.detail && e.detail.appointment_id === appointmentId) {
        if (callback) callback(e.detail);
      }
    };
    window.addEventListener('carepulse_new_chat_message', localHandler);

    return () => {
      if (channel && sb) sb.removeChannel(channel);
      window.removeEventListener('carepulse_new_chat_message', localHandler);
    };
  },

  async markMessagesAsRead(appointmentId, currentUserId) {
    const sb = getSupabaseClient();
    if (!sb) return;

    try {
      await sb
        .from('chat_messages')
        .update({ is_read: true })
        .eq('appointment_id', appointmentId)
        .neq('sender_id', currentUserId);
    } catch (e) {}
  },

  // ============================================================================
  // MODULE 1 & 3: CITIES, HOSPITALS & LOCATION DIRECTORY
  // ============================================================================
  async getCities(filters = {}) {
    if (window.LocationService) {
      return await window.LocationService.getCities(filters);
    }
    const sb = getSupabaseClient();
    if (!sb) return [];
    try {
      const { data } = await sb.from('cities').select('*').eq('is_active', true);
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async getCityById(id) {
    if (window.LocationService) {
      return await window.LocationService.getCityById(id);
    }
    const sb = getSupabaseClient();
    if (!sb) return null;
    try {
      const { data } = await sb.from('cities').select('*').eq('id', id).maybeSingle();
      return data;
    } catch (e) {
      return null;
    }
  },

  async getHospitals(filters = {}) {
    const sb = getSupabaseClient();
    const CORE_HOSPITALS = [
      {
        id: 'c0000000-0000-0000-0000-000000000001',
        name: 'CarePulse Central Hospital',
        hospital_type: 'Super-specialty',
        registration_number: 'REG-MH-MUM-2021-089',
        license_number: 'LIC-MCGM-HOSP-4491',
        city_id: '10000000-0000-0000-0000-000000000001',
        address: '742 Healthcare Boulevard, Bandra West, Mumbai',
        city_name: 'Mumbai',
        district_name: 'Mumbai',
        state_name: 'Maharashtra',
        pincode: '400050',
        latitude: 19.0596,
        longitude: 72.8295,
        email: 'contact@carepulse.hospital',
        phone: '+91 22 4910 8000',
        emergency_phone: '+91 22 4910 9999',
        website: 'https://carepulse.hospital',
        logo_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
        cover_image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800',
        facilities: ["ICU", "Emergency 24x7", "Cardiac Cath Lab", "MRI / CT Scan", "Pharmacy 24x7", "Dialysis", "Blood Bank", "Advanced Trauma Care"],
        total_beds: 350,
        verification_status: 'approved',
        is_active: true
      },
      {
        id: 'c0000000-0000-0000-0000-000000000002',
        name: 'CarePulse District Multi-Specialty Hospital',
        hospital_type: 'Private Multi-specialty',
        registration_number: 'REG-MH-YTL-2022-014',
        license_number: 'LIC-DHS-YTL-1082',
        city_id: '10000000-0000-0000-0000-000000000004',
        address: 'Station Road, Near Civil Lines, Yavatmal',
        city_name: 'Yavatmal',
        district_name: 'Yavatmal',
        state_name: 'Maharashtra',
        pincode: '445001',
        latitude: 20.3888,
        longitude: 78.1204,
        email: 'yavatmal@carepulse.hospital',
        phone: '+91 7232 254100',
        emergency_phone: '+91 7232 254108',
        website: 'https://carepulse.hospital/yavatmal',
        logo_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400',
        cover_image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800',
        facilities: ["Emergency 24x7", "ICU", "Pharmacy", "Laboratory", "General Surgery", "Pediatrics", "Digital X-Ray", "Teleconsultation Room"],
        total_beds: 120,
        verification_status: 'approved',
        is_active: true
      },
      {
        id: 'c0000000-0000-0000-0000-000000000003',
        name: 'CarePulse Metro Specialty Center',
        hospital_type: 'Super-specialty',
        registration_number: 'REG-MH-PUN-2020-045',
        license_number: 'LIC-PMC-HOSP-7781',
        city_id: '10000000-0000-0000-0000-000000000002',
        address: 'FC Road, Shivaji Nagar, Pune',
        city_name: 'Pune',
        district_name: 'Pune',
        state_name: 'Maharashtra',
        pincode: '411005',
        latitude: 18.5314,
        longitude: 73.8446,
        email: 'pune@carepulse.hospital',
        phone: '+91 20 2567 1100',
        emergency_phone: '+91 20 2567 1199',
        website: 'https://carepulse.hospital/pune',
        logo_url: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400',
        cover_image: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=800',
        facilities: ["ICU", "NICU", "Emergency 24x7", "Pharmacy", "Robotic Surgery", "Oncology Wing"],
        total_beds: 220,
        verification_status: 'approved',
        is_active: true
      },
      {
        id: 'c0000000-0000-0000-0000-000000000004',
        name: 'CarePulse Regional Medical Institute',
        hospital_type: 'Super-specialty',
        registration_number: 'REG-MH-NGP-2023-102',
        license_number: 'LIC-NMC-HOSP-3312',
        city_id: '10000000-0000-0000-0000-000000000003',
        address: 'Central Avenue, Ramdaspeth, Nagpur',
        city_name: 'Nagpur',
        district_name: 'Nagpur',
        state_name: 'Maharashtra',
        pincode: '440010',
        latitude: 21.1352,
        longitude: 79.0722,
        email: 'nagpur@carepulse.hospital',
        phone: '+91 712 245 8800',
        emergency_phone: '+91 712 245 8899',
        website: 'https://carepulse.hospital/nagpur',
        logo_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
        cover_image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800',
        facilities: ["Trauma Care", "Neurology ICU", "Emergency 24x7", "Pharmacy", "Advanced Diagnostic Wing"],
        total_beds: 280,
        verification_status: 'approved',
        is_active: true
      }
    ];

    if (!sb) return CORE_HOSPITALS;

    try {
      let query = sb
        .from('hospitals')
        .select(`
          *,
          cities (
            id,
            state_name,
            district_name,
            city_name,
            pincode,
            latitude,
            longitude
          )
        `);

      if (!filters.includeUnapproved) {
        query = query.eq('verification_status', 'approved').eq('is_active', true);
      }
      if (filters.cityId) {
        query = query.eq('city_id', filters.cityId);
      }
      if (filters.hospitalType) {
        query = query.eq('hospital_type', filters.hospitalType);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(h => ({
          ...h,
          city_name: h.cities?.city_name || h.district_name || 'Mumbai',
          district_name: h.cities?.district_name || h.district_name || 'Mumbai',
          state_name: h.cities?.state_name || h.state_name || 'Maharashtra',
          pincode: h.cities?.pincode || h.pincode || '',
          latitude: Number(h.latitude || h.cities?.latitude || 19.0760),
          longitude: Number(h.longitude || h.cities?.longitude || 72.8777)
        }));
      }
    } catch (e) {
      console.warn('Supabase getHospitals note:', e.message);
    }

    return CORE_HOSPITALS;
  },

  async getHospitalById(id) {
    const list = await this.getHospitals({ includeUnapproved: true });
    return list.find(h => h.id === id) || null;
  },

  async getDoctorHospitals(doctorId) {
    const sb = getSupabaseClient();
    if (!sb) return [];
    try {
      const { data, error } = await sb
        .from('doctor_hospitals')
        .select(`
          *,
          hospitals (*)
        `)
        .eq('doctor_id', doctorId)
        .eq('affiliation_status', 'approved');

      if (!error && Array.isArray(data) && data.length > 0) return data;
    } catch (e) {}

    return [{
      doctor_id: doctorId,
      hospital_id: 'c0000000-0000-0000-0000-000000000001',
      hospital_name: 'CarePulse Central Hospital',
      is_primary: true,
      affiliation_status: 'approved'
    }];
  },

  async getHospitalDoctors(hospitalId) {
    const sb = getSupabaseClient();
    const allDocs = await this.getDoctors();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('doctor_hospitals')
          .select('doctor_id, opd_room, consultation_fee, is_primary')
          .eq('hospital_id', hospitalId)
          .eq('affiliation_status', 'approved');

        if (!error && Array.isArray(data) && data.length > 0) {
          const docMap = new Map(allDocs.map(d => [d.id, d]));
          const matched = data.map(dh => {
            const doc = docMap.get(dh.doctor_id);
            if (!doc) return null;
            return {
              ...doc,
              room_number: dh.opd_room || doc.room_number || 'OPD-1',
              consultation_fee: dh.consultation_fee || doc.consultation_fee || 50,
              is_primary_hospital: dh.is_primary === true
            };
          }).filter(Boolean);
          if (matched.length > 0) return matched;
        }
      } catch (e) {
        console.warn('getHospitalDoctors note:', e.message);
      }
    }
    // Fallback: match doctors to hospital city or return top doctors
    const hosp = await this.getHospitalById(hospitalId);
    if (hosp && hosp.city_name) {
      const cityDocs = allDocs.filter(d => d.city_name && d.city_name.toLowerCase() === hosp.city_name.toLowerCase());
      if (cityDocs.length > 0) return cityDocs;
    }
    return allDocs.slice(0, 4);
  },

  async searchDoctorsByLocation(options = {}) {
    const doctors = await this.getDoctors();
    let approved = doctors.filter(d => (d.verification_status || 'approved') === 'approved' && d.is_active !== false);

    if (options.specialty) {
      const spec = options.specialty.toLowerCase();
      approved = approved.filter(d =>
        (d.specialization && d.specialization.toLowerCase().includes(spec)) ||
        (d.department_name && d.department_name.toLowerCase().includes(spec))
      );
    }

    if (options.consultationMode && options.consultationMode !== 'all') {
      const mode = options.consultationMode;
      approved = approved.filter(d => {
        const dMode = d.consultation_modes || 'both';
        return dMode === 'both' || dMode === mode;
      });
    }

    if (options.city) {
      const c = options.city.toLowerCase();
      approved = approved.filter(d =>
        (d.city_name && d.city_name.toLowerCase() === c) ||
        (d.address && d.address.toLowerCase().includes(c)) ||
        (d.hospital_name && d.hospital_name.toLowerCase().includes(c))
      );
    }

    if (options.userLat && options.userLng && window.LocationService) {
      const radius = options.radiusKm || 50;
      approved = window.LocationService.filterNearby(approved, options.userLat, options.userLng, radius);
    }

    return approved;
  },

  async searchHospitalsByLocation(options = {}) {
    const hospitals = await this.getHospitals();
    let approved = hospitals.filter(h => (h.verification_status || 'approved') === 'approved' && h.is_active !== false);

    if (options.search) {
      const q = options.search.toLowerCase();
      approved = approved.filter(h =>
        (h.name && h.name.toLowerCase().includes(q)) ||
        (h.city_name && h.city_name.toLowerCase().includes(q)) ||
        (h.district_name && h.district_name.toLowerCase().includes(q)) ||
        (h.address && h.address.toLowerCase().includes(q)) ||
        (h.facilities && JSON.stringify(h.facilities).toLowerCase().includes(q))
      );
    }

    if (options.state && options.state !== 'all') {
      const st = options.state.toLowerCase();
      approved = approved.filter(h => h.state_name && h.state_name.toLowerCase() === st);
    }

    if (options.city && options.city !== 'all') {
      const c = options.city.toLowerCase();
      approved = approved.filter(h =>
        (h.city_name && h.city_name.toLowerCase() === c) ||
        (h.district_name && h.district_name.toLowerCase() === c) ||
        (h.address && h.address.toLowerCase().includes(c))
      );
    }

    if (options.hospitalType && options.hospitalType !== 'all') {
      const ht = options.hospitalType.toLowerCase();
      approved = approved.filter(h => h.hospital_type && h.hospital_type.toLowerCase() === ht);
    }

    if (options.facility && options.facility !== 'all') {
      const fac = options.facility.toLowerCase();
      approved = approved.filter(h =>
        h.facilities && JSON.stringify(h.facilities).toLowerCase().includes(fac)
      );
    }

    if (options.userLat && options.userLng && window.LocationService) {
      const radius = options.radiusKm || 0;
      if (radius > 0) {
        approved = window.LocationService.filterNearby(approved, options.userLat, options.userLng, radius);
      }
    }

    return approved;
  },

  // ============================================================================
  // MODULE 2, 3 & 4: INDEPENDENT REGISTRATION & ADMIN VERIFICATION
  // ============================================================================
  async verifyDoctor({ doctorId, adminId, decision, reason }) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory justification reason is required for administrative audit.');
    }
    const validDecisions = ['approved', 'rejected', 'under_review', 'suspended'];
    if (!validDecisions.includes(decision)) {
      throw new Error(`Invalid verification decision. Must be one of: ${validDecisions.join(', ')}`);
    }

    // Strict No Self-Approval Guard
    if (doctorId === adminId) {
      throw new Error('Self-approval violation: Administrators cannot verify or approve their own professional profile.');
    }
    const doc = await this.getDoctorById(doctorId);
    if (doc && (doc.profile_id === adminId || doc.id === adminId)) {
      throw new Error('Self-approval violation: Administrators cannot verify or approve their own professional profile.');
    }

    const sb = getSupabaseClient();
    const isVerified = (decision === 'approved');

    if (sb) {
      try {
        await sb.from('doctors').update({
          verification_status: decision,
          is_verified: isVerified,
          admin_reviewed_by: adminId,
          admin_review_reason: reason.trim(),
          admin_reviewed_at: new Date().toISOString()
        }).eq('id', doctorId);
      } catch (e) {
        console.warn('verifyDoctor db update note:', e.message);
      }
    }

    if (doc) {
      doc.verification_status = decision;
      doc.is_verified = isVerified;
    }

    await this.logAuditEvent({
      action: `doctor_verification_${decision}`,
      entity_type: 'doctor',
      entity_id: doctorId,
      details: {
        adminId,
        decision,
        reason: reason.trim(),
        timestamp: new Date().toISOString()
      }
    });

    return { success: true, doctorId, decision, reason: reason.trim() };
  },

  async verifyHospital({ hospitalId, adminId, decision, reason }) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory justification reason is required for administrative audit.');
    }
    const validDecisions = ['approved', 'rejected', 'under_review', 'suspended'];
    if (!validDecisions.includes(decision)) {
      throw new Error(`Invalid verification decision. Must be one of: ${validDecisions.join(', ')}`);
    }

    // Strict No Self-Approval Guard
    if (hospitalId === adminId) {
      throw new Error('Self-approval violation: Administrators cannot verify or approve their own hospital registration.');
    }
    const hosp = await this.getHospitalById(hospitalId);
    if (hosp && hosp.profile_id === adminId) {
      throw new Error('Self-approval violation: Administrators cannot verify or approve their own hospital registration.');
    }

    const sb = getSupabaseClient();
    const isActive = (decision === 'approved');

    if (sb) {
      try {
        await sb.from('hospitals').update({
          verification_status: decision,
          is_active: isActive,
          admin_reviewed_by: adminId,
          admin_review_reason: reason.trim(),
          admin_reviewed_at: new Date().toISOString()
        }).eq('id', hospitalId);
      } catch (e) {
        console.warn('verifyHospital db update note:', e.message);
      }
    }

    if (hosp) {
      hosp.verification_status = decision;
      hosp.is_active = isActive;
    }

    await this.logAuditEvent({
      action: `hospital_verification_${decision}`,
      entity_type: 'hospital',
      entity_id: hospitalId,
      details: {
        adminId,
        decision,
        reason: reason.trim(),
        timestamp: new Date().toISOString()
      }
    });

    return { success: true, hospitalId, decision, reason: reason.trim() };
  },

  async registerHospital({
    name,
    hospital_type = 'Private Multi-specialty',
    email,
    phone,
    emergency_phone,
    address,
    city_id,
    city_name,
    district_name,
    state_name,
    pincode,
    license_number,
    registration_number,
    facilities = [],
    total_beds = 50,
    authorized_person_name,
    authorized_person_designation,
    logo_url,
    documents = []
  }) {
    const sb = getSupabaseClient();
    const newHospitalId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'hosp-' + Date.now();

    const hospRecord = {
      id: newHospitalId,
      name,
      hospital_type,
      email: email || '',
      phone: phone || '',
      emergency_phone: emergency_phone || phone || '',
      address,
      city_id: city_id || null,
      district_name: district_name || city_name || '',
      state_name: state_name || 'Maharashtra',
      pincode: pincode || '',
      license_number: license_number || '',
      registration_number: registration_number || '',
      facilities: facilities.length > 0 ? facilities : ["ICU", "Emergency 24x7", "Pharmacy", "Laboratory"],
      total_beds: parseInt(total_beds, 10) || 50,
      authorized_person_name: authorized_person_name || '',
      authorized_person_designation: authorized_person_designation || 'Administrator',
      logo_url: logo_url || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
      verification_status: 'pending',
      is_active: false,
      created_at: new Date().toISOString()
    };

    if (sb) {
      try {
        await sb.from('hospitals').insert(hospRecord);
      } catch (e) {
        console.warn('registerHospital insert note:', e.message);
      }
    }

    return hospRecord;
  },

  // ============================================================================
  // MODULE 6: CROSS-CITY REFERRAL SYSTEM ENGINE
  // ============================================================================
  async recordPatientConsent({ patientId, referralId, grantedToDoctorId, consentType = 'medical_record_sharing' }) {
    const sb = getSupabaseClient();
    const consentRecord = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'consent-' + Date.now(),
      patient_id: patientId,
      referral_id: referralId || null,
      consent_type: consentType,
      granted_to_doctor_id: grantedToDoctorId || null,
      is_consent_active: true,
      consent_timestamp: new Date().toISOString(),
      ip_address: '127.0.0.1',
      user_agent: (typeof navigator !== 'undefined') ? navigator.userAgent : 'CarePulse-Client'
    };

    if (sb) {
      try {
        await sb.from('patient_consent_records').insert([consentRecord]);
      } catch (e) {
        console.warn('recordPatientConsent note:', e.message);
      }
    }
    return consentRecord;
  },

  async createReferralRequest({
    patientId,
    referringDoctorId = null,
    receivingDoctorId,
    originCity,
    destinationCity,
    specialty,
    clinicalSummary = '',
    provisionalDiagnosis = '',
    referralUrgency = 'routine',
    consentGiven = false
  }) {
    if (!consentGiven) {
      throw new Error('Mandatory Patient Consent Violation: Explicit patient consent is required before sharing clinical history or dispatching a referral.');
    }
    if (!receivingDoctorId) {
      throw new Error('Receiving doctor ID is required for cross-city referral dispatch.');
    }

    const sb = getSupabaseClient();
    const referralId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'ref-' + Date.now();
    const referralRecord = {
      id: referralId,
      patient_id: patientId,
      referring_doctor_id: referringDoctorId,
      receiving_doctor_id: receivingDoctorId,
      origin_city: originCity || 'Yavatmal',
      destination_city: destinationCity || 'Mumbai',
      specialty_required: specialty || 'Specialist Consultation',
      clinical_summary: clinicalSummary,
      provisional_diagnosis: provisionalDiagnosis,
      referral_urgency: referralUrgency,
      status: 'requested',
      patient_consent_given: true,
      patient_consent_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (sb) {
      try {
        await sb.from('cross_city_referrals').insert([referralRecord]);
      } catch (e) {
        console.warn('createReferralRequest note:', e.message);
      }
    }

    // Record digital consent record
    await this.recordPatientConsent({
      patientId,
      referralId,
      grantedToDoctorId: receivingDoctorId,
      consentType: 'medical_record_sharing'
    });

    // Notify receiving doctor
    if (this.createNotification) {
      await this.createNotification({
        userId: receivingDoctorId,
        title: 'New Cross-City Referral Request',
        message: `Patient referral requested from ${originCity || 'Local City'} for ${specialty || 'Consultation'}.`,
        type: 'referral',
        link: 'doctor/referrals.html'
      }).catch(() => {});
    }

    await this.logAuditEvent({
      action: 'referral_created',
      entity_type: 'cross_city_referral',
      entity_id: referralId,
      details: {
        patientId,
        receivingDoctorId,
        originCity,
        destinationCity,
        specialty
      }
    });

    return referralRecord;
  },

  async getReferrals(filters = {}) {
    const sb = getSupabaseClient();
    const CORE_REFERRALS = [
      {
        id: 'ref-demo-001',
        patient_id: '99999999-9999-9999-9999-999999999991',
        patient_name: 'John Doe',
        referring_doctor_id: null,
        receiving_doctor_id: '11111111-1111-1111-1111-111111111111',
        origin_city: 'Yavatmal',
        destination_city: 'Mumbai',
        specialty_required: 'Senior Cardiologist',
        clinical_summary: 'Recurrent angina on exertion; local clinic recommended super-specialist cardiology evaluation in Mumbai.',
        provisional_diagnosis: 'Suspected Coronary Artery Disease',
        referral_urgency: 'routine',
        status: 'requested',
        patient_consent_given: true,
        patient_consent_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ];

    if (!sb) return CORE_REFERRALS;

    try {
      let query = sb
        .from('cross_city_referrals')
        .select(`
          *,
          patient:patient_id (id, full_name, email, phone),
          receiving_doctor:receiving_doctor_id (id, specialization, profiles (full_name)),
          referring_doctor:referring_doctor_id (id, specialization, profiles (full_name))
        `);

      if (filters.patientId) {
        query = query.eq('patient_id', filters.patientId);
      }
      if (filters.doctorId) {
        query = query.or(`receiving_doctor_id.eq.${filters.doctorId},referring_doctor_id.eq.${filters.doctorId}`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(r => ({
          ...r,
          patient_name: r.patient?.full_name || 'Patient',
          receiving_doctor_name: r.receiving_doctor?.profiles?.full_name || 'Dr. Specialist',
          referring_doctor_name: r.referring_doctor?.profiles?.full_name || 'Referring Physician'
        }));
      }
    } catch (e) {
      console.warn('getReferrals note:', e.message);
    }

    return CORE_REFERRALS;
  },

  async updateReferralStatus({ referralId, status, decisionReason = '', doctorId }) {
    const validStatuses = ['requested', 'under_review', 'accepted', 'rejected', 'cancelled', 'appointment_booked', 'completed', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid referral status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const sb = getSupabaseClient();
    const payload = {
      status,
      decision_reason: decisionReason,
      reviewed_by_doctor_id: doctorId || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (sb) {
      try {
        await sb.from('cross_city_referrals').update(payload).eq('id', referralId);
      } catch (e) {
        console.warn('updateReferralStatus note:', e.message);
      }
    }

    await this.logAuditEvent({
      action: `referral_status_${status}`,
      entity_type: 'cross_city_referral',
      entity_id: referralId,
      details: {
        status,
        decisionReason,
        doctorId
      }
    });

    return { success: true, referralId, status, decisionReason };
  }
};

// Start automated background reminder & expired offers runner
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (window.CarePulseDB && window.CarePulseDB.startReminderScheduler) {
      window.CarePulseDB.startReminderScheduler();
    }
    if (window.CarePulseDB && window.CarePulseDB.checkExpiredWaitingOffers) {
      setInterval(() => window.CarePulseDB.checkExpiredWaitingOffers(), 60000);
    }
  }, 2000);
}

