# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-04-02
### Added
- Added `.github/workflows/ci.yml` for automated testing and coverage validation.
- Centralized `test_db` and `hermes_home` fixtures into `tests/dashboard/conftest.py`.
- Injected `DOMPurify` CDN into `index.html` for frontend XSS sanitation.

### Changed
- Reintroduced `pytest`, `httpx`, and `hypothesis` to `requirements.txt` and pinned all versions to guarantee stability.
- Refactored `start.sh` to use idempotent `pip install` directly.
- Wrapped `marked.parse` calls in `DOMPurify.sanitize()` across chat, memory, and soul modules in `app.js`.
- Converted SQLite code to utilize context managers (`with get_db() as conn:`) in `get_sessions` and `get_session_messages` logic.
- Moved Python core `import json` to the top of `fastapi_app.py` for standard PEP8 ordering.

### Fixed
- Added robust logging and `try/except` capturing around the `subprocess.Popen` task executing the Hermes CLI agent in `post_chat()`.
- Aborted caching of `"vUnknown"` inside `get_hermes_version()` so the server correctly polls for agent recovery without forcing a reboot.

### Security
- Modified `verify_localhost` middleware to correctly throw a Starlette `JSONResponse` (HTTP 403) for non-localhost queries instead of a swallowed `HTTPException`.
- Implemented Regex `[A-Z0-9_]+` validation logic on all environment variables returned by `read_env()` to stop `.env` key HTML-injection techniques.

## [1.0.0] - 2026-03-31
### Added
- Initial Open-Source launch of the Olympus Dashboard interface.
- Core 3-Layer Agent architecture implemented and vetted for fast, zero-config GUI.
- Implemented live chat synchronization with standalone Hermes CLI instances.
