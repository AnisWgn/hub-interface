// GitHub Repository Configuration
const GITHUB_OWNER = 'AnisWgn';
const GITHUB_REPO = 'hub-interface';
const API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// DOM Elements
const downloadLink = document.getElementById('download-link');
const downloadText = document.getElementById('download-text');
const versionBadge = document.getElementById('version-badge');
const releaseInfo = document.getElementById('release-info');

// Fetch latest release from GitHub
async function fetchLatestRelease() {
    try {
        downloadLink.classList.add('loading');
        downloadText.textContent = 'Chargement...';

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error('Aucune release disponible');
        }

        const release = await response.json();

        // Find Windows installer (.exe or .zip)
        const windowsAsset = release.assets.find(asset =>
            asset.name.endsWith('.exe') ||
            asset.name.endsWith('.zip') ||
            asset.name.includes('Setup')
        );

        if (windowsAsset) {
            downloadLink.href = windowsAsset.browser_download_url;
            downloadText.textContent = `Windows (${formatBytes(windowsAsset.size)})`;
        } else {
            // Fallback to releases page
            downloadLink.href = release.html_url;
            downloadText.textContent = 'Voir les releases';
        }

        versionBadge.textContent = `Version ${release.tag_name}`;

        const releaseDate = new Date(release.published_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        releaseInfo.textContent = `Publiée le ${releaseDate}`;

        downloadLink.classList.remove('loading');

    } catch (error) {
        console.error('Error fetching release:', error);
        versionBadge.textContent = 'Aucune release';
        downloadText.textContent = 'Voir sur GitHub';
        downloadLink.href = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
        releaseInfo.textContent = 'Publiez votre première release pour activer le téléchargement automatique.';
        downloadLink.classList.remove('loading');
    }
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Download click effect
downloadLink.addEventListener('click', () => {
    downloadLink.style.transform = 'scale(0.95)';
    setTimeout(() => {
        downloadLink.style.transform = '';
    }, 150);
});

// Parallax effect on scroll
window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const blobs = document.querySelectorAll('.blob');

    blobs.forEach((blob, index) => {
        const speed = (index + 1) * 0.2;
        blob.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Initialize
fetchLatestRelease();
