# <dialog> probes (2026-10-16)

Run from this directory with `node <probe>.mjs`. Chromium and Firefox only (WebKit cannot launch
locally). Each `*.output.txt` is the recorded output on Chromium 156 / Firefox 157.

`react.mjs` needs the bundles built first:

```sh
ESB=/home/uhyo/repos/funstack-ui/node_modules/.pnpm/node_modules/.bin/esbuild
export NODE_PATH=/home/uhyo/repos/funstack-ui/packages/ui/node_modules
$ESB react/client.jsx --bundle --format=iife --define:process.env.NODE_ENV='"development"' --jsx=automatic --outfile=react/client.bundle.js
$ESB react/ssr.jsx --bundle --platform=node --format=cjs --define:process.env.NODE_ENV='"development"' --jsx=automatic --outfile=react/ssr.bundle.cjs
```
