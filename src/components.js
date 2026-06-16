function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}
window.showToast = showToast;

window.Components = {
    ReplayView: () => `
        <div class="replay-hero fade-in" id="drop-zone">
            <div class="hero-content">
                <i data-lucide="file-search" class="hero-icon"></i>
                <h1>Outil coach — Analyse de replays Rocket League</h1>
                <p>Glissez un ou <strong>plusieurs</strong> fichiers <code>.replay</code>. Analyse locale (WASM) : minimap, stats, possession, boost, graphiques et export JSON.</p>
                <button class="btn-primary btn-lg" id="btn-upload-hero">
                    <i data-lucide="upload-cloud"></i> Sélectionner des .replay
                </button>
            </div>
            <div class="hero-features">
                <div class="feature-chip"><i data-lucide="map"></i> Minimap + heatmap</div>
                <div class="feature-chip"><i data-lucide="bar-chart-3"></i> Graphiques</div>
                <div class="feature-chip"><i data-lucide="layers"></i> Multi-replays</div>
                <div class="feature-chip"><i data-lucide="filter"></i> Filtre équipe</div>
                <div class="feature-chip"><i data-lucide="book-open"></i> Glossaire coach</div>
            </div>
        </div>

        <div id="replay-loading" class="replay-loading" hidden>
            <div class="loader"></div>
            <p id="loading-label">Décryptage et extraction des données…</p>
            <div class="progress-bar"><div class="progress-fill" id="loading-progress"></div></div>
            <span class="progress-pct" id="loading-pct">0%</span>
        </div>

        <div id="replay-results" hidden>
            <div id="replay-library" class="replay-library" hidden></div>

            <div class="coach-toolbar fade-in">
                <div class="toolbar-group">
                    <span class="toolbar-label">Équipe</span>
                    <button class="btn-chip active" data-team-filter="all">Tous</button>
                    <button class="btn-chip" data-team-filter="0">Bleu</button>
                    <button class="btn-chip" data-team-filter="1">Orange</button>
                    <button class="btn-chip" data-team-filter="mine">Mon équipe</button>
                </div>
                <div class="toolbar-group">
                    <span class="toolbar-label">Je suis</span>
                    <select id="my-team-select" class="speed-select">
                        <option value="">— Choisir —</option>
                        <option value="0">Équipe bleue</option>
                        <option value="1">Équipe orange</option>
                    </select>
                </div>
            </div>

            <div class="match-banner fade-in">
                <div class="team-block team-blue">
                    <span class="team-label">Bleu</span>
                    <span class="team-name" id="res-blue-name"></span>
                </div>
                <div class="score-block">
                    <span class="score" id="res-blue-score"></span>
                    <span class="score-sep">—</span>
                    <span class="score" id="res-orange-score"></span>
                </div>
                <div class="team-block team-orange">
                    <span class="team-label">Orange</span>
                    <span class="team-name" id="res-orange-name"></span>
                </div>
            </div>

            <div class="meta-grid fade-in">
                <div class="meta-card"><span class="meta-label">Fichier</span><span class="meta-value" id="res-filename"></span></div>
                <div class="meta-card"><span class="meta-label">Map</span><span class="meta-value" id="res-map"></span></div>
                <div class="meta-card"><span class="meta-label">Durée</span><span class="meta-value" id="res-duration"></span></div>
                <div class="meta-card"><span class="meta-label">Frames</span><span class="meta-value" id="res-frames"></span></div>
                <div class="meta-card"><span class="meta-label">Possession</span><span class="meta-value" id="res-possession"></span></div>
                <div class="meta-card"><span class="meta-label">Mode</span><span class="meta-value" id="res-gametype"></span></div>
            </div>

            <div class="analysis-grid fade-in">
                <div class="analysis-main">
                    <div class="panel">
                        <div class="panel-header">
                            <h2><i data-lucide="map"></i> Minimap tactique</h2>
                            <div class="panel-actions">
                                <button class="btn-chip" id="btn-heatmap" title="Heatmap balle">🔥 Heatmap</button>
                                <span class="panel-badge" id="res-frame-info">—</span>
                            </div>
                        </div>
                        <div class="minimap-wrapper">
                            <canvas id="replay-canvas"></canvas>
                            <div id="minimap-empty" class="minimap-empty" hidden>
                                <i data-lucide="alert-circle"></i>
                                <p>Aucune donnée de position extraite.</p>
                            </div>
                        </div>
                        <div class="timeline-markers" id="timeline-markers"></div>
                        <div class="playback-controls">
                            <button class="ctrl-btn" id="btn-step-back" title="Frame -1 (←)"><i data-lucide="skip-back"></i></button>
                            <button class="ctrl-btn ctrl-play" id="btn-play-pause" title="Play/Pause (Espace)"><i data-lucide="play"></i></button>
                            <button class="ctrl-btn" id="btn-step-forward" title="Frame +1 (→)"><i data-lucide="skip-forward"></i></button>
                            <input type="range" id="timeline-slider" min="0" max="100" value="0" class="timeline-slider">
                            <span id="timeline-time" class="timeline-time">0:00</span>
                            <select id="playback-speed" class="speed-select">
                                <option value="0.5">0.5×</option>
                                <option value="1" selected>1×</option>
                                <option value="2">2×</option>
                                <option value="4">4×</option>
                            </select>
                        </div>
                        <p class="hint-text">Espace · ← → · cliquez un événement pour sauter à la frame</p>
                    </div>
                </div>
                <div class="analysis-side">
                    <div class="panel">
                        <div class="panel-header"><h2><i data-lucide="users"></i> Joueurs</h2></div>
                        <div id="res-player-cards" class="player-cards"></div>
                    </div>
                    <div class="panel coach-summary-panel">
                        <div class="panel-header"><h2><i data-lucide="clipboard-list"></i> Résumé coach</h2></div>
                        <div id="res-coach-summary"></div>
                    </div>
                </div>
            </div>

            <div class="tabs-panel fade-in">
                <div class="tabs-nav">
                    <button class="tab-btn active" data-tab="stats">Stats</button>
                    <button class="tab-btn" data-tab="charts">Graphiques</button>
                    <button class="tab-btn" data-tab="boost">Boost</button>
                    <button class="tab-btn" data-tab="positioning">Position</button>
                    <button class="tab-btn" data-tab="mechanics">Méca</button>
                    <button class="tab-btn" data-tab="touches">Touches</button>
                    <button class="tab-btn" data-tab="shots">Tirs</button>
                    <button class="tab-btn" data-tab="goals">Buts</button>
                    <button class="tab-btn" data-tab="possession">Possession</button>
                    <button class="tab-btn" data-tab="events">Événements</button>
                    <button class="tab-btn" data-tab="compare">Comparer</button>
                    <button class="tab-btn" data-tab="heatmap">Heatmap</button>
                    <button class="tab-btn" data-tab="metadata">Meta</button>
                    <button class="tab-btn" data-tab="raw">JSON</button>
                </div>
                <div class="tab-content active" id="tab-stats"><div class="table-wrap"><table class="stats-table"><thead><tr>
                    <th>Joueur</th><th>Score</th><th>Buts</th><th>Passes</th><th>Arrêts</th><th>Tirs</th><th>Démos</th><th>Précision</th>
                </tr></thead><tbody id="res-player-stats"></tbody></table></div></div>
                <div class="tab-content" id="tab-charts"><div id="res-charts" class="charts-grid"></div></div>
                <div class="tab-content" id="tab-boost"><div id="res-boost"></div></div>
                <div class="tab-content" id="tab-positioning"><div id="res-positioning"></div></div>
                <div class="tab-content" id="tab-mechanics"><div id="res-mechanics"></div></div>
                <div class="tab-content" id="tab-touches"><div id="res-touches"></div></div>
                <div class="tab-content" id="tab-shots"><div id="res-shots"></div></div>
                <div class="tab-content" id="tab-goals"><div id="res-goals"></div></div>
                <div class="tab-content" id="tab-possession"><div id="res-possession-detail"></div></div>
                <div class="tab-content" id="tab-events">
                    <div class="events-filter">
                        <button class="btn-chip active" data-filter="all">Tous</button>
                        <button class="btn-chip" data-filter="goal">Buts</button>
                        <button class="btn-chip" data-filter="match">Match</button>
                        <button class="btn-chip" data-filter="mechanic">Mécaniques</button>
                        <button class="btn-chip" data-filter="demo">Démos</button>
                        <button class="btn-chip" data-filter="touch">Touches</button>
                    </div>
                    <div id="res-events" class="timeline-list events-scroll"></div>
                </div>
                <div class="tab-content" id="tab-compare"><div id="res-compare"></div></div>
                <div class="tab-content" id="tab-heatmap">
                    <div class="heatmap-controls">
                        <button class="btn-chip active" data-heatmap="ball">Balle</button>
                        <span id="heatmap-player-btns"></span>
                    </div>
                    <p class="hint-text" id="heatmap-hint">Densité des positions de balle sur la durée du match</p>
                    <canvas id="heatmap-canvas" class="heatmap-canvas"></canvas>
                </div>
                <div class="tab-content" id="tab-metadata"><div id="res-metadata" class="metadata-grid"></div></div>
                <div class="tab-content" id="tab-raw">
                    <div class="raw-actions">
                        <button class="btn-ghost btn-sm" id="btn-copy-json"><i data-lucide="copy"></i> Copier</button>
                        <button class="btn-ghost btn-sm" id="btn-download-json"><i data-lucide="download"></i> Télécharger</button>
                    </div>
                    <pre id="res-raw-json" class="raw-json"></pre>
                </div>
            </div>
            <div class="results-footer fade-in">
                <button class="btn-ghost" id="btn-add-replay"><i data-lucide="plus"></i> Ajouter un replay</button>
                <button class="btn-ghost" id="btn-new-replay"><i data-lucide="rotate-ccw"></i> Nouvelle session</button>
            </div>
        </div>

        <div id="glossary-modal" class="modal" hidden>
            <div class="modal-backdrop" data-close-glossary></div>
            <div class="modal-panel">
                <div class="modal-header">
                    <h2><i data-lucide="book-open"></i> Glossaire coach</h2>
                    <button class="ctrl-btn" id="btn-close-glossary" type="button"><i data-lucide="x"></i></button>
                </div>
                <input type="search" id="glossary-search" class="glossary-search" placeholder="Rechercher une métrique…">
                <div id="glossary-content" class="glossary-scroll"></div>
            </div>
        </div>
    `
};
