# StationOne

A digital survey calculations assistant — library / CLI focused.

Quick start

- Install dependencies: `npm ci`
- Build: `npm run build`
- Type check: `npm run typecheck`
- Lint: `npm run lint`

Offline caching

This project includes a service worker (public/service-worker.js) and a small PWA manifest (public/manifest.json) to enable offline caching of the app's shell and assets. To enable the service worker, register it from your app entry point:

```
import { registerServiceWorker } from './sw-register';
registerServiceWorker();
```

Support

[![GitHub](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png) Support on GitHub](https://github.com/JasonMomanyi)
