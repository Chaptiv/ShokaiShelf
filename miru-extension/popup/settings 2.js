// ShokaiShelf Miru - Settings Page Logic

class SettingsManager {
  constructor() {
    this.customSites = [];
    this.currentEditingSite = null;

    this.init();
  }

  async init() {
    console.log('[Settings] Initializing...');

    // Load custom sites from storage
    await this.loadCustomSites();

    // Setup event listeners
    this.setupEventListeners();

    // Render custom sites
    this.renderCustomSites();
  }

  // ========================================================================
  // STORAGE
  // ========================================================================

  async loadCustomSites() {
    try {
      const result = await chrome.storage.sync.get(['customSites']);
      this.customSites = result.customSites || [];
      console.log('[Settings] Loaded custom sites:', this.customSites.length);
    } catch (e) {
      console.error('[Settings] Failed to load custom sites:', e);
      this.customSites = [];
    }
  }

  async saveCustomSites() {
    try {
      await chrome.storage.sync.set({ customSites: this.customSites });
      console.log('[Settings] Saved custom sites:', this.customSites.length);
      return true;
    } catch (e) {
      console.error('[Settings] Failed to save custom sites:', e);
      alert('Failed to save settings. Error: ' + e.message);
      return false;
    }
  }

  // ========================================================================
  // EVENT LISTENERS
  // ========================================================================

  setupEventListeners() {
    // Back button
    document.getElementById('btnBack').addEventListener('click', () => {
      window.location.href = 'popup.html';
    });

    // Add site button
    document.getElementById('btnAddSite').addEventListener('click', () => {
      this.openModal();
    });

    // Modal close buttons
    document.getElementById('btnCloseModal').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('btnCancelModal').addEventListener('click', () => {
      this.closeModal();
    });

    // Save button
    document.getElementById('btnSaveSite').addEventListener('click', () => {
      this.saveSite();
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Method selection changes
    document.getElementById('titleMethod').addEventListener('change', (e) => {
      this.showMethodConfig(e.target.value, 'method-config');
    });

    document.getElementById('episodeMethod').addEventListener('change', (e) => {
      this.showMethodConfig(e.target.value, 'episode-method-config');
    });

    document.getElementById('seasonMethod').addEventListener('change', (e) => {
      const patternGroup = document.getElementById('seasonPatternGroup');
      patternGroup.style.display = e.target.value === 'none' ? 'none' : 'block';
    });

    // Test extraction button
    document.getElementById('btnTestExtraction').addEventListener('click', () => {
      this.testExtraction();
    });

    // Close modal when clicking outside
    document.getElementById('siteModal').addEventListener('click', (e) => {
      if (e.target.id === 'siteModal') {
        this.closeModal();
      }
    });
  }

  // ========================================================================
  // MODAL MANAGEMENT
  // ========================================================================

  openModal(site = null) {
    this.currentEditingSite = site;
    const modal = document.getElementById('siteModal');
    const modalTitle = document.getElementById('modalTitle');

    if (site) {
      modalTitle.textContent = 'Edit Custom Site';
      this.loadSiteIntoForm(site);
    } else {
      modalTitle.textContent = 'Add Custom Site';
      this.resetForm();
    }

    modal.classList.add('active');
    this.switchTab('basic');
  }

  closeModal() {
    const modal = document.getElementById('siteModal');
    modal.classList.remove('active');
    this.currentEditingSite = null;
    this.resetForm();
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.dataset.tab === tabName) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  showMethodConfig(method, containerClass) {
    document.querySelectorAll('.' + containerClass).forEach(config => {
      if (config.dataset.method === method) {
        config.classList.remove('hidden');
      } else {
        config.classList.add('hidden');
      }
    });
  }

  // ========================================================================
  // FORM MANAGEMENT
  // ========================================================================

  resetForm() {
    document.getElementById('siteForm').reset();
    document.getElementById('videoSelector').value = 'video';
    document.getElementById('titleRegexGroup').value = '1';
    document.getElementById('episodeRegexGroup').value = '1';
    document.getElementById('retryAttempts').value = '5';
    document.getElementById('titleMethod').value = 'regex';
    document.getElementById('episodeMethod').value = 'regex';
    document.getElementById('seasonMethod').value = 'none';

    this.showMethodConfig('regex', 'method-config');
    this.showMethodConfig('regex', 'episode-method-config');
    document.getElementById('seasonPatternGroup').style.display = 'none';
    document.getElementById('testResults').classList.add('hidden');
  }

  loadSiteIntoForm(site) {
    document.getElementById('siteName').value = site.name;
    document.getElementById('siteDomain').value = site.domain;
    document.getElementById('videoSelector').value = site.config.videoSelector || 'video';
    document.getElementById('videoIframe').value = site.config.videoIframe || '';

    // Title extraction
    document.getElementById('titleMethod').value = site.config.titleMethod || 'regex';
    document.getElementById('titleRegex').value = site.config.titleRegex || '';
    document.getElementById('titleRegexGroup').value = site.config.titleRegexGroup || 1;
    document.getElementById('titleSelector').value = site.config.titleSelector || '';
    document.getElementById('titleMetaProperty').value = site.config.titleMetaProperty || '';
    document.getElementById('titleJsonPath').value = site.config.titleJsonPath || '';

    // Episode extraction
    document.getElementById('episodeMethod').value = site.config.episodeMethod || 'regex';
    document.getElementById('episodeRegex').value = site.config.episodeRegex || '';
    document.getElementById('episodeRegexGroup').value = site.config.episodeRegexGroup || 1;
    document.getElementById('episodeSelector').value = site.config.episodeSelector || '';
    document.getElementById('episodeUrlPattern').value = site.config.episodeUrlPattern || '';

    // Advanced
    document.getElementById('seasonMethod').value = site.config.seasonMethod || 'none';
    document.getElementById('seasonPattern').value = site.config.seasonPattern || '';
    document.getElementById('retryAttempts').value = site.config.retryAttempts || 5;
    document.getElementById('waitSelectors').value = (site.config.waitSelectors || []).join(', ');

    this.showMethodConfig(site.config.titleMethod || 'regex', 'method-config');
    this.showMethodConfig(site.config.episodeMethod || 'regex', 'episode-method-config');
    document.getElementById('seasonPatternGroup').style.display =
      site.config.seasonMethod === 'none' ? 'none' : 'block';
  }

  getSiteFromForm() {
    const waitSelectorsValue = document.getElementById('waitSelectors').value.trim();
    const waitSelectors = waitSelectorsValue ?
      waitSelectorsValue.split(',').map(s => s.trim()).filter(s => s) : [];

    return {
      id: this.currentEditingSite?.id || this.generateId(),
      enabled: this.currentEditingSite?.enabled !== false,
      name: document.getElementById('siteName').value.trim(),
      domain: document.getElementById('siteDomain').value.trim(),
      config: {
        videoSelector: document.getElementById('videoSelector').value.trim(),
        videoIframe: document.getElementById('videoIframe').value.trim(),

        titleMethod: document.getElementById('titleMethod').value,
        titleRegex: document.getElementById('titleRegex').value.trim(),
        titleRegexGroup: parseInt(document.getElementById('titleRegexGroup').value) || 1,
        titleSelector: document.getElementById('titleSelector').value.trim(),
        titleMetaProperty: document.getElementById('titleMetaProperty').value.trim(),
        titleJsonPath: document.getElementById('titleJsonPath').value.trim(),

        episodeMethod: document.getElementById('episodeMethod').value,
        episodeRegex: document.getElementById('episodeRegex').value.trim(),
        episodeRegexGroup: parseInt(document.getElementById('episodeRegexGroup').value) || 1,
        episodeSelector: document.getElementById('episodeSelector').value.trim(),
        episodeUrlPattern: document.getElementById('episodeUrlPattern').value.trim(),

        seasonMethod: document.getElementById('seasonMethod').value,
        seasonPattern: document.getElementById('seasonPattern').value.trim(),

        retryAttempts: parseInt(document.getElementById('retryAttempts').value) || 5,
        waitSelectors: waitSelectors,
      },
    };
  }

  validateSite(site) {
    const errors = [];

    if (!site.name) {
      errors.push('Site name is required');
    }

    if (!site.domain) {
      errors.push('Domain pattern is required');
    }

    // Validate based on extraction methods
    if (site.config.titleMethod === 'regex' && !site.config.titleRegex) {
      errors.push('Title regex pattern is required');
    }
    if (site.config.titleMethod === 'selector' && !site.config.titleSelector) {
      errors.push('Title selector is required');
    }
    if (site.config.titleMethod === 'meta' && !site.config.titleMetaProperty) {
      errors.push('Title meta property is required');
    }
    if (site.config.titleMethod === 'jsonld' && !site.config.titleJsonPath) {
      errors.push('Title JSON path is required');
    }

    if (site.config.episodeMethod === 'regex' && !site.config.episodeRegex) {
      errors.push('Episode regex pattern is required');
    }
    if (site.config.episodeMethod === 'selector' && !site.config.episodeSelector) {
      errors.push('Episode selector is required');
    }
    if (site.config.episodeMethod === 'url' && !site.config.episodeUrlPattern) {
      errors.push('Episode URL pattern is required');
    }

    return errors;
  }

  // ========================================================================
  // SITE MANAGEMENT
  // ========================================================================

  async saveSite() {
    const site = this.getSiteFromForm();
    const errors = this.validateSite(site);

    if (errors.length > 0) {
      alert('Validation errors:\n\n' + errors.join('\n'));
      return;
    }

    if (this.currentEditingSite) {
      // Update existing site
      const index = this.customSites.findIndex(s => s.id === this.currentEditingSite.id);
      if (index !== -1) {
        this.customSites[index] = site;
      }
    } else {
      // Add new site
      this.customSites.push(site);
    }

    const saved = await this.saveCustomSites();
    if (saved) {
      this.closeModal();
      this.renderCustomSites();

      // Notify background script to reload custom sites
      chrome.runtime.sendMessage({ type: 'RELOAD_CUSTOM_SITES' });
    }
  }

  async deleteSite(siteId) {
    if (!confirm('Are you sure you want to delete this custom site?')) {
      return;
    }

    this.customSites = this.customSites.filter(s => s.id !== siteId);
    await this.saveCustomSites();
    this.renderCustomSites();

    // Notify background script
    chrome.runtime.sendMessage({ type: 'RELOAD_CUSTOM_SITES' });
  }

  async toggleSite(siteId) {
    const site = this.customSites.find(s => s.id === siteId);
    if (site) {
      site.enabled = !site.enabled;
      await this.saveCustomSites();
      this.renderCustomSites();

      // Notify background script
      chrome.runtime.sendMessage({ type: 'RELOAD_CUSTOM_SITES' });
    }
  }

  generateId() {
    return 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ========================================================================
  // RENDERING
  // ========================================================================

  renderCustomSites() {
    const container = document.getElementById('customSitesList');
    const emptyState = document.getElementById('emptyState');

    if (this.customSites.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = this.customSites.map(site => `
      <div class="site-card">
        <div class="site-header">
          <span class="site-name">${this.escapeHtml(site.name)}</span>
          <span class="badge ${site.enabled ? 'badge-success' : 'badge-inactive'}">
            ${site.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div class="site-details">
          <span class="domain">${this.escapeHtml(site.domain)}</span>
        </div>
        <div class="site-actions">
          <label class="toggle-switch">
            <input type="checkbox" ${site.enabled ? 'checked' : ''}
                   onchange="settingsManager.toggleSite('${site.id}')">
            <span class="toggle-slider"></span>
          </label>
          <button class="btn btn-secondary btn-small"
                  onclick="settingsManager.openModal(settingsManager.customSites.find(s => s.id === '${site.id}'))">
            Edit
          </button>
          <button class="btn btn-danger btn-small"
                  onclick="settingsManager.deleteSite('${site.id}')">
            Delete
          </button>
        </div>
      </div>
    `).join('');
  }

  // ========================================================================
  // TEST EXTRACTION
  // ========================================================================

  async testExtraction() {
    const site = this.getSiteFromForm();
    const errors = this.validateSite(site);

    if (errors.length > 0) {
      alert('Please fix validation errors before testing:\n\n' + errors.join('\n'));
      return;
    }

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if tab matches domain
      if (!this.matchesDomain(tab.url, site.domain)) {
        alert(`Current tab URL (${tab.url}) does not match domain pattern (${site.domain})`);
        return;
      }

      // Inject test script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: SettingsManager.extractMediaInfoTest,
        args: [site.config],
      });

      if (results && results[0] && results[0].result) {
        this.showTestResults(results[0].result);
      }
    } catch (e) {
      console.error('[Settings] Test failed:', e);
      alert('Test failed: ' + e.message);
    }
  }

  // This function is injected into the page
  static extractMediaInfoTest(config) {
    let title = null;
    let episode = null;
    let season = null;

    // Title extraction
    switch (config.titleMethod) {
      case 'regex':
        if (config.titleRegex) {
          const regex = new RegExp(config.titleRegex, 'i');
          const match = document.title.match(regex);
          if (match && match[config.titleRegexGroup]) {
            title = match[config.titleRegexGroup].trim();
          }
        }
        break;

      case 'selector':
        if (config.titleSelector) {
          const el = document.querySelector(config.titleSelector);
          if (el) {
            title = el.textContent?.trim();
          }
        }
        break;

      case 'meta':
        if (config.titleMetaProperty) {
          const meta = document.querySelector(`meta[property="${config.titleMetaProperty}"]`);
          if (meta) {
            title = meta.getAttribute('content')?.trim();
          }
        }
        break;

      case 'jsonld':
        // Simplified JSON-LD extraction
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            // Simple path extraction (e.g., "partOfSeries.name")
            const parts = config.titleJsonPath.split('.');
            let value = data;
            for (const part of parts) {
              value = value?.[part];
            }
            if (value) {
              title = value.toString().trim();
              break;
            }
          } catch (e) {
            // Ignore
          }
        }
        break;
    }

    // Episode extraction
    switch (config.episodeMethod) {
      case 'regex':
        if (config.episodeRegex) {
          const regex = new RegExp(config.episodeRegex, 'i');
          const match = document.title.match(regex);
          if (match && match[config.episodeRegexGroup]) {
            episode = parseInt(match[config.episodeRegexGroup], 10);
          }
        }
        break;

      case 'selector':
        if (config.episodeSelector) {
          const el = document.querySelector(config.episodeSelector);
          if (el) {
            const epMatch = el.textContent?.match(/(\d+)/);
            if (epMatch) {
              episode = parseInt(epMatch[1], 10);
            }
          }
        }
        break;

      case 'url':
        if (config.episodeUrlPattern) {
          const regex = new RegExp(config.episodeUrlPattern, 'i');
          const match = window.location.pathname.match(regex);
          if (match && match[1]) {
            episode = parseInt(match[1], 10);
          }
        }
        break;
    }

    // Season extraction
    if (config.seasonMethod !== 'none' && config.seasonPattern) {
      const regex = new RegExp(config.seasonPattern, 'i');
      let match = null;

      if (config.seasonMethod === 'url') {
        match = window.location.pathname.match(regex);
      } else if (config.seasonMethod === 'regex') {
        match = document.title.match(regex);
      }

      if (match && match[1]) {
        season = parseInt(match[1], 10);
      }
    }

    return {
      title: title || 'Unknown',
      episode: episode || null,
      season: season || null,
      status: (title && episode) ? 'Success' : 'Partial',
    };
  }

  showTestResults(results) {
    document.getElementById('testResults').classList.remove('hidden');
    document.getElementById('testTitle').textContent = results.title;
    document.getElementById('testEpisode').textContent = results.episode || 'Not found';
    document.getElementById('testSeason').textContent = results.season || 'Not found';
    document.getElementById('testStatus').textContent = results.status;
    document.getElementById('testStatus').style.color =
      results.status === 'Success' ? '#059669' : '#d97706';
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  matchesDomain(url, pattern) {
    // Convert domain pattern to regex
    // *.example.com -> ^https?://[^/]*\.example\.com
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^/]*');

    const regex = new RegExp(`^https?:\\/\\/${regexPattern}`, 'i');
    return regex.test(url);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize settings manager
const settingsManager = new SettingsManager();
