# Dashboard Standard Operating Procedure (SOP)

## Domain Intent
The Dashboard domain provides an interactive, standalone web interface to configure, monitor, and converse with the Hermes Agent. It strictly binds to localhost `127.0.0.1:8787` for security.

## Bounded Context
This domain is responsible for:
- Reading and writing Hermes Agent files (`config.yaml`, `.env`, `MEMORY.md`, `USER.md`).
- Interfacing with the Hermes `state.db` SQLite database (read-only for messages, read/write for chat insertions).
- Serving the vanilla HTML/CSS/JS frontend located in `execution/dashboard/static/`.

## Core Rules

1. **Security-First (API Keys)**:
    - Never transmit unredacted API keys to the frontend via `/api/env` or any other route.
    - Redaction rule: `value[:4] + "****"`.
2. **File Preservation (Write Safety)**:
    - When updating `config.yaml`, `ruamel.yaml` MUST be used so that user comments and block structures are preserved.
    - When updating `.env`, `dotenv.set_key` MUST be used to preserve comments.
3. **Immutability of Data Models**:
    - The backend parses files strictly. Missing files should not crash the server but return empty or default templates with a warning flag.
4. **Chat Execution**:
    - The `/api/chat` interaction should log directly into the agent's database or forward to the agent's native interface securely.
5. **Versioning and Transparency**:
    - Every time updates are implemented to core project files, a Semantic Versioning bump must occur.
    - Updates must reflect in `CHANGELOG.md` and visually in `execution/dashboard/static/index.html` (the footer interface).

## Test-Driven Development Requirement
Before implementing any route in `fastapi_app.py`:
- A corresponding test must be created in `tests/dashboard/`.
- Tests must use Hypothesis for property-based generation (e.g., fuzzing config YAML schemas, redaction leaks).
