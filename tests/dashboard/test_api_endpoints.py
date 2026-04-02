import os
import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from execution.dashboard.fastapi_app import app

client = TestClient(app)

def test_api_env_get_put(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    env_file = tmp_path / ".env"
    env_file.write_text("API_KEY=12345\nDEBUG=true\n")
    
    # Test GET
    response = client.get("/api/env")
    assert response.status_code == 200
    data = response.json()
    assert "variables" in data
    
    # Both should be "set" since they have values
    api_key_var = next(v for v in data["variables"] if v["key"] == "API_KEY")
    assert api_key_var["is_set"] is True
    # The value should be heavily redacted if it's an API_KEY
    assert api_key_var["value"] == "1234****"
    
    # Test PUT update
    put_response = client.put("/api/env", json={"key": "DEBUG", "value": "false"})
    assert put_response.status_code == 200
    assert put_response.json()["status"] == "success"
    
    # Test PUT new
    client.put("/api/env", json={"key": "NEW_KEY", "value": "hello"})
    content = env_file.read_text()
    assert "DEBUG" in content
    assert "false" in content
    assert "NEW_KEY" in content


def test_api_memory(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    (tmp_path / "MEMORY.md").write_text("# Active Memory\nTesting memory content")
    
    # Let's purposefully NOT create USER.md to test the silent fallback/empty string logic
    response = client.get("/api/memory")
    assert response.status_code == 200
    data = response.json()
    
    assert "memory" in data
    assert "user_profile" in data
    assert "Testing memory" in data["memory"]["content"]
    assert data["memory"]["char_count"] > 0
    assert data["user_profile"]["content"] == ""
    assert data["user_profile"]["char_count"] == 0

def test_api_soul(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    (tmp_path / "SOUL.md").write_text("I am Hermes.")
    
    response = client.get("/api/soul")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "I am Hermes."

def test_api_skills(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    skills_dir = tmp_path / "skills"
    
    # 1. Valid Skill
    valid_skill = skills_dir / "category1" / "skill1"
    valid_skill.mkdir(parents=True)
    (valid_skill / "SKILL.md").write_text("---\nname: Valid Skill\ndescription: A cool skill\n---\n# Docs")
    
    # 2. Invalid Frontend Matter Skill
    invalid_skill = skills_dir / "category2" / "skill2"
    invalid_skill.mkdir(parents=True)
    # Malformed YAML where it's missing quotes around messy characters
    (invalid_skill / "SKILL.md").write_text("---\nname: @[Invalid:\n---\n# Docs")
    
    response = client.get("/api/skills")
    assert response.status_code == 200
    data = response.json()
    
    assert data["total"] == 2
    
    names = [s["name"] for s in data["skills"]]
    assert "Valid Skill" in names
    
    # The invalid skill should fall back to using its directory name ("skill2")
    assert "skill2" in names

def test_api_cron_jobs(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    cron_dir = tmp_path / "cron"
    cron_dir.mkdir()
    cron_file = cron_dir / "jobs.json"
    cron_file.write_text('[{"schedule": "0 * * * *", "command": "clean"}]')
    
    response = client.get("/api/cron")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert len(data["jobs"]) == 1
    assert data["jobs"][0]["command"] == "clean"

def test_api_cron_jobs_not_found(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    response = client.get("/api/cron")
    assert response.status_code == 200
    data = response.json()
    # Should fallback gracefully to an empty array
    assert data["jobs"] == []

def test_api_status(tmp_path):
    os.environ["HERMES_HOME"] = str(tmp_path)
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "hermes_version" in data
    assert "hermes_home" in data
