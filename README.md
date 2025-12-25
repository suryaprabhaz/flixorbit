# 🎬 FlixOrbit

FlixOrbit is a lightweight, frontend-only movie discovery web app built using plain HTML, CSS, and JavaScript.  
It uses the TMDB API to let users explore popular movies, view detailed information, watch trailers, browse cast, and check OTT availability — all in a clean dark-themed UI.

This project is focused on **UI/UX, API integration, and real-world frontend behavior**, not frameworks.

## 🚀 Live Demo

👉 https://flixorbit.netlify.app/

---

## ✨ Features

- Infinite scrolling popular movies
- Movie search with smart suggestions (movies + actors)
- Detailed movie view with:
  - Overview, runtime, budget, revenue
  - Cast list with actor profiles
  - Embedded YouTube trailer (privacy-safe)
- OTT availability display with clickable app icons  
  (Netflix, Prime Video, Disney+, Hotstar, etc.)
- Actor detail pages with biography
- Smooth hover animations and dark UI
- Keyboard support (ESC to close overlays)
- Fully responsive (desktop & mobile)

---

## 🛠 Tech Stack

- HTML5
- CSS3 (Flexbox & Grid)
- Vanilla JavaScript (ES6+)
- TMDB API
- Deployed on Netlify

> No frameworks. No build tools. No libraries.

---

## 🔑 API Usage

This project uses the **TMDB API** for movie data.

- API key is used on the client side (acceptable for demo/portfolio projects)
- The key is read-only and rate-limited
- No user data or write operations are involved

For production-scale apps, a backend proxy would be required.

---

## 📦 Installation (Local)

No installation or build steps required.

```bash
git clone https://github.com/your-username/flixorbit.git
cd flixorbit
open index.html
or run a simple local if needed
