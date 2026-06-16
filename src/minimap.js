export class MinimapEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.frames = [];
        this.boostPads = [];
        this.heatmapBall = [];
        this.markers = [];
        this.currentFrame = 0;
        this.isPlaying = false;
        this.animationId = null;
        this.playSpeed = 1;
        this.fps = 30;
        this.heatmapMode = false;
        this._resizeHandler = () => this.resize();
        this._keyHandler = (e) => this.onKey(e);

        this.slider = document.getElementById('timeline-slider');
        this.timeDisplay = document.getElementById('timeline-time');
        this.btnPlay = document.getElementById('btn-play-pause');
        this.btnBack = document.getElementById('btn-step-back');
        this.btnForward = document.getElementById('btn-step-forward');
        this.speedSelect = document.getElementById('playback-speed');
        this.btnHeatmap = document.getElementById('btn-heatmap');
        this.markersEl = document.getElementById('timeline-markers');

        this.bindControls();
        window.addEventListener('resize', this._resizeHandler);
        window.addEventListener('keydown', this._keyHandler);
        this.resize();
    }

    bindControls() {
        if (this.slider) {
            this.slider.addEventListener('input', (e) => {
                this.currentFrame = parseInt(e.target.value);
                this.render();
                this.updateTimeDisplay();
            });
        }
        if (this.btnPlay) {
            this.btnPlay.addEventListener('click', () => this.togglePlay());
        }
        if (this.btnBack) {
            this.btnBack.addEventListener('click', () => this.step(-1));
        }
        if (this.btnForward) {
            this.btnForward.addEventListener('click', () => this.step(1));
        }
        if (this.speedSelect) {
            this.speedSelect.addEventListener('change', (e) => {
                this.playSpeed = parseFloat(e.target.value);
            });
        }
        if (this.btnHeatmap) {
            this.btnHeatmap.addEventListener('click', () => {
                this.heatmapMode = !this.heatmapMode;
                this.btnHeatmap.classList.toggle('active', this.heatmapMode);
                this.render();
            });
        }
    }

    onKey(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
        if (e.code === 'ArrowRight') { e.preventDefault(); this.step(1); }
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        this.updatePlayButton();
        if (this.isPlaying) this.play();
        else this.pause();
    }

    step(delta) {
        this.pause();
        this.isPlaying = false;
        this.updatePlayButton();
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, this.currentFrame + delta));
        if (this.slider) this.slider.value = this.currentFrame;
        this.render();
        this.updateTimeDisplay();
    }

    jumpToFrame(frame) {
        if (!this.frames.length) return;
        this.pause();
        this.isPlaying = false;
        this.updatePlayButton();
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, frame));
        if (this.slider) this.slider.value = this.currentFrame;
        this.render();
        this.updateTimeDisplay();
        this.canvas?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setMarkers(markers) {
        this.markers = markers || [];
        if (!this.markersEl || !this.frames.length) return;
        this.markersEl.innerHTML = this.markers.map(m => {
            const pct = (m.frame / Math.max(1, this.frames.length - 1)) * 100;
            const cls = m.kind === 'Goal' || m.kind === 'goal' ? 'marker-goal' : (m.kind === 'demo' ? 'marker-demo' : 'marker-event');
            return `<button class="timeline-marker ${cls}" style="left:${pct}%" title="${m.label} @ frame ${m.frame}" data-frame="${m.frame}"></button>`;
        }).join('');
        this.markersEl.querySelectorAll('.timeline-marker').forEach(btn => {
            btn.addEventListener('click', () => this.jumpToFrame(parseInt(btn.dataset.frame)));
        });
    }

    updatePlayButton() {
        if (!this.btnPlay) return;
        this.btnPlay.innerHTML = this.isPlaying ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
        if (window.lucide) window.lucide.createIcons();
    }

    destroy() {
        this.pause();
        window.removeEventListener('resize', this._resizeHandler);
        window.removeEventListener('keydown', this._keyHandler);
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    loadData(framesData, heatmapBall = []) {
        this.frames = [];
        this.boostPads = [];
        this.heatmapBall = heatmapBall;
        let hasPositions = false;

        if (framesData?.boost_pads?.length) {
            this.boostPads = framesData.boost_pads.map(pad => {
                const loc = pad.location || pad.loc || pad.Location || pad || {};
                return {
                    x: loc.x || loc.X || 0,
                    y: loc.y || loc.Y || 0,
                    isBig: pad.is_big ?? pad.isBig ?? false
                };
            });
        }

        const fd = framesData?.frame_data;
        if (fd) {
            const numFrames = fd.metadata_frames?.length || 0;
            for (let i = 0; i < numFrames; i++) {
                const frame = { ball: null, players: [] };
                const bf = fd.ball_data?.frames?.[i];
                if (bf !== 'Empty' && bf?.Data?.rigid_body) {
                    frame.ball = { x: bf.Data.rigid_body.location.x, y: bf.Data.rigid_body.location.y };
                }
                fd.players?.forEach(pTuple => {
                    const pf = pTuple[1]?.frames?.[i];
                    if (pf !== 'Empty' && pf?.Data?.rigid_body) {
                        const q = pf.Data.rigid_body.rotation;
                        const yaw = q ? Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z)) : 0;
                        frame.players.push({
                            x: pf.Data.rigid_body.location.x,
                            y: pf.Data.rigid_body.location.y,
                            yaw,
                            team: pf.Data.is_team_0 ? 0 : 1,
                            name: pf.Data.player_name,
                            boost: pf.Data.boost_amount != null ? Math.round((pf.Data.boost_amount / 255) * 100) : 0
                        });
                    }
                });
                if (frame.ball || frame.players.length) hasPositions = true;
                this.frames.push(frame);
            }
        }

        if (this.slider) {
            this.slider.max = Math.max(0, this.frames.length - 1);
            this.slider.value = 0;
        }
        this.currentFrame = 0;
        this.render();
        this.updateTimeDisplay();
        return { frameCount: this.frames.length, hasPositions };
    }

    play() {
        if (!this.frames.length) return;
        if (this.currentFrame >= this.frames.length - 1) this.currentFrame = 0;
        let lastTime = performance.now();
        const loop = (now) => {
            if (!this.isPlaying) return;
            if (now - lastTime >= (1000 / 30) / this.playSpeed) {
                this.currentFrame += 1;
                if (this.currentFrame >= this.frames.length) {
                    this.currentFrame = this.frames.length - 1;
                    this.isPlaying = false;
                    this.updatePlayButton();
                }
                if (this.slider) this.slider.value = this.currentFrame;
                this.updateTimeDisplay();
                this.render();
                lastTime = now;
            }
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    pause() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
    }

    updateTimeDisplay() {
        if (!this.timeDisplay) return;
        const totalSeconds = Math.floor(this.currentFrame / this.fps);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const info = this.frames.length ? ` (${this.currentFrame}/${this.frames.length - 1})` : '';
        this.timeDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}${info}`;
    }

    drawField(cx, cy, scale) {
        this.ctx.fillStyle = '#1a2332';
        this.ctx.fillRect(cx - 4096 * scale, cy - 5120 * scale, 8192 * scale, 10240 * scale);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - 4096 * scale, cy - 5120 * scale, 8192 * scale, 10240 * scale);
        this.ctx.beginPath();
        this.ctx.moveTo(cx - 4096 * scale, cy);
        this.ctx.lineTo(cx + 4096 * scale, cy);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(59,130,246,0.25)';
        this.ctx.fillRect(cx - 892 * scale, cy - 5120 * scale - 880 * scale, 1784 * scale, 880 * scale);
        this.ctx.fillStyle = 'rgba(249,115,22,0.25)';
        this.ctx.fillRect(cx - 892 * scale, cy + 5120 * scale, 1784 * scale, 880 * scale);
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 1000 * scale, 0, Math.PI * 2);
        this.ctx.stroke();
        this.boostPads.forEach(pad => {
            this.ctx.beginPath();
            this.ctx.arc(cx + pad.x * scale, cy + pad.y * scale, pad.isBig ? 10 : 4, 0, Math.PI * 2);
            this.ctx.fillStyle = pad.isBig ? 'rgba(234,179,8,0.6)' : 'rgba(234,179,8,0.25)';
            this.ctx.fill();
        });
    }

    renderHeatmap(cx, cy, scale) {
        if (!this.heatmapBall.length) return;
        const grid = new Map();
        const cell = 350;
        this.heatmapBall.forEach(p => {
            const gx = Math.floor(p.x / cell);
            const gy = Math.floor(p.y / cell);
            const key = gx + ',' + gy;
            grid.set(key, (grid.get(key) || 0) + 1);
        });
        let max = 1;
        grid.forEach(v => { if (v > max) max = v; });
        grid.forEach((count, key) => {
            const [gx, gy] = key.split(',').map(Number);
            const alpha = 0.15 + (count / max) * 0.65;
            this.ctx.fillStyle = `rgba(255,107,0,${alpha})`;
            this.ctx.fillRect(cx + gx * cell * scale - 2, cy + gy * cell * scale - 2, cell * scale + 4, cell * scale + 4);
        });
    }

    render() {
        if (!this.ctx || !this.frames.length) return;
        const frame = this.frames[this.currentFrame];
        if (!frame) return;

        const w = this.canvas.width, h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2;
        const scale = Math.min(w / 8200, h / 10280);

        this.drawField(cx, cy, scale);
        if (this.heatmapMode) this.renderHeatmap(cx, cy, scale);

        if (!this.heatmapMode && this.currentFrame > 0) {
            this.ctx.beginPath();
            let first = true;
            for (let i = Math.max(0, this.currentFrame - 45); i <= this.currentFrame; i++) {
                const b = this.frames[i]?.ball;
                if (b) {
                    const bx = cx + b.x * scale, by = cy + b.y * scale;
                    if (first) { this.ctx.moveTo(bx, by); first = false; } else this.ctx.lineTo(bx, by);
                }
            }
            this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        if (!this.heatmapMode) {
            frame.players.forEach(p => {
                const px = cx + p.x * scale, py = cy + p.y * scale;
                const color = p.team === 0 ? '#3B82F6' : '#F97316';
                this.ctx.save();
                this.ctx.translate(px, py);
                this.ctx.rotate(p.yaw || 0);
                this.ctx.beginPath();
                this.ctx.moveTo(14, 0);
                this.ctx.lineTo(-10, 9);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -9);
                this.ctx.closePath();
                this.ctx.fillStyle = color;
                this.ctx.fill();
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
                this.ctx.restore();
                if (p.name) {
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = 'bold 10px Inter,sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(p.name, px, py - 16);
                }
                if (p.boost != null) {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
                    this.ctx.fillRect(px - 12, py - 10, 24, 4);
                    this.ctx.fillStyle = p.boost < 20 ? '#ef4444' : (p.boost < 50 ? '#eab308' : '#22c55e');
                    this.ctx.fillRect(px - 12, py - 10, 24 * (p.boost / 100), 4);
                }
            });
            if (frame.ball) {
                const bx = cx + frame.ball.x * scale, by = cy + frame.ball.y * scale;
                this.ctx.beginPath();
                this.ctx.arc(bx, by, 9, 0, Math.PI * 2);
                this.ctx.fillStyle = '#fff';
                this.ctx.fill();
                this.ctx.strokeStyle = '#111';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
    }
}

export function renderHeatmapCanvas(canvasId, points) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !points?.length) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.min(rect.width, 900);
    canvas.height = canvas.width / 1.4;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w / 8200, h / 10280);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(cx - 4096 * scale, cy - 5120 * scale, 8192 * scale, 10240 * scale);

    const grid = new Map();
    const cell = 280;
    points.forEach(p => {
        const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
        grid.set(key, (grid.get(key) || 0) + 1);
    });
    let max = 1;
    grid.forEach(v => { if (v > max) max = v; });
    grid.forEach((count, key) => {
        const [gx, gy] = key.split(',').map(Number);
        const t = count / max;
        ctx.fillStyle = `rgba(${Math.round(255 * t)},${Math.round(107 * (1 - t * 0.5))},0,${0.2 + t * 0.7})`;
        ctx.beginPath();
        ctx.arc(cx + gx * cell * scale, cy + gy * cell * scale, (cell * scale) / 2, 0, Math.PI * 2);
        ctx.fill();
    });
}
