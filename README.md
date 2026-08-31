# LessonDeck

A dependency-free classroom command center prototype for planning and presenting paced lessons. It combines a clock-aware agenda, projected instructional content, classroom expectations, a quick timer, focus mode, schedule overrides, keyboard remote controls, and persistent live state.

## Run locally

Open `index.html` directly, or serve the directory with:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- **Right / Left arrow:** move through the agenda
- **Space:** pause or resume agenda pacing
- **U:** undo the last agenda timing change
- **Escape:** leave widget focus mode

Lesson timing and teacher adjustments are stored in `localStorage`, so refreshing the page preserves the classroom state.
