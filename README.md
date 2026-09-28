# Note Trainer

A browser-based practice game for reading notes on the treble clef staff. Pick a key
signature, choose piano or violin, and answer by clicking the correct key or
fingerboard position. Includes a timed test mode and score tracking.

## Play it

Open [index.html](web/index.html) in a browser — no build step, no dependencies.

Or serve it locally:

```bash
cd web
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

- `web/index.html` — page markup
- `web/app.js` — game logic (staff drawing, piano/fingerboard input, scoring, test mode)
- `web/notes.js` — note data and helpers
- `web/style.css` — styling

## License

MIT — see [LICENSE](LICENSE).
