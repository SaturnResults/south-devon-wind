# South Devon Wind 🌬️

A no-build web app that tells you where to windsurf or wingfoil in South Devon. It uses live multi-model wind forecasts, tide times and webcam links.

## What it does
- **Five forecast models side by side** via [Open-Meteo](https://open-meteo.com/): Met Office UKV 2 km, ECMWF IFS, DWD ICON-D2, Météo-France AROME HD and NOAA GFS. The app averages them and flags when they disagree.
- **Cross-shore rating** for every spot. Each spot stores its seaward bearing, or an explicit list of good wind directions for estuaries, so every hour is rated cross-shore / cross-on / onshore / cross-off / offshore.
- **Sport thresholds**: windsurf ≥ 20 kn and wing ≥ 12 kn by default. You can change both, plus a "too much" upper limit, in ⚙︎ Settings.
- **Tide rules per spot**, e.g. Coombe Cellars only within ±2 h of high water, and Bigbury/Bantham avoid ±1.5 h of low water.
  - Default source: Open-Meteo's tide model, which needs no key.
  - Optional: paste a free **UKHO Admiralty UK Tidal API** key (Discovery tier, from admiraltyapi.portal.azure-api.net) in Settings to get official HW/LW times from the nearest standard port.
- **Session finder**: lists every upcoming daylight window where wind, direction and tide all line up.
- **Spot pages** with an hourly table, tide chart, compass of good directions, webcam links, Windy/Met Office/Windfinder links and an embedded Windy map.

## Spots
Coombe Cellars ★, Preston Sands ★, Broadsands, Torre Abbey Sands, Teignmouth, Dawlish Warren, Exmouth Duck Pond, Exmouth seafront, Torcross/Slapton, Bigbury-on-Sea, Bantham, Mount Batten.

To add or tweak a spot, edit `spots.js`. Each field is documented at the top of that file.

## Run it
It's plain static HTML/JS, so just open `index.html` or serve the folder:
```
python3 -m http.server 8000
```
To host it for free, use GitHub Pages: Settings → Pages → deploy from branch `main`, folder `/ (root)`.

## Caveats
- The forecasts are model data, not live observations. Use the webcam links and Met Office obs links to check what's actually happening.
- Webcams are run by third parties and may go offline.
- The tide-model times are approximate, so add an Admiralty key for official times. Not for navigation.
