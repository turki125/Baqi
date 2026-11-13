# Thmanyah fonts

The uploaded archive includes three upright families, each with Light (300),
Regular (400), Medium (500), Bold (700), and Black (900) weights:

- Thmanyah Sans
- Thmanyah Serif Text
- Thmanyah Serif Display

Only the 15 WOFF2 files are used by the app. The archive's OTF files duplicate
the same faces and are not needed by modern browsers. Font binaries and their
embedded notices are unchanged; the included original license is `LICENSE.pdf`.

## Application usage

`../../styles/fonts.css` contains the centralized `@font-face` declarations.
`../../index.css` defines the application tokens and Tailwind families:

- `--app-font-sans` / `font-sans`: default Arabic and English typography,
  including headings, forms, portals, notifications, and Clerk sign-in.
- `--app-font-serif` / `font-serif`: opt-in Serif Text.
- `--app-font-display` / `font-display`: opt-in Serif Display.

The existing UI remains sans-serif to avoid redesigning pages. The legacy
`font-mono` UI utility also uses the custom sans face because no monospace font
was supplied. Numeric alignment still uses `font-variant-numeric`.

There is no supplied 600 face or italic style. Browser CSS weight matching uses
the real Bold face for existing 600 requests; synthetic bold/italics are disabled.
Each face uses `font-display: swap`. Vite resolves relative CSS font URLs into
base-path-aware, fingerprinted production assets. Unused faces load only when
requested by the browser.

## License caution before publishing

The supplied license permits website/application embedding as part of a
compiled, packaged, or obfuscated product, but also restricts independently
extractable/downloadable font files. Ordinary WOFF2 webfonts remain downloadable
even when filenames are fingerprinted. Confirm that the intended web deployment
is covered by your permission from the font owner before publishing. This
integration does not establish or extend that permission.
