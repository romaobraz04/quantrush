# QuantRush

QuantRush is a fast, game-like mental arithmetic trainer with focused practice and an 80 in 8 Hardcore Mode.

Live beta: https://romaobraz04.github.io/quantrush/

## Run locally

Serve this folder with any static web server, then open `index.html`. Opening the file directly is not recommended because account features import the Supabase client from a CDN.

## Hosting

The app is published from the repository root with GitHub Pages. It contains no private server credentials. The Supabase key in the browser code is a public publishable key; database access is enforced by Row Level Security.
