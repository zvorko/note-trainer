// Port of notes.py — all domain data and pure helper functions.

export const NOTES = [
    // G string
    { name: "G", octave: 3, accidental: null,    step: -5, string: "G", finger: 0, low: false },
    { name: "G", octave: 3, accidental: "sharp",  step: -5, string: "G", finger: 1, low: true  },
    { name: "A", octave: 3, accidental: null,    step: -4, string: "G", finger: 1, low: false },
    { name: "H", octave: 3, accidental: "flat",   step: -3, string: "G", finger: 2, low: true  },
    { name: "H", octave: 3, accidental: null,    step: -3, string: "G", finger: 2, low: false },
    { name: "C", octave: 4, accidental: null,    step: -2, string: "G", finger: 3, low: false },
    { name: "C", octave: 4, accidental: "sharp",  step: -2, string: "G", finger: 4, low: true  },
    { name: "D", octave: 4, accidental: null,    step: -1, string: "G", finger: 4, low: false },
    // D string
    { name: "D", octave: 4, accidental: null,    step: -1, string: "D", finger: 0, low: false },
    { name: "E", octave: 4, accidental: "flat",   step:  0, string: "D", finger: 1, low: true  },
    { name: "E", octave: 4, accidental: null,    step:  0, string: "D", finger: 1, low: false },
    { name: "F", octave: 4, accidental: null,    step:  1, string: "D", finger: 2, low: false },
    { name: "F", octave: 4, accidental: "sharp",  step:  1, string: "D", finger: 3, low: true  },
    { name: "G", octave: 4, accidental: null,    step:  2, string: "D", finger: 3, low: false },
    { name: "G", octave: 4, accidental: "sharp",  step:  2, string: "D", finger: 4, low: true  },
    { name: "A", octave: 4, accidental: null,    step:  3, string: "D", finger: 4, low: false },
    // A string
    { name: "A", octave: 4, accidental: null,    step:  3, string: "A", finger: 0, low: false },
    { name: "H", octave: 4, accidental: "flat",   step:  4, string: "A", finger: 1, low: true  },
    { name: "H", octave: 4, accidental: null,    step:  4, string: "A", finger: 1, low: false },
    { name: "C", octave: 5, accidental: null,    step:  5, string: "A", finger: 2, low: false },
    { name: "C", octave: 5, accidental: "sharp",  step:  5, string: "A", finger: 3, low: true  },
    { name: "D", octave: 5, accidental: null,    step:  6, string: "A", finger: 3, low: false },
    { name: "E", octave: 5, accidental: "flat",   step:  7, string: "A", finger: 4, low: true  },
    { name: "E", octave: 5, accidental: null,    step:  7, string: "A", finger: 4, low: false },
    // E string
    { name: "E", octave: 5, accidental: null,    step:  7, string: "E", finger: 0, low: false },
    { name: "F", octave: 5, accidental: null,    step:  8, string: "E", finger: 1, low: false },
    { name: "F", octave: 5, accidental: "sharp",  step:  8, string: "E", finger: 2, low: true  },
    { name: "G", octave: 5, accidental: null,    step:  9, string: "E", finger: 2, low: false },
    { name: "G", octave: 5, accidental: "sharp",  step:  9, string: "E", finger: 3, low: true  },
    { name: "A", octave: 5, accidental: null,    step: 10, string: "E", finger: 3, low: false },
    { name: "H", octave: 5, accidental: "flat",   step: 11, string: "E", finger: 4, low: true  },
    { name: "H", octave: 5, accidental: null,    step: 11, string: "E", finger: 4, low: false },
];

export const STRING_ORDER = ["G", "D", "A", "E"];

export function accSymbol(acc) {
    return acc === "sharp" ? "\u266F" : acc === "flat" ? "\u266D" : "";
}

export function fingerLabel(note) {
    if (note.finger === 0) return "Open string";
    const ord = ["", "1st", "2nd", "3rd", "4th"][note.finger];
    return note.low ? `${ord} finger (low placement)` : `${ord} finger`;
}

export function noteDisplayName(note) {
    return `${note.name}${accSymbol(note.accidental)}${note.octave}`;
}

const SEMITONE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11 };
const ACC_OFFSET    = { sharp: 1, flat: -1 };

export function noteToSemitone(name, accidental, octave) {
    return SEMITONE_BASE[name] + (ACC_OFFSET[accidental] ?? 0) + octave * 12;
}

export const KEY_SIGNATURES = [
    { label: "C dur / A mol  (no accidentals)",               accidentals: [] },
    { label: "G dur / E mol  (F\u266F)",                       accidentals: [["F", "sharp"]] },
    { label: "D dur / H mol  (F\u266F C\u266F)",               accidentals: [["F", "sharp"], ["C", "sharp"]] },
    { label: "A dur / F\u266F mol  (F\u266F C\u266F G\u266F)", accidentals: [["F", "sharp"], ["C", "sharp"], ["G", "sharp"]] },
    { label: "F dur / D mol  (H\u266D)",                       accidentals: [["H", "flat"]] },
];

const SHARP_KS_STEPS = { F: 8, C: 5, G: 2, D: 6, A: 3 };
const FLAT_KS_STEPS  = { H: 4, E: 7, A: 3, D: 6, G: 2 };

export function keySigDrawItems(accidentals) {
    if (!accidentals.length) return [];
    const accType = accidentals[0][1];
    const stepMap = accType === "sharp" ? SHARP_KS_STEPS : FLAT_KS_STEPS;
    const symbol  = accSymbol(accType);
    return accidentals
        .filter(([name]) => name in stepMap)
        .map(([name]) => [symbol, stepMap[name]]);
}

export function filterNotesForKey(accidentals) {
    const sharped = new Set(accidentals.filter(([, a]) => a === "sharp").map(([n]) => n));
    const flatted = new Set(accidentals.filter(([, a]) => a === "flat").map(([n]) => n));
    const accSet  = new Set(accidentals.map(([n, a]) => `${n}:${a}`));
    return NOTES.filter(({ name, accidental }) => {
        if (accidental === null) return !sharped.has(name) && !flatted.has(name);
        return accSet.has(`${name}:${accidental}`);
    });
}
