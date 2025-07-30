# ArcTrack Patch 3.0 — Job Info Modal + Logo

- Adds **Create Job** modal with extended fields for power generation jobs.
- Stores: contact, address, GPS, generator model/kW, fuel type, on-site fuel, start kWh, notes.
- **Current Job** remains visible on dashboard.
- PDF report includes the **ArcWave Energy logo** and the job information block.
- Safe migrations automatically add new columns to existing DB.

## Deploy
1. Replace files in your repo root with the contents of this ZIP (keep `public/` intact).
2. Commit & push.
3. Render → Clear build cache → Manual Deploy.
