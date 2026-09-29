import {
    NOTES, POSITIONS, KEY_SIGNATURES, fingerLabel, noteDisplayName,
    noteToSemitone, filterNotesForKey,
} from './notes.js';
import {
    setupHiDPI, canvasXY, drawStaff, drawFingerboard, drawPiano,
    pianoHitTest, fingerboardHitTest, buildNoteLookup,
} from './drawing.js';
import { createLineChart, niceCeil } from './chart.js';
import { loadPlayers, savePlayer, loadHistory, saveHistoryRecord, GameLogger } from './storage.js';

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
            this._feedback.textContent = `✅  ${noteDisplayName(note)}${info}`;
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
                    `Test done — ${this.score}/${this.total} correct, avg ${avg.toFixed(2)} s`;
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
        this._timing.textContent      = `⏱  ${seconds.toFixed(2)} s`;
    }
}

document.addEventListener('DOMContentLoaded', () => new NoteTrainerApp());
