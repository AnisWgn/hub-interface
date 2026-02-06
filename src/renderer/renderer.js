const { ipcRenderer } = require('electron');

const appsGrid = document.getElementById('apps-grid');
const addAppCard = document.getElementById('add-app-card');
const addModal = document.getElementById('add-modal');
const addAppForm = document.getElementById('add-app-form');
const cancelBtn = document.getElementById('cancel-btn');
const closeBtn = document.getElementById('close-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const minimizeBtn = document.getElementById('minimize-btn');

// Theme handling
const themeToggle = document.getElementById('theme-toggle');

function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark');
        themeToggle.textContent = '🌙';
    }
    localStorage.setItem('theme', theme);
}

// Initial theme check
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    setTheme(currentTheme);
});

// Initial apps data - Firebase Only (centralized storage)
let apps = [];

// Firebase Connection Status Indicator
const firebaseStatus = document.getElementById('firebase-status');

// DEBUG: Track Firebase initialization
console.log("Renderer initialized. Checking Firebase...");
if (typeof firebase === 'undefined') {
    console.error("FATAL: Firebase SDK not loaded! Check index.html script tags and paths.");
} else {
    console.log("Firebase SDK detected.");
}

function updateConnectionStatus(status) {
    console.log(`Connection Status Update: ${status}`);
    firebaseStatus.className = ''; // Reset
    firebaseStatus.classList.add(status || 'connecting');
}

// Connection check timeout
const connectionTimeout = setTimeout(() => {
    if (!firebaseStatus.classList.contains('connected')) {
        console.warn("Firebase connection timeout after 10s.");
        updateConnectionStatus('error');
    }
}, 10000);

// Listen for changes in Realtime Database (real-time sync)
if (typeof appsRef !== 'undefined') {
    appsRef.on('value', (snapshot) => {
        clearTimeout(connectionTimeout);
        updateConnectionStatus('connected');
        const data = snapshot.val();
        if (data) {
            apps = data;
        } else {
            console.log("Realtime Database empty, initializing default data...");
            apps = [
                {
                    name: 'Digiteq E-School',
                    url: 'https://digiteq-e-school.netlify.app/',
                    image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=400',
                    category: 'Education'
                }
            ];
            appsRef.set(apps);
        }
        updateCategoryDropdowns();
        renderApps();
    }, (error) => {
        console.error("Realtime Database Sync Error:", error);
        updateConnectionStatus('error');
    });
} else {
    console.error("appsRef is not defined. Check firebase-config.js.");
    updateConnectionStatus('error');
}

function saveApps() {
    appsRef.set(apps).then(() => {
        updateConnectionStatus('connected');
    }).catch(err => {
        console.error("Realtime Database Sync Error:", err);
        updateConnectionStatus('error');
        alert("Erreur de synchronisation. Vérifiez votre connexion internet.");
    });
}

const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const paginationContainer = document.getElementById('pagination');

const ITEMS_PER_PAGE = 6;
let currentPage = 1;

function updateCategoryDropdowns() {
    // Extract unique categories
    const categories = [...new Set(apps.map(app => app.category).filter(c => c && c.trim() !== ''))].sort();

    // Update Main Filter
    const currentFilter = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">Toutes les catégories</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    categoryFilter.value = currentFilter;

    // Update Modal Autocomplete List
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        categoryList.appendChild(option);
    });
}

function renderApps() {
    const filterText = searchInput.value.toLowerCase();
    const filterCategory = categoryFilter.value;

    // Remove all existing app cards except the "Add" card
    const existingCards = document.querySelectorAll('.app-card:not(.add-card)');
    existingCards.forEach(card => card.remove());

    const filteredApps = apps.filter(app => {
        const matchesSearch = app.name.toLowerCase().includes(filterText);
        const matchesCategory = filterCategory === '' || app.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // Calculate pagination slices
    const totalPages = Math.ceil(filteredApps.length / ITEMS_PER_PAGE);

    // Safety check for current page
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    } else if (totalPages === 0) {
        currentPage = 1; // If no apps, reset to page 1
    }


    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pagedApps = filteredApps.slice(startIndex, endIndex);

    pagedApps.forEach((app, index) => {
        const originalIndex = apps.indexOf(app);

        const appCard = document.createElement('div');
        // Use a deterministic pseudo-random based on name to avoid flickering
        const randomType = (app.name.length % 7 === 0) ? 'card-wide' :
            (app.name.length % 5 === 0) ? 'card-tall' : '';

        appCard.className = `app-card ${randomType}`;
        appCard.style.animationDelay = `${index * 0.05}s`;

        // Determine category badge
        const categoryBadge = app.category ? `<div class="app-category-badge">${app.category}</div>` : '';

        appCard.innerHTML = `
            <img src="${app.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400'}" class="app-image" alt="${app.name}">
            <div class="app-info">
                <div class="app-header">
                    <div class="app-category">Application</div>
                    ${categoryBadge}
                </div>
                <div class="app-name">${app.name}</div>
            </div>
        `;

        appCard.addEventListener('click', () => {
            showChoiceModal(app);
        });

        appsGrid.insertBefore(appCard, addAppCard);
    });

    renderPagination(totalPages);

    // Refresh dropdowns ONLY if not editing (to avoid disrupting UX, though mostly safe)
    // Actually better to call it on data change.
}

function renderPagination(totalPages) {
    paginationContainer.innerHTML = '';

    // Don't show if only 1 page
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderApps();
            // Scroll to top of grid
            document.querySelector('main').scrollTop = 0;
        });
        paginationContainer.appendChild(pageBtn);
    }
}

// Search handling
searchInput.addEventListener('input', (e) => {
    currentPage = 1; // Reset to first page on new search
    renderApps();
});

// Category Filter handling
categoryFilter.addEventListener('change', (e) => {
    currentPage = 1;
    renderApps();
});

// Modal handling
let editingIndex = null; // Track if we're editing an app

addAppCard.addEventListener('click', () => {
    editingIndex = null; // Reset - we're adding, not editing
    document.querySelector('#add-modal h2').textContent = 'Nouvelle Application';
    addModal.classList.add('active');
});

function openEditModal(index) {
    editingIndex = index;
    const app = apps[index];

    // Pre-fill the form
    document.getElementById('app-name').value = app.name || '';
    document.getElementById('app-url').value = app.url || '';
    document.getElementById('app-image').value = app.image || '';
    document.getElementById('app-guide').value = app.guide || '';

    // Update modal title
    document.querySelector('#add-modal h2').textContent = 'Modifier l\'Application';

    addModal.classList.add('active');
}

cancelBtn.addEventListener('click', () => {
    addModal.classList.remove('active');
    addAppForm.reset();
    editingIndex = null;
});

// File Browsing Logic
const browseImageBtn = document.getElementById('browse-image-btn');
const browseGuideBtn = document.getElementById('browse-guide-btn');

async function handleFileBrowse(filters) {
    const result = await ipcRenderer.invoke('show-open-dialog', filters);
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
}

browseImageBtn.addEventListener('click', async () => {
    const filePath = await handleFileBrowse([{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp'] }]);
    if (filePath) {
        document.getElementById('app-image').value = filePath;
    }
});

browseGuideBtn.addEventListener('click', async () => {
    const filePath = await handleFileBrowse([{ name: 'PDF', extensions: ['pdf'] }]);
    if (filePath) {
        document.getElementById('app-guide').value = filePath;
    }
});

const choiceModal = document.getElementById('choice-modal');
const choiceAppName = document.getElementById('choice-app-name');
const launchAppBtn = document.getElementById('launch-app-btn');
const openGuideBtn = document.getElementById('open-guide-btn');
const editAppBtn = document.getElementById('edit-app-btn');
const deleteAppBtn = document.getElementById('delete-app-btn');
const closeChoiceBtn = document.getElementById('close-choice-btn');

let currentActiveApp = null;

function showChoiceModal(app) {
    currentActiveApp = app;
    choiceAppName.textContent = app.name;

    // Enable/Disable guide button based on availability
    if (app.guide) {
        openGuideBtn.classList.remove('disabled');
        openGuideBtn.title = "";
    } else {
        openGuideBtn.classList.add('disabled');
        openGuideBtn.title = "Aucun guide disponible pour cette application";
    }

    choiceModal.classList.add('active');
}

launchAppBtn.addEventListener('click', () => {
    if (currentActiveApp) {
        ipcRenderer.send('launch-app', currentActiveApp.url);
        choiceModal.classList.remove('active');
    }
});

openGuideBtn.addEventListener('click', () => {
    if (currentActiveApp && currentActiveApp.guide && !openGuideBtn.classList.contains('disabled')) {
        ipcRenderer.send('open-external-link', currentActiveApp.guide);
        choiceModal.classList.remove('active');
    }
});

editAppBtn.addEventListener('click', () => {
    if (currentActiveApp) {
        const index = apps.indexOf(currentActiveApp);
        choiceModal.classList.remove('active');
        openEditModal(index);
    }
});

deleteAppBtn.addEventListener('click', () => {
    if (currentActiveApp) {
        const index = apps.indexOf(currentActiveApp);
        if (confirm(`Supprimer ${currentActiveApp.name} ?`)) {
            apps.splice(index, 1);
            saveApps();
            choiceModal.classList.remove('active');
        }
    }
});

choiceModal.addEventListener('click', (e) => {
    if (e.target === choiceModal) {
        choiceModal.classList.remove('active');
    }
});

closeChoiceBtn.addEventListener('click', () => {
    choiceModal.classList.remove('active');
});

addAppForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('app-name').value;
    const url = document.getElementById('app-url').value;
    const image = document.getElementById('app-image').value;
    const guide = document.getElementById('app-guide').value;
    const category = document.getElementById('app-category').value;

    if (editingIndex !== null) {
        // Edit existing app
        apps[editingIndex] = { name, url, image, guide, category };
    } else {
        // Add new app
        apps.push({ name, url, image, guide, category });
    }

    saveApps();

    addModal.classList.remove('active');
    addAppForm.reset();
    editingIndex = null;
});

// Window controls
closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-app');
});

maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('maximize-app');
});

minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('minimize-app');
});

ipcRenderer.on('fullscreen-state', (event, isFullScreen) => {
    if (isFullScreen) {
        document.body.classList.add('fullscreen');
        maximizeBtn.textContent = '❐';
    } else {
        document.body.classList.remove('fullscreen');
        maximizeBtn.textContent = '▢';
    }
});

// Initial render
renderApps();
