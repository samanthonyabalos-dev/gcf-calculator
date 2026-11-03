# GCF-400 Security Model — Version 24

## Supported security guarantees

- **Confidentiality:** Source PDF, DOCX, and extracted text stay in the local browser processing workflow. The deployed static host has no user-content upload endpoint. The app may load optional third-party PDF/OCR libraries over the network; this is **not a guarantee** of zero outbound requests by those libraries.
- **Integrity:** An audit manifest contains source file SHA-256 hashes, scan settings, per-page coverage, counts, and individual findings (including printed/expected weekdays and source evidence). Its ECDSA P-256 signature covers a canonical serialization of the entire manifest.
- **Independent verification:** Anyone holding a signed JSON file can check its signature, SHA-256 payload digest and public-key fingerprint without scanning another file. A verifier may additionally compare an original source PDF/DOCX hash. An independently received trusted public-key fingerprint may be entered to detect substitution of the signer key.
- **Accountability:** Each signed report has an export timestamp, a public-key fingerprint and original document fingerprints; they support tracking which evidence corresponds to which source. Signing keys are generated per browser session and are **not** retained or tied to a named user.
- **Availability:** The static core application shell, calendar engine and security verifier are pre-cached for offline access after initial setup. Optional PDF.js, PDF-lib and OCR engines may require internet.
- **Client hardening:** Content Security Policy restricts dynamic script origins, object/embed content and form submission; file-type signature checks validate PDF and DOCX containers; XML readers reject DTD/entity definitions and apply size restrictions; CSV exports neutralize spreadsheet formula prefixes; audit finding displays escape untrusted document text.

## Security boundaries and limitations

1. **A signature is not a verified human identity.** Anyone can generate a browser key and sign a document. A known public-key fingerprint independently distributed by a trusted identity or authority can support a trust decision, but the application does not validate certificates, trusted timestamps or third-party identity attestations.
2. **This is not true legal non-repudiation.** The tool does not establish who held a signing key; it is not a trusted signing service. Audit proofs are tamper-evident, not a legally binding signature.
3. **Authenticated original-source documents are out of scope.** A matching SHA-256 shows that a presented file equals the scanned source; it does not certify that a PRC PDF was published by PRC.
4. **Self-contained signed evidence can be replaced with a wholly new signed report.** An independently trusted public-key fingerprint, certificate or external witnessed log is needed to distinguish different signers. A local signature alone does not prevent such substitution.
5. **No server-managed account credentials or logs.** The privacy-first static design does not implement authenticated users, protected central audit logs, remote key custody or cross-session audit recovery.
6. **Availability depends on device and browser.** Cache storage can be cleared, and some third-party library resources are not cached for offline use.
7. **CSP is defense in depth.** The application permits only known pinned CDN hostnames for optional engines, but without immutable Subresource Integrity hashes those externally loaded library files remain a supply-chain risk. Version strings in URLs alone do not ensure unchanged bytes.

## Testing

- `node tests/security-seal.js`: signing, signature verification, report edits, individual finding changes, signature edits, public-key fingerprint mismatch, and altered source PDF bytes.
- `node tests/hardening.js`: file signatures, empty files, duplicate filenames, audit summary correctness, and manifest findings.
- `node tests/offline.js`: offline precache and privacy-safe service-worker routing.
- `node tests/ui-smoke.js`: document scanning through result display and filtering.
- `node tests/regression.js` and `node tests/prc-fixtures.js`: calendar/date regression coverage.

## Research-instrument interpretation

A security score is the opinion of a qualified evaluator, not a property automatically proved by code. Stronger data confidentiality and integrity controls support higher ratings; non-repudiation and user identity authenticity remain limited without trusted infrastructure. If a formal ISO questionnaire requires these controls, scope decisions must be reviewed by the research adviser rather than manipulating results.
