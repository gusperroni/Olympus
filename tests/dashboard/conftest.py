import sys
import os
import sqlite3
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

@pytest.fixture(autouse=True)
def hermes_home(tmp_path):
    """Configura HERMES_HOME para diretório temporário em todos os testes."""
    os.environ["HERMES_HOME"] = str(tmp_path)
    yield tmp_path

@pytest.fixture
def test_db(hermes_home):
    """Cria banco SQLite de teste com schema completo."""
    conn = sqlite3.connect(hermes_home / "state.db")
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE sessions (
        id TEXT PRIMARY KEY, source TEXT NOT NULL,
        user_id TEXT, model TEXT, model_config TEXT,
        system_prompt TEXT, parent_session_id TEXT,
        started_at REAL NOT NULL
    )''')
    cursor.execute('''CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL, content TEXT,
        tool_call_id TEXT, tool_calls TEXT,
        tool_name TEXT, timestamp REAL NOT NULL,
        token_count INTEGER, finish_reason TEXT,
        reasoning TEXT, reasoning_details TEXT,
        codex_reasoning_items TEXT
    )''')
    conn.commit()
    conn.close()
    return hermes_home
