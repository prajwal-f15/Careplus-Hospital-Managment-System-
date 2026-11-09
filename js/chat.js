/**
 * ==============================================================================
 * CAREPULSE - REALTIME TWO-WAY DOCTOR-PATIENT CHAT ENGINE
 * ==============================================================================
 */

window.CarePulseChat = {
  activeSession: null,
  realtimeSubscription: null,
  messages: [],

  // Initialize or inject chat modal into DOM
  ensureModalExists() {
    if (document.getElementById('carepulse-chat-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'carepulse-chat-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-3 sm:p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col h-[600px] max-h-[92vh] overflow-hidden border border-slate-200">
        <!-- Chat Header -->
        <div class="px-5 py-4 bg-gradient-to-r from-teal-600 via-sky-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div class="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold text-base">
                <i data-lucide="message-square" class="w-5 h-5"></i>
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-teal-700 rounded-full"></span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 id="chat-header-title" class="text-sm font-extrabold leading-tight">Consultation Chat</h3>
                <span id="chat-token-badge" class="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-bold tracking-wider">APT-001</span>
              </div>
              <p id="chat-header-subtitle" class="text-[11px] text-teal-100 mt-0.5">Direct 2-Way Channel</p>
            </div>
          </div>
          <button onclick="window.CarePulseChat.closeChat()" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition" title="Close Chat">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Quick Template Chips -->
        <div id="chat-quick-templates" class="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
          <!-- Populated dynamically based on role -->
        </div>

        <!-- Message History Stream -->
        <div id="chat-messages-container" class="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          <div class="p-8 text-center text-xs text-slate-400">Loading conversation history...</div>
        </div>

        <!-- Message Input Box -->
        <form id="chat-input-form" onsubmit="window.CarePulseChat.handleSendMessage(event)" class="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input 
            type="text" 
            id="chat-message-input" 
            placeholder="Type your message here..." 
            class="flex-1 px-4 py-3 rounded-2xl bg-slate-100 border-0 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            autocomplete="off"
            maxlength="500"
          >
          <button 
            type="submit" 
            id="chat-send-btn" 
            class="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
          >
            <span>Send</span>
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();
  },

  async openChat({ appointmentId, doctorId, patientId, otherPartyName, otherPartyRole, otherPartySubtitle, tokenNumber }) {
    this.ensureModalExists();

    const currentUser = window.Auth?.getCurrentUser();
    if (!currentUser) {
      window.showToast('Please sign in to access consultation chat', 'warning');
      return;
    }

    const myRole = currentUser.role || (currentUser.doctor_id ? 'doctor' : 'patient');
    this.activeSession = {
      appointmentId,
      doctorId,
      patientId,
      myId: currentUser.id,
      myRole,
      myName: currentUser.full_name || (myRole === 'doctor' ? 'Doctor' : 'Patient'),
      otherPartyName: otherPartyName || (myRole === 'doctor' ? 'Patient' : 'Doctor'),
      otherPartyRole: otherPartyRole || (myRole === 'doctor' ? 'patient' : 'doctor'),
      tokenNumber: tokenNumber || 'APPT'
    };

    // Update Header
    document.getElementById('chat-header-title').innerText = this.activeSession.otherPartyName;
    document.getElementById('chat-token-badge').innerText = `Token ${this.activeSession.tokenNumber}`;
    document.getElementById('chat-header-subtitle').innerText = otherPartySubtitle || `${this.activeSession.otherPartyRole.toUpperCase()} • Live Direct Channel`;

    // Populate Quick Chips
    this.renderQuickChips(myRole);

    // Show Modal
    const modal = document.getElementById('carepulse-chat-modal');
    modal.classList.remove('hidden');

    // Load initial messages
    await this.loadMessages();

    // Mark unread messages as read
    if (window.CarePulseDB?.markMessagesAsRead) {
      window.CarePulseDB.markMessagesAsRead(appointmentId, currentUser.id);
    }

    // Subscribe to real-time chat updates
    if (this.realtimeSubscription && this.realtimeSubscription.unsubscribe) {
      try { this.realtimeSubscription.unsubscribe(); } catch (e) {}
    }
    if (window.CarePulseDB?.subscribeToChat) {
      this.realtimeSubscription = window.CarePulseDB.subscribeToChat(appointmentId, (newMsg) => {
        if (!newMsg) return;
        const exists = this.messages.some(m => m.id === newMsg.id);
        if (!exists) {
          this.messages.push(newMsg);
          this.renderMessages();
          this.scrollToBottom();
        }
      });
    }

    // Focus input
    setTimeout(() => {
      document.getElementById('chat-message-input')?.focus();
    }, 150);

    if (window.lucide) window.lucide.createIcons();
  },

  renderQuickChips(role) {
    const chipsContainer = document.getElementById('chat-quick-templates');
    if (!chipsContainer) return;

    let templates = [];
    if (role === 'doctor') {
      templates = [
        'Doctor is ready, please come inside',
        'Running 10 minutes late, thank you for waiting',
        'Please have your lab reports and history ready',
        'Your digital prescription has been updated'
      ];
    } else {
      templates = [
        'I am waiting in the OPD waiting area',
        'Can I step out for 5 minutes?',
        'Thank you Doctor, see you shortly',
        'I have my previous prescription ready'
      ];
    }

    chipsContainer.innerHTML = templates.map(text => `
      <button type="button" onclick="window.CarePulseChat.insertTemplate('${text.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 transition shrink-0 whitespace-nowrap">
        ${text}
      </button>
    `).join('');
  },

  insertTemplate(text) {
    const input = document.getElementById('chat-message-input');
    if (input) {
      input.value = text;
      input.focus();
    }
  },

  async loadMessages() {
    if (!this.activeSession) return;
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Loading conversation history...</div>';

    try {
      this.messages = await window.CarePulseDB.getChatMessages(this.activeSession.appointmentId);
      this.renderMessages();
      this.scrollToBottom();
    } catch (err) {
      console.error('Error loading chat messages:', err);
      container.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">Failed to load messages: ${err.message}</div>`;
    }
  },

  renderMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !this.activeSession) return;

    if (!this.messages || this.messages.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center text-slate-400 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <i data-lucide="message-circle" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-bold text-slate-700">No messages yet</p>
          <p class="text-[11px] text-slate-400">Start the conversation with ${this.activeSession.otherPartyName}.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const myId = this.activeSession.myId;
    const myRole = this.activeSession.myRole;

    container.innerHTML = this.messages.map(m => {
      const isMine = (m.sender_id === myId) || (m.sender_role === myRole);
      const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';

      return `
        <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'}">
          <div class="text-[10px] text-slate-400 font-semibold mb-1 px-1">
            ${isMine ? 'You' : (m.sender_name || (m.sender_role === 'doctor' ? 'Doctor' : 'Patient'))} • ${timeStr}
          </div>
          <div class="max-w-[82%] px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
            isMine 
              ? 'bg-teal-600 text-white rounded-br-xs' 
              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
          }">
            ${this.escapeHtml(m.message)}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  async handleSendMessage(e) {
    e.preventDefault();
    if (!this.activeSession) return;

    const input = document.getElementById('chat-message-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    if (sendBtn) sendBtn.disabled = true;

    try {
      const payload = {
        appointmentId: this.activeSession.appointmentId,
        doctorId: this.activeSession.doctorId,
        patientId: this.activeSession.patientId,
        senderId: this.activeSession.myId,
        senderRole: this.activeSession.myRole,
        senderName: this.activeSession.myName,
        message
      };

      const savedMsg = await window.CarePulseDB.sendChatMessage(payload);
      
      // If realtime didn't add it instantly, add to local list
      if (!this.messages.some(m => m.id === savedMsg.id)) {
        this.messages.push(savedMsg);
        this.renderMessages();
      }
      this.scrollToBottom();
    } catch (err) {
      window.showToast(`Message could not be sent: ${err.message}`, 'error');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  closeChat() {
    const modal = document.getElementById('carepulse-chat-modal');
    if (modal) modal.classList.add('hidden');
    if (this.realtimeSubscription && this.realtimeSubscription.unsubscribe) {
      try { this.realtimeSubscription.unsubscribe(); } catch (e) {}
      this.realtimeSubscription = null;
    }
    this.activeSession = null;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

