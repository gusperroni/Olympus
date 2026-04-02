import os
import sqlite3
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from execution.dashboard.fastapi_app import app, write_config, get_db

client = TestClient(app)

def setup_test_db(tmp_path):
    conn = sqlite3.connect(tmp_path / "state.db")
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        user_id TEXT,
        model TEXT,
        model_config TEXT,
        system_prompt TEXT,
        parent_session_id TEXT,
        started_at REAL NOT NULL
    )''')
    cursor.execute('''CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        tool_name TEXT,
        timestamp REAL NOT NULL,
        token_count INTEGER,
        finish_reason TEXT,
        reasoning TEXT,
        reasoning_details TEXT,
        codex_reasoning_items TEXT
    )''')
    conn.commit()
    conn.close()

def test_get_config(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    (tmp_path / "config.yaml").write_text("model:\n  default: 'test-model'\n")
    
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json() == {"model": {"default": "test-model"}}

def test_put_config(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    response = client.put("/api/config", json={"section": "model", "key": "default", "value": "new-model"})
    assert response.status_code == 200
    
    content = (tmp_path / "config.yaml").read_text()
    assert "new-model" in content

def test_chat_send(tmp_path):
    setup_test_db(tmp_path)
    os.environ["HERMES_HOME"] = str(tmp_path)
    
    conn = sqlite3.connect(tmp_path / "state.db")
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (id, source, started_at) VALUES ('sess_123', 'cli', 0)")
    conn.commit()
    conn.close()
    
    response = client.post("/api/chat", json={
        "session_id": "sess_123",
        "content": "Hello Hermes"
    })
    
    assert response.status_code == 200

def test_get_sessions(tmp_path):
    setup_test_db(tmp_path)
    os.environ["HERMES_HOME"] = str(tmp_path)
    conn = sqlite3.connect(tmp_path / "state.db")
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (id, source, started_at) VALUES ('sess_123', 'cli', 0)")
    conn.commit()
    conn.close()
    
    response = client.get("/api/sessions")
    assert response.status_code == 200
    assert response.json()["total"] > 0
    assert response.json()["sessions"][0]["id"] == "sess_123"

def test_get_session_messages(tmp_path):
    setup_test_db(tmp_path)
    os.environ["HERMES_HOME"] = str(tmp_path)
    conn = sqlite3.connect(tmp_path / "state.db")
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (id, source, started_at) VALUES ('sess_123', 'cli', 0)")
    cursor.execute("INSERT INTO messages (session_id, role, content, timestamp) VALUES ('sess_123', 'user', 'Hi', 0)")
    cursor.execute("INSERT INTO messages (session_id, role, content, timestamp) VALUES ('sess_123', 'assistant', 'Hello!', 1)")
    conn.commit()
    conn.close()
    
    response = client.get("/api/sessions/sess_123/messages")
    assert response.status_code == 200
    msgs = response.json()["messages"]
    assert len(msgs) == 2
    assert msgs[0]["content"] == "Hi"
    assert msgs[1]["content"] == "Hello!"
