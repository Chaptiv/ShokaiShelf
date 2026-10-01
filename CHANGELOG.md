# Changelog

## 0.2.4 — 2026-10-01

### Fixed

- Include AniList viewer lookup and session-cache reads in dashboard startup error handling.
- Show a retryable error when no AniList viewer is available.
- End dashboard loading after two minutes and ignore late results after timeout or unmount.
- Abort AniList GraphQL network requests after 30 seconds.
- Limit each GraphQL request to one retry after an HTTP 429 response.
- Use an ES module import for default Dream migration metrics instead of renderer-side `require()`.

### Changed

- Update the README to describe the current runtime, build scripts, storage limitations, and update flow.
- License ShokaiShelf under GNU GPL version 3.0 only (`GPL-3.0-only`). Replace the previous reuse and redistribution restrictions.
- Include the complete GPL license text in the repository and packaged application.

### Validation

- All 16 automated tests pass, including six dashboard startup regression tests.
- The renderer production build completes successfully.
- Runtime validation of the rebuilt Windows executable remains pending.
