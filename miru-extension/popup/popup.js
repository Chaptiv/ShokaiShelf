// ShokaiShelf Miru - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = statusIndicator.querySelector('.status-text');
  const currentMediaEl = document.getElementById('current-media');
  const noMediaEl = document.getElementById('no-media');
  const mediaTitleEl = document.getElementById('media-title');
  const mediaEpisodeEl = document.getElementById('media-episode');
  const btnSettings = document.getElementById('btnSettings');

  // Settings button
  btnSettings.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

  // Get status from background
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    // Update connection status
    if (status.connected) {
      statusIndicator.classList.remove('disconnected');
      statusIndicator.classList.add('connected');
      statusText.textContent = 'Connected';
    } else {
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
    }

    // Update current media
    if (status.currentMedia) {
      currentMediaEl.classList.remove('hidden');
      noMediaEl.style.display = 'none';

      mediaTitleEl.textContent = status.currentMedia.title || 'Unknown';

      let episodeText = '';
      if (status.currentMedia.episode) {
        episodeText = `Episode ${status.currentMedia.episode}`;
        if (status.currentMedia.season) {
          episodeText = `S${status.currentMedia.season} E${status.currentMedia.episode}`;
        }
      }
      if (status.currentMedia.site) {
        episodeText += episodeText ? ` • ${status.currentMedia.site}` : status.currentMedia.site;
      }
      mediaEpisodeEl.textContent = episodeText || 'Watching...';
    } else {
      currentMediaEl.classList.add('hidden');
      noMediaEl.style.display = 'block';
    }
  } catch (err) {
    console.error('[Miru/Popup] Error getting status:', err);
    statusIndicator.classList.remove('connected');
    statusIndicator.classList.add('disconnected');
    statusText.textContent = 'Error';
  }
});
