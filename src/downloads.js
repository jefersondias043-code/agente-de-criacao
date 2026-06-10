'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   DOWNLOADS — multi-plataforma via serviços externos
   ============================================================ */

const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    detect: (url) => /(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv)\//i.test(url),
    services: [
      { name: 'SnapInsta', url: (u) => `https://snapinsta.app/?url=${encodeURIComponent(u)}` },
      { name: 'SaveInsta', url: (u) => `https://saveinsta.app/?url=${encodeURIComponent(u)}` },
      { name: 'iGram', url: (u) => `https://igram.world/?url=${encodeURIComponent(u)}` },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: '#010101',
    detect: (url) => /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(url),
    services: [
      { name: 'SnapTik', url: (u) => `https://snaptik.app/?url=${encodeURIComponent(u)}` },
      { name: 'SSSTik', url: (u) => `https://ssstik.io/?url=${encodeURIComponent(u)}` },
      { name: 'TikMate', url: (u) => `https://tikmate.online/?url=${encodeURIComponent(u)}` },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    detect: (url) => /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/i.test(url),
    services: [
      { name: 'Y2mate', url: (u) => `https://www.y2mate.com/youtube/${extractYoutubeId(u) || ''}` },
      { name: 'SaveFrom', url: (u) => `https://en.savefrom.net/391/?url=${encodeURIComponent(u)}` },
      { name: 'SSYoutube', url: (u) => u.replace(/youtube\.com/, 'ssyoutube.com').replace(/youtu\.be/, 'ssyoutu.be') },
    ],
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    color: '#1DA1F2',
    detect: (url) => /(?:twitter\.com|x\.com)\/.*\/status\//i.test(url),
    services: [
      { name: 'TwitterVideoDownloader', url: (u) => `https://twittervideodownloader.com/?url=${encodeURIComponent(u)}` },
      { name: 'SaveTweetVid', url: (u) => `https://www.savetweetvid.com/?url=${encodeURIComponent(u)}` },
      { name: 'SSSTwitter', url: (u) => `https://ssstwitter.com/?url=${encodeURIComponent(u)}` },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    detect: (url) => /(?:facebook\.com|fb\.watch|fb\.com)/i.test(url),
    services: [
      { name: 'GetfVid', url: (u) => `https://www.getfvid.com/pt/downloader?url=${encodeURIComponent(u)}` },
      { name: 'FDownloader', url: (u) => `https://fdownloader.net/?url=${encodeURIComponent(u)}` },
      { name: 'SnapSave', url: (u) => `https://snapsave.app/?url=${encodeURIComponent(u)}` },
    ],
  },
  {
    id: 'threads',
    name: 'Threads',
    color: '#000000',
    detect: (url) => /threads\.(net|com)\/.*\/post\//i.test(url),
    services: [
      { name: 'ThreadsPhotoDownloader', url: (u) => `https://threadsphotodownloader.com/?url=${encodeURIComponent(u)}` },
      { name: 'SnapThreads', url: (u) => `https://snapthreads.com/?url=${encodeURIComponent(u)}` },
    ],
  },
  {
    id: 'kwai',
    name: 'Kwai',
    color: '#FF6600',
    detect: (url) => /kwai\.com|kwai\.app/i.test(url),
    services: [
      { name: 'SaveKwai', url: (u) => `https://savekwai.com/?url=${encodeURIComponent(u)}` },
    ],
  },
];

function extractYoutubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1];
}

function detectPlatform(url) {
  if (!url) return null;
  return PLATFORMS.find(p => p.detect(url)) || null;
}

function platformIcon(id) {
  const icons = {
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    tiktok: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>',
    youtube: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
    twitter: '<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    threads: '<circle cx="12" cy="12" r="10"/><path d="M8 14a4 4 0 0 1 8 0"/>',
    kwai: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  };
  return icons[id] || '<circle cx="12" cy="12" r="10"/>';
}

function renderDownloads() {
  const input = $('#d-url');
  const badge = $('#d-platform-badge');
  const services = $('#d-services');

  const update = () => {
    const url = input.value.trim();
    if (!url) {
      badge.innerHTML = '<span class="text-xs text-mute">Cole um link para começar.</span>';
      services.innerHTML = '';
      return;
    }
    // Segurança: só URLs http(s) viram links de serviço (nada de javascript:, data: etc.)
    let parsed = null;
    try { parsed = new URL(url); } catch (_) { /* inválida */ }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
      badge.innerHTML = '<span class="badge danger">Link inválido</span><div class="text-xs text-mute mt-1">Cole uma URL completa começando com http(s)://</div>';
      services.innerHTML = '';
      return;
    }
    const platform = detectPlatform(url);
    if (!platform) {
      badge.innerHTML = `<span class="badge danger">Plataforma não reconhecida</span>
        <div class="text-xs text-mute mt-1">Plataformas suportadas: ${PLATFORMS.map(p => p.name).join(', ')}.</div>`;
      services.innerHTML = '';
      return;
    }
    badge.innerHTML = `
      <div class="flex items-center gap-1" style="flex-wrap: wrap;">
        <span class="badge accent" style="background: ${platform.color}; border-color: ${platform.color};">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${platformIcon(platform.id)}</svg>
          ${platform.name}
        </span>
        <span class="text-xs text-mute">detectado pela URL</span>
      </div>`;
    services.innerHTML = `
      <div class="label mb-1">Escolha um serviço para baixar:</div>
      <div class="flex flex-wrap gap-1">
        ${platform.services.map(s => `
          <button class="btn btn-ghost btn-sm" data-svc="${escapeHtml(s.url(url))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            ${escapeHtml(s.name)}
          </button>
        `).join('')}
      </div>
      <div class="text-xs text-mute mt-2">
        Os serviços abrem em nova aba. São de terceiros — a plataforma não controla seu conteúdo, anúncios ou políticas.
      </div>`;

    services.querySelectorAll('[data-svc]').forEach(btn => {
      btn.onclick = () => {
        window.open(btn.dataset.svc, '_blank', 'noopener,noreferrer');
        addToHistory({ url, platform: platform.id, platformName: platform.name });
      };
    });
  };
  input.oninput = update;
  update();

  $('#d-clear').onclick = () => {
    input.value = '';
    update();
  };

  // Histórico
  renderDownloadHistory();
  $('#d-clear-history').onclick = () => {
    if (!confirm('Apagar histórico de URLs?')) return;
    State.downloads = [];
    saveJSON(STORAGE_KEYS.downloads, State.downloads);
    renderDownloadHistory();
    toast('Histórico limpo.', 'success');
  };
}

function addToHistory(entry) {
  const item = {
    id: uuid(),
    url: entry.url,
    platform: entry.platform,
    platformName: entry.platformName,
    createdAt: new Date().toISOString(),
  };
  State.downloads.unshift(item);
  // Limita a 50 últimos
  State.downloads = State.downloads.slice(0, 50);
  saveJSON(STORAGE_KEYS.downloads, State.downloads);
  renderDownloadHistory();
}

function renderDownloadHistory() {
  const wrap = $('#d-history');
  if (!State.downloads.length) {
    wrap.innerHTML = '<div class="text-sm text-mute" style="padding: 1rem 0;">Nenhum link consultado ainda.</div>';
    return;
  }
  wrap.innerHTML = `<div class="list">` + State.downloads.map(d => {
    const platform = PLATFORMS.find(p => p.id === d.platform);
    const color = platform?.color || '#888';
    return `
      <div class="list-item" data-dl-url="${escapeHtml(d.url)}">
        <div class="list-item-header">
          <div class="list-item-title" style="font-family: var(--mono); font-size: 0.8rem;">${escapeHtml(truncate(d.url, 80))}</div>
          <span class="badge" style="background: ${color}; color: #fff; border-color: ${color}; font-size: 0.65rem;">${escapeHtml(d.platformName)}</span>
        </div>
        <div class="list-item-meta">
          <span>${formatDate(d.createdAt)}</span>
        </div>
      </div>`;
  }).join('') + `</div>`;
  wrap.querySelectorAll('[data-dl-url]').forEach(el => {
    el.onclick = () => {
      $('#d-url').value = el.dataset.dlUrl;
      $('#d-url').dispatchEvent(new Event('input'));
      $('#d-url').focus();
    };
  });
}

