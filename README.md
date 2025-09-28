
# VibeShift — MVP (React + Vite + Tailwind)

A clickable mock for the Mood DJ: mood gauge, signal sliders (health + weather + macro + finance), playlist pathing, and emoji feedback. Plaid is the default finance source (UI stub), with Gmail receipts as an alternative.

## Quick start
```bash
npm install
npm run dev
# open the URL shown (usually http://localhost:5173)
```

## What's inside
- React 18 + Vite
- Tailwind CSS 3
- One-file app component in `src/App.jsx`
- Slides in `slides/VibeShift_Slides.pptx`

## Notes
- All data is simulated on the client. No external APIs are called.
- Settings → Finance Signal Source shows **Plaid (default)** and **Gmail Receipts** with a simulated connect button.
- The **Spend spike (24h vs avg)** slider feeds into the mood model as `financeStress`.
