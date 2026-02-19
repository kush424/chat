// ==========================================
// FIREBASE CONFIGURATION - YAHAN APNI CONFIG DALEN
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==========================================
// GLOBAL VARIABLES
// ==========================================
let currentRoom = null;
let currentUser = null;
let messagesRef = null;
let typingRef = null;
let presenceRef = null;
let selectedImageFile = null;
let selectedImageData = null; // For storing base64 data
let isCreator = false;

// Generate random user ID
const userId = 'user_' + Math.random().toString(36).substr(2, 9);

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function validateCode(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    const btn = document.getElementById('joinChatBtn');
    btn.disabled = input.value.length !== 4;
    document.getElementById('errorText').style.display = 'none';
}

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

// ==========================================
// MODAL FUNCTIONS
// ==========================================
function openCreate() {
    currentRoom = generateCode();
    document.getElementById('createdCode').textContent = currentRoom;
    document.getElementById('createModal').classList.add('active');
    isCreator = true;
}

function openJoin() {
    document.getElementById('joinModal').classList.add('active');
    document.getElementById('joinCodeInput').focus();
}

function closeModal(event, type) {
    if (!event || event.target.classList.contains('modal-overlay') || event.target.classList.contains('modal-close')) {
        document.getElementById(type + 'Modal').classList.remove('active');
        if (type === 'join') {
            document.getElementById('joinCodeInput').value = '';
            document.getElementById('errorText').style.display = 'none';
        }
    }
}

// ==========================================
// ROOM FUNCTIONS
// ==========================================
function enterChat() {
    closeModal(null, 'create');
    initializeChat();
}

function attemptJoin() {
    const code = document.getElementById('joinCodeInput').value;
    
    database.ref('rooms/' + code).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                currentRoom = code;
                isCreator = false;
                closeModal(null, 'join');
                initializeChat();
            } else {
                document.getElementById('errorText').style.display = 'block';
            }
        })
        .catch((error) => {
            console.error("Error checking room:", error);
            showToast("Connection error. Try again.");
        });
}

function initializeChat() {
    // Show chat screen
    document.getElementById('homeScreen').classList.remove('active');
    document.getElementById('chatScreen').classList.add('active');
    document.getElementById('chatRoomName').textContent = 'Room: ' + currentRoom;
    
    // Create room in Firebase if not exists
    database.ref('rooms/' + currentRoom).set({
        created: firebase.database.ServerValue.TIMESTAMP,
        lastActive: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Setup presence
    setupPresence();
    
    // Listen for messages
    listenForMessages();
    
    // Listen for typing indicators
    listenForTyping();
    
    // Listen for presence
    listenForPresence();
    
    // Add system message
    addSystemMessage(isCreator ? 'You created room ' + currentRoom : 'You joined room ' + currentRoom);
    
    showToast(isCreator ? 'Room created! Share the code.' : 'Connected to room!');
}

function setupPresence() {
    const userStatusRef = database.ref('rooms/' + currentRoom + '/users/' + userId);
    const connectedRef = database.ref('.info/connected');
    
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            userStatusRef.set({
                online: true,
                joined: firebase.database.ServerValue.TIMESTAMP
            });
            
            userStatusRef.onDisconnect().remove();
        }
    });
}

// ==========================================
// MESSAGE FUNCTIONS
// ==========================================
function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    
    // Check if text or image is present
    if (!text && !selectedImageData) return;
    
    const messageData = {
        userId: userId,
        text: text || '',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        type: selectedImageData ? 'image' : 'text'
    };
    
    // If image is selected, add it to message
    if (selectedImageData) {
        messageData.image = selectedImageData;
    }
    
    // Push message to Firebase
    pushMessage(messageData);
    
    // Clear input and image
    input.value = '';
    input.style.height = 'auto';
    clearSelectedImage();
    
    // Clear typing indicator
    database.ref('rooms/' + currentRoom + '/typing/' + userId).remove();
}

function pushMessage(messageData) {
    database.ref('rooms/' + currentRoom + '/messages').push(messageData)
        .then(() => {
            database.ref('rooms/' + currentRoom).update({
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .catch((error) => {
            console.error("Error sending message:", error);
            showToast("Failed to send message");
        });
}

function listenForMessages() {
    messagesRef = database.ref('rooms/' + currentRoom + '/messages');
    
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message, snapshot.key);
    });
    
    messagesRef.on('child_removed', (snapshot) => {
        const msgElement = document.getElementById('msg-' + snapshot.key);
        if (msgElement) msgElement.remove();
    });
}

function displayMessage(message, messageId) {
    const messagesDiv = document.getElementById('messages');
    const isMe = message.userId === userId;
    
    const msgDiv = document.createElement('div');
    msgDiv.id = 'msg-' + messageId;
    msgDiv.className = `message ${isMe ? 'sent' : 'received'}`;
    
    let content = '';
    
    // Handle image message
    if (message.type === 'image' && message.image) {
        content = `<img src="${message.image}" class="message-image" onclick="viewImage('${message.image}')" loading="lazy">`;
        // Add text if present with image
        if (message.text && message.text.trim()) {
            content += `<div class="message-text" style="margin-top: 8px;">${escapeHtml(message.text)}</div>`;
        }
    } else {
        // Text only message
        content = `<div class="message-text">${escapeHtml(message.text)}</div>`;
    }
    
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    msgDiv.innerHTML = `
        ${content}
        <div class="message-time">${time}</div>
    `;
    
    messagesDiv.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(text) {
    const messagesDiv = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.innerHTML = `<span>${text}</span>`;
    messagesDiv.appendChild(div);
    scrollToBottom();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// TYPING INDICATORS
// ==========================================
let typingTimeout;
const msgInput = document.getElementById('msgInput');

if (msgInput) {
    msgInput.addEventListener('input', () => {
        if (!currentRoom) return;
        
        database.ref('rooms/' + currentRoom + '/typing/' + userId).set({
            name: 'Anonymous',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            database.ref('rooms/' + currentRoom + '/typing/' + userId).remove();
        }, 3000);
    });
}

function listenForTyping() {
    const typingRef = database.ref('rooms/' + currentRoom + '/typing');
    typingRef.on('value', (snapshot) => {
        const typing = snapshot.val();
        if (!typing) {
            document.getElementById('onlineStatus').textContent = 'online';
            return;
        }
        
        const typers = Object.keys(typing).filter(id => id !== userId);
        if (typers.length > 0) {
            document.getElementById('onlineStatus').textContent = 'typing...';
        } else {
            document.getElementById('onlineStatus').textContent = 'online';
        }
    });
}

// ==========================================
// PRESENCE / ONLINE STATUS
// ==========================================
function listenForPresence() {
    const usersRef = database.ref('rooms/' + currentRoom + '/users');
    usersRef.on('value', (snapshot) => {
        const users = snapshot.val();
        const count = users ? Object.keys(users).length : 0;
        // Optional: Show user count
    });
}

// ==========================================
// IMAGE HANDLING - FIXED
// ==========================================
function selectImage(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file');
        return;
    }
    
    // Validate file size (max 2MB for Firebase performance)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image too large. Max 2MB allowed.');
        event.target.value = '';
        return;
    }
    
    selectedImageFile = file;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        selectedImageData = e.target.result; // Store base64 data
        document.getElementById('previewImage').src = selectedImageData;
        document.getElementById('imgModal').classList.add('active');
        showToast('Image ready to send');
    };
    
    reader.onerror = (error) => {
        console.error('FileReader error:', error);
        showToast('Error loading image');
        clearSelectedImage();
    };
    
    reader.readAsDataURL(file);
}

function clearSelectedImage() {
    selectedImageFile = null;
    selectedImageData = null;
    document.getElementById('fileInput').value = '';
}

function closeImgModal() {
    document.getElementById('imgModal').classList.remove('active');
    // Don't clear image data here, user might want to send after preview
    setTimeout(() => {
        if (!document.getElementById('imgModal').classList.contains('active')) {
            clearSelectedImage();
        }
    }, 300);
}

function viewImage(src) {
    document.getElementById('previewImage').src = src;
    document.getElementById('imgModal').classList.add('active');
}

// Send image from modal
function sendImage() {
    if (!selectedImageData) {
        showToast('No image selected');
        return;
    }
    
    // Close modal first
    document.getElementById('imgModal').classList.remove('active');
    
    // Send message with image
    sendMessage();
}

// ==========================================
// CHAT MANAGEMENT
// ==========================================
function clearChat() {
    if (confirm('Clear all messages?')) {
        database.ref('rooms/' + currentRoom + '/messages').remove()
            .then(() => {
                document.getElementById('messages').innerHTML = `
                    <div class="system-notice">
                        <span class="line"></span>
                        🔒 End-to-end encrypted
                        <span class="line"></span>
                    </div>
                `;
                addSystemMessage('Chat cleared');
            })
            .catch((error) => {
                console.error('Error clearing chat:', error);
                showToast('Failed to clear chat');
            });
    }
}

function leaveChat() {
    // Remove user from room
    if (currentRoom) {
        database.ref('rooms/' + currentRoom + '/users/' + userId).remove();
        database.ref('rooms/' + currentRoom + '/typing/' + userId).remove();
        
        // Unsubscribe listeners
        if (messagesRef) messagesRef.off();
        if (typingRef) typingRef.off();
        if (presenceRef) presenceRef.off();
    }
    
    currentRoom = null;
    selectedImageData = null;
    selectedImageFile = null;
    
    document.getElementById('chatScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.add('active');
    document.getElementById('messages').innerHTML = `
        <div class="system-notice">
            <span class="line"></span>
            🔒 End-to-end encrypted
            <span class="line"></span>
        </div>
    `;
    document.getElementById('msgInput').value = '';
    document.getElementById('msgInput').style.height = 'auto';
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentRoom) {
        database.ref('rooms/' + currentRoom + '/users/' + userId).remove();
        database.ref('rooms/' + currentRoom + '/typing/' + userId).remove();
    }
});

// Prevent zoom on double tap (mobile)
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);
