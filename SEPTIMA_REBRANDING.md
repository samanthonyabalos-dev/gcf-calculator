# SC Auditor — Branding and Repository Migration

**Website and installed app:** SC Auditor  
**App subtitle:** Date–Weekday Checker  
**Mathematical method:** Septima Congruence (SC)  
**Core implementation designation:** SC-400

The website, PWA metadata, user-facing audit exports, PDF legends, and licensing pages use **SC Auditor**. Mathematical attribution and legacy report schemas remain unchanged for compatibility.

## GitHub repository and Pages address

The current GitHub repository is still `samanthonyabalos-dev/gcf-calculator`. The intended repository name is **SC**. The repository owner needs to rename it under **Settings → General → Repository name → Rename**, which cannot be done using the connected repository file-editing tools.

- **After rename — repository:** https://github.com/samanthonyabalos-dev/SC
- **After rename — GitHub Pages:** https://samanthonyabalos-dev.github.io/SC/

These target links should be treated as **pending**, not as confirmed live links, until the repository rename and Pages deployment are completed. The uppercase `SC` path matters.

GitHub repository redirects may cover repository links, but GitHub Pages paths should be updated directly. After the rename, check **Settings → Pages** and confirm the new Pages address. Existing installed PWAs may need to be removed and installed again because the path/scope changes.

The offline worker uses a new branding cache name to refresh the installed app's shell. Previous SC-400 evidence schema identifiers are retained so historical signed reports can still be recognized.
