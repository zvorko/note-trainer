// Canvas rendering + hit-testing for the staff, violin fingerboard, and piano.

import { STRING_ORDER, accSymbol, keySigDrawItems } from './notes.js';

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
    { label: "C♯", name: "C", acc: "sharp", after: 0 },
    { label: "E♭", name: "E", acc: "flat",  after: 1 },
    { label: "F♯", name: "F", acc: "sharp", after: 3 },
    { label: "G♯", name: "G", acc: "sharp", after: 4 },
    { label: "H♭", name: "H", acc: "flat",  after: 5 },
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
export function buildNoteLookup(positionNotes) {
    return new Map(positionNotes.map(n => [`${n.string}:${n.finger}:${n.low}`, n]));
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

export function setupHiDPI(canvas) {
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
export function canvasXY(canvas, event) {
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

export function drawStaff(ctx, note, keyAccidentals) {
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

export function drawFingerboard(ctx, keyNotes, showKey, markerNotes, position, noteLookup) {
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

export function drawPiano(ctx, highlightNote) {
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

export function pianoHitTest(x, y) {
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

export function fingerboardHitTest(x, y, position, noteLookup) {
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
