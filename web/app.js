import {
    NOTES, POSITIONS, STRING_ORDER, accSymbol, fingerLabel, noteDisplayName,
    noteToSemitone, KEY_SIGNATURES, keySigDrawItems, filterNotesForKey,
} from './notes.js';

// ─── Layout constants (logical pixel dimensions) ────────────────────────────

const S = { W: 340, H: 180, LINE_SP: 16, BOT_LINE: 120, NOTE_X: 215, NOTE_RX: 11, NOTE_RY: 7 };
const FB = { W: 200, H: 300, TOP: 30, BOT: 265, X0: 40, X_STP: 40 };

const WK_W = 44, WK_H = 100, BK_W = 26, BK_H = 62, PX0 = 8, PY0 = 8;
const PIANO_W = 7 * WK_W + 2 * PX0;   // 324
const PIANO_H = WK_H + 2 * PY0;       // 116

const WHITE_KEYS = [
    { label: "C", name: "C", acc: null },
    { label: "D", name: "D", acc: null },
    { label: "E", name: "E", acc: null },
    { label: "F", name: "F", acc: null },
    { label: "G", name: "G", acc: null },
    { label: "A", name: "A", acc: null },
    { label: "H", name: "H", acc: null },
];

// after: index of the white key to the left of this black key
const BLACK_KEYS = [
    { label: "C\u266F", name: "C", acc: "sharp", after: 0 },
    { label: "E\u266D", name: "E", acc: "flat",  after: 1 },
    { label: "F\u266F", name: "F", acc: "sharp", after: 3 },
    { label: "G\u266F", name: "G", acc: "sharp", after: 4 },
    { label: "H\u266D", name: "H", acc: "flat",  after: 5 },
];

// Row 0 (open string) only applies to 1st position — 2nd/3rd position shift
// the whole hand up the fingerboard, so there's no open string to play.
const FINGER_POSITIONS = [
    { finger: 0, low: false, label: "0"  },
    { finger: 1, low: true,  label: "1L" },
    { finger: 1, low: false, label: "1"  },
    { finger: 2, low: true,  label: "2L" },
    { finger: 2, low: false, label: "2"  },
    { finger: 3, low: true,  label: "3L" },
    { finger: 3, low: false, label: "3"  },
    { finger: 4, low: true,  label: "4L" },
    { finger: 4, low: false, label: "4"  },
];

function fingerPositionsFor(position) {
    return position === 1 ? FINGER_POSITIONS : FINGER_POSITIONS.slice(1);
}

// fast (string, finger, low) → note lookup for a given position's note set
function buildNoteLookup(positionNotes) {
    return new Map(positionNotes.map(n => [`${n.string}:${n.finger}:${n.low}`, n]));
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const lw = canvas.width, lh = canvas.height;   // logical size from HTML attr
    canvas.width  = lw * dpr;
    canvas.height = lh * dpr;
    canvas.style.width  = lw + 'px';
    canvas.style.height = lh + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
}

// Returns logical canvas coords from a mouse or touch event, accounting for
// any CSS scaling applied to the canvas element.
function canvasXY(canvas, event) {
    const rect  = canvas.getBoundingClientRect();
    const dpr   = window.devicePixelRatio || 1;
    const lw    = canvas.width  / dpr;
    const lh    = canvas.height / dpr;
    const src   = event.touches ? event.touches[0] : event;
    return {
        x: (src.clientX - rect.left) * (lw / rect.width),
        y: (src.clientY - rect.top)  * (lh / rect.height),
    };
}

// Converts a Tkinter-style arc (bbox, start°, extent° CCW from east) to a
// canvas ellipse stroke. Tkinter CCW = canvas anticlockwise on screen.
function tkArc(ctx, x1, y1, x2, y2, startDeg, extentDeg) {
    const TO_RAD = Math.PI / 180;
    ctx.beginPath();
    ctx.ellipse(
        (x1 + x2) / 2, (y1 + y2) / 2,
        Math.abs((x2 - x1) / 2), Math.abs((y2 - y1) / 2),
        0,
        -startDeg * TO_RAD,
        -(startDeg + extentDeg) * TO_RAD,
        extentDeg > 0,
    );
    ctx.stroke();
}

// ─── Staff drawing ───────────────────────────────────────────────────────────

function stepToY(step) {
    return S.BOT_LINE - step * (S.LINE_SP / 2);
}

function drawTrebleClef(ctx) {
    ctx.save();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // 𝄞 U+1D11E; size + y-offset tuned so the G-curl sits on the second staff line
    ctx.font = 'normal 100px serif';
    ctx.fillText('\u{1D11E}', 4, S.BOT_LINE );
    ctx.restore();
}

function drawStaff(ctx, note, keyAccidentals) {
    ctx.clearRect(0, 0, S.W, S.H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, S.W, S.H);

    drawTrebleClef(ctx);

    // five staff lines
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const y = S.BOT_LINE - i * S.LINE_SP;
        ctx.beginPath();
        ctx.moveTo(88, y);
        ctx.lineTo(315, y);
        ctx.stroke();
    }

    // key signature symbols
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    keySigDrawItems(keyAccidentals).forEach(([sym, ksStep], i) => {
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText(sym, 100 + i * 13, stepToY(ksStep) + 6);
    });

    const step = note.step;

    // ledger lines below staff
    if (step < 0) {
        ctx.lineWidth = 2;
        for (let s = -2; s >= step; s -= 2) {
            const y = stepToY(s);
            ctx.beginPath();
            ctx.moveTo(S.NOTE_X - 18, y);
            ctx.lineTo(S.NOTE_X + 18, y);
            ctx.stroke();
        }
    }
    // ledger lines above staff
    if (step > 8) {
        ctx.lineWidth = 2;
        for (let s = 10; s <= step; s += 2) {
            const y = stepToY(s);
            ctx.beginPath();
            ctx.moveTo(S.NOTE_X - 18, y);
            ctx.lineTo(S.NOTE_X + 18, y);
            ctx.stroke();
        }
    }

    // accidental (omit if the key signature already covers it)
    const inKey = keyAccidentals.some(([n, a]) => n === note.name && a === note.accidental);
    const sym = accSymbol(note.accidental);
    if (sym && !inKey) {
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#111';
        ctx.fillText(sym, S.NOTE_X - 26, stepToY(step) + 8);
    }

    // whole note: hollow oval, slightly tilted, no stem
    const ny = stepToY(step);
    ctx.save();
    ctx.translate(S.NOTE_X, ny);
    ctx.rotate(-0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, S.NOTE_RX, S.NOTE_RY, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
}

// ─── Fingerboard drawing ─────────────────────────────────────────────────────

function fingerY(finger) {
    return FB.TOP + (FB.BOT - FB.TOP) * finger / 4;
}

function stringX(i) {
    return FB.X0 + i * FB.X_STP;
}

function posY(finger, low) {
    return low ? (fingerY(finger) + fingerY(finger - 1)) / 2 : fingerY(finger);
}

function drawFingerboard(ctx, keyNotes, showKey, markerNotes, position, noteLookup) {
    ctx.clearRect(0, 0, FB.W, FB.H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, FB.W, FB.H);

    const fingerPositions = fingerPositionsFor(position);
    const keyIds = new Set(keyNotes.map(n => `${n.string}:${n.finger}:${n.low}`));
    const r = 10;

    // target ovals (drawn before strings so strings sit on top)
    for (const { finger, low } of fingerPositions) {
        const fy = posY(finger, low);
        STRING_ORDER.forEach((str, i) => {
            const x    = stringX(i);
            const key  = `${str}:${finger}:${low}`;
            const note = noteLookup.get(key);
            let fill = 'white', stroke = '#bbb';
            if (!note) {
                fill = '#f0f0f0'; stroke = '#ddd';
            } else if (showKey) {
                const inKey = keyIds.has(key);
                fill   = inKey ? '#c8f0c8' : '#f5f5f5';
                stroke = inKey ? '#5aaa5a' : '#ccc';
            }
            ctx.beginPath();
            ctx.arc(x, fy, r, 0, 2 * Math.PI);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    // string lines
    STRING_ORDER.forEach((name, i) => {
        const x = stringX(i);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, FB.TOP);
        ctx.lineTo(x, FB.BOT);
        ctx.stroke();

        // string label
        ctx.fillStyle = '#333';
        ctx.font = 'bold 13px Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, FB.TOP - 14);

        // tick marks at each finger position
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        for (const { finger, low } of fingerPositions) {
            const fy = posY(finger, low);
            ctx.beginPath();
            ctx.moveTo(x - 5, fy);
            ctx.lineTo(x + 5, fy);
            ctx.stroke();
        }
    });

    // position labels on the left
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    for (const { finger, low, label } of fingerPositions) {
        ctx.font = '9px Helvetica, sans-serif';
        ctx.fillText(label, 18, posY(finger, low) + 4);
    }

    ctx.fillStyle = '#888';
    ctx.font = '9px Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('(tap to answer)', FB.W / 2, FB.BOT + 20);
    ctx.fillText('strings', FB.W / 2, FB.TOP - 28);

    // answer marker(s) — a note can be reachable at more than one string/finger
    // (e.g. G-string 4th finger and open D are both "D"), so highlight all of them
    for (const markerNote of markerNotes ?? []) {
        const i  = STRING_ORDER.indexOf(markerNote.string);
        const x  = stringX(i);
        const fy = markerNote.low
            ? (fingerY(markerNote.finger) + fingerY(markerNote.finger - 1)) / 2
            : fingerY(markerNote.finger);
        const color = markerNote.low ? '#9b59b6' : '#ff9900';

        ctx.beginPath();
        ctx.arc(x, fy, 11, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(markerNote.finger === 0 ? '0' : String(markerNote.finger), x, fy + 4);

        if (markerNote.low) {
            ctx.fillStyle = color;
            ctx.font = 'italic 8px Helvetica, sans-serif';
            ctx.fillText('low', x + 24, fy + 4);
        }
    }
}

// ─── Piano drawing ───────────────────────────────────────────────────────────

function drawPiano(ctx, highlightNote) {
    ctx.clearRect(0, 0, PIANO_W, PIANO_H);

    // white keys
    WHITE_KEYS.forEach(({ label, name }, i) => {
        const x = PX0 + i * WK_W;
        let fill = 'white';
        if (highlightNote && highlightNote.accidental === null && highlightNote.name === name)
            fill = '#90ee90';
        ctx.fillStyle = fill;
        ctx.fillRect(x, PY0, WK_W, WK_H);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, PY0, WK_W, WK_H);
        ctx.fillStyle = '#333';
        ctx.font = '9px Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + WK_W / 2, PY0 + WK_H - 10);
    });

    // black keys (drawn on top)
    BLACK_KEYS.forEach(({ label, name, acc, after }) => {
        const x = PX0 + (after + 1) * WK_W - BK_W / 2;
        let fill = '#222';
        if (highlightNote && highlightNote.accidental !== null
                && highlightNote.name === name && highlightNote.accidental === acc)
            fill = '#2d8a4e';
        ctx.fillStyle = fill;
        ctx.fillRect(x, PY0, BK_W, BK_H);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, PY0, BK_W, BK_H);
        ctx.fillStyle = 'white';
        ctx.font = '7px Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + BK_W / 2, PY0 + BK_H - 8);
    });
}

// ─── Hit testing ─────────────────────────────────────────────────────────────

function pianoHitTest(x, y) {
    // black keys first — they visually sit on top
    for (const { name, acc, after } of BLACK_KEYS) {
        const kx = PX0 + (after + 1) * WK_W - BK_W / 2;
        if (x >= kx && x <= kx + BK_W && y >= PY0 && y <= PY0 + BK_H)
            return { name, acc };
    }
    for (let i = 0; i < WHITE_KEYS.length; i++) {
        const kx = PX0 + i * WK_W;
        if (x >= kx && x <= kx + WK_W && y >= PY0 && y <= PY0 + WK_H)
            return { name: WHITE_KEYS[i].name, acc: null };
    }
    return null;
}

function fingerboardHitTest(x, y, position, noteLookup) {
    if (y < FB.TOP - 5 || y > FB.BOT + 5) return null;
    let bestStr = 0;
    STRING_ORDER.forEach((_, i) => {
        if (Math.abs(x - (FB.X0 + i * FB.X_STP)) < Math.abs(x - (FB.X0 + bestStr * FB.X_STP)))
            bestStr = i;
    });
    if (Math.abs(x - (FB.X0 + bestStr * FB.X_STP)) > FB.X_STP / 2) return null;
    const fingerPositions = fingerPositionsFor(position);
    const best = fingerPositions.reduce((b, fp) =>
        Math.abs(posY(fp.finger, fp.low) - y) < Math.abs(posY(b.finger, b.low) - y) ? fp : b
    );
    return noteLookup.get(`${STRING_ORDER[bestStr]}:${best.finger}:${best.low}`) ?? null;
}

// ─── Progress chart (SVG line chart) ────────────────────────────────────────

const CHART = { W: 320, H: 140, L: 34, R: 12, T: 12, B: 18 };

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

// Rounds a max value up to a "nice" step so axis ticks land on clean numbers.
function niceCeil(max) {
    if (max <= 0) return 1;
    const pow  = Math.pow(10, Math.floor(Math.log10(max)));
    const norm = max / pow;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * pow;
}

// Builds an interactive single-series line chart inside `svg`, with a
// crosshair + tooltip in `tooltipEl`. Returns { render(points, opts) }.
// points: [{ x: index, value, label }] in chronological (left-to-right) order.
function createLineChart(svg, tooltipEl) {
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

// ─── Persistence (localStorage) ──────────────────────────────────────────────

function loadPlayers() {
    try { return JSON.parse(localStorage.getItem('nt_players') || '[]'); }
    catch { return []; }
}

function savePlayer(name) {
    name = name.trim();
    if (!name) return;
    const list = loadPlayers();
    if (!list.includes(name)) {
        list.push(name);
        list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        localStorage.setItem('nt_players', JSON.stringify(list));
    }
}

const HISTORY_KEY = 'nt_history';
const HISTORY_MAX = 300;

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
}

function saveHistoryRecord(record) {
    const list = loadHistory();
    list.push(record);
    if (list.length > HISTORY_MAX) list.splice(0, list.length - HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

class GameLogger {
    constructor(player, testSize, keyLabel) {
        this._player = player;
        this._size   = testSize;
        this._notes  = [];
        this._ts     = new Date();
        this._append(`${this._fmt(this._ts)} Start test ${testSize} notes - ${player}, ${keyLabel}`);
    }

    logNote(noteName, correct, semitonesOff, elapsed, inputMethod) {
        this._notes.push(elapsed);
        const diff = correct ? 0 : semitonesOff;
        this._append(
            `note: ${noteName.padEnd(5)} correct: ${correct ? 'Y' : 'N'}` +
            ` diff: ${diff} time: ${elapsed.toFixed(3)} input: ${inputMethod}`
        );
    }

    save(score, total) {
        if (!this._notes.length) return;
        const totalS = this._notes.reduce((a, b) => a + b, 0);
        const avg    = totalS / this._notes.length;
        const pct    = total ? Math.round(score / total * 100) : 0;
        this._append(
            `${this._fmt(new Date())} Test done ${this._player} ${score}/${total} (${pct}%)` +
            ` Total time: ${totalS.toFixed(0)} sec Avg: ${avg.toFixed(3)} sec`
        );
        this._append('**************************************');
    }

    _fmt(d) { return d.toISOString().replace('T', ' ').slice(0, 19); }

    _append(line) {
        const prev = localStorage.getItem('nt_log') || '';
        localStorage.setItem('nt_log', prev + line + '\n');
    }

    static downloadLog() {
        const text = localStorage.getItem('nt_log') || '(no log entries yet)';
        const a    = Object.assign(document.createElement('a'), {
            href:     URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
            download: 'game_log.txt',
        });
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

// ─── Main application ─────────────────────────────────────────────────────────

class NoteTrainerApp {
    constructor() {
        // game state
        this.score         = 0;
        this.total         = 0;
        this.currentNote   = null;
        this.awaitingNext  = false;
        this.keyAcc        = [];   // active key-signature accidentals
        this.position      = 1;    // violin hand position: 1st/2nd/3rd
        this._keyNotes     = [];
        this._noteLookup   = buildNoteLookup(POSITIONS[1]);
        this._showKey      = false;
        this._markerNotes  = [];
        this._testSize     = 0;
        this._testRemain   = 0;
        this._testTimes    = [];
        this._noteStart    = 0;
        this._timer        = null;
        this._logger       = null;

        // canvas contexts
        this._sCtx  = setupHiDPI(document.getElementById('staff-canvas'));
        this._fbCtx = setupHiDPI(document.getElementById('fingerboard-canvas'));
        this._pCtx  = setupHiDPI(document.getElementById('piano-canvas'));

        // DOM refs
        this._feedback     = document.getElementById('feedback');
        this._timing       = document.getElementById('timing-bar');
        this._progress     = document.getElementById('progress-label');
        this._scoreEl      = document.getElementById('score-label');
        this._nextBtn    = document.getElementById('next-btn');
        this._restartBtn = document.getElementById('restart-btn');
        this._playerIn     = document.getElementById('player-input');
        this._playerDL     = document.getElementById('player-list');
        this._keySelect    = document.getElementById('key-select');
        this._positionSelect = document.getElementById('position-select');
        this._testCount    = document.getElementById('test-count');
        this._showKeyCb    = document.getElementById('show-key-cb');
        this._screenSetup  = document.getElementById('screen-setup');
        this._screenGame   = document.getElementById('screen-game');
        this._screenProgress    = document.getElementById('screen-progress');
        this._progressSelect    = document.getElementById('progress-player-select');
        this._progressEmpty     = document.getElementById('progress-empty');
        this._progressCharts    = document.getElementById('progress-charts');
        this._progressTableWrap = document.querySelector('.progress-table-wrap');
        this._progressTableBody = document.querySelector('#progress-table tbody');

        this._accChart = createLineChart(
            document.getElementById('chart-accuracy'),
            document.getElementById('chart-accuracy-tip'));
        this._speedChart = createLineChart(
            document.getElementById('chart-speed'),
            document.getElementById('chart-speed-tip'));

        this._initUI();
        this._refreshKeyNotes();
        // game starts only when the user presses Start on screen 1
    }

    _initUI() {
        this._refreshPlayerList();

        KEY_SIGNATURES.forEach(ks => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = ks.label;
            this._keySelect.appendChild(opt);
        });

        this._keySelect.addEventListener('change', () => this._onKeyChange());
        this._positionSelect.addEventListener('change', () => this._onPositionChange());

        this._showKeyCb.addEventListener('change', () => {
            this._showKey = this._showKeyCb.checked;
            this._redrawFB();
        });

        this._nextBtn.addEventListener('click', () => this.newNote());

        document.getElementById('restart-btn')
                .addEventListener('click', () => {
                    this._restartBtn.style.display = 'none';
                    this._startTest();
                });

        document.getElementById('start-btn')
                .addEventListener('click', () => this._onStartBtn());

        document.getElementById('back-btn')
                .addEventListener('click', () => this._onBackBtn());

        document.getElementById('download-log-btn')
                .addEventListener('click', () => GameLogger.downloadLog());

        document.getElementById('progress-btn')
                .addEventListener('click', () => this._openProgress());

        document.getElementById('progress-back-btn')
                .addEventListener('click', () => {
                    this._screenProgress.style.display = 'none';
                    this._screenSetup.style.display    = '';
                });

        this._progressSelect.addEventListener('change', () =>
            this._renderProgress(this._progressSelect.value));

        // game-mode toggle shows/hides test count field
        document.querySelectorAll('input[name="game-mode"]').forEach(r =>
            r.addEventListener('change', () => this._onGameModeChange())
        );

        // input-mode segmented control
        document.querySelectorAll('input[name="input-mode"]').forEach(r =>
            r.addEventListener('change', () => this._onInputModeChange())
        );
        this._onInputModeChange();

        // canvas touch + click
        const hitCanvas = (canvas, handler) => {
            canvas.addEventListener('touchstart', e => {
                e.preventDefault();
                handler(canvasXY(canvas, e));
            }, { passive: false });
            canvas.addEventListener('click', e => handler(canvasXY(canvas, e)));
        };

        hitCanvas(document.getElementById('piano-canvas'), ({ x, y }) => {
            if (this.awaitingNext) return;
            const hit = pianoHitTest(x, y);
            if (hit) this.checkAnswer(hit.name, hit.acc, 'keyboard');
        });

        hitCanvas(document.getElementById('fingerboard-canvas'), ({ x, y }) => {
            if (this.awaitingNext) return;
            const note = fingerboardHitTest(x, y, this.position, this._noteLookup);
            if (note) this.checkAnswer(note.name, note.accidental, 'violin');
        });
    }

    _refreshPlayerList() {
        this._playerDL.innerHTML = '';
        loadPlayers().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            this._playerDL.appendChild(opt);
        });
    }

    _openProgress() {
        const history = loadHistory();
        const players = [...new Set(history.map(r => r.player))].sort((a, b) => a.localeCompare(b));

        this._progressSelect.innerHTML = '';
        if (!players.length) {
            const opt = document.createElement('option');
            opt.textContent = 'No test history yet';
            this._progressSelect.appendChild(opt);
            this._progressSelect.disabled = true;
        } else {
            this._progressSelect.disabled = false;
            players.forEach(name => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = name;
                this._progressSelect.appendChild(opt);
            });
            const current = this._playerIn.value.trim();
            this._progressSelect.value = players.includes(current) ? current : players[0];
        }

        this._screenSetup.style.display    = 'none';
        this._screenProgress.style.display = '';
        this._renderProgress(this._progressSelect.value);
    }

    _renderProgress(player) {
        const records = loadHistory()
            .filter(r => r.player === player)
            .sort((a, b) => new Date(a.ts) - new Date(b.ts));

        const hasData = records.length > 0;
        this._progressEmpty.style.display     = hasData ? 'none' : '';
        this._progressCharts.style.display    = hasData ? '' : 'none';
        this._progressTableWrap.style.display = hasData ? '' : 'none';
        if (!hasData) return;

        const dateLabel = ts => new Date(ts).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });

        const chartRecords = records.slice(-30);
        const accPoints = chartRecords.map((r, i) => ({
            x: i, label: dateLabel(r.ts),
            value: r.total ? Math.round((r.score / r.total) * 100) : 0,
        }));
        const speedPoints = chartRecords.map((r, i) => ({
            x: i, label: dateLabel(r.ts), value: r.avgTime,
        }));

        this._accChart.render(accPoints, {
            yMin: 0, yMax: 100, yTicks: [0, 50, 100],
            color: '#1a9c53',
            formatValue: v => `${v}%`,
            formatTick:  v => `${v}%`,
        });

        const maxTime = Math.max(...speedPoints.map(p => p.value));
        const speedMax = niceCeil(maxTime || 1);
        this._speedChart.render(speedPoints, {
            yMin: 0, yMax: speedMax, yTicks: [0, speedMax / 2, speedMax],
            color: '#1a6bb5',
            formatValue: v => `${v.toFixed(2)} s`,
            formatTick:  v => v.toFixed(1),
        });

        this._progressTableBody.replaceChildren(
            ...[...records].reverse().map(r => {
                const tr = document.createElement('tr');
                const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
                [
                    dateLabel(r.ts),
                    r.key,
                    r.mode === 'violin' ? 'Violin' : 'Piano',
                    `${r.score}/${r.total} (${pct}%)`,
                    `${r.avgTime.toFixed(2)} s`,
                ].forEach(text => {
                    const td = document.createElement('td');
                    td.textContent = text;
                    tr.appendChild(td);
                });
                return tr;
            })
        );
    }

    _onGameModeChange() {
        const mode = document.querySelector('input[name="game-mode"]:checked')?.value ?? 'test';
        document.getElementById('test-count-row').style.display = mode === 'test' ? '' : 'none';
    }

    _onStartBtn() {
        this._screenSetup.style.display = 'none';
        this._screenGame.style.display  = '';
        const mode = document.querySelector('input[name="game-mode"]:checked')?.value ?? 'test';
        if (mode === 'test') {
            this._startTest();
        } else {
            this._testSize   = 0;
            this._testRemain = 0;
            this._logger     = null;
            this.score       = 0;
            this.total       = 0;
            this._scoreEl.textContent = 'Score: 0 / 0';
            this.newNote();
        }
    }

    _onBackBtn() {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        this._screenGame.style.display  = 'none';
        this._screenSetup.style.display = '';
    }

    _onInputModeChange() {
        const mode = document.querySelector('input[name="input-mode"]:checked')?.value ?? 'piano';
        document.getElementById('piano-wrap').style.display   = mode === 'piano'  ? '' : 'none';
        document.getElementById('fb-wrap').style.display      = mode === 'violin' ? '' : 'none';
        document.querySelector('.show-key-row').style.display = mode === 'violin' ? '' : 'none';
        document.querySelector('.position-row').style.display = mode === 'violin' ? '' : 'none';
    }

    _onKeyChange() {
        const ks = KEY_SIGNATURES.find(k => k.label === this._keySelect.value) ?? KEY_SIGNATURES[0];
        this.keyAcc = ks.accidentals;
        this._refreshKeyNotes();
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        this.newNote();
    }

    _onPositionChange() {
        this.position = parseInt(this._positionSelect.value, 10);
        this._refreshKeyNotes();
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        this.newNote();
    }

    // notes reachable in the currently selected violin position; irrelevant
    // (and unused) in piano mode, which always draws from the full note set
    _currentPositionNotes() {
        return POSITIONS[this.position];
    }

    _refreshKeyNotes() {
        const positionNotes = this._currentPositionNotes();
        this._keyNotes   = filterNotesForKey(positionNotes, this.keyAcc);
        this._noteLookup = buildNoteLookup(positionNotes);
        this._redrawFB();
    }

    _redrawFB() {
        drawFingerboard(
            this._fbCtx, this._keyNotes, this._showKey, this._markerNotes,
            this.position, this._noteLookup);
    }

    _startTest() {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        const n = parseInt(this._testCount.value, 10);
        if (!n || n < 1) return;

        const player   = this._playerIn.value.trim() || 'Anonymous';
        savePlayer(player);
        this._refreshPlayerList();

        const keyLabel     = this._keySelect.value.split(' / ')[0].trim();
        this._testSize     = Math.max(1, Math.min(99, n));
        this._logger       = new GameLogger(player, this._testSize, keyLabel);
        this._testPlayer   = player;
        this._testKeyLabel = keyLabel;
        this._testMode     = document.querySelector('input[name="input-mode"]:checked')?.value ?? 'piano';
        this._testRemain   = this._testSize;
        this._testTimes    = [];
        this.score         = 0;
        this.total         = 0;
        this._scoreEl.textContent = 'Score: 0 / 0';
        this.newNote();
    }

    newNote() {
        this._timer = null;
        const mode        = document.querySelector('input[name="input-mode"]:checked')?.value ?? 'piano';
        const sourceNotes = mode === 'violin' ? this._currentPositionNotes() : NOTES;
        const pool    = filterNotesForKey(sourceNotes, this.keyAcc);
        const choices = pool.filter(n => n !== this.currentNote);
        const src     = choices.length ? choices : pool;
        this.currentNote = src[Math.floor(Math.random() * src.length)];

        drawStaff(this._sCtx, this.currentNote, this.keyAcc);
        this._markerNotes = [];
        this._redrawFB();
        drawPiano(this._pCtx, null);

        this._feedback.textContent = '';
        this._feedback.className   = 'feedback';
        this._timing.textContent   = '';
        this._timing.style.cssText = '';
        this._nextBtn.style.display    = 'none';
        this._restartBtn.style.display = 'none';
        this.awaitingNext = false;

        if (this._testRemain > 0) {
            const done = this._testSize - this._testRemain + 1;
            this._progress.textContent = `Note ${done} of ${this._testSize}`;
        } else {
            this._progress.textContent = '';
        }

        this._noteStart = performance.now();
    }

    checkAnswer(letter, accidental, inputMethod = 'keyboard') {
        if (this.awaitingNext) return;

        const elapsed   = (performance.now() - this._noteStart) / 1000;
        this._showTiming(elapsed);

        this.total++;
        const note      = this.currentNote;
        const isCorrect = letter === note.name && accidental === note.accidental;
        const info      = inputMethod === 'violin'
            ? ` (${note.string}, ${fingerLabel(note).toLowerCase()})`
            : '';
        let semitones   = 0;

        if (isCorrect) {
            this.score++;
            this._feedback.textContent = `\u2705  ${noteDisplayName(note)}${info}`;
            this._feedback.className   = 'feedback correct';
        } else {
            const raw = Math.abs(
                noteToSemitone(note.name, note.accidental, 4) -
                noteToSemitone(letter, accidental ?? null, 4)
            );
            semitones = Math.min(raw, 12 - raw);
            this._feedback.textContent =
                `${noteDisplayName(note)}${info}`;
            this._feedback.className   = 'feedback incorrect';
        }

        // highlight every string/finger (within the current position) that produces this pitch
        this._markerNotes = this._currentPositionNotes().filter(n =>
            n.name === note.name && n.accidental === note.accidental && n.octave === note.octave);
        this._redrawFB();
        drawPiano(this._pCtx, note);

        this._scoreEl.textContent = `Score: ${this.score} / ${this.total}`;
        this.awaitingNext = true;

        if (this._testRemain > 0) {
            this._testRemain--;
            this._testTimes.push(elapsed);
            if (this._logger)
                this._logger.logNote(noteDisplayName(note), isCorrect, semitones, elapsed, inputMethod);

            if (this._testRemain === 0) {
                if (this._logger) { this._logger.save(this.score, this.total); this._logger = null; }
                const avg = this._testTimes.reduce((a, b) => a + b, 0) / this._testTimes.length;
                saveHistoryRecord({
                    ts:      new Date().toISOString(),
                    player:  this._testPlayer,
                    key:     this._testKeyLabel,
                    mode:    this._testMode,
                    score:   this.score,
                    total:   this.total,
                    avgTime: avg,
                });
                this._progress.textContent =
                    `Test done \u2014 ${this.score}/${this.total} correct, avg ${avg.toFixed(2)} s`;
                this._testSize = 0;
                this._restartBtn.style.display = '';
            } else {
                // auto-advance after 1.8 s so the child can read the result
                this._timer = setTimeout(() => this.newNote(), 1800);
            }
        } else {
            this._nextBtn.style.display = '';
        }
    }

    _showTiming(seconds) {
        const ratio = Math.max(0, Math.min(1, (seconds - 1) / 3));
        const hue   = Math.round((1 - ratio) / 3 * 360);   // green → yellow → red
        this._timing.style.background = `hsl(${hue}, 78%, 42%)`;
        this._timing.style.color      = 'white';
        this._timing.textContent      = `\u23f1  ${seconds.toFixed(2)} s`;
    }
}

document.addEventListener('DOMContentLoaded', () => new NoteTrainerApp());
