# QuantRush

QuantRush is a fast, game-like mental arithmetic trainer with focused practice and an 80 in 8 Hardcore Mode.

## Run locally

Serve this folder with any static web server, then open `index.html`. Opening the file directly is not recommended because account features import the Supabase client from a CDN.

## Hosting

The production build is the contents of `dist/`. It contains `index.html`, `redesign.css`, and `assets/` with no private server credentials. The Supabase key in the browser code is a public publishable key; database access is enforced by Row Level Security.
