import { MinimapEngine, renderHeatmapCanvas } from './minimap.js';
import { formatTime } from './utils.js';
import { glossaryHtml } from './glossary.js';
import { renderBarChart, renderStackedChart, renderDonutChart, renderHistogram } from './charts.js';

function filterHeaderPlayers(players, teamFilter, myTeam) {
    if (!players?.length) return [];
    if (teamFilter === 'mine' && myTeam != null) return players.filter(p => p.Team === myTeam);
    if (teamFilter === 'all') return players;
    return players.filter(p => p.Team === teamFilter);
}

function filterCoachPlayers(coach, teamFilter, myTeam) {
    if (!coach?.players) return [];
    if (teamFilter === 'mine' && myTeam != null) return coach.players.filter(p => p.team === myTeam);
    if (teamFilter === 'all') return coach.players;
    return coach.players.filter(p => p.team === teamFilter);
}

function replaySummary(data) {
    const c = data.coach;
    const blueGoals = data.players?.filter(p => p.Team === 0).reduce((s, p) => s + (p.Goals || 0), 0) ?? 0;
    const orangeGoals = data.players?.filter(p => p.Team === 1).reduce((s, p) => s + (p.Goals || 0), 0) ?? 0;
    const avgBoost = (team) => {
        const ps = c?.players?.filter(p => p.team === team) || [];
        if (!ps.length) return '—';
        return Math.round(ps.reduce((s, p) => s + p.boost.avg, 0) / ps.length);
    };
    return {
        filename: data.originalFilename,
        map: data.mapName,
        duration: data.duration,
        score: `${data.teamBlue.score} - ${data.teamOrange.score}`,
        possessionBlue: c?.teams?.possession?.blue ?? '—',
        possessionOrange: c?.teams?.possession?.orange ?? '—',
        goalsBlue: blueGoals,
        goalsOrange: orangeGoals,
        avgBoostBlue: avgBoost(0),
        avgBoostOrange: avgBoost(1),
        shots: c?.shots?.length ?? 0
    };
}

class App {
    constructor() {
        this.container = document.getElementById('view-container');
        this.minimap = null;
        this.replays = [];
        this.activeReplayId = null;
        this.eventFilter = 'all';
        this.teamFilter = 'all';
        this.myTeam = null;
        this.heatmapTarget = 'ball';
        this.init();
    }

    get currentData() {
        return this.replays.find(r => r.id === this.activeReplayId)?.data ?? null;
    }

    init() {
        this.render();
        this.bindGlobalUpload();
        this.initGlossary();
    }

    render() {
        this.container.innerHTML = window.Components.ReplayView();
        if (window.lucide) window.lucide.createIcons();
        this.initDropZone();
        this.initTabs();
        this.initTeamToolbar();
        document.getElementById('loading-overlay')?.classList.add('hidden');
        if (this.replays.length) this.showResultsShell();
    }

    bindGlobalUpload() {
        const headerBtn = document.getElementById('btn-upload-header');
        const fileInput = document.getElementById('replay-file-input');
        if (headerBtn && fileInput) {
            headerBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) this.handleReplayFiles([...e.target.files]);
            });
        }
        document.getElementById('btn-glossary')?.addEventListener('click', () => this.openGlossary());
    }

    initGlossary() {
        const modal = document.getElementById('glossary-modal');
        const content = document.getElementById('glossary-content');
        const search = document.getElementById('glossary-search');
        if (content) content.innerHTML = glossaryHtml();
        search?.addEventListener('input', () => {
            if (content) content.innerHTML = glossaryHtml(search.value);
        });
        document.getElementById('btn-close-glossary')?.addEventListener('click', () => this.closeGlossary());
        modal?.querySelector('[data-close-glossary]')?.addEventListener('click', () => this.closeGlossary());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeGlossary();
        });
    }

    openGlossary(scrollTo) {
        const modal = document.getElementById('glossary-modal');
        if (!modal) return;
        modal.hidden = false;
        if (scrollTo) {
            document.getElementById(`gloss-${scrollTo}`)?.scrollIntoView({ behavior: 'smooth' });
        }
        if (window.lucide) window.lucide.createIcons();
    }

    closeGlossary() {
        const modal = document.getElementById('glossary-modal');
        if (modal) modal.hidden = true;
    }

    initTeamToolbar() {
        document.querySelectorAll('[data-team-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-team-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.teamFilter = btn.dataset.teamFilter === 'mine' ? 'mine'
                    : btn.dataset.teamFilter === 'all' ? 'all' : parseInt(btn.dataset.teamFilter, 10);
                if (this.teamFilter === 'mine' && this.myTeam == null) {
                    window.showToast('Choisissez « Je suis » bleu ou orange', 'info');
                }
                this.refreshFilteredViews();
            });
        });
        document.getElementById('my-team-select')?.addEventListener('change', (e) => {
            const v = e.target.value;
            this.myTeam = v === '' ? null : parseInt(v, 10);
            if (this.teamFilter === 'mine' && this.myTeam != null) this.refreshFilteredViews();
        });
    }

    refreshFilteredViews() {
        const data = this.currentData;
        if (!data) return;
        this.renderPlayerCards(data.players);
        this.renderStatsTable(data.players);
        this.renderCoachSummary(data.coach);
        this.renderCharts(data.coach);
        this.renderBoost(data.coach);
        this.renderPositioning(data.coach);
        this.renderMechanics(data.coach);
        this.renderTouches(data.coach);
        this.renderShots(data.coach);
        this.renderGoals(data.coach);
        this.renderEvents(data.coach);
    }

    initDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const heroBtn = document.getElementById('btn-upload-hero');
        const fileInput = document.getElementById('replay-file-input');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
            dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); });
        });
        dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-over');
            const files = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.replay'));
            if (files.length) this.handleReplayFiles(files);
        });
        if (heroBtn && fileInput) heroBtn.addEventListener('click', () => fileInput.click());

        document.getElementById('btn-new-replay')?.addEventListener('click', () => {
            this.replays = [];
            this.activeReplayId = null;
            if (this.minimap) { this.minimap.destroy(); this.minimap = null; }
            const fi = document.getElementById('replay-file-input');
            if (fi) fi.value = '';
            this.render();
            this.bindGlobalUpload();
        });

        document.getElementById('btn-add-replay')?.addEventListener('click', () => {
            document.getElementById('replay-file-input')?.click();
        });
    }

    initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
                const tab = btn.dataset.tab;
                if (tab === 'heatmap') this.renderHeatmapTab();
                if (tab === 'charts' && this.currentData?.coach) this.renderCharts(this.currentData.coach);
                if (tab === 'compare') this.renderCompare();
            });
        });
        document.querySelectorAll('.events-filter .btn-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.events-filter .btn-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.eventFilter = btn.dataset.filter;
                if (this.currentData) this.renderEvents(this.currentData.coach);
            });
        });
    }

    updateLoading(p) {
        const label = document.getElementById('loading-label');
        const bar = document.getElementById('loading-progress');
        const pct = document.getElementById('loading-pct');
        if (label) label.textContent = p.label || 'Chargement…';
        if (bar) bar.style.width = (p.progress || 0) + '%';
        if (pct) pct.textContent = (p.progress || 0) + '%';
    }

    async handleReplayFiles(files) {
        const valid = files.filter(f => f.name.toLowerCase().endsWith('.replay'));
        if (!valid.length) {
            window.showToast("Aucun fichier .replay valide", 'error');
            return;
        }

        const loading = document.getElementById('replay-loading');
        const hero = document.getElementById('drop-zone');
        loading.hidden = false;
        hero.hidden = true;
        this.showResultsShell();

        for (let i = 0; i < valid.length; i++) {
            const file = valid[i];
            this.updateLoading({ progress: 0, label: `Analyse ${i + 1}/${valid.length} : ${file.name}` });
            try {
                const data = await window.ReplayParser.parse(file, (p) => this.updateLoading(p));
                const id = crypto.randomUUID();
                this.replays.push({ id, data, summary: replaySummary(data) });
                this.activeReplayId = id;
            } catch (e) {
                window.showToast(`${file.name} : ${e.message}`, 'error');
            }
        }

        loading.hidden = true;
        if (!this.replays.length) {
            hero.hidden = false;
            return;
        }

        this.renderReplayLibrary();
        this.displayActiveReplay();
        window.showToast(`${valid.length} replay(s) analysé(s)`, 'success');
    }

    showResultsShell() {
        document.getElementById('replay-results').hidden = false;
        document.getElementById('drop-zone').hidden = true;
    }

    renderReplayLibrary() {
        const el = document.getElementById('replay-library');
        if (!el) return;
        if (this.replays.length <= 1) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = `
            <span class="toolbar-label">Session (${this.replays.length})</span>
            ${this.replays.map(r => `
                <button class="replay-chip ${r.id === this.activeReplayId ? 'active' : ''}" data-replay-id="${r.id}">
                    <span class="replay-chip-name">${r.summary.filename}</span>
                    <span class="replay-chip-score">${r.summary.score}</span>
                </button>
            `).join('')}
        `;
        el.querySelectorAll('.replay-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeReplayId = btn.dataset.replayId;
                this.renderReplayLibrary();
                this.displayActiveReplay();
            });
        });
    }

    displayActiveReplay() {
        const data = this.currentData;
        if (!data) return;
        this.populateResults(data);

        if (this.minimap) { this.minimap.destroy(); this.minimap = null; }
        this.minimap = new MinimapEngine('replay-canvas');
        const { hasPositions } = this.minimap.loadData(data.framesData, data.coach?.heatmapBall);
        this.minimap.setMarkers(data.coach?.markers);

        const emptyEl = document.getElementById('minimap-empty');
        if (emptyEl) {
            emptyEl.hidden = hasPositions;
            emptyEl.style.display = hasPositions ? 'none' : 'flex';
        }

        this.initExportButtons(data);
        this.renderCompare();
        if (window.lucide) window.lucide.createIcons();
    }

    populateResults(data) {
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        const coach = data.coach;

        set('res-filename', data.originalFilename);
        set('res-map', data.mapName);
        set('res-duration', data.duration);
        set('res-frames', data.framesCount > 0 ? data.framesCount.toLocaleString() + ' frames' : (data.numFrames || '—'));
        set('res-gametype', data.playlist !== '—' ? data.playlist : data.gameType);
        set('res-possession', coach ? `${coach.teams.possession.blue} bleu · ${coach.teams.possession.orange} orange` : '—');
        set('res-blue-name', data.teamBlue.name);
        set('res-blue-score', data.teamBlue.score);
        set('res-orange-name', data.teamOrange.name);
        set('res-orange-score', data.teamOrange.score);
        set('res-frame-info', data.framesCount > 0 ? `${data.framesCount.toLocaleString()} @ ${data.recordFps} FPS` : '—');

        const mySelect = document.getElementById('my-team-select');
        if (mySelect && this.myTeam != null) mySelect.value = String(this.myTeam);

        this.renderPlayerCards(data.players);
        this.renderStatsTable(data.players);
        this.renderCoachSummary(coach);
        this.renderCharts(coach);
        this.renderBoost(coach);
        this.renderPositioning(coach);
        this.renderMechanics(coach);
        this.renderTouches(coach);
        this.renderShots(coach);
        this.renderGoals(coach);
        this.renderPossession(coach);
        this.renderEvents(coach);
        this.renderHeatmapControls(coach);
        this.renderMetadata(data);
        this.renderRawJson(data);
    }

    glossLink(id) {
        return `<button type="button" class="term-tip" data-gloss="${id}" title="Voir glossaire">?</button>`;
    }

    bindGlossTips(root) {
        root?.querySelectorAll('.term-tip').forEach(btn => {
            btn.addEventListener('click', () => this.openGlossary(btn.dataset.gloss));
        });
    }

    renderPlayerCards(players) {
        const el = document.getElementById('res-player-cards');
        if (!el) return;
        const list = filterHeaderPlayers(players, this.teamFilter, this.myTeam);
        if (!list.length) { el.innerHTML = '<p class="empty-msg">Aucune stat.</p>'; return; }
        el.innerHTML = list.map(p => {
            const acc = p.Shots > 0 ? Math.round((p.Goals / p.Shots) * 100) : 0;
            return `<div class="player-stat-card ${p.Team === 0 ? 'team-blue' : 'team-orange'}">
                <div class="psc-name">${p.Name}</div>
                <div class="psc-score">${p.Score} pts</div>
                <div class="psc-mini">
                    <span>⚽ ${p.Goals}</span><span>🅰️ ${p.Assists}</span>
                    <span>🛡️ ${p.Saves}</span><span>🎯 ${p.Shots}</span>
                </div>
                ${p.Demolitions ? `<div class="psc-demo">💥 ${p.Demolitions}</div>` : ''}
                ${p.Shots > 0 ? `<div class="psc-acc">${acc}% précision</div>` : ''}
            </div>`;
        }).join('');
    }

    renderStatsTable(players) {
        const tbody = document.getElementById('res-player-stats');
        if (!tbody) return;
        const list = filterHeaderPlayers(players, this.teamFilter, this.myTeam);
        if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">—</td></tr>'; return; }
        tbody.innerHTML = list.map(p => {
            const c = p.Team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
            const acc = p.Shots > 0 ? Math.round((p.Goals / p.Shots) * 100) + '%' : '—';
            return `<tr>
                <td style="color:${c};font-weight:700">${p.Name}</td>
                <td>${p.Score}</td><td>${p.Goals}</td><td>${p.Assists}</td>
                <td>${p.Saves}</td><td>${p.Shots}</td><td>${p.Demolitions || 0}</td><td>${acc}</td>
            </tr>`;
        }).join('');
    }

    renderCoachSummary(coach) {
        const el = document.getElementById('res-coach-summary');
        if (!el || !coach) return;
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        const top = [...players].sort((a, b) => b.movement.avgSpeed - a.movement.avgSpeed)[0];
        const mech = Object.values(coach.mechanicsSummary).sort((a, b) => b.count - a.count).slice(0, 4);
        const showTeam = this.teamFilter === 'all';
        el.innerHTML = `
            <div class="coach-kpi-grid">
                ${showTeam ? `
                <div class="coach-kpi"><span class="kpi-label">Possession bleu ${this.glossLink('possession')}</span><span class="kpi-value blue">${coach.teams.possession.blue}</span></div>
                <div class="coach-kpi"><span class="kpi-label">Possession orange</span><span class="kpi-value orange">${coach.teams.possession.orange}</span></div>
                ` : ''}
                <div class="coach-kpi"><span class="kpi-label">Pression territ. ${this.glossLink('territorial_pressure')}</span><span class="kpi-value">${coach.teams.pressure.blue}s / ${coach.teams.pressure.orange}s</span></div>
                <div class="coach-kpi"><span class="kpi-label">Camp adv. ${this.glossLink('field_pressure')}</span><span class="kpi-value">${coach.teams.fieldPressure?.blueOffSec ?? 0}s / ${coach.teams.fieldPressure?.orangeOffSec ?? 0}s</span></div>
            </div>
            ${top ? `<p class="coach-insight">🏎️ Vitesse moy. max : <strong>${top.name}</strong> (${top.movement.avgSpeed} uu/s)</p>` : ''}
            <div class="coach-mech-chips">${mech.map(m => `<span class="feature-chip">${m.label}: ${m.count}</span>`).join('')}</div>
            <p class="hint-text">${coach.eventFeed.length} événements · <button type="button" class="link-btn" id="btn-gloss-from-summary">Glossaire coach</button></p>`;
        this.bindGlossTips(el);
        el.querySelector('#btn-gloss-from-summary')?.addEventListener('click', () => this.openGlossary());
    }

    renderCharts(coach) {
        const el = document.getElementById('res-charts');
        if (!el || !coach) return;
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        const colors = players.map(p => p.team === 0 ? '#00E5FF' : '#FF6B00');

        el.innerHTML = `
            <div class="chart-card"><canvas id="chart-boost" class="chart-canvas"></canvas></div>
            <div class="chart-card"><canvas id="chart-position" class="chart-canvas"></canvas></div>
            <div class="chart-card"><canvas id="chart-possession" class="chart-canvas"></canvas></div>
            <div class="chart-card"><canvas id="chart-shots" class="chart-canvas"></canvas></div>
            <p class="hint-text chart-hint">Unités : boost en points, vitesse en uu/s ${this.glossLink('uu')} — voir glossaire pour les définitions.</p>`;
        this.bindGlossTips(el);

        requestAnimationFrame(() => {
            renderBarChart('chart-boost', {
                title: 'Boost moyen par joueur',
                labels: players.map(p => p.name),
                values: players.map(p => p.boost.avg),
                colors
            });
            const parsePct = (s) => parseInt(String(s).replace('%', ''), 10) || 0;
            renderStackedChart('chart-position', {
                title: 'Répartition positionnelle (%)',
                labels: players.map(p => p.name),
                seriesNames: ['Défense', 'Neutre', 'Attaque'],
                seriesColors: ['#3b82f6', '#64748b', '#f97316'],
                series: [
                    players.map(p => parsePct(p.positioning.defThirdPct)),
                    players.map(p => parsePct(p.positioning.neuThirdPct)),
                    players.map(p => parsePct(p.positioning.offThirdPct))
                ]
            });
            const poss = coach.teams.possession;
            const parseP = (s) => parseInt(String(s).replace('%', ''), 10) || 0;
            renderDonutChart('chart-possession', {
                title: 'Possession équipes',
                segments: [
                    { label: 'Bleu', value: parseP(poss.blue), color: '#00E5FF' },
                    { label: 'Orange', value: parseP(poss.orange), color: '#FF6B00' },
                    { label: 'Neutre', value: parseP(poss.neutral), color: '#64748b' }
                ]
            });
            const shots = (coach.shots || []).filter(s => {
                if (this.teamFilter === 'all') return true;
                if (this.teamFilter === 'mine' && this.myTeam != null) return s.team === this.myTeam;
                return s.team === this.teamFilter;
            });
            renderHistogram('chart-shots', {
                title: 'Distribution vitesse des tirs',
                values: shots.map(s => s.ballSpeed),
                bins: [0, 1000, 1500, 2000, 2500, 3000, 4000],
                color: '#A855F7',
                xLabel: 'Vitesse balle (uu/s)'
            });
        });
    }

    renderBoost(coach) {
        const el = document.getElementById('res-boost');
        if (!el || !coach) return;
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        el.innerHTML = `<p class="section-sub">Boost ${this.glossLink('boost_avg')} ${this.glossLink('boost_ledger')}</p>
        <div class="table-wrap"><table class="stats-table"><thead><tr>
            <th>Joueur</th><th>Boost moy.</th><th>Temps à 0</th><th>Temps à 100</th><th>Consommé</th><th>Collecté</th><th>Volé</th><th>Gros pads</th><th>Petits pads</th>
        </tr></thead><tbody>${players.map(p => {
            const c = p.team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
            return `<tr>
                <td style="color:${c};font-weight:700">${p.name}</td>
                <td>${p.boost.avg}</td><td>${p.boost.timeZeroPct}</td><td>${p.boost.timeFullPct}</td>
                <td>${p.boost.used}</td><td>${p.boost.collected}</td><td>${p.boost.stolen}</td>
                <td>${p.boost.bigPads}</td><td>${p.boost.smallPads}</td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
        this.bindGlossTips(el);
    }

    renderPositioning(coach) {
        const el = document.getElementById('res-positioning');
        if (!el || !coach) return;
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        el.innerHTML = `<p class="section-sub">Positionnement ${this.glossLink('behind_ball')} ${this.glossLink('last_man')}</p>
        <div class="table-wrap"><table class="stats-table"><thead><tr>
            <th>Joueur</th><th>Défense</th><th>Neutre</th><th>Attaque</th><th>Derrière balle</th><th>Devant balle</th><th>Last</th><th>First</th><th>Dist. balle</th><th>Vitesse</th>
        </tr></thead><tbody>${players.map(p => {
            const c = p.team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
            return `<tr>
                <td style="color:${c};font-weight:700">${p.name}</td>
                <td>${p.positioning.defThirdPct}</td><td>${p.positioning.neuThirdPct}</td><td>${p.positioning.offThirdPct}</td>
                <td>${p.positioning.behindBallPct}</td><td>${p.positioning.inFrontPct}</td>
                <td>${p.positioning.mostBackPct}</td><td>${p.positioning.mostForwardPct}</td>
                <td>${p.positioning.avgDistBall}</td><td>${p.movement.avgSpeed}</td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
        this.bindGlossTips(el);
    }

    renderMechanics(coach) {
        const el = document.getElementById('res-mechanics');
        if (!el || !coach) return;
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        const summary = Object.values(coach.mechanicsSummary).sort((a, b) => b.count - a.count);
        el.innerHTML = `
            <div class="mech-summary-grid">${summary.map(m =>
                `<div class="mech-card"><span class="mech-count">${m.count}</span><span class="mech-label">${m.label}</span></div>`
            ).join('')}</div>
            <h3 class="section-sub">Par joueur</h3>
            <div class="table-wrap"><table class="stats-table"><thead><tr>
                <th>Joueur</th><th>Passes</th><th>One-timer</th><th>50/50</th><th>Speed flip</th><th>Wavedash</th><th>Flick</th><th>Démos</th><th>Air</th>
            </tr></thead><tbody>${players.map(p => {
                const m = p.mechanics;
                const c = p.team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
                return `<tr>
                    <td style="color:${c};font-weight:700">${p.name}</td>
                    <td>${m.pass || 0}</td><td>${m.one_timer || 0}</td><td>${m.fifty_fifty || 0}</td>
                    <td>${m.speed_flip || 0}</td><td>${m.wavedash || 0}</td><td>${m.flick || 0}</td>
                    <td>${m.demo || 0}</td><td>${(m.wall_aerial || 0) + (m.ball_carry || 0)}</td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    }

    renderTouches(coach) {
        const el = document.getElementById('res-touches');
        if (!el || !coach) return;
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        el.innerHTML = `<p class="section-sub">Touches ${this.glossLink('touch_control')} ${this.glossLink('pass_completed')}</p>
        <div class="table-wrap"><table class="stats-table"><thead><tr>
            <th>Joueur</th><th>Total</th><th>Contrôle</th><th>Frappe moy.</th><th>Frappe forte</th>
            <th>Avancée balle</th><th>Recul balle</th><th>Passes compl.</th>
        </tr></thead><tbody>${players.map(p => {
            const t = p.touches;
            const c = p.team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
            return `<tr>
                <td style="color:${c};font-weight:700">${p.name}</td>
                <td>${t.total}</td><td>${t.control}</td><td>${t.medium_hit}</td><td>${t.hard_hit}</td>
                <td>${t.advance}</td><td>${t.retreat}</td><td>${p.passesCompleted}</td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
        this.bindGlossTips(el);
    }

    renderShots(coach) {
        const el = document.getElementById('res-shots');
        if (!el || !coach) return;
        let shots = coach.shots || [];
        if (this.teamFilter === 'mine' && this.myTeam != null) shots = shots.filter(s => s.team === this.myTeam);
        else if (this.teamFilter !== 'all') shots = shots.filter(s => s.team === this.teamFilter);
        if (!shots.length) { el.innerHTML = '<p class="empty-msg">Aucun tir pour ce filtre.</p>'; return; }
        const avgSpeed = Math.round(shots.reduce((s, x) => s + x.ballSpeed, 0) / shots.length);
        el.innerHTML = `
            <div class="coach-kpi-grid" style="margin-bottom:1rem">
                <div class="coach-kpi"><span class="kpi-label">Tirs</span><span class="kpi-value">${shots.length}</span></div>
                <div class="coach-kpi"><span class="kpi-label">Vitesse moy. ${this.glossLink('uu')}</span><span class="kpi-value">${avgSpeed} uu/s</span></div>
            </div>
            <div class="table-wrap"><table class="stats-table"><thead><tr>
                <th>Temps</th><th>Joueur</th><th>Vitesse balle</th><th>Vitesse joueur</th><th></th>
            </tr></thead><tbody>${shots.map(s => {
                const c = s.team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
                return `<tr>
                    <td>${formatTime(s.time)}</td>
                    <td style="color:${c};font-weight:700">${s.player}</td>
                    <td>${s.ballSpeed} uu/s</td><td>${s.playerSpeed} uu/s</td>
                    <td><button class="btn-chip" data-frame="${s.frame}">▶ Frame</button></td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
        this.bindGlossTips(el);
        el.querySelectorAll('[data-frame]').forEach(btn => {
            btn.addEventListener('click', () => this.minimap?.jumpToFrame(parseInt(btn.dataset.frame)));
        });
    }

    renderGoals(coach) {
        const el = document.getElementById('res-goals');
        if (!el || !coach) return;
        let tags = coach.goals?.tags || [];
        if (this.teamFilter === 'mine' && this.myTeam != null) tags = tags.filter(g => g.team === this.myTeam);
        else if (this.teamFilter !== 'all') tags = tags.filter(g => g.team === this.teamFilter);
        const players = filterCoachPlayers(coach, this.teamFilter, this.myTeam);
        const summary = Object.entries(coach.goals?.tagSummary || {}).map(([k, n]) =>
            `<div class="mech-card"><span class="mech-count">${n}</span><span class="mech-label">${k.replace(/_/g, ' ')}</span></div>`
        ).join('');
        el.innerHTML = `
            <p class="section-sub">Analyse buts ${this.glossLink('aerial_goal')} ${this.glossLink('buildup')}</p>
            ${summary ? `<div class="mech-summary-grid">${summary}</div>` : '<p class="empty-msg">Pas de tags de buts.</p>'}
            <h3 class="section-sub">Tags par but</h3>
            <div class="events-scroll" style="max-height:200px;margin-bottom:1.5rem">${tags.map(g => {
                const tc = g.team === 0 ? 'team-blue' : 'team-orange';
                return `<button class="timeline-event clickable" data-frame="${g.frame}">
                    <span class="tl-time">${formatTime(g.time)}</span>
                    <span class="tl-type">${g.label}</span>
                    <span class="tl-player ${tc}">${g.scorer}</span>
                </button>`;
            }).join('')}</div>
            <h3 class="section-sub">Métriques défensives ${this.glossLink('last_man')}</h3>
            <div class="table-wrap"><table class="stats-table"><thead><tr>
                <th>Joueur</th><th>Buts conc. (last)</th><th>Buts pour (most back)</th><th>Buts enc. (most back)</th>
                <th>Boost moy. sur but enc.</th>
            </tr></thead><tbody>${players.map(p => {
                const c = p.team === 0 ? 'var(--accent-blue)' : 'var(--accent-orange)';
                const cd = p.coach;
                return `<tr>
                    <td style="color:${c};font-weight:700">${p.name}</td>
                    <td>${cd.goalsConcededLastDefender}</td><td>${cd.goalsForMostBack}</td><td>${cd.goalsAgainstMostBack}</td>
                    <td>${cd.avgBoostOnGoalAgainst ?? '—'}</td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
        this.bindGlossTips(el);
        el.querySelectorAll('.clickable').forEach(btn => {
            btn.addEventListener('click', () => this.minimap?.jumpToFrame(parseInt(btn.dataset.frame)));
        });
    }

    renderHeatmapControls(coach) {
        const container = document.getElementById('heatmap-player-btns');
        if (!container || !coach?.heatmapPlayers) return;
        let players = Object.values(coach.heatmapPlayers);
        if (this.teamFilter === 'mine' && this.myTeam != null) {
            const names = filterCoachPlayers(coach, 'mine', this.myTeam).map(p => p.name);
            players = players.filter(p => names.includes(p.name));
        } else if (this.teamFilter !== 'all') {
            const names = filterCoachPlayers(coach, this.teamFilter, this.myTeam).map(p => p.name);
            players = players.filter(p => names.includes(p.name));
        }
        container.innerHTML = players.map(p =>
            `<button class="btn-chip" data-heatmap="${p.name}">${p.name}</button>`
        ).join('');
        document.querySelectorAll('[data-heatmap]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-heatmap]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.heatmapTarget = btn.dataset.heatmap;
                this.renderHeatmapTab();
            });
        });
    }

    renderHeatmapTab() {
        const coach = this.currentData?.coach;
        if (!coach) return;
        let points = coach.heatmapBall;
        let hint = 'Densité des positions de balle';
        if (this.heatmapTarget !== 'ball') {
            const entry = Object.values(coach.heatmapPlayers || {}).find(p => p.name === this.heatmapTarget);
            if (entry) { points = entry.points; hint = `Positions de ${entry.name}`; }
        }
        const hintEl = document.getElementById('heatmap-hint');
        if (hintEl) {
            hintEl.innerHTML = `${hint} — <button type="button" class="term-tip link-btn" data-gloss="heatmap">?</button>`;
            this.bindGlossTips(hintEl);
        }
        renderHeatmapCanvas('heatmap-canvas', points);
    }

    renderPossession(coach) {
        const el = document.getElementById('res-possession-detail');
        if (!el || !coach) return;
        const p = coach.teams.possession;
        el.innerHTML = `
            <p class="section-sub">Possession ${this.glossLink('possession')} · Rotations ${this.glossLink('rotation')}</p>
            <div class="possession-bars">
                <div class="poss-bar"><span class="poss-label team-blue">Bleu</span><div class="poss-track"><div class="poss-fill blue" style="width:${p.blue}"></div></div><span>${p.blue} (${p.blueSec}s)</span></div>
                <div class="poss-bar"><span class="poss-label team-orange">Orange</span><div class="poss-track"><div class="poss-fill orange" style="width:${p.orange}"></div></div><span>${p.orange} (${p.orangeSec}s)</span></div>
                <div class="poss-bar"><span class="poss-label">Neutre</span><div class="poss-track"><div class="poss-fill neutral" style="width:${p.neutral}"></div></div><span>${p.neutral}</span></div>
            </div>
            <div class="coach-kpi-grid" style="margin-top:1.5rem">
                <div class="coach-kpi"><span class="kpi-label">Rotations bleu / orange</span><span class="kpi-value">${coach.teams.rotationChanges.blue} / ${coach.teams.rotationChanges.orange}</span></div>
                <div class="coach-kpi"><span class="kpi-label">Rush ${this.glossLink('rush')}</span><span class="kpi-value">${coach.teams.rush?.blue ?? 0} / ${coach.teams.rush?.orange ?? 0}</span></div>
            </div>
            ${this.renderBuildupSection(coach)}`;
        this.bindGlossTips(el);
    }

    renderBuildupSection(coach) {
        const b = coach.teams.goalBuildup?.blue || {};
        const o = coach.teams.goalBuildup?.orange || {};
        const entries = [...new Set([...Object.keys(b), ...Object.keys(o)])];
        if (!entries.length) return '';
        return `<h3 class="section-sub">Build-up des buts</h3>
            <div class="table-wrap"><table class="stats-table"><thead><tr>
                <th>Type</th><th>Bleu</th><th>Orange</th>
            </tr></thead><tbody>${entries.map(k => `<tr><td>${k}</td><td>${b[k] || 0}</td><td>${o[k] || 0}</td></tr>`).join('')}</tbody></table></div>`;
    }

    renderCompare() {
        const el = document.getElementById('res-compare');
        if (!el) return;
        if (this.replays.length < 2) {
            el.innerHTML = '<p class="empty-msg">Chargez au moins 2 replays pour comparer (bouton « Ajouter un replay » ou glisser plusieurs fichiers).</p>';
            return;
        }
        el.innerHTML = `<div class="table-wrap"><table class="stats-table compare-table"><thead><tr>
            <th>Replay</th><th>Map</th><th>Score</th><th>Durée</th>
            <th>Poss. bleu</th><th>Poss. orange</th><th>Boost moy. B</th><th>Boost moy. O</th><th>Tirs</th><th></th>
        </tr></thead><tbody>${this.replays.map(r => {
            const s = r.summary;
            const active = r.id === this.activeReplayId;
            return `<tr class="${active ? 'row-active' : ''}">
                <td>${s.filename}</td><td>${s.map}</td><td>${s.score}</td><td>${s.duration}</td>
                <td>${s.possessionBlue}</td><td>${s.possessionOrange}</td>
                <td>${s.avgBoostBlue}</td><td>${s.avgBoostOrange}</td><td>${s.shots}</td>
                <td><button class="btn-chip" data-open-replay="${r.id}">Ouvrir</button></td>
            </tr>`;
        }).join('')}</tbody></table></div>
        <p class="hint-text">Comparez scrims, matchs ou semaines d'entraînement. Les replays restent en mémoire locale (rien n'est envoyé en ligne).</p>`;
        el.querySelectorAll('[data-open-replay]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeReplayId = btn.dataset.openReplay;
                this.renderReplayLibrary();
                this.displayActiveReplay();
            });
        });
    }

    renderEvents(coach) {
        const el = document.getElementById('res-events');
        if (!el || !coach) return;
        let feed = coach.eventFeed;
        if (this.eventFilter !== 'all') {
            feed = feed.filter(e => e.category === this.eventFilter || (this.eventFilter === 'goal' && e.category === 'goal'));
        }
        if (this.teamFilter === 'mine' && this.myTeam != null) feed = feed.filter(e => e.team == null || e.team === this.myTeam);
        else if (this.teamFilter !== 'all') feed = feed.filter(e => e.team == null || e.team === this.teamFilter);
        if (!feed.length) { el.innerHTML = '<p class="empty-msg">Aucun événement.</p>'; return; }
        el.innerHTML = feed.slice(0, 300).map(e => {
            const tc = e.team === 0 ? 'team-blue' : (e.team === 1 ? 'team-orange' : '');
            return `<button class="timeline-event clickable" data-frame="${e.frame}">
                <span class="tl-time">${formatTime(e.time)}</span>
                <span class="tl-type">${e.label}</span>
                ${e.player ? `<span class="tl-player ${tc}">${e.player}</span>` : ''}
                ${e.detail ? `<span class="tl-detail">${e.detail}</span>` : ''}
            </button>`;
        }).join('');
        el.querySelectorAll('.clickable').forEach(btn => {
            btn.addEventListener('click', () => this.minimap?.jumpToFrame(parseInt(btn.dataset.frame)));
        });
        if (feed.length > 300) el.innerHTML += `<p class="empty-msg">… ${feed.length - 300} de plus</p>`;
    }

    renderMetadata(data) {
        const el = document.getElementById('res-metadata');
        if (!el) return;
        const counts = data.coach?.eventCounts || {};
        const fc = data.coach?.frameDataCounts || {};
        const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const entries = [
            ['Fichier', data.originalFilename], ['Taille', data.size],
            ['Map', data.mapName], ['Date', data.date], ['Durée', data.duration],
            ['FPS', data.recordFps], ['Frames', data.framesCount || data.numFrames],
            ['Mode', data.gameType], ['Playlist', data.playlist], ['GUID', data.matchGuid],
            ['Buts', fc.goalEvents], ['Démolitions', fc.demolitions], ['Tirs détaillés', fc.playerStatEvents],
            ...sortedCounts.slice(0, 12).map(([k, v]) => [`evt.${k}`, v])
        ];
        el.innerHTML = entries.map(([k, v]) =>
            `<div class="metadata-item"><span class="meta-label">${k}</span><span class="meta-value">${v ?? '—'}</span></div>`
        ).join('');
    }

    renderRawJson(data) {
        const el = document.getElementById('res-raw-json');
        if (!el) return;
        el.textContent = JSON.stringify({
            match: { filename: data.originalFilename, map: data.mapName, teams: { blue: data.teamBlue, orange: data.teamOrange } },
            players: data.players,
            coach: data.coach,
            properties: data.props
        }, null, 2);
    }

    initExportButtons(data) {
        const rawEl = document.getElementById('res-raw-json');
        if (!rawEl) return;
        const jsonStr = rawEl.textContent;
        const copyBtn = document.getElementById('btn-copy-json');
        const dlBtn = document.getElementById('btn-download-json');
        const newCopy = copyBtn?.cloneNode(true);
        const newDl = dlBtn?.cloneNode(true);
        copyBtn?.replaceWith(newCopy);
        dlBtn?.replaceWith(newDl);
        newCopy?.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(jsonStr); window.showToast('JSON copié', 'success'); }
            catch { window.showToast('Erreur copie', 'error'); }
        });
        newDl?.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }));
            a.download = (data.originalFilename || 'replay').replace('.replay', '') + '_analysis.json';
            a.click();
        });
    }
}

window.app = new App();
if (window.lucide) window.lucide.createIcons();
