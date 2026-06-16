function setupCanvas(canvas, height = 220) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h: height };
}

function clear(ctx, w, h) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
}

export function renderBarChart(canvasId, { title, labels, values, colors, unit = '' }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !labels?.length) return;
    const { ctx, w, h } = setupCanvas(canvas, 240);
    clear(ctx, w, h);
    const pad = { l: 48, r: 16, t: 36, b: 56 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const max = Math.max(...values, 1);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(title, pad.l, 22);

    const barW = Math.min(48, (chartW / labels.length) * 0.65);
    const gap = (chartW - barW * labels.length) / (labels.length + 1);

    labels.forEach((label, i) => {
        const val = values[i];
        const barH = (val / max) * chartH;
        const x = pad.l + gap + i * (barW + gap);
        const y = pad.t + chartH - barH;
        ctx.fillStyle = colors[i] || '#00E5FF';
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 4);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(val) + unit, x + barW / 2, y - 6);
        ctx.save();
        ctx.translate(x + barW / 2, pad.t + chartH + 14);
        ctx.rotate(-0.45);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        const short = label.length > 10 ? label.slice(0, 9) + '…' : label;
        ctx.fillText(short, 0, 0);
        ctx.restore();
    });
}

export function renderStackedChart(canvasId, { title, labels, series, seriesColors, seriesNames }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !labels?.length) return;
    const { ctx, w, h } = setupCanvas(canvas, 260);
    clear(ctx, w, h);
    const pad = { l: 48, r: 16, t: 36, b: 56 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(title, pad.l, 22);

    const totals = labels.map((_, i) => series.reduce((s, row) => s + (row[i] || 0), 0));
    const max = Math.max(...totals, 1);
    const barW = Math.min(52, (chartW / labels.length) * 0.65);
    const gap = (chartW - barW * labels.length) / (labels.length + 1);

    let legendX = pad.l;
    seriesNames.forEach((name, si) => {
        ctx.fillStyle = seriesColors[si];
        ctx.fillRect(legendX, 8, 10, 10);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(name, legendX + 14, 17);
        legendX += ctx.measureText(name).width + 28;
    });

    labels.forEach((label, i) => {
        const x = pad.l + gap + i * (barW + gap);
        let yOff = 0;
        series.forEach((row, si) => {
            const val = row[i] || 0;
            const barH = (val / max) * chartH;
            const y = pad.t + chartH - yOff - barH;
            ctx.fillStyle = seriesColors[si];
            ctx.fillRect(x, y, barW, barH);
            yOff += barH;
        });
        ctx.save();
        ctx.translate(x + barW / 2, pad.t + chartH + 14);
        ctx.rotate(-0.45);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label.length > 10 ? label.slice(0, 9) + '…' : label, 0, 0);
        ctx.restore();
    });
}

export function renderDonutChart(canvasId, { title, segments }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !segments?.length) return;
    const { ctx, w, h } = setupCanvas(canvas, 220);
    clear(ctx, w, h);
    const cx = w / 2;
    const cy = h / 2 + 10;
    const r = Math.min(w, h) * 0.32;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let angle = -Math.PI / 2;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, cx, 20);

    segments.forEach(seg => {
        const slice = (seg.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + slice);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        angle += slice;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    let ly = cy + r + 24;
    segments.forEach(seg => {
        const pct = Math.round((seg.value / total) * 100);
        ctx.fillStyle = seg.color;
        ctx.fillRect(cx - 80, ly - 8, 10, 10);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${seg.label} ${pct}%`, cx - 64, ly);
        ly += 16;
    });
}

export function renderHistogram(canvasId, { title, values, bins, color, xLabel }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !values?.length) return;
    const { ctx, w, h } = setupCanvas(canvas, 220);
    clear(ctx, w, h);
    const pad = { l: 40, r: 16, t: 32, b: 40 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const counts = bins.map((bin, i) => {
        const lo = bin;
        const hi = bins[i + 1] ?? Infinity;
        return values.filter(v => v >= lo && v < hi).length;
    });
    const max = Math.max(...counts, 1);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(title, pad.l, 20);

    const barW = chartW / counts.length - 4;
    counts.forEach((c, i) => {
        const barH = (c / max) * chartH;
        const x = pad.l + i * (barW + 4);
        const y = pad.t + chartH - barH;
        ctx.fillStyle = color || '#FF6B00';
        ctx.fillRect(x, y, barW, barH);
        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(bins[i]), x + barW / 2, pad.t + chartH + 14);
    });
    if (xLabel) {
        ctx.fillStyle = '#475569';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, pad.l + chartW / 2, h - 6);
    }
}
