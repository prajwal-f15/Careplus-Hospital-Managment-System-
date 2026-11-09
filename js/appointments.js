/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * Appointment Engine, Slot Calculation, Double-Booking Guard & Token Queue
 * ==============================================================================
 */

window.AppointmentEngine = {
  // Days of week index map
  DAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  /**
   * Generates available and booked time slots for a doctor on a specific date
   * @param {string} doctorId 
   * @param {string} dateStr (YYYY-MM-DD)
   */
  async getDoctorSlotsForDate(doctorId, dateStr) {
    const selectedDate = new Date(dateStr + 'T00:00:00');
    const dayName = this.DAYS[selectedDate.getDay()];

    // 0. Check Doctor Leaves
    try {
      const leaves = await window.CarePulseDB.getDoctorLeaves(doctorId);
      const onLeave = leaves.some(l => l.leave_date === dateStr);
      if (onLeave) {
        return {
          available: false,
          message: 'Doctor is on approved leave on this date. Please choose another date.',
          slots: []
        };
      }
    } catch (e) {}

    // 1. Get Doctor's Availability for this day
    const availabilityList = await window.CarePulseDB.getDoctorAvailability(doctorId);
    const daySchedule = availabilityList.find(a => a.day_of_week.toLowerCase() === dayName.toLowerCase() && a.is_available);

    if (!daySchedule) {
      return {
        available: false,
        message: `Doctor is not available on ${dayName}s.`,
        slots: []
      };
    }

    // 2. Generate all interval slots between start_time and end_time
    const slotDuration = daySchedule.slot_duration_minutes || 30;
    const generatedSlots = [];

    const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);

    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);

    const end = new Date();
    end.setHours(endHour, endMin, 0, 0);

    while (current < end) {
      const timeStr = current.toTimeString().substring(0, 5); // "09:00"
      const displayTime = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      
      generatedSlots.push({
        timeValue: timeStr,
        displayTime: displayTime,
        isBooked: false,
        appointment: null
      });

      current = new Date(current.getTime() + slotDuration * 60000);
    }

    // 3. Fetch existing appointments to mark booked slots (Double-Booking Prevention)
    const allAppointments = await window.CarePulseDB.getAppointments();
    const existingDoctorBookings = allAppointments.filter(a => 
      a.doctor_id === doctorId && 
      a.appointment_date === dateStr &&
      !['cancelled', 'rejected'].includes(a.status)
    );

    // Cross reference and mark booked slots
    generatedSlots.forEach(slot => {
      const matched = existingDoctorBookings.find(b => {
        const bookedTime = (b.time_slot || b.appointment_time || '').substring(0, 5);
        return bookedTime === slot.timeValue;
      });
      if (matched) {
        slot.isBooked = true;
        slot.appointment = matched;
      }
    });

    return {
      available: true,
      dayName,
      schedule: daySchedule,
      slots: generatedSlots,
      totalSlots: generatedSlots.length,
      availableSlotsCount: generatedSlots.filter(s => !s.isBooked).length
    };
  },

  /**
   * Calculates Live Queue Information for a specific appointment
   */
  async getQueueStatus(appointmentId) {
    const appointment = await window.CarePulseDB.getAppointmentById(appointmentId);
    if (!appointment) return null;

    const allAppointments = await window.CarePulseDB.getAppointments();
    
    // Get all appointments for this doctor on the same date
    const todayAppointments = allAppointments
      .filter(a => a.doctor_id === appointment.doctor_id && a.appointment_date === appointment.appointment_date && !['cancelled', 'rejected'].includes(a.status))
      .sort((a, b) => (a.time_slot || a.appointment_time || '').localeCompare(b.time_slot || b.appointment_time || ''));

    // Find currently serving appointment (called, in-room, or in-consultation)
    const activeCalledApt = todayAppointments.find(a => 
      a.queue_status === 'called' || 
      a.queue_status === 'in-room' || 
      a.queue_status === 'in_consultation' || 
      a.status === 'in-consultation' || 
      a.status === 'in_consultation' || 
      a.status === 'in-progress' ||
      a.is_called === true
    );
    const completedList = todayAppointments.filter(a => a.status === 'completed' || a.queue_status === 'completed');
    
    let currentServingToken = 'None';

    if (activeCalledApt) {
      currentServingToken = activeCalledApt.token_number;
    } else if (completedList.length > 0) {
      const lastCompleted = completedList[completedList.length - 1];
      currentServingToken = `${lastCompleted.token_number} (Done)`;
    } else if (todayAppointments.length > 0) {
      currentServingToken = todayAppointments[0].token_number + ' (Waiting to Start)';
    }

    // Calculate queue position relative to current appointment
    const myIndex = todayAppointments.findIndex(a => a.id === appointment.id);
    let patientsAhead = 0;

    const isCurrentActive = appointment.queue_status === 'called' || 
                            appointment.queue_status === 'in-room' || 
                            appointment.status === 'in-consultation' || 
                            appointment.status === 'in_consultation' || 
                            appointment.status === 'in-progress' ||
                            appointment.is_called === true;

    if (appointment.status === 'completed' || appointment.queue_status === 'completed') {
      patientsAhead = 0;
    } else if (isCurrentActive) {
      patientsAhead = 0;
    } else {
      patientsAhead = todayAppointments.filter((a, idx) => 
        idx < myIndex && 
        ['pending', 'confirmed', 'checked_in'].includes(a.status) &&
        a.queue_status !== 'completed' &&
        a.status !== 'completed'
      ).length;
    }

    // Fetch doctor delay if any (Feature 5: Doctor Delay Management)
    let doctorDelay = { delay_minutes: 0, delay_reason: '' };
    try {
      if (window.CarePulseDB && window.CarePulseDB.getDoctorDelay) {
        doctorDelay = await window.CarePulseDB.getDoctorDelay(appointment.doctor_id);
      }
    } catch (e) {}

    const delayMinutes = doctorDelay.delay_minutes || 0;
    const baseWaitMinutes = Math.max(0, patientsAhead * 15);
    const estimatedWaitMinutes = (isCurrentActive || appointment.status === 'completed' || appointment.queue_status === 'completed')
      ? 0
      : baseWaitMinutes + delayMinutes;

    return {
      appointment,
      currentServingToken,
      patientToken: appointment.token_number,
      totalPatientsInQueue: todayAppointments.length,
      patientsAhead,
      baseWaitMinutes,
      delayMinutes,
      delayReason: doctorDelay.delay_reason || '',
      hasDelay: delayMinutes > 0,
      estimatedWaitMinutes,
      status: appointment.status,
      queueStatus: appointment.queue_status || 'waiting',
      roomNumber: appointment.room_number || 'Consultation Room 101'
    };
  },

  /**
   * Delegates to CarePulseDB availability calculation
   */
  async calculateDoctorAvailability(doctorId, dateStr, timeStr) {
    if (window.CarePulseDB && window.CarePulseDB.calculateDoctorAvailability) {
      return window.CarePulseDB.calculateDoctorAvailability(doctorId, dateStr, timeStr);
    }
    return null;
  }
};
