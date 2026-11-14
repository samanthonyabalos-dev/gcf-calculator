# GCF-400 — Third-party software notices

These notices cover the third-party software used by the GCF-400 browser application. They **do not license or transfer ownership of GCF-400's original source code**. License terms and copyright notices for third-party components remain with their respective rights holders.

## Direct dependencies

| Component | Version used | Purpose | License | Full text |
| --- | --- | --- | --- | --- |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 (self-hosted `jszip.min.js`) | ZIP reading and exporting, including XLSX and audit packages | MIT selected from MIT/GPLv3 dual-license choice | [JSZip MIT notice](licenses/JSZIP-MIT.txt) |
| [PDF.js](https://github.com/mozilla/pdf.js) | 3.11.174 (loaded on demand from a CDN) | PDF reading, text extraction and preview | Apache License 2.0 | [Apache 2.0](licenses/APACHE-2.0.txt) |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 5.1.1 (loaded on demand from a CDN) | OCR fallback for scanned PDF pages | Apache License 2.0 | [Apache 2.0](licenses/APACHE-2.0.txt) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 (loaded on demand from a CDN) | Exporting annotated PDFs | MIT | [pdf-lib MIT notice](licenses/PDF-LIB-MIT.txt) |

- **JSZip:** Copyright (c) 2009–2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. JSZip is dual-licensed; GCF-400 elects the **MIT** option and preserves the original attribution header in `jszip.min.js`. License: [upstream v3.10.1](https://github.com/Stuk/jszip/blob/v3.10.1/LICENSE.markdown).
- **PDF.js:** Mozilla Foundation and contributors. The project uses the Apache License 2.0. License: [upstream v3.11.174](https://github.com/mozilla/pdf.js/blob/v3.11.174/LICENSE).
- **Tesseract.js:** Project Naptha/Tesseract.js contributors. The project uses the Apache License 2.0. License: [upstream v5.1.1](https://github.com/naptha/tesseract.js/blob/v5.1.1/LICENSE.md). OCR engines, language data and subdependencies may carry additional notices; see their upstream distributions.
- **pdf-lib:** Copyright (c) 2019 Andrew Dillon. License: [upstream v1.17.1](https://github.com/Hopding/pdf-lib/blob/v1.17.1/LICENSE.md).

## JSZip browser bundle — included open-source components

The redistributed JSZip browser bundle contains code from other MIT-licensed packages. Their license notices are reproduced here separately, in addition to the JSZip license.

| Bundled package | License | Local copyright / permission notice |
| --- | --- | --- |
| [pako](https://github.com/nodeca/pako) (1.x) | MIT | [pako license](licenses/PAKO-MIT.txt) |
| [lie](https://github.com/calvinmetcalf/lie) (3.x) | MIT | [lie license](licenses/LIE-MIT.txt) |
| [immediate](https://github.com/calvinmetcalf/immediate) (3.x) | MIT | [immediate license](licenses/IMMEDIATE-MIT.txt) |
| [setImmediate](https://github.com/YuzuJS/setImmediate) (1.x) | MIT | [setImmediate license](licenses/SETIMMEDIATE-MIT.txt) |
| [readable-stream](https://github.com/nodejs/readable-stream) (2.x) | MIT and included related notices | [readable-stream license](licenses/READABLE-STREAM.txt) |

The notices in this section are based on the upstream package licenses; some browser bundle dependencies may themselves include additional small helpers with separate notices. Follow each package's upstream distribution when redistributing or replacing a bundle.

## OCR and other transitive dependencies

Tesseract.js may load **tesseract.js-core**, WebAssembly binaries, and language data on demand. See the upstream [tesseract.js-core license](https://github.com/naptha/tesseract.js-core/blob/master/LICENSE) (Apache 2.0) and any license or attribution shipped with individual language/model assets. PDF.js and Tesseract.js CDN scripts can contain further bundled third-party components; their upstream distributions remain authoritative for those components' notices.

The application uses these libraries under their own terms; this document is **not** a declaration that all third-party code is original GCF-400 code, or a claim that a legal audit of every transitive component has been completed.

## License texts

- [JSZip MIT option](licenses/JSZIP-MIT.txt)
- [pdf-lib MIT](licenses/PDF-LIB-MIT.txt)
- [Apache License 2.0 (PDF.js, Tesseract.js and related core)](licenses/APACHE-2.0.txt)
- [pako MIT](licenses/PAKO-MIT.txt)
- [lie MIT](licenses/LIE-MIT.txt)
- [immediate MIT](licenses/IMMEDIATE-MIT.txt)
- [setImmediate MIT](licenses/SETIMMEDIATE-MIT.txt)
- [readable-stream license and accompanying notices](licenses/READABLE-STREAM.txt)

None of these third-party licenses requires GCF-400's own independently written code to be licensed under the same terms by virtue of using the listed MIT/Apache-licensed components.
