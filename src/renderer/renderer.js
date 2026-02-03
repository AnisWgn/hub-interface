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

// Initial apps data - Now synced via Firebase + LocalStorage Backup
let apps = JSON.parse(localStorage.getItem('kiosk-apps')) || [];

// Listen for changes in Firebase
appsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        apps = data;
        localStorage.setItem('kiosk-apps', JSON.stringify(apps));
    } else if (apps.length === 0) {
        // Default data if everything is empty
        apps = [
            {
                name: 'Digiteq E-School',
                url: 'https://digiteq-e-school.netlify.app/',
                image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=400'
            }
        ];
    }
    // Keep current search filter if user is typing
    const currentFilter = searchInput ? searchInput.value : '';
    renderApps(currentFilter);
});

function saveApps() {
    // Save to LocalStorage immediately for instant persistence
    localStorage.setItem('kiosk-apps', JSON.stringify(apps));

    // Sync to Firebase
    appsRef.set(apps).catch(err => {
        console.error("Firebase Sync Error:", err);
        // We don't alert here to avoid annoying the user if they're offline, 
        // since it's already saved locally.
    });
}

const searchInput = document.getElementById('search-input');
const paginationContainer = document.getElementById('pagination');

const ITEMS_PER_PAGE = 10;
let currentPage = 1;

function renderApps(filter = '') {
    // Remove all existing app cards except the "Add" card
    const existingCards = document.querySelectorAll('.app-card:not(.add-card)');
    existingCards.forEach(card => card.remove());

    const filteredApps = apps.filter(app =>
        app.name.toLowerCase().includes(filter.toLowerCase())
    );

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
        // Find the original index in the 'apps' array for deletion
        const originalIndex = apps.indexOf(app);

        const appCard = document.createElement('div');
        appCard.className = 'app-card';
        // Add staggered animation delay
        appCard.style.animationDelay = `${index * 0.1}s`;

        appCard.innerHTML = `
            <img src="${app.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400'}" class="app-image" alt="${app.name}">
            <div class="app-info">
                <div class="app-name">${app.name}</div>
            </div>
            <button class="delete-btn" data-index="${originalIndex}">×</button>
        `;

        appCard.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            showChoiceModal(app);
        });

        // Add delete functionality
        const deleteBtn = appCard.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Supprimer ${app.name} ?`)) {
                apps.splice(originalIndex, 1);
                saveApps();
                // renderApps() will be called automatically by the firebase listener
            }
        });

        appsGrid.insertBefore(appCard, addAppCard);
    });

    renderPagination(totalPages);
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
            renderApps(searchInput.value);
            // Scroll to top of grid
            document.querySelector('main').scrollTop = 0;
        });
        paginationContainer.appendChild(pageBtn);
    }
}

// Search handling
searchInput.addEventListener('input', (e) => {
    currentPage = 1; // Reset to first page on new search
    renderApps(e.target.value);
});

// Modal handling
addAppCard.addEventListener('click', () => {
    addModal.classList.add('active');
});

cancelBtn.addEventListener('click', () => {
    addModal.classList.remove('active');
    addAppForm.reset();
});

const choiceModal = document.getElementById('choice-modal');
const choiceAppName = document.getElementById('choice-app-name');
const launchAppBtn = document.getElementById('launch-app-btn');
const openGuideBtn = document.getElementById('open-guide-btn');
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
        ipcRenderer.send('open-guide', currentActiveApp.guide);
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

    apps.push({ name, url, image, guide });
    saveApps();

    addModal.classList.remove('active');
    addAppForm.reset();
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
