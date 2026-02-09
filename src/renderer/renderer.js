const { ipcRenderer } = require('electron');

const appsGrid = document.getElementById('apps-grid');
const addAppCard = document.getElementById('add-app-card');
const addModal = document.getElementById('add-modal');
const addAppForm = document.getElementById('add-app-form');
const cancelBtn = document.getElementById('cancel-btn');
const closeBtn = document.getElementById('close-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const minimizeBtn = document.getElementById('minimize-btn');

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

// Listen for changes in Realtime Database (real-time sync) - Optimisé avec throttling
if (typeof appsRef !== 'undefined') {
    let lastUpdateTime = 0;
    const THROTTLE_MS = 300; // Minimum 300ms entre les updates
    
    appsRef.on('value', (snapshot) => {
        clearTimeout(connectionTimeout);
        updateConnectionStatus('connected');
        const data = snapshot.val();
        
        // Vérifier si les données ont vraiment changé
        const dataString = JSON.stringify(data);
        if (dataString === lastAppsData) {
            return; // Pas de changement, skip le render
        }
        lastAppsData = dataString;
        
        // Throttling pour éviter les updates trop fréquents
        const now = Date.now();
        if (now - lastUpdateTime < THROTTLE_MS && lastUpdateTime > 0) {
            // Schedule update pour plus tard
            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(() => {
                processAppsUpdate(data);
            }, THROTTLE_MS - (now - lastUpdateTime));
            return;
        }
        lastUpdateTime = now;
        
        processAppsUpdate(data);
    }, (error) => {
        console.error("Realtime Database Sync Error:", error);
        updateConnectionStatus('error');
    });
    
    function processAppsUpdate(data) {
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
    }
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
const paginationContainer = document.getElementById('pagination');

// Custom Dropdown Elements
const categoryTrigger = document.getElementById('category-trigger');
const categoryDropdown = document.getElementById('category-dropdown');
let selectedCategory = ''; // Store the value here instead of select.value

let itemsPerPage = 9;
let currentPage = 1;

// Performance optimizations
let renderTimeout = null;
let lastAppsData = null; // Cache pour éviter les re-renders inutiles
let isRendering = false; // Flag pour éviter les renders simultanés

/**
 * Calcule dynamiquement le nombre d'éléments par page
 * en fonction de la taille de l'écran disponible
 */
function calculateItemsPerPage() {
    const header = document.querySelector('header');
    const mainEl = document.querySelector('main');
    if (!header || !mainEl) return;

    const columns = 3; // Toujours 3 colonnes
    const headerHeight = header.offsetHeight;
    const mainPadding = 40; // 20px top + 20px bottom
    const paginationHeight = 60; // espace pour la pagination
    const addCardHeight = 120; // hauteur du bouton ajouter
    const availableHeight = window.innerHeight - headerHeight - mainPadding - paginationHeight - addCardHeight;
    const availableWidth = mainEl.clientWidth - 48; // 24px padding * 2
    const gridGap = 16;

    // Largeur réelle d'une carte et hauteur via aspect-ratio 16:10
    const cardWidth = (availableWidth - (columns - 1) * gridGap) / columns;
    const cardHeight = cardWidth * (10 / 16);

    // Nombre de rangées qui tiennent dans l'espace disponible
    const rows = Math.max(1, Math.floor((availableHeight + gridGap) / (cardHeight + gridGap)));

    itemsPerPage = Math.max(3, columns * rows);
}

// Debounce function pour optimiser les performances
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateCategoryDropdowns() {
    // Extract unique categories
    const categories = [...new Set(apps.map(app => app.category).filter(c => c && c.trim() !== ''))].sort();

    // --- Update Custom Main Filter ---
    categoryDropdown.innerHTML = '';

    // Add "All" option
    const allOption = document.createElement('div');
    allOption.className = 'select-item same-as-selected'; // Default selected
    allOption.textContent = 'Toutes les catégories';
    allOption.addEventListener('click', () => {
        selectCategory('', 'Toutes les catégories', allOption);
    });
    categoryDropdown.appendChild(allOption);

    categories.forEach(cat => {
        const option = document.createElement('div');
        option.className = 'select-item';
        option.textContent = cat;
        option.addEventListener('click', () => {
            selectCategory(cat, cat, option);
        });
        categoryDropdown.appendChild(option);
    });

    // --- Update Modal Autocomplete List (Native datalist remains) ---
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        categoryList.appendChild(option);
    });
}

function selectCategory(value, displayText, itemElement) {
    selectedCategory = value;
    categoryTrigger.textContent = displayText;

    // Update visual selection state
    const items = categoryDropdown.getElementsByClassName('select-item');
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('same-as-selected');
    }
    itemElement.classList.add('same-as-selected');

    // Close dropdown
    categoryDropdown.classList.remove('select-show');
    categoryTrigger.classList.remove('select-arrow-active');

    // Trigger render
    currentPage = 1;
    renderApps();
}

// Toggle Dropdown
categoryTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    categoryDropdown.classList.toggle('select-show');
    categoryTrigger.classList.toggle('select-arrow-active');
});

// Close when clicking outside
document.addEventListener('click', (e) => {
    if (!categoryTrigger.contains(e.target)) {
        categoryDropdown.classList.remove('select-show');
        categoryTrigger.classList.remove('select-arrow-active');
    }
});

function renderApps() {
    // Éviter les renders simultanés
    if (isRendering) {
        return;
    }
    isRendering = true;
    
    // Utiliser requestAnimationFrame pour optimiser le rendu
    requestAnimationFrame(() => {
        try {
            const filterText = searchInput.value.toLowerCase();
            const filterCategory = selectedCategory;

            // Filtrer les apps
            const filteredApps = apps.filter(app => {
                const matchesSearch = app.name.toLowerCase().includes(filterText);
                const matchesCategory = filterCategory === '' || app.category === filterCategory;
                return matchesSearch && matchesCategory;
            });

            // Recalculer le nombre d'items par page selon la taille de l'écran
            calculateItemsPerPage();

            // Calculate pagination slices
            const totalPages = Math.ceil(filteredApps.length / itemsPerPage);

            // Safety check for current page
            if (currentPage > totalPages && totalPages > 0) {
                currentPage = totalPages;
            } else if (totalPages === 0) {
                currentPage = 1;
            }

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pagedApps = filteredApps.slice(startIndex, endIndex);

            // Supprimer les cartes existantes (approche simple mais optimisée avec DocumentFragment)
            const existingCards = document.querySelectorAll('.app-card:not(.add-card)');
            existingCards.forEach(card => card.remove());

            // Utiliser DocumentFragment pour réduire les reflows
            const fragment = document.createDocumentFragment();
            
            // Créer les nouvelles cartes
            pagedApps.forEach((app, index) => {
                const appCard = document.createElement('div');
                
                // Use a deterministic pseudo-random based on name
                const randomType = (app.name.length % 7 === 0) ? 'card-wide' :
                    (app.name.length % 5 === 0) ? 'card-tall' : '';
                appCard.className = `app-card ${randomType}`;

                // Determine category badge
                const categoryBadge = app.category ? `<div class="app-category-badge">${app.category}</div>` : '';
                const imageUrl = app.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400';
                
                // Créer l'image avec lazy loading
                const img = document.createElement('img');
                img.src = imageUrl;
                img.className = 'app-image';
                img.alt = app.name;
                img.loading = 'lazy';
                img.decoding = 'async';
                
                // Créer le contenu de la carte
                const appInfo = document.createElement('div');
                appInfo.className = 'app-info';
                appInfo.innerHTML = `
                    <div class="app-header">
                        <div class="app-category">Application</div>
                        ${categoryBadge}
                    </div>
                    <div class="app-name">${app.name}</div>
                `;
                
                appCard.appendChild(img);
                appCard.appendChild(appInfo);
                
                // Event listener
                appCard.onclick = () => {
                    showChoiceModal(app);
                };

                fragment.appendChild(appCard);
            });

            // Ajouter toutes les cartes en une seule opération DOM
            appsGrid.insertBefore(fragment, addAppCard);

            renderPagination(totalPages);
        } finally {
            isRendering = false;
        }
    });
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

// Search handling avec debouncing pour optimiser les performances
const debouncedRenderApps = debounce(() => {
    currentPage = 1; // Reset to first page on new search
    renderApps();
}, 300); // 300ms de délai

searchInput.addEventListener('input', (e) => {
    debouncedRenderApps();
});

// Category Filter handling is now done via custom click events
// categoryFilter.addEventListener('change', ...) Removed

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
    document.getElementById('app-github').value = app.github || '';

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
const openGithubBtn = document.getElementById('open-github-btn');
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

    // Enable/Disable GitHub button based on availability
    if (app.github) {
        openGithubBtn.classList.remove('disabled');
        openGithubBtn.title = "";
    } else {
        openGithubBtn.classList.add('disabled');
        openGithubBtn.title = "Aucun dépôt GitHub pour cette application";
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

openGithubBtn.addEventListener('click', () => {
    if (currentActiveApp && currentActiveApp.github && !openGithubBtn.classList.contains('disabled')) {
        ipcRenderer.send('open-external-link', currentActiveApp.github);
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
    const github = document.getElementById('app-github').value;
    const category = document.getElementById('app-category').value;

    if (editingIndex !== null) {
        // Edit existing app
        apps[editingIndex] = { name, url, image, guide, github, category };
    } else {
        // Add new app
        apps.push({ name, url, image, guide, github, category });
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

// Recalculer et re-rendre quand la fenêtre change de taille
const debouncedResize = debounce(() => {
    const oldItemsPerPage = itemsPerPage;
    calculateItemsPerPage();
    if (oldItemsPerPage !== itemsPerPage) {
        currentPage = 1;
        renderApps();
    }
}, 200);

window.addEventListener('resize', debouncedResize);

// Initial render
calculateItemsPerPage();
renderApps();
