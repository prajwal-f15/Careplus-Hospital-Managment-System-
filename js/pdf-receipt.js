/**
 * ==============================================================================
 * CAREPULSE - HOSPITAL APPOINTMENT BOOKING SYSTEM
 * jsPDF Appointment Receipt & Digital Token Slip Generator with Scannable QR
 * ==============================================================================
 */

function loadQRCodeLibraryIfNeeded() {
  return new Promise((resolve) => {
    if (window.QRCode) return resolve(true);
    const existing = document.querySelector('script[src*="qrcode"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(!!window.QRCode));
      setTimeout(() => resolve(!!window.QRCode), 1500);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => resolve(!!window.QRCode);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function ensureQRCodeDataURL(text) {
  await loadQRCodeLibraryIfNeeded();
  return new Promise((resolve) => {
    if (window.QRCode) {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      try {
        new window.QRCode(tempDiv, {
          text: text,
          width: 256,
          height: 256,
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
        });

        setTimeout(() => {
          const img = tempDiv.querySelector('img');
          const canvas = tempDiv.querySelector('canvas');
          let dataUrl = null;
          if (img && img.src && img.src.startsWith('data:image')) {
            dataUrl = img.src;
          } else if (canvas) {
            dataUrl = canvas.toDataURL('image/png');
          }
          try { document.body.removeChild(tempDiv); } catch (e) {}
          resolve(dataUrl);
        }, 140);
      } catch (e) {
        try { document.body.removeChild(tempDiv); } catch (e2) {}
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });
}

window.generateAppointmentReceiptPDF = async function(appointment) {
  if (!appointment) return;

  if (['pending', 'cancelled', 'rejected'].includes(appointment.status)) {
    const reasonMsg = appointment.status === 'pending'
      ? 'This appointment is PENDING Doctor Confirmation. Your Token Slip & QR Code Pass will unlock once the doctor confirms it.'
      : `Slip & QR Pass are not available because this appointment is ${appointment.status.toUpperCase()}.`;
    window.showToast(reasonMsg, 'warning');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    window.showToast('jsPDF library loading... Please try again in a moment.', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // A5 is standard receipt/slip size: 148mm x 210mm
  });

  const primaryColor = [13, 148, 136];  // Teal 600
  const secondaryColor = [15, 23, 42];  // Slate 900
  const mutedColor = [100, 116, 139];   // Slate 500
  const accentColor = [2, 132, 199];    // Sky 600

  // 1. Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 148, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CAREPULSE CENTRAL HOSPITAL', 74, 11, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Official Appointment Slip & Scannable QR Pass', 74, 18, { align: 'center' });

  // 2. Token Highlight Box
  doc.setFillColor(240, 253, 250); // Teal 50
  doc.roundedRect(12, 31, 124, 28, 3, 3, 'F');
  doc.setDrawColor(204, 251, 241); // Teal 200
  doc.roundedRect(12, 31, 124, 28, 3, 3, 'D');

  doc.setTextColor(...mutedColor);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL QUEUE TOKEN NUMBER', 74, 37, { align: 'center' });

  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(appointment.token_number || 'APT-001', 74, 47, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text(`Status: ${(appointment.status || 'Confirmed').toUpperCase()}  |  Priority: ${(appointment.priority || 'Normal').toUpperCase()}`, 74, 54, { align: 'center' });

  // 3. Generate and Embed Scannable QR Code (Non-PII verification token)
  const verificationHash = appointment.verification_hash ||
    (window.CarePulseDB ? window.CarePulseDB.generateVerificationHash(appointment) : `CP-${(appointment.id || 'AUTH').slice(0, 8).toUpperCase()}`);
  const qrVerificationPayload = window.CarePulseDB?.generateAppointmentQRCodeData
    ? window.CarePulseDB.generateAppointmentQRCodeData({ ...appointment, verification_hash: verificationHash })
    : `CAREPULSE:VERIFY:${appointment.id}:${appointment.token_number || ''}:${verificationHash}`;

  const qrDataUrl = await ensureQRCodeDataURL(qrVerificationPayload);
  if (qrDataUrl) {
    // QR Code Frame on right
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(96, 64, 40, 48, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(96, 64, 40, 48, 2, 2, 'D');

    // Embed QR image into PDF
    doc.addImage(qrDataUrl, 'PNG', 98, 66, 36, 36);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('SCANNABLE ENTRY PASS', 116, 105, { align: 'center' });
    doc.setFontSize(5.5);
    doc.setTextColor(...mutedColor);
    doc.text('Doctor / Admin Verification', 116, 109, { align: 'center' });
  }

  // 4. Appointment Information Grid (Left Column)
  let y = 68;
  const renderRow = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(label, 14, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryColor);
    doc.text(String(value || 'N/A'), 48, y);

    // subtle divider line
    doc.setDrawColor(241, 245, 249);
    doc.line(14, y + 2, qrDataUrl ? 92 : 134, y + 2);

    y += 6.5;
  };

  renderRow('Patient Name:', appointment.patient_name || 'Valued Patient');
  renderRow('Contact Phone:', appointment.patient_phone || 'N/A');
  renderRow('Doctor Name:', appointment.doctor_name || 'Specialist Doctor');
  renderRow('Specialization:', appointment.specialization || 'Healthcare Consultation');
  renderRow('Department:', appointment.department_name || 'General OPD');
  renderRow('Consultation Room:', appointment.room_number || 'Room 101');
  renderRow('Scheduled Date:', appointment.appointment_date);
  renderRow('Scheduled Slot:', appointment.time_slot || appointment.appointment_time || '09:00 AM');
  renderRow('Hospital Facility:', (appointment.hospital_name || 'CarePulse Central Hospital').substring(0, 24));
  if (appointment.referral_id) {
    renderRow('Referral Track ID:', `#${appointment.referral_id.slice(0, 12)}`);
  }
  renderRow('Reason for Visit:', (appointment.reason || 'General Health Checkup').substring(0, 24));

  // 5. Verification Notice
  y = Math.max(y + 3, 118);
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(12, y, 124, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...secondaryColor);
  doc.text('SECURITY HASH:', 16, y + 5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...accentColor);
  doc.text(appointment.verification_hash || (`CP-VERIFY-${appointment.id ? appointment.id.slice(0, 12).toUpperCase() : 'AUTH'}`), 46, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...mutedColor);
  doc.text('This QR code is tied to your patient record and verified at OPD check-in desk.', 16, y + 9);

  // 6. Hospital Guidelines
  y += 15;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, y, 124, 28, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...secondaryColor);
  doc.text('PATIENT INSTRUCTIONS & CLINICAL PROTOCOLS:', 16, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...mutedColor);
  doc.text('1. Please arrive at the OPD waiting lounge 15 minutes before your time slot.', 16, y + 10);
  doc.text('2. Present this token slip QR at the Doctor desk or Admin kiosk for instant entry.', 16, y + 14);
  doc.text('3. Track live queue wait times directly on the CarePulse Live Queue Dashboard.', 16, y + 18);
  doc.text('4. Use the 2-way patient-doctor consultation chat for real-time OPD updates.', 16, y + 22);

  // 7. Footer
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedColor);
  doc.text(`Generated: ${new Date().toLocaleString()} | CarePulse Hospital Management System`, 74, 196, { align: 'center' });
  doc.text(`Appointment ID: ${appointment.id}`, 74, 201, { align: 'center' });

  // Save the PDF
  const filename = `CarePulse_Slip_${appointment.token_number || 'APT'}_${appointment.appointment_date}.pdf`;
  doc.save(filename);
  window.showToast(`Downloaded appointment slip with scannable QR: ${filename}`, 'success');
};
