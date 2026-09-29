// localStorage persistence: saved player names, test history, and the
// downloadable per-note game log.

export function loadPlayers() {
    try { return JSON.parse(localStorage.getItem('nt_players') || '[]'); }
    catch { return []; }
}

export function savePlayer(name) {
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

export function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
}

export function saveHistoryRecord(record) {
    const list = loadHistory();
    list.push(record);
    if (list.length > HISTORY_MAX) list.splice(0, list.length - HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

export class GameLogger {
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
