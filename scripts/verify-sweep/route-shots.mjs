#!/usr/bin/env node
// route-shots — the architect's own eyes, mechanised: check pages visually in a browser before any "done".
// Every route at the configured ownerViewport (if any) and the reference desktop, each colour
// scheme, at scroll 0 and one viewport down (sticky/docked chrome state),
// written as PNGs for the architect to READ before any "done".
//   node <plugin root>/scripts/verify-sweep/route-shots.mjs [outDir] [route ...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, loadConfig, settle } from './lib.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const [outArg, ...routeArgs] = process.argv.slice(2);
const out = outArg && !outArg.startsWith('/') ? outArg : cfg.shotsDir;
const routes = routeArgs.length ? routeArgs : outArg?.startsWith('/') ? [outArg, ...routeArgs] : cfg.routes;
mkdirSync(out, { recursive: true });

const VIEWPORTS = [cfg.ownerViewport, [1920, 1080]].filter(Boolean); // ownerViewport is optional project config
const browser = await launch(cwd);
for (const scheme of cfg.colorSchemes) {
  for (const [w, h] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
    if (cfg.initScript) await page.addInitScript(cfg.initScript);
    for (const route of routes) {
      // Query routes (/?fixture=x) need a file-safe name: '?' is illegal in Windows file names.
      const slug = route === '/' ? 'home' : route.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
      const tag = cfg.colorSchemes.length > 1 ? `-${scheme}` : '';
      await page.goto(cfg.url(route), { waitUntil: 'networkidle' });
      await settle(page, cfg, 2000);
      await page.screenshot({ path: join(out, `${slug}${tag}-${w}-top.png`) });
      await page.mouse.move(w / 2, h / 2);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, h / 10);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(out, `${slug}${tag}-${w}-down.png`) });
      console.log(`${slug}${tag} @${w}: top + down`);
    }
    await page.close();
  }
}
await browser.close();
console.log(`route-shots: ${routes.length} routes × ${cfg.colorSchemes.length} scheme(s) × ${VIEWPORTS.length} viewports → ${out}/`);
