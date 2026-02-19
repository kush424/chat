        // ===== DATA STORE =====
        // Real rooms storage (in-memory for demo)
        const activeRooms = new Map(); // code -> {created: timestamp, messages: []}
        let currentRoom = null;
        let selectedImage = null;
        let myMessages = []; // Track only my messages

        // ===== SCREEN NAVIGATION =====
        function showScreen(name) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(name + 'Screen').classList.add('active');
        }

        // ===== MODAL FUNCTIONS =====
        function openCreate() {
            // Generate unique 4-digit code
            let code;
            do {
                code = Math.floor(1000 + Math.random() * 9000).toString();
            } while (activeRooms.has(code));
            
            // Create room
            activeRooms.set(code, {
                created: Date.now(),
                messages: [],
                members: 1
            });
            
            currentRoom = code;
            document.getElementById('createdCode').textContent = code;
            document.getElementById('createModal').classList.add('active');
        }

        function openJoin() {
            document.getElementById('joinModal').classList.add('active');
            document.getElementById('joinCodeInput').value = '';
            document.getElementById('joinCodeInput').focus();
            hideError();
        }

        function closeModal(e, type) {
            if (e && e.target !== e.currentTarget) return;
            document.getElementById(type + 'Modal').classList.remove('active');
            if (type === 'join') {
                document.getElementById('joinCodeInput').value = '';
                hideError();
            }
        }

        // ===== CODE VERIFICATION =====
        function validateCode(input) {
            // Only numbers
            input.value = input.value.replace(/[^0-9]/g, '');
            
            // Enable button if 4 digits
            const btn = document.getElementById('joinChatBtn');
            btn.disabled = input.value.length !== 4;
            
            // Remove error styling on input
            input.classList.remove('error');
            hideError();
        }

        function showError() {
            document.getElementById('errorText').classList.add('show');
            document.getElementById('joinCodeInput').classList.add('error');
        }

        function hideError() {
            document.getElementById('errorText').classList.remove('show');
            document.getElementById('joinCodeInput').classList.remove('error');
        }

        function attemptJoin() {
            const code = document.getElementById('joinCodeInput').value;
            
            // VERIFY: Check if room exists
            if (!activeRooms.has(code)) {
                showError();
                // Shake animation
                const input = document.getElementById('joinCodeInput');
                input.style.animation = 'none';
                setTimeout(() => input.style.animation = '', 10);
                return;
            }
            
            // SUCCESS: Join room
            currentRoom = code;
            const room = activeRooms.get(code);
            room.members++;
            
            closeModal(null, 'join');
            enterChat();
            
            // Load previous messages
            loadMessages(room.messages);
        }

        // ===== CHAT FUNCTIONS =====
        function enterChat() {
            showScreen('chat');
            showToast('Connected to room ' + currentRoom);
            
            // If joining existing room with messages, show them
            if (activeRooms.has(currentRoom)) {
                const room = activeRooms.get(currentRoom);
                if (room.messages.length > 0) {
                    loadMessages(room.messages);
                }
            }
        }

        function loadMessages(messages) {
            const container = document.getElementById('messages');
            // Clear except system notice
            const systemNotice = container.querySelector('.system-notice');
            container.innerHTML = '';
            container.appendChild(systemNotice);
            
            messages.forEach(msg => {
                displayMessage(msg.text, msg.isImage, msg.isMe, msg.time, false);
            });
        }

        function sendMessage() {
            const input = document.getElementById('msgInput');
            const text = input.value.trim();
            
            if (!text || !currentRoom) return;
            
            // Save to room
            const room = activeRooms.get(currentRoom);
            const msgData = {
                text: text,
                isImage: false,
                isMe: true,
                time: Date.now()
            };
            room.messages.push(msgData);
            
            // Display
            displayMessage(text, false, true);
            
            // Clear input
            input.value = '';
            input.style.height = 'auto';
            
            // NO AUTO-REPLY - Bas itna hi hota hai
        }

        function displayMessage(text, isImage, isMe, time = Date.now(), save = true) {
            const container = document.getElementById('messages');
            const timeStr = new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${isMe ? 'sent' : 'received'}`;
            
            if (isImage) {
                msgDiv.innerHTML = `
                    <div class="msg-image" onclick="viewImage('${text}')">
                        <img src="${text}" alt="Photo">
                    </div>
                    <div class="msg-meta">${timeStr}</div>
                `;
            } else {
                msgDiv.innerHTML = `
                    <div class="bubble">${escapeHtml(text)}</div>
                    <div class="msg-meta">
                        ${timeStr}
                        ${isMe ? '<span class="checks">✓✓</span>' : ''}
                    </div>
                `;
            }
            
            container.appendChild(msgDiv);
            container.scrollTop = container.scrollHeight;
            
            // Save if new message
            if (save && currentRoom) {
                const room = activeRooms.get(currentRoom);
                if (room) {
                    room.messages.push({
                        text, isImage, isMe, time
                    });
                }
            }
        }

        // ===== IMAGE HANDLING =====
        function selectImage(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(evt) {
                selectedImage = evt.target.result;
                document.getElementById('previewImage').src = selectedImage;
                document.getElementById('imgModal').classList.add('active');
            };
            reader.readAsDataURL(file);
        }

        function sendImage() {
            if (!selectedImage || !currentRoom) return;
            
            // Save to room
            const room = activeRooms.get(currentRoom);
            room.messages.push({
                text: selectedImage,
                isImage: true,
                isMe: true,
                time: Date.now()
            });
            
            displayMessage(selectedImage, true, true);
            closeImgModal();
        }

        function viewImage(src) {
            document.getElementById('previewImage').src = src;
            document.getElementById('imgModal').classList.add('active');
        }

        function closeImgModal(e) {
            if (e && e.target !== e.currentTarget && !e.target.classList.contains('btn-secondary')) return;
            document.getElementById('imgModal').classList.remove('active');
            selectedImage = null;
            document.getElementById('fileInput').value = '';
        }

        // ===== UTILITIES =====
        function autoGrow(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
        }

        function handleKey(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showToast(msg, isError = false) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.className = 'toast' + (isError ? ' error' : '');
            toast.classList.add('show');
            
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function leaveChat() {
            if (confirm('Leave chat? You can rejoin with code: ' + currentRoom)) {
                currentRoom = null;
                document.getElementById('messages').innerHTML = `
                    <div class="system-notice">
                        <span class="line"></span>
                        🔒 End-to-end encrypted
                        <span class="line"></span>
                    </div>
                `;
                showScreen('home');
            }
        }

        function clearChat() {
            if (confirm('Clear all messages?')) {
                if (currentRoom && activeRooms.has(currentRoom)) {
                    activeRooms.get(currentRoom).messages = [];
                }
                document.getElementById('messages').innerHTML = `
                    <div class="system-notice">
                        <span class="line"></span>
                        Chat cleared
                        <span class="line"></span>
                    </div>
                `;
            }
        }

        // Cleanup old rooms every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [code, room] of activeRooms.entries()) {
                // Remove rooms older than 1 hour with no members
                if (now - room.created > 3600000 && room.members === 0) {
                    activeRooms.delete(code);
                }
            }
        }, 300000);

        // Prevent accidental back
        window.onbeforeunload = () => currentRoom ? 'Leave chat?' : null;
