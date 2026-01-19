/**
 * LOTS - LexOffice Time Scheduling
 * Main Application JavaScript
 */

// ============================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyBTo1iRnVajuGC0ZdXlolas3OoNzUbsvds",
    authDomain: "lots-8ce57.firebaseapp.com",
    projectId: "lots-8ce57",
    storageBucket: "lots-8ce57.firebasestorage.app",
    messagingSenderId: "94130371605",
    appId: "1:94130371605:web:3eb0e1185626196e07221c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Current user and organization
let currentFirebaseUser = null;
let currentOrganization = null;
let unsubscribeListeners = [];
let domReady = false;
let pendingAuthUser = null;

// ============================================
// DATA STORAGE
// ============================================

const STORAGE_KEYS = {
    USERS: 'lots_users',
    CLIENTS: 'lots_clients',
    PROJECTS: 'lots_projects',
    ENTRIES: 'lots_entries',
    CURRENT_USER: 'lots_current_user',
    TAGS: 'lots_tags'
};

const MAX_USERS = 5;

// Default data structure
let appData = {
    users: [],
    clients: [],
    projects: [],
    entries: [],
    tags: [],
    userColors: {} // Map userId -> color
};

let currentUser = null; // Deprecated: Now using currentFirebaseUser
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerStartTime = null;

// Chart instances
let charts = {
    client: null,
    project: null,
    daily: null,
    monthly: null,
    tag: null,
    user: null
};

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info', title = null) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const titles = {
        success: title || 'Erfolg',
        error: title || 'Fehler',
        warning: title || 'Warnung',
        info: title || 'Info'
    };

    notification.innerHTML = `
        <div class="notification-icon">${icons[type]}</div>
        <div class="notification-content">
            <div class="notification-title">${titles[type]}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">×</button>
    `;

    container.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            closeNotification(notification.querySelector('.notification-close'));
        }
    }, 5000);
}

function closeNotification(button) {
    const notification = button.closest('.notification');
    notification.classList.add('removing');
    setTimeout(() => {
        notification.remove();
    }, 300);
}

// ============================================
// DARK MODE
// ============================================

function initDarkMode() {
    // Load saved preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon(savedTheme);
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeIcon(newTheme);
}

function updateDarkModeIcon(theme) {
    const icon = theme === 'dark' ? '☀️' : '🌙';
    const darkModeIcon = document.getElementById('darkModeIcon');
    const darkModeIconAuth = document.getElementById('darkModeIconAuth');

    if (darkModeIcon) darkModeIcon.textContent = icon;
    if (darkModeIconAuth) darkModeIconAuth.textContent = icon;
}

// Initialize dark mode on load
initDarkMode();

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? user.email : 'logged out', 'DOM ready:', domReady);

    if (!domReady) {
        // Store user and wait for DOM to be ready
        pendingAuthUser = user;
        console.log('DOM not ready, storing user for later');
        return;
    }

    await handleAuthStateChange(user);
});

async function handleAuthStateChange(user) {
    if (user) {
        currentFirebaseUser = user;
        console.log('Handling auth for user:', user.email);

        // Check if user has an organization
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (!userDoc.exists || !userDoc.data().organizationId) {
            // Show organization setup
            showOrgSetup();
        } else {
            // Load organization and data
            const orgId = userDoc.data().organizationId;
            await loadOrganization(orgId);
            await loadFirestoreData();
            showApp();
        }
    } else {
        currentFirebaseUser = null;
        currentOrganization = null;
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appContent').style.display = 'none';
    const statsBar = document.getElementById('statsBar');
    if (statsBar) statsBar.style.display = 'none';
}

function showApp() {
    console.log('showApp() called');
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    const statsBar = document.getElementById('statsBar');
    if (statsBar) statsBar.style.display = 'block';

    // Update user info in header
    document.getElementById('currentUserName').textContent = currentFirebaseUser.displayName || currentFirebaseUser.email;
    document.getElementById('orgName').textContent = currentOrganization?.name || '';

    initializeApp();
    setupNavigation();
    setDefaultDates();
}

function showOrgSetup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('orgSetupForm').style.display = 'block';
}

// Google Sign In
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Google sign in error:', error);
        showNotification('Fehler beim Google Login: ' + error.message);
    }
}

// Sign Out
async function signOut() {
    try {
        // Unsubscribe from all Firestore listeners
        unsubscribeListeners.forEach(unsub => unsub());
        unsubscribeListeners = [];

        await auth.signOut();
    } catch (error) {
        console.error('Sign out error:', error);
        showNotification('beim Abmelden: ' + error.message, 'error');
    }
}

// ============================================
// ORGANIZATION FUNCTIONS
// ============================================

async function createOrganization() {
    try {
        const orgName = prompt('Name deiner Organisation:');
        if (!orgName) return;

        const inviteCode = generateInviteCode();

        const orgRef = await db.collection('organizations').add({
            name: orgName,
            members: [currentFirebaseUser.uid],
            createdBy: currentFirebaseUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Save invite code
        await db.collection('inviteCodes').doc(inviteCode).set({
            organizationId: orgRef.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update user document
        await db.collection('users').doc(currentFirebaseUser.uid).set({
            email: currentFirebaseUser.email,
            displayName: currentFirebaseUser.displayName || currentFirebaseUser.email,
            organizationId: orgRef.id,
            inviteCode: inviteCode
        });

        // Load organization
        await loadOrganization(orgRef.id);

        // Load Firestore data and show app
        await loadFirestoreData();
        showApp();

    } catch (error) {
        console.error('Create organization error:', error);
        showNotification('beim Erstellen der Organisation: ' + error.message, 'error');
    }
}

async function joinOrganization(event) {
    event.preventDefault();
    const code = document.getElementById('inviteCode').value.toUpperCase().trim();

    try {
        const codeDoc = await db.collection('inviteCodes').doc(code).get();

        if (!codeDoc.exists) {
            showNotification('Ungültiger Einladungscode!', 'error');
            return;
        }

        const orgId = codeDoc.data().organizationId;

        // Add user to organization
        await db.collection('organizations').doc(orgId).update({
            members: firebase.firestore.FieldValue.arrayUnion(currentFirebaseUser.uid)
        });

        // Update user document
        await db.collection('users').doc(currentFirebaseUser.uid).set({
            email: currentFirebaseUser.email,
            displayName: currentFirebaseUser.displayName || currentFirebaseUser.email,
            organizationId: orgId
        });

        // Load organization and data
        await loadOrganization(orgId);
        await loadFirestoreData();
        showApp();

    } catch (error) {
        console.error('Join organization error:', error);
        showNotification('beim Beitreten: ' + error.message, 'error');
    }
}

async function loadOrganization(orgId) {
    try {
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (orgDoc.exists) {
            currentOrganization = {
                id: orgDoc.id,
                ...orgDoc.data()
            };
        }
    } catch (error) {
        console.error('Load organization error:', error);
    }
}

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'ORG-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ============================================
// ORGANIZATION SETTINGS
// ============================================

async function showOrgSettings() {
    try {
        // Load invite code
        const userDoc = await db.collection('users').doc(currentFirebaseUser.uid).get();
        const inviteCode = userDoc.data().inviteCode;

        // If no invite code, find it
        let displayCode = inviteCode;
        if (!displayCode) {
            const codesSnapshot = await db.collection('inviteCodes')
                .where('organizationId', '==', currentOrganization.id)
                .limit(1)
                .get();

            if (!codesSnapshot.empty) {
                displayCode = codesSnapshot.docs[0].id;
            }
        }

        document.getElementById('orgSettingsName').textContent = currentOrganization.name;
        document.getElementById('inviteCodeDisplay').textContent = displayCode || 'N/A';

        // Load members
        const membersList = document.getElementById('orgMembersList');
        membersList.innerHTML = '';

        for (const memberId of currentOrganization.members) {
            const memberDoc = await db.collection('users').doc(memberId).get();
            if (memberDoc.exists) {
                const li = document.createElement('li');
                li.textContent = memberDoc.data().displayName || memberDoc.data().email;
                membersList.appendChild(li);
            }
        }

        // Load current user's color
        const currentUserDoc = await db.collection('users').doc(currentFirebaseUser.uid).get();
        const userColor = currentUserDoc.data().color || '#9B59B6'; // Default purple
        document.getElementById('userColorSetting').value = userColor;

        openModal('orgSettingsModal');
    } catch (error) {
        console.error('Show org settings error:', error);
        showNotification('beim Laden der Einstellungen: ' + error.message, 'error');
    }
}

function copyInviteCode() {
    const code = document.getElementById('inviteCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Einladungscode kopiert!', 'success');
    });
}

async function saveUserColor() {
    try {
        const color = document.getElementById('userColorSetting').value;

        // Update in Firestore
        await db.collection('users').doc(currentFirebaseUser.uid).update({
            color: color
        });

        showNotification('Farbe erfolgreich gespeichert!', 'success');
    } catch (error) {
        console.error('Save user color error:', error);
        showNotification('beim Speichern der Farbe: ' + error.message, 'error');
    }
}

// ============================================
// FIRESTORE DATA OPERATIONS
// ============================================

async function loadFirestoreData() {
    if (!currentOrganization) {
        console.warn('loadFirestoreData: No organization set');
        return;
    }

    try {
        console.log('Loading data for organization:', currentOrganization.id);
        const orgRef = db.collection('organizations').doc(currentOrganization.id);

        // Load clients
        const clientsSnapshot = await orgRef.collection('clients').get();
        appData.clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Loaded clients:', appData.clients.length);

        // Load projects
        const projectsSnapshot = await orgRef.collection('projects').get();
        appData.projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Loaded projects:', appData.projects.length);

        // Load time entries
        const entriesSnapshot = await orgRef.collection('timeEntries').get();
        appData.entries = entriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Loaded entries:', appData.entries.length);

        // Load users (deprecated - keeping for compatibility)
        appData.users = [];

        // Extract unique tags from entries
        const tagsSet = new Set();
        appData.entries.forEach(entry => {
            if (entry.tags) {
                const tags = typeof entry.tags === 'string'
                    ? entry.tags.split(',')
                    : entry.tags;
                tags.forEach(tag => {
                    const trimmed = typeof tag === 'string' ? tag.trim() : tag;
                    if (trimmed) tagsSet.add(trimmed);
                });
            }
        });
        appData.tags = Array.from(tagsSet);

        // Load user colors from entries
        const uniqueUserIds = new Set();
        appData.entries.forEach(entry => {
            if (entry.userId) {
                uniqueUserIds.add(entry.userId);
            }
        });

        appData.userColors = {};
        for (const userId of uniqueUserIds) {
            try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists && userDoc.data().color) {
                    appData.userColors[userId] = userDoc.data().color;
                }
            } catch (error) {
                console.warn(`Could not load color for user ${userId}:`, error);
            }
        }

        console.log('Data loaded successfully from Firestore');

    } catch (error) {
        console.error('Load Firestore data error:', error);
        showNotification('beim Laden der Daten: ' + error.message, 'error');
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    domReady = true;

    // Setup time input auto-formatting
    setupTimeInputFormatting();

    // If auth state changed before DOM was ready, handle it now
    if (pendingAuthUser !== null) {
        console.log('Processing pending auth user');
        await handleAuthStateChange(pendingAuthUser);
        pendingAuthUser = null;
    }
});

// Auto-format time inputs (e.g. "1200" -> "12:00")
function setupTimeInputFormatting() {
    const timeInputs = [
        'entryStartTime',
        'entryEndTime',
        'editEntryStartTime',
        'editEntryEndTime'
    ];

    timeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', function() {
                const value = this.value.replace(/\D/g, ''); // Remove non-digits
                if (value.length === 3 || value.length === 4) {
                    let hours, minutes;
                    if (value.length === 3) {
                        // e.g. "945" -> "09:45"
                        hours = value.substring(0, 1).padStart(2, '0');
                        minutes = value.substring(1);
                    } else {
                        // e.g. "1245" -> "12:45"
                        hours = value.substring(0, 2);
                        minutes = value.substring(2);
                    }

                    // Validate
                    if (parseInt(hours) < 24 && parseInt(minutes) < 60) {
                        this.value = `${hours}:${minutes}`;
                    }
                }
            });
        }
    });
}

function initializeApp() {
    console.log('Initializing app with data:', {
        clients: appData.clients.length,
        projects: appData.projects.length,
        entries: appData.entries.length
    });

    renderUsers();
    renderClients();
    renderProjects();
    renderTodayEntries();
    renderRecentProjects();
    updateDashboardStats();
    populateFilterDropdowns();
    populateExportDropdowns();
    initCharts();
    updateCharts();

    console.log('App initialization complete');
}

// Deprecated: Data is now loaded from Firestore via loadFirestoreData()
function loadData() {
    // No-op: Kept for backwards compatibility
}

// Deprecated: Data is now saved to Firestore automatically
function saveData() {
    // No-op: Kept for backwards compatibility
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entryDate').value = today;

    // Filter default: current month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    document.getElementById('filterStartDate').value = firstOfMonth.toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = today;

    // Set period dropdown to current month by default
    document.getElementById('filterPeriod').value = 'current-month';

    // Export default: current month
    const monthInput = document.getElementById('customerPdfMonth');
    if (monthInput) {
        monthInput.value = today.substring(0, 7);
    }

    // Setup time input auto-formatting
    setupTimeInputFormatting();
}

function handlePeriodChange() {
    const period = document.getElementById('filterPeriod').value;
    const today = new Date();
    let startDate, endDate;

    if (period === 'current-month') {
        // Current month: from 1st to today
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = today;
    } else if (period === 'last-month') {
        // Last month: from 1st to last day of previous month
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
        // Custom - don't change dates, let user set them manually
        return;
    }

    document.getElementById('filterStartDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = endDate.toISOString().split('T')[0];
    updateCharts();
}

// Auto-format time inputs (12 → 12:00, 1245 → 12:45)
function setupTimeInputFormatting() {
    const timeInputs = [
        'entryStartTime',
        'entryEndTime',
        'editEntryStartTime',
        'editEntryEndTime'
    ];

    timeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', function() {
                formatTimeInput(this);
            });
        }
    });
}

function formatTimeInput(input) {
    let value = input.value.replace(/[^0-9]/g, ''); // Remove non-digits

    if (!value) return;

    // Handle different input formats
    if (value.length === 1 || value.length === 2) {
        // "1" or "12" → "12:00"
        value = value.padStart(2, '0') + ':00';
    } else if (value.length === 3) {
        // "123" → "01:23"
        value = '0' + value[0] + ':' + value.substring(1);
    } else if (value.length === 4) {
        // "1245" → "12:45"
        value = value.substring(0, 2) + ':' + value.substring(2);
    } else if (value.length > 4) {
        // Truncate to 4 digits
        value = value.substring(0, 2) + ':' + value.substring(2, 4);
    }

    // Validate time
    const parts = value.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        input.value = value;
    } else {
        input.value = ''; // Invalid time, clear it
        showNotification('Ungültige Zeitangabe! Stunden: 0-23, Minuten: 0-59', 'warning');
    }
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Smooth scroll with offset for fixed header
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 100;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterByTag(tag) {
    // Set the tag filter
    document.getElementById('filterTag').value = tag;

    // Update charts with filtered data
    updateCharts();

    // Scroll to analytics section
    const analyticsSection = document.getElementById('auswertung');
    if (analyticsSection) {
        analyticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// USER MANAGEMENT
// ============================================

function renderUsers() {
    // Deprecated: User selection removed, now using Firebase auth
    // Only render if elements exist (backwards compatibility)
    const select = document.getElementById('currentUser');
    const filterSelect = document.getElementById('filterUser');

    if (!select || !filterSelect) {
        console.log('User selection elements not found - using Firebase auth instead');
        return;
    }

    select.innerHTML = '<option value="">Benutzer wählen...</option>';
    filterSelect.innerHTML = '<option value="">Alle Benutzer</option>';

    appData.users.forEach(user => {
        select.innerHTML += `<option value="${user.id}" ${currentUser && currentUser.id === user.id ? 'selected' : ''}>${user.name}</option>`;
        filterSelect.innerHTML += `<option value="${user.id}">${user.name}</option>`;
    });
}

function saveUser(event) {
    event.preventDefault();

    if (appData.users.length >= MAX_USERS) {
        showNotification(`Maximale Anzahl von ${MAX_USERS} Benutzern erreicht!`, 'warning');
        return;
    }

    const user = {
        id: generateId(),
        name: document.getElementById('userName').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        color: document.getElementById('userColor').value,
        createdAt: new Date().toISOString()
    };

    appData.users.push(user);
    saveData();

    document.getElementById('userForm').reset();
    document.getElementById('userColor').value = '#9B59B6';
    closeModal('userModal');

    renderUsers();
    updateCharts();
}

function switchUser(userId) {
    currentUser = appData.users.find(u => u.id === userId) || null;
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userId);
    renderTodayEntries();
        renderRecentProjects();
    updateDashboardStats();
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

function renderClients() {
    const container = document.getElementById('clientsList');
    const entrySelect = document.getElementById('entryClient');
    const editEntrySelect = document.getElementById('editEntryClient');
    const projectSelect = document.getElementById('projectClient');
    const filterSelect = document.getElementById('filterClient');

    // Render client cards
    if (appData.clients.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Kunden angelegt ◉</p>';
    } else {
        container.innerHTML = appData.clients.map(client => {
            const projectCount = appData.projects.filter(p => p.clientId === client.id).length;
            const totalHours = calculateClientHours(client.id);

            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${escapeHtml(client.name)}</div>
                            ${client.contact ? `<div class="card-subtitle">${escapeHtml(client.contact)}</div>` : ''}
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-meta">
                            ${client.email ? `<span>📧 ${escapeHtml(client.email)}</span>` : ''}
                            ${client.phone ? `<span>📞 ${escapeHtml(client.phone)}</span>` : ''}
                            ${client.hourlyRate ? `<span>💰 ${client.hourlyRate}€/Std.</span>` : ''}
                            <span>📁 ${projectCount} Projekte</span>
                            <span>⏱️ ${formatHours(totalHours)} erfasst</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-small btn-secondary" onclick="editClient('${client.id}')">Bearbeiten</button>
                        <button class="btn btn-small btn-danger" onclick="deleteClient('${client.id}')">Löschen</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Populate select dropdowns
    const clientOptions = '<option value="">Kunde wählen...</option>' +
        appData.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const clientOptionsAll = '<option value="">Alle Kunden</option>' +
        appData.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    entrySelect.innerHTML = clientOptions;
    editEntrySelect.innerHTML = clientOptions;
    projectSelect.innerHTML = clientOptions;
    filterSelect.innerHTML = clientOptionsAll;
}

async function saveClient(event) {
    event.preventDefault();

    const editId = document.getElementById('editClientId').value;
    const isEdit = !!editId;
    const clientId = isEdit ? editId : generateId();

    const clientData = {
        name: document.getElementById('clientName').value.trim(),
        contact: document.getElementById('clientContact').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        hourlyRate: parseFloat(document.getElementById('clientHourlyRate').value) || 0
    };

    if (!isEdit) {
        clientData.createdAt = new Date().toISOString();
    }

    try {
        const orgRef = db.collection('organizations').doc(currentOrganization.id);

        if (isEdit) {
            // Update existing client
            await orgRef.collection('clients').doc(clientId).update(clientData);

            // Update local state
            const clientIndex = appData.clients.findIndex(c => c.id === clientId);
            if (clientIndex !== -1) {
                appData.clients[clientIndex] = { ...appData.clients[clientIndex], ...clientData };
            }

            showNotification('Kunde erfolgreich aktualisiert', 'success');
        } else {
            // Create new client
            await orgRef.collection('clients').doc(clientId).set(clientData);

            // Update local state
            appData.clients.push({ id: clientId, ...clientData });

            showNotification('Kunde erfolgreich erstellt', 'success');
        }

        document.getElementById('clientForm').reset();
        document.getElementById('editClientId').value = '';
        closeModal('clientModal');

        renderClients();
        populateExportDropdowns();
        updateDashboardStats();
    } catch (error) {
        console.error('Save client error:', error);
        showNotification('Fehler beim Speichern des Kunden: ' + error.message, 'error');
    }
}

async function deleteClient(clientId) {
    if (!confirm('Möchtest du diesen Kunden wirklich löschen? Alle zugehörigen Projekte und Zeiteinträge werden ebenfalls gelöscht!')) {
        return;
    }

    try {
        const orgRef = db.collection('organizations').doc(currentOrganization.id);

        // Delete associated projects and entries
        const projectIds = appData.projects.filter(p => p.clientId === clientId).map(p => p.id);

        // Delete entries
        for (const entry of appData.entries.filter(e => projectIds.includes(e.projectId))) {
            await orgRef.collection('timeEntries').doc(entry.id).delete();
        }

        // Delete projects
        for (const projectId of projectIds) {
            await orgRef.collection('projects').doc(projectId).delete();
        }

        // Delete client
        await orgRef.collection('clients').doc(clientId).delete();

        // Update local state
        appData.entries = appData.entries.filter(e => !projectIds.includes(e.projectId));
        appData.projects = appData.projects.filter(p => p.clientId !== clientId);
        appData.clients = appData.clients.filter(c => c.id !== clientId);

        renderClients();
        renderProjects();
        renderTodayEntries();
        renderRecentProjects();
        updateDashboardStats();
        updateCharts();
        populateExportDropdowns();
    } catch (error) {
        console.error('Delete client error:', error);
        showNotification('beim Löschen des Kunden: ' + error.message, 'error');
    }
}

function openClientModal() {
    // Reset form for new client
    document.getElementById('clientForm').reset();
    document.getElementById('editClientId').value = '';
    document.getElementById('clientModalTitle').textContent = 'Neuer Kunde';
    openModal('clientModal');
}

function editClient(clientId) {
    const client = appData.clients.find(c => c.id === clientId);
    if (!client) return;

    // Fill form with client data
    document.getElementById('editClientId').value = clientId;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientContact').value = client.contact || '';
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientAddress').value = client.address || '';
    document.getElementById('clientHourlyRate').value = client.hourlyRate || '';

    // Update modal title
    document.getElementById('clientModalTitle').textContent = 'Kunde bearbeiten';

    // Open modal
    openModal('clientModal');
}

function calculateClientHours(clientId) {
    const projectIds = appData.projects.filter(p => p.clientId === clientId).map(p => p.id);
    return appData.entries
        .filter(e => projectIds.includes(e.projectId))
        .reduce((sum, e) => sum + e.duration, 0);
}

// ============================================
// PROJECT MANAGEMENT
// ============================================

function renderProjects() {
    const container = document.getElementById('projectsList');
    const entrySelect = document.getElementById('entryProject');
    const editEntrySelect = document.getElementById('editEntryProject');
    const filterSelect = document.getElementById('filterProject');

    if (appData.projects.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Projekte angelegt ✦</p>';
    } else {
        container.innerHTML = appData.projects.map(project => {
            const client = appData.clients.find(c => c.id === project.clientId);
            const totalHours = calculateProjectHours(project.id);
            const budgetPercent = project.budgetHours ? Math.min(100, (totalHours / project.budgetHours) * 100) : 0;
            const budgetClass = budgetPercent > 90 ? 'danger' : budgetPercent > 75 ? 'warning' : '';

            const effectiveRate = project.hourlyRate !== null && project.hourlyRate !== undefined
                ? project.hourlyRate
                : (client ? client.hourlyRate : 0);

            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${escapeHtml(project.name)}</div>
                            <div class="card-subtitle">${client ? escapeHtml(client.name) : 'Unbekannter Kunde'}</div>
                        </div>
                        <span class="status-badge status-${project.status}">${getStatusLabel(project.status)}</span>
                    </div>
                    <div class="card-content">
                        ${project.description ? `<p style="margin-bottom: var(--spacing-md);">${escapeHtml(project.description)}</p>` : ''}
                        <div class="card-meta">
                            <span>⏱️ ${formatHours(totalHours)} erfasst${project.budgetHours ? ` / ${formatHours(project.budgetHours)} Budget` : ''}</span>
                            ${effectiveRate > 0 ? `<span>💰 ${effectiveRate.toFixed(2)}€/Std.${project.hourlyRate !== null && project.hourlyRate !== undefined ? ' (Projekt)' : ''}</span>` : ''}
                            ${project.deadline ? `<span>📅 Deadline: ${formatDate(project.deadline)}</span>` : ''}
                            <span>⏲️ Intervall: ${project.minInterval || 15} Min.</span>
                        </div>
                        ${project.budgetHours ? `
                            <div class="progress-bar">
                                <div class="progress-fill ${budgetClass}" style="width: ${budgetPercent}%"></div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-small btn-secondary" onclick="editProject('${project.id}')">Bearbeiten</button>
                        <button class="btn btn-small btn-danger" onclick="deleteProject('${project.id}')">Löschen</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Populate filter dropdown with all projects
    filterSelect.innerHTML = '<option value="">Alle Projekte</option>' +
        appData.projects.map(p => {
            const client = appData.clients.find(c => c.id === p.clientId);
            return `<option value="${p.id}">${escapeHtml(p.name)} (${client ? escapeHtml(client.name) : ''})</option>`;
        }).join('');
}

async function saveProject(event) {
    event.preventDefault();

    const editId = document.getElementById('editProjectId').value;
    const isEdit = !!editId;
    const projectId = isEdit ? editId : generateId();

    const hourlyRateValue = document.getElementById('projectHourlyRate').value;
    const projectData = {
        clientId: document.getElementById('projectClient').value,
        name: document.getElementById('projectName').value.trim(),
        description: document.getElementById('projectDescription').value.trim(),
        budgetHours: parseFloat(document.getElementById('projectBudgetHours').value) || 0,
        hourlyRate: hourlyRateValue ? parseFloat(hourlyRateValue) : null,
        deadline: document.getElementById('projectDeadline').value,
        status: document.getElementById('projectStatus').value,
        minInterval: parseInt(document.getElementById('projectMinInterval').value) || 15
    };

    if (!isEdit) {
        projectData.createdAt = new Date().toISOString();
    }

    try {
        const orgRef = db.collection('organizations').doc(currentOrganization.id);

        if (isEdit) {
            // Update existing project
            await orgRef.collection('projects').doc(projectId).update(projectData);

            // Update local state
            const projectIndex = appData.projects.findIndex(p => p.id === projectId);
            if (projectIndex !== -1) {
                appData.projects[projectIndex] = { ...appData.projects[projectIndex], ...projectData };
            }

            showNotification('Projekt erfolgreich aktualisiert', 'success');
        } else {
            // Create new project
            await orgRef.collection('projects').doc(projectId).set(projectData);

            // Update local state
            appData.projects.push({ id: projectId, ...projectData });

            showNotification('Projekt erfolgreich erstellt', 'success');
        }

        document.getElementById('projectForm').reset();
        document.getElementById('editProjectId').value = '';
        closeModal('projectModal');

        renderProjects();
        populateExportDropdowns();
        updateDashboardStats();
    } catch (error) {
        console.error('Save project error:', error);
        showNotification('Fehler beim Speichern des Projekts: ' + error.message, 'error');
    }
}

async function deleteProject(projectId) {
    if (!confirm('Möchtest du dieses Projekt wirklich löschen? Alle zugehörigen Zeiteinträge werden ebenfalls gelöscht!')) {
        return;
    }

    try {
        const orgRef = db.collection('organizations').doc(currentOrganization.id);

        // Delete entries
        for (const entry of appData.entries.filter(e => e.projectId === projectId)) {
            await orgRef.collection('timeEntries').doc(entry.id).delete();
        }

        // Delete project
        await orgRef.collection('projects').doc(projectId).delete();

        // Update local state
        appData.entries = appData.entries.filter(e => e.projectId !== projectId);
        appData.projects = appData.projects.filter(p => p.id !== projectId);

        renderProjects();
        renderTodayEntries();
        renderRecentProjects();
        updateDashboardStats();
        updateCharts();
        populateExportDropdowns();
    } catch (error) {
        console.error('Delete project error:', error);
        showNotification('beim Löschen des Projekts: ' + error.message, 'error');
    }
}

function openProjectModal() {
    // Reset form for new project
    document.getElementById('projectForm').reset();
    document.getElementById('editProjectId').value = '';
    document.getElementById('projectModalTitle').textContent = 'Neues Projekt';
    document.getElementById('projectMinInterval').value = '15'; // Set default
    openModal('projectModal');
}

function editProject(projectId) {
    const project = appData.projects.find(p => p.id === projectId);
    if (!project) return;

    // Fill form with project data
    document.getElementById('editProjectId').value = projectId;
    document.getElementById('projectClient').value = project.clientId;
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectBudgetHours').value = project.budgetHours || '';
    document.getElementById('projectHourlyRate').value = project.hourlyRate || '';
    document.getElementById('projectDeadline').value = project.deadline || '';
    document.getElementById('projectStatus').value = project.status;
    document.getElementById('projectMinInterval').value = project.minInterval || 15;

    // Update modal title
    document.getElementById('projectModalTitle').textContent = 'Projekt bearbeiten';

    // Open modal
    openModal('projectModal');
}

function loadProjectsForClient(clientId) {
    const select = document.getElementById('entryProject');
    const projects = appData.projects.filter(p => p.clientId === clientId && p.status === 'active');

    select.innerHTML = '<option value="">Projekt wählen...</option>' +
        projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

function loadProjectsForClientEdit(clientId) {
    const select = document.getElementById('editEntryProject');
    const projects = appData.projects.filter(p => p.clientId === clientId);

    select.innerHTML = '<option value="">Projekt wählen...</option>' +
        projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

function calculateProjectHours(projectId) {
    return appData.entries
        .filter(e => e.projectId === projectId)
        .reduce((sum, e) => sum + e.duration, 0);
}

function getStatusLabel(status) {
    const labels = {
        active: 'Aktiv',
        paused: 'Pausiert',
        completed: 'Abgeschlossen'
    };
    return labels[status] || status;
}

// Round duration to project's minimum interval
function roundToInterval(durationHours, intervalMinutes) {
    const durationMinutes = durationHours * 60;
    const roundedMinutes = Math.ceil(durationMinutes / intervalMinutes) * intervalMinutes;
    return roundedMinutes / 60; // Convert back to hours
}

// ============================================
// TIMER
// ============================================

function toggleTimer() {
    if (timerRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (!currentFirebaseUser) {
        showNotification('Bitte melde dich an!', 'warning');
        return;
    }

    timerRunning = true;
    timerStartTime = new Date();

    document.getElementById('timerBtnText').textContent = '⏸ Pause';
    document.getElementById('startStopBtn').classList.remove('btn-primary');
    document.getElementById('startStopBtn').classList.add('btn-accent');

    timerInterval = setInterval(() => {
        timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);

    document.getElementById('timerBtnText').textContent = '▶ Start';
    document.getElementById('startStopBtn').classList.add('btn-primary');
    document.getElementById('startStopBtn').classList.remove('btn-accent');

    // Auto-fill time fields
    if (timerStartTime && timerSeconds > 0) {
        const endTime = new Date();
        document.getElementById('entryStartTime').value = formatTimeForInput(timerStartTime);
        document.getElementById('entryEndTime').value = formatTimeForInput(endTime);
    }
}

function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    timerStartTime = null;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const seconds = timerSeconds % 60;

    document.getElementById('timerDisplay').textContent =
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================
// TIME ENTRIES
// ============================================

async function saveTimeEntry(event) {
    event.preventDefault();

    if (!currentFirebaseUser) {
        showNotification('Bitte melde dich an!', 'warning');
        return;
    }

    const date = document.getElementById('entryDate').value;
    const startTime = document.getElementById('entryStartTime').value;
    const endTime = document.getElementById('entryEndTime').value;
    const clientId = document.getElementById('entryClient').value;
    const projectId = document.getElementById('entryProject').value;
    const tagsInput = document.getElementById('entryTags').value;
    const tagsArray = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);
    const description = document.getElementById('entryDescription').value.trim();

    // Calculate duration in hours
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    let duration = (end - start) / (1000 * 60 * 60);

    if (duration <= 0) {
        showNotification('Die Endzeit muss nach der Startzeit liegen!', 'warning');
        return;
    }

    // Round to project's minimum interval (default: 15 minutes)
    const project = appData.projects.find(p => p.id === projectId);
    const minInterval = project?.minInterval || 15;
    duration = roundToInterval(duration, minInterval);

    const entryId = generateId();
    const entry = {
        userId: currentFirebaseUser.uid,
        userName: currentFirebaseUser.displayName || currentFirebaseUser.email,
        clientId: clientId,
        projectId: projectId,
        date: date,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        tags: tagsArray,
        description: description,
        createdAt: new Date().toISOString()
    };

    try {
        // Save to Firestore
        await db.collection('organizations').doc(currentOrganization.id)
            .collection('timeEntries').doc(entryId).set(entry);

        // Update local state
        appData.entries.push({ id: entryId, ...entry });

        // Add new tags to global tags list
        tagsArray.forEach(tag => {
            if (!appData.tags.includes(tag)) {
                appData.tags.push(tag);
            }
        });

        // Reset form
        document.getElementById('timeEntryForm').reset();
        document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
        resetTimer();

        renderTodayEntries();
        renderRecentProjects();
        updateDashboardStats();
        updateCharts();
        populateFilterDropdowns();
    } catch (error) {
        console.error('Save time entry error:', error);
        showNotification('beim Speichern des Zeiteintrags: ' + error.message, 'error');
    }
}

function renderTodayEntries() {
    const container = document.getElementById('todayEntries');
    const today = new Date().toISOString().split('T')[0];

    let entries = appData.entries.filter(e => e.date === today);

    // Show all entries from organization (no user filter needed)

    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Einträge für heute ✦</p>';
        return;
    }

    entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

    container.innerHTML = entries.map(entry => {
        const project = appData.projects.find(p => p.id === entry.projectId);
        const client = project ? appData.clients.find(c => c.id === project.clientId) : null;
        const userName = entry.userName || 'Unbekannt';

        return `
            <div class="entry-card">
                <div class="entry-time">${entry.startTime} - ${entry.endTime}</div>
                <div class="entry-details">
                    <div class="entry-project">${project ? escapeHtml(project.name) : 'Unbekanntes Projekt'}</div>
                    <div class="entry-client">${client ? escapeHtml(client.name) : ''} • ${escapeHtml(userName)}</div>
                    ${entry.description ? `<div class="entry-description">${escapeHtml(entry.description)}</div>` : ''}
                    ${normalizeTags(entry.tags).length > 0 ? `
                        <div class="entry-tags">
                            ${normalizeTags(entry.tags).map(tag => `<span class="tag" onclick="filterByTag('${escapeHtml(tag)}')" style="cursor: pointer;">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="entry-duration">${formatHours(entry.duration)}</div>
                <div class="entry-actions">
                    <button class="btn btn-small btn-secondary" onclick="editEntry('${entry.id}')">✎</button>
                    <button class="btn btn-small btn-danger" onclick="deleteEntry('${entry.id}')">×</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentProjects() {
    const container = document.getElementById('recentProjects');

    // Get unique projects from current user's entries, sorted by most recent
    const userEntries = appData.entries
        .filter(e => e.userId === currentFirebaseUser?.uid)
        .sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.createdAt?.localeCompare(a.createdAt || '') || 0;
        });

    // Get unique project IDs (last 3)
    const uniqueProjectIds = [...new Set(userEntries.map(e => e.projectId))].slice(0, 3);

    if (uniqueProjectIds.length === 0) {
        container.innerHTML = '<p class="empty-state-small">Noch keine Einträge</p>';
        return;
    }

    container.innerHTML = uniqueProjectIds.map(projectId => {
        const project = appData.projects.find(p => p.id === projectId);
        if (!project) return '';

        const client = appData.clients.find(c => c.id === project.clientId);

        return `
            <button class="recent-project-btn" onclick="quickStartProject('${projectId}')">
                <div class="recent-project-name">${escapeHtml(project.name)}</div>
                <div class="recent-project-client">${client ? escapeHtml(client.name) : 'Kein Kunde'}</div>
            </button>
        `;
    }).join('');
}

function quickStartProject(projectId) {
    const project = appData.projects.find(p => p.id === projectId);
    if (!project) return;

    // Set current date and time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    // Fill form
    document.getElementById('entryDate').value = today;
    document.getElementById('entryStartTime').value = ''; // User fills this in
    document.getElementById('entryEndTime').value = currentTime;
    document.getElementById('entryClient').value = project.clientId;

    // Load projects for client, then select project
    loadProjectsForClient(project.clientId);
    setTimeout(() => {
        document.getElementById('entryProject').value = projectId;
    }, 100);

    // Focus on start time
    document.getElementById('entryStartTime').focus();

    showNotification('Projekt vorausgewählt - bitte Startzeit eintragen', 'info');
}

function editEntry(entryId) {
    const entry = appData.entries.find(e => e.id === entryId);
    if (!entry) return;

    document.getElementById('editEntryId').value = entry.id;
    document.getElementById('editEntryDate').value = entry.date;
    document.getElementById('editEntryStartTime').value = entry.startTime;
    document.getElementById('editEntryEndTime').value = entry.endTime;
    document.getElementById('editEntryClient').value = entry.clientId;
    loadProjectsForClientEdit(entry.clientId);
    setTimeout(() => {
        document.getElementById('editEntryProject').value = entry.projectId;
    }, 100);
    document.getElementById('editEntryTags').value = entry.tags.join(', ');
    document.getElementById('editEntryDescription').value = entry.description;

    openModal('editEntryModal');
}

async function updateTimeEntry(event) {
    event.preventDefault();

    const entryId = document.getElementById('editEntryId').value;
    const entry = appData.entries.find(e => e.id === entryId);
    if (!entry) return;

    const date = document.getElementById('editEntryDate').value;
    const startTime = document.getElementById('editEntryStartTime').value;
    const endTime = document.getElementById('editEntryEndTime').value;

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    let duration = (end - start) / (1000 * 60 * 60);

    if (duration <= 0) {
        showNotification('Die Endzeit muss nach der Startzeit liegen!', 'warning');
        return;
    }

    const tagsInput = document.getElementById('editEntryTags').value;
    const tagsArray = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

    const projectId = document.getElementById('editEntryProject').value;

    // Round to project's minimum interval (default: 15 minutes)
    const project = appData.projects.find(p => p.id === projectId);
    const minInterval = project?.minInterval || 15;
    duration = roundToInterval(duration, minInterval);

    const updates = {
        date: date,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        clientId: document.getElementById('editEntryClient').value,
        projectId: projectId,
        tags: tagsArray,
        description: document.getElementById('editEntryDescription').value.trim()
    };

    try {
        // Update in Firestore
        await db.collection('organizations').doc(currentOrganization.id)
            .collection('timeEntries').doc(entryId).update(updates);

        // Update local state
        Object.assign(entry, updates);

        // Add new tags
        tagsArray.forEach(tag => {
            if (!appData.tags.includes(tag)) {
                appData.tags.push(tag);
            }
        });

        closeModal('editEntryModal');

        renderTodayEntries();
        renderRecentProjects();
        renderProjects();
        updateDashboardStats();
        updateCharts();
    } catch (error) {
        console.error('Update time entry error:', error);
        showNotification('beim Aktualisieren des Eintrags: ' + error.message, 'error');
    }
}

async function deleteEntry(entryId) {
    if (!confirm('Möchtest du diesen Eintrag wirklich löschen?')) {
        return;
    }

    try {
        // Delete from Firestore
        await db.collection('organizations').doc(currentOrganization.id)
            .collection('timeEntries').doc(entryId).delete();

        // Update local state
        appData.entries = appData.entries.filter(e => e.id !== entryId);

        renderTodayEntries();
        renderRecentProjects();
        renderProjects();
        updateDashboardStats();
        updateCharts();
    } catch (error) {
        console.error('Delete entry error:', error);
        showNotification('beim Löschen des Eintrags: ' + error.message, 'error');
    }
}

// ============================================
// DASHBOARD STATS
// ============================================

function updateDashboardStats() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    // Today's hours
    let todayEntries = appData.entries.filter(e => e.date === today);
    const todayHours = todayEntries.reduce((sum, e) => sum + e.duration, 0);
    document.getElementById('totalHoursToday').textContent = formatHours(todayHours);

    // Month's hours
    let monthEntries = appData.entries.filter(e => e.date.startsWith(currentMonth));
    const monthHours = monthEntries.reduce((sum, e) => sum + e.duration, 0);
    document.getElementById('totalHoursMonth').textContent = formatHours(monthHours);

    // Active projects
    const activeProjects = appData.projects.filter(p => p.status === 'active').length;
    document.getElementById('activeProjects').textContent = activeProjects;

    // Total clients
    document.getElementById('totalClients').textContent = appData.clients.length;
}

// ============================================
// CHARTS & ANALYTICS
// ============================================

function initCharts() {
    const chartConfig = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true
                }
            }
        }
    };

    // Client Chart (Doughnut)
    charts.client = new Chart(document.getElementById('clientChart'), {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: chartConfig
    });

    // Project Chart (Bar)
    charts.project = new Chart(document.getElementById('projectChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: '#9B59B6' }] },
        options: {
            ...chartConfig,
            indexAxis: 'y',
            plugins: {
                ...chartConfig.plugins,
                legend: { display: false }
            }
        }
    });

    // Daily Chart (Bar)
    charts.daily = new Chart(document.getElementById('dailyChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: '#BB8FCE' }] },
        options: {
            ...chartConfig,
            plugins: {
                ...chartConfig.plugins,
                legend: { display: false }
            }
        }
    });

    // Monthly Chart (Line)
    charts.monthly = new Chart(document.getElementById('monthlyChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#9B59B6',
                backgroundColor: 'rgba(155, 89, 182, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...chartConfig,
            plugins: {
                ...chartConfig.plugins,
                legend: { display: false }
            }
        }
    });

    // Tag Chart (Pie)
    charts.tag = new Chart(document.getElementById('tagChart'), {
        type: 'pie',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: chartConfig
    });

    // User Chart (Bar)
    charts.user = new Chart(document.getElementById('userChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: {
            ...chartConfig,
            plugins: {
                ...chartConfig.plugins,
                legend: { display: false }
            }
        }
    });
}

function updateCharts() {
    const filteredEntries = getFilteredEntries();

    updateClientChart(filteredEntries);
    updateProjectChart(filteredEntries);
    updateDailyChart(filteredEntries);
    updateMonthlyChart(filteredEntries);
    updateTagChart(filteredEntries);
    updateUserChart(filteredEntries);
    updateDetailTable(filteredEntries);
}

function getFilteredEntries() {
    let entries = [...appData.entries];

    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const clientId = document.getElementById('filterClient').value;
    const projectId = document.getElementById('filterProject').value;
    const tag = document.getElementById('filterTag').value;
    const userId = document.getElementById('filterUser').value;

    if (startDate) {
        entries = entries.filter(e => e.date >= startDate);
    }
    if (endDate) {
        entries = entries.filter(e => e.date <= endDate);
    }
    if (clientId) {
        entries = entries.filter(e => e.clientId === clientId);
    }
    if (projectId) {
        entries = entries.filter(e => e.projectId === projectId);
    }
    if (tag) {
        entries = entries.filter(e => normalizeTags(e.tags).includes(tag));
    }
    if (userId) {
        entries = entries.filter(e => e.userId === userId);
    }

    return entries;
}

function updateClientChart(entries) {
    const clientHours = {};

    entries.forEach(entry => {
        const project = appData.projects.find(p => p.id === entry.projectId);
        if (project) {
            const client = appData.clients.find(c => c.id === project.clientId);
            const clientName = client ? client.name : 'Unbekannt';
            clientHours[clientName] = (clientHours[clientName] || 0) + entry.duration;
        }
    });

    const colors = generateColors(Object.keys(clientHours).length);

    charts.client.data.labels = Object.keys(clientHours);
    charts.client.data.datasets[0].data = Object.values(clientHours).map(h => Math.round(h * 100) / 100);
    charts.client.data.datasets[0].backgroundColor = colors;
    charts.client.update();
}

function updateProjectChart(entries) {
    const projectHours = {};

    entries.forEach(entry => {
        const project = appData.projects.find(p => p.id === entry.projectId);
        const projectName = project ? project.name : 'Unbekannt';
        projectHours[projectName] = (projectHours[projectName] || 0) + entry.duration;
    });

    // Sort by hours and take top 10
    const sorted = Object.entries(projectHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    charts.project.data.labels = sorted.map(s => s[0]);
    charts.project.data.datasets[0].data = sorted.map(s => Math.round(s[1] * 100) / 100);
    charts.project.update();
}

function updateDailyChart(entries) {
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const dayHours = [0, 0, 0, 0, 0, 0, 0];

    entries.forEach(entry => {
        const dayIndex = new Date(entry.date).getDay();
        dayHours[dayIndex] += entry.duration;
    });

    // Reorder to start with Monday
    const reordered = [...dayHours.slice(1), dayHours[0]];
    const reorderedLabels = [...dayNames.slice(1), dayNames[0]];

    charts.daily.data.labels = reorderedLabels;
    charts.daily.data.datasets[0].data = reordered.map(h => Math.round(h * 100) / 100);
    charts.daily.update();
}

function updateMonthlyChart(entries) {
    const monthHours = {};

    entries.forEach(entry => {
        const month = entry.date.substring(0, 7);
        monthHours[month] = (monthHours[month] || 0) + entry.duration;
    });

    const sorted = Object.entries(monthHours).sort((a, b) => a[0].localeCompare(b[0]));

    charts.monthly.data.labels = sorted.map(s => formatMonth(s[0]));
    charts.monthly.data.datasets[0].data = sorted.map(s => Math.round(s[1] * 100) / 100);
    charts.monthly.update();
}

function updateTagChart(entries) {
    const tagHours = {};

    entries.forEach(entry => {
        const tags = normalizeTags(entry.tags);
        if (tags.length === 0) {
            // Count entries without tags
            tagHours['ohne Tags'] = (tagHours['ohne Tags'] || 0) + entry.duration;
        } else {
            tags.forEach(tag => {
                tagHours[tag] = (tagHours[tag] || 0) + entry.duration;
            });
        }
    });

    const colors = generateColors(Object.keys(tagHours).length);

    charts.tag.data.labels = Object.keys(tagHours);
    charts.tag.data.datasets[0].data = Object.values(tagHours).map(h => Math.round(h * 100) / 100);
    charts.tag.data.datasets[0].backgroundColor = colors;
    charts.tag.update();
}

function updateUserChart(entries) {
    const userHours = {};
    const userIdMap = {}; // Map userName -> userId

    entries.forEach(entry => {
        const userName = entry.userName || 'Unbekannt';
        const userId = entry.userId;

        userHours[userName] = (userHours[userName] || 0) + entry.duration;
        if (userId) {
            userIdMap[userName] = userId;
        }
    });

    // Use individual user colors or fall back to default colors
    const defaultColors = ['#9B59B6', '#3498DB', '#E74C3C', '#27AE60', '#F39C12', '#E67E22'];
    const userColors = Object.keys(userHours).map((userName, index) => {
        const userId = userIdMap[userName];
        if (userId && appData.userColors[userId]) {
            return appData.userColors[userId];
        }
        return defaultColors[index % defaultColors.length];
    });

    charts.user.data.labels = Object.keys(userHours);
    charts.user.data.datasets[0].data = Object.values(userHours).map(h => Math.round(h * 100) / 100);
    charts.user.data.datasets[0].backgroundColor = userColors;
    charts.user.update();
}

function updateDetailTable(entries) {
    const tbody = document.getElementById('detailTableBody');

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Keine Einträge im ausgewählten Zeitraum</td></tr>';
        return;
    }

    // Sort by date descending
    entries.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

    tbody.innerHTML = entries.map(entry => {
        const userName = entry.userName || 'Unbekannt';
        const project = appData.projects.find(p => p.id === entry.projectId);
        const client = project ? appData.clients.find(c => c.id === project.clientId) : null;

        return `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>${escapeHtml(userName)}</td>
                <td>${client ? escapeHtml(client.name) : '-'}</td>
                <td>${project ? escapeHtml(project.name) : '-'}</td>
                <td>${escapeHtml(entry.description || '-')}</td>
                <td>${normalizeTags(entry.tags).map(t => `<span class="tag" onclick="filterByTag('${escapeHtml(t)}')" style="cursor: pointer;">${escapeHtml(t)}</span>`).join(' ')}</td>
                <td>${formatHours(entry.duration)}</td>
                <td class="actions">
                    <button class="btn btn-small btn-secondary" onclick="editEntry('${entry.id}')">✎</button>
                    <button class="btn btn-small btn-danger" onclick="deleteEntry('${entry.id}')">×</button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateFilterDropdowns() {
    // Tags dropdown
    const tagSelect = document.getElementById('filterTag');
    tagSelect.innerHTML = '<option value="">Alle Tags</option>' +
        appData.tags.map(t => `<option value="${t}">${escapeHtml(t)}</option>`).join('');

    // Users dropdown - extract unique users from entries
    const userSelect = document.getElementById('filterUser');
    const uniqueUsers = new Map();
    appData.entries.forEach(entry => {
        if (entry.userId && entry.userName) {
            uniqueUsers.set(entry.userId, entry.userName);
        }
    });

    userSelect.innerHTML = '<option value="">Alle Benutzer</option>' +
        Array.from(uniqueUsers.entries())
            .map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`)
            .join('');

    // Populate tags suggestions for autocomplete
    populateTagsSuggestions();
}

function populateTagsSuggestions() {
    const datalist = document.getElementById('tagsSuggestions');
    if (!datalist) return;

    datalist.innerHTML = appData.tags
        .map(tag => `<option value="${escapeHtml(tag)}">`)
        .join('');
}

function populateExportDropdowns() {
    const clientOptions = '<option value="">Alle Kunden</option>' +
        appData.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const clientOptionsRequired = '<option value="">Kunde wählen...</option>' +
        appData.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    document.getElementById('csvExportClient').innerHTML = clientOptions;
    document.getElementById('pdfExportClient').innerHTML = clientOptions;
    document.getElementById('customerPdfClient').innerHTML = clientOptionsRequired;

    // Project dropdowns based on client selection
    ['csvExportProject', 'pdfExportProject', 'customerPdfProject'].forEach(id => {
        document.getElementById(id).innerHTML = '<option value="">Alle Projekte</option>';
    });

    // Add change listeners for customer PDF
    document.getElementById('customerPdfClient').addEventListener('change', function() {
        const clientId = this.value;
        const projects = appData.projects.filter(p => p.clientId === clientId);
        document.getElementById('customerPdfProject').innerHTML = '<option value="">Alle Projekte des Kunden</option>' +
            projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    });
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportCSV() {
    const clientId = document.getElementById('csvExportClient').value;
    const projectId = document.getElementById('csvExportProject').value;

    let entries = [...appData.entries];

    if (clientId) {
        entries = entries.filter(e => e.clientId === clientId);
    }
    if (projectId) {
        entries = entries.filter(e => e.projectId === projectId);
    }

    if (entries.length === 0) {
        showNotification('Keine Einträge zum Exportieren gefunden!', 'info');
        return;
    }

    // Sort by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Create CSV content
    const headers = ['Datum', 'Benutzer', 'Kunde', 'Projekt', 'Startzeit', 'Endzeit', 'Dauer (Std)', 'Beschreibung', 'Tags'];
    const rows = entries.map(entry => {
        const userName = entry.userName || 'Unbekannt';
        const project = appData.projects.find(p => p.id === entry.projectId);
        const client = project ? appData.clients.find(c => c.id === project.clientId) : null;

        return [
            entry.date,
            userName,
            client ? client.name : '',
            project ? project.name : '',
            entry.startTime,
            entry.endTime,
            entry.duration.toFixed(2),
            entry.description || '',
            entry.tags.join('; ')
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `LOTS_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportPDF(type) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let clientId, projectId, month;
    let entries = [...appData.entries];
    let title = 'Zeiterfassung';
    let subtitle = '';

    if (type === 'customer') {
        clientId = document.getElementById('customerPdfClient').value;
        projectId = document.getElementById('customerPdfProject').value;
        month = document.getElementById('customerPdfMonth').value;

        if (!clientId) {
            showNotification('Bitte wähle einen Kunden aus!', 'warning');
            return;
        }

        const client = appData.clients.find(c => c.id === clientId);
        title = `Stundennachweis für ${client.name}`;

        entries = entries.filter(e => e.clientId === clientId);

        if (projectId) {
            entries = entries.filter(e => e.projectId === projectId);
            const project = appData.projects.find(p => p.id === projectId);
            subtitle = `Projekt: ${project.name}`;
        }

        if (month) {
            entries = entries.filter(e => e.date.startsWith(month));
            subtitle += (subtitle ? ' | ' : '') + `Zeitraum: ${formatMonth(month)}`;
        }
    } else {
        clientId = document.getElementById('pdfExportClient').value;
        projectId = document.getElementById('pdfExportProject').value;

        if (clientId) {
            const client = appData.clients.find(c => c.id === clientId);
            entries = entries.filter(e => e.clientId === clientId);
            subtitle = `Kunde: ${client.name}`;
        }

        if (projectId) {
            entries = entries.filter(e => e.projectId === projectId);
            const project = appData.projects.find(p => p.id === projectId);
            subtitle += (subtitle ? ' | ' : '') + `Projekt: ${project.name}`;
        }
    }

    if (entries.length === 0) {
        showNotification('Keine Einträge zum Exportieren gefunden!', 'info');
        return;
    }

    // Sort entries
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // PDF Header
    doc.setFontSize(20);
    doc.setTextColor(155, 89, 182); // Primary color
    doc.text('LOTS', 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text('LexOffice Time Scheduling', 20, 27);

    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text(title, 20, 45);

    if (subtitle) {
        doc.setFontSize(11);
        doc.setTextColor(127, 140, 141);
        doc.text(subtitle, 20, 53);
    }

    // Summary
    const totalHours = entries.reduce((sum, e) => sum + e.duration, 0);
    const client = clientId ? appData.clients.find(c => c.id === clientId) : null;

    // Calculate total cost considering project-specific hourly rates
    const totalCost = entries.reduce((sum, entry) => {
        const project = appData.projects.find(p => p.id === entry.projectId);
        const entryClient = project ? appData.clients.find(c => c.id === project.clientId) : null;

        // Use project hourly rate if available, otherwise use client hourly rate
        const hourlyRate = (project && project.hourlyRate !== null && project.hourlyRate !== undefined)
            ? project.hourlyRate
            : (entryClient ? entryClient.hourlyRate || 0 : 0);

        return sum + (entry.duration * hourlyRate);
    }, 0);

    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    let yPos = subtitle ? 65 : 55;

    doc.text(`Gesamtstunden: ${formatHours(totalHours)}`, 20, yPos);
    if (totalCost > 0) {
        doc.text(`Gesamtbetrag: ${totalCost.toFixed(2)} €`, 20, yPos + 7);
        yPos += 7;
    }

    yPos += 15;

    // Detail table
    const includeDetails = type === 'customer' ? document.getElementById('includeDetails').checked : true;

    if (includeDetails) {
        const tableData = entries.map(entry => {
            const userName = entry.userName || 'Unbekannt';
            const project = appData.projects.find(p => p.id === entry.projectId);

            if (type === 'customer') {
                return [
                    formatDate(entry.date),
                    project ? project.name : '-',
                    entry.description || '-',
                    formatHours(entry.duration)
                ];
            } else {
                return [
                    formatDate(entry.date),
                    userName,
                    project ? project.name : '-',
                    entry.description || '-',
                    formatHours(entry.duration)
                ];
            }
        });

        const headers = type === 'customer'
            ? ['Datum', 'Projekt', 'Beschreibung', 'Dauer']
            : ['Datum', 'Benutzer', 'Projekt', 'Beschreibung', 'Dauer'];

        doc.autoTable({
            startY: yPos,
            head: [headers],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [155, 89, 182],
                textColor: 255
            },
            styles: {
                fontSize: 9
            },
            columnStyles: type === 'customer' ? {
                0: { cellWidth: 25 },
                1: { cellWidth: 40 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 20, halign: 'right' }
            } : {
                0: { cellWidth: 22 },
                1: { cellWidth: 25 },
                2: { cellWidth: 35 },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 18, halign: 'right' }
            }
        });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(127, 140, 141);
        doc.text(
            `Erstellt am ${new Date().toLocaleDateString('de-DE')} mit LOTS | Seite ${i} von ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Download
    const filename = type === 'customer'
        ? `Stundennachweis_${client.name.replace(/\s+/g, '_')}_${month || new Date().toISOString().split('T')[0]}.pdf`
        : `LOTS_Bericht_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(filename);
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Normalize tags: convert string to array or return empty array
function normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
        return tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
    return [];
}

function formatHours(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function formatTimeForInput(date) {
    return date.toTimeString().substring(0, 5);
}

function generateColors(count) {
    const baseColors = [
        '#9B59B6', '#8E44AD', '#BB8FCE', '#E8DAEF',
        '#3498DB', '#2980B9', '#5DADE2', '#AED6F1',
        '#27AE60', '#229954', '#58D68D', '#ABEBC6',
        '#E74C3C', '#C0392B', '#EC7063', '#F5B7B1',
        '#F39C12', '#D68910', '#F7DC6F', '#F9E79F'
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

// ============================================
// TODAY ENTRIES VIEW TOGGLE
// ============================================

function switchTodayView(view) {
    const listView = document.getElementById('todayEntries');
    const calendarView = document.getElementById('todayCalendar');
    const listBtn = document.getElementById('listViewBtn');
    const calendarBtn = document.getElementById('calendarViewBtn');

    if (view === 'list') {
        listView.style.display = 'flex';
        calendarView.style.display = 'none';
        listBtn.classList.add('active');
        calendarBtn.classList.remove('active');
    } else {
        listView.style.display = 'none';
        calendarView.style.display = 'block';
        listBtn.classList.remove('active');
        calendarBtn.classList.add('active');
        renderTodayCalendar();
    }
}

function renderTodayCalendar() {
    const container = document.getElementById('todayCalendar');
    const today = new Date().toISOString().split('T')[0];
    let entries = appData.entries.filter(e => e.date === today);

    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Einträge für heute ✦</p>';
        return;
    }

    // Sort by start time
    entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Generate timeline (6:00 - 22:00)
    let html = '<div class="timeline-container">';
    html += '<div class="timeline-hours">';
    for (let h = 6; h <= 22; h++) {
        html += '<div class="timeline-hour">' + String(h).padStart(2, '0') + ':00</div>';
    }
    html += '</div>';
    html += '<div class="timeline-entries">';

    entries.forEach(entry => {
        const project = appData.projects.find(p => p.id === entry.projectId);
        const client = project ? appData.clients.find(c => c.id === project.clientId) : null;

        // Calculate position and height
        const [startH, startM] = entry.startTime.split(':').map(Number);
        const [endH, endM] = entry.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const top = ((startMinutes - 6 * 60) / (16 * 60)) * 100; // 6:00 - 22:00 = 16 hours
        const height = ((endMinutes - startMinutes) / (16 * 60)) * 100;

        html += '<div class="timeline-entry" style="top: ' + top + '%; height: ' + height + '%;">';
        html += '<div class="timeline-entry-time">' + entry.startTime + ' - ' + entry.endTime + '</div>';
        html += '<div class="timeline-entry-project">' + (project ? escapeHtml(project.name) : 'Unbekannt') + '</div>';
        html += '<div class="timeline-entry-client">' + (client ? escapeHtml(client.name) : '') + '</div>';
        html += '<div class="timeline-entry-duration">' + formatHours(entry.duration) + '</div>';
        html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
}
