# Credits & third-party licenses

Katha Studio bundles the following open-licensed fonts so that scripts look the
same on every computer and work fully offline. The fonts are copied into
`public/fonts/` at build time from the `@fontsource` npm packages; each font's
full license text is shipped next to it as `public/fonts/LICENSE-<font>.txt`.

## Fonts (SIL Open Font License, Version 1.1)

| Font | Used for | Copyright |
| --- | --- | --- |
| **Courier Prime** (regular, bold, italic, bold italic) | English / Latin screenplay text | Copyright 2015 The Courier Prime Project Authors (https://github.com/quoteunquoteapps/CourierPrime) |
| **Noto Sans Tamil** | Tamil (default) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tamil) |
| **Noto Serif Tamil** | Tamil (serif option) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/tamil) |
| **Noto Sans Telugu** | Telugu (default) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/telugu) |
| **Noto Serif Telugu** | Telugu (serif option) | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/telugu) |
| **Noto Sans Devanagari** | Hindi | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/devanagari) |
| **Noto Sans Malayalam** | Malayalam | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/malayalam) |
| **Noto Sans Kannada** | Kannada | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/kannada) |

The SIL Open Font License 1.1 allows the fonts to be bundled, embedded in
documents (such as exported PDFs) and redistributed with software. Full text:
https://openfontlicense.org/open-font-license-official-text/

The Indic fonts are registered inside the app under the family names
"Katha Tamil", "Katha Telugu" etc. with a `size-adjust` so they sit well next to
Courier Prime; the font files themselves are unmodified.

## Software libraries

| Library | License |
| --- | --- |
| ProseMirror (prosemirror-model, -state, -view, -transform, -keymap, -history, -commands) | MIT |
| Preact | MIT |
| JSZip | MIT (dual MIT / GPLv3 — used under MIT) |
| Vite, vite-plugin-pwa, Workbox | MIT |
| Electron | MIT |
| electron-builder, electron-updater | MIT |
| Vitest | MIT |

## Sample content

The sample screenplay "Theeram (The Shore)" was written specifically for Katha
Studio and is not taken from any existing film.

Katha Studio is not affiliated with Final Draft. "Final Draft" is a trademark of
its owner; Katha Studio only reads and writes the `.fdx` file format for
interoperability.
