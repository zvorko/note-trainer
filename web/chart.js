// Interactive SVG line chart used by the Progress screen.

const CHART = { W: 320, H: 140, L: 34, R: 12, T: 12, B: 18 };

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

// Rounds a max value up to a "nice" step so axis ticks land on clean numbers.
export function niceCeil(max) {
    if (max <= 0) return 1;
    const pow  = Math.pow(10, Math.floor(Math.log10(max)));
    const norm = max / pow;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * pow;
}

// Builds an interactive single-series line chart inside `svg`, with a
// crosshair + tooltip in `tooltipEl`. Returns { render(points, opts) }.
// points: [{ x: index, value, label }] in chronological (left-to-right) order.
export function createLineChart(svg, tooltipEl) {
    const plotW = CHART.W - CHART.L - CHART.R;
    const plotH = CHART.H - CHART.T - CHART.B;
    let current = [];
    let yMin = 0, yMax = 1, color = '#1a6bb5', formatValue = v => String(v);

    const xAt = i => current.length <= 1
        ? CHART.L + plotW / 2
        : CHART.L + (i / (current.length - 1)) * plotW;
    const yAt = v => CHART.T + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    function hide() { tooltipEl.classList.remove('visible'); crosshair.setAttribute('opacity', 0); }

    function showAt(clientX) {
        if (!current.length) return;
        const rect = svg.getBoundingClientRect();
        const svgX = (clientX - rect.left) / rect.width * CHART.W;
        let idx = 0, best = Infinity;
        current.forEach((p, i) => {
            const d = Math.abs(xAt(i) - svgX);
            if (d < best) { best = d; idx = i; }
        });
        const p  = current[idx];
        const px = xAt(idx), py = yAt(p.value);

        crosshair.setAttribute('opacity', 1);
        crosshair.setAttribute('x1', px);
        crosshair.setAttribute('x2', px);
        crosshair.setAttribute('y1', CHART.T);
        crosshair.setAttribute('y2', CHART.T + plotH);
        hoverDot.setAttribute('opacity', 1);
        hoverDot.setAttribute('cx', px);
        hoverDot.setAttribute('cy', py);

        const rectSvg = svg.getBoundingClientRect();
        tooltipEl.textContent = `${p.label}: ${formatValue(p.value)}`;
        tooltipEl.style.left = `${(px / CHART.W) * rectSvg.width}px`;
        tooltipEl.style.top  = `${(py / CHART.H) * rectSvg.height}px`;
        tooltipEl.classList.add('visible');
    }

    // static layers created once, updated on each render()
    const gridGroup = svgEl('g');
    const lineGroup = svgEl('g');
    const crosshair = svgEl('line', {
        class: 'chart-crosshair', stroke: '#c3c2b7', 'stroke-width': 1, opacity: 0,
    });
    const hoverDot = svgEl('circle', { r: 5, fill: color, stroke: 'white', 'stroke-width': 2, opacity: 0 });
    svg.append(gridGroup, lineGroup, crosshair, hoverDot);

    svg.addEventListener('pointermove', e => showAt(e.clientX));
    svg.addEventListener('pointerdown', e => showAt(e.clientX));
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') setTimeout(hide, 1500);
    });

    function render(points, opts) {
        current     = points;
        yMin        = opts.yMin;
        yMax        = opts.yMax;
        color       = opts.color;
        formatValue = opts.formatValue ?? (v => String(v));
        hoverDot.setAttribute('fill', color);
        hide();

        gridGroup.replaceChildren();
        lineGroup.replaceChildren();
        svg.setAttribute('viewBox', `0 0 ${CHART.W} ${CHART.H}`);

        opts.yTicks.forEach(tick => {
            const y = yAt(tick);
            gridGroup.append(svgEl('line', {
                x1: CHART.L, x2: CHART.L + plotW, y1: y, y2: y,
                stroke: '#e1e0d9', 'stroke-width': 1,
            }));
            gridGroup.append(Object.assign(svgEl('text', {
                x: CHART.L - 6, y: y + 3, 'text-anchor': 'end',
                class: 'chart-axis-label',
            }), { textContent: opts.formatTick ? opts.formatTick(tick) : String(tick) }));
        });

        if (!points.length) return;

        if (points.length >= 2) {
            const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.value)}`).join(' ');
            lineGroup.append(svgEl('path', {
                d, fill: 'none', stroke: color, 'stroke-width': 2,
                'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            }));
        }

        // per-point markers only up to a readable density; beyond that just the line
        if (points.length <= 25) {
            points.forEach((p, i) => {
                lineGroup.append(svgEl('circle', {
                    cx: xAt(i), cy: yAt(p.value), r: 5, fill: 'white',
                }));
                lineGroup.append(svgEl('circle', {
                    cx: xAt(i), cy: yAt(p.value), r: 4, fill: color,
                }));
            });
        }

        // value label at the line's end
        const last  = points[points.length - 1];
        const lx    = xAt(points.length - 1);
        const ly    = yAt(last.value);
        const above = (last.value - yMin) / (yMax - yMin || 1) < 0.85;
        lineGroup.append(Object.assign(svgEl('text', {
            x: lx, y: above ? ly - 10 : ly + 16,
            'text-anchor': 'end', class: 'chart-end-label',
        }), { textContent: formatValue(last.value) }));

        svg.append(gridGroup, lineGroup, crosshair, hoverDot); // keep crosshair/dot on top
    }

    return { render };
}
