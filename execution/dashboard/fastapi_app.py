import os
import json
import re
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import ruamel.yaml
import dotenv
import sqlite3
from typing import Optional

app = FastAPI()

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

@app.get("/")
def read_root():
    return FileResponse(str(static_dir / "index.html"))

def get_db():
    db_path = hermes_home() / "state.db"
    return sqlite3.connect(db_path)

def hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()

def redact(value: str) -> str:
    if not value:
        return ""
    if len(value) >= 4:
        return value[:4] + "****"
    return value + "****"

_agent_version_cache = None

def get_hermes_version() -> str:
    global _agent_version_cache
    if _agent_version_cache and _agent_version_cache != "vUnknown":
        return _agent_version_cache
        
    import shutil
    import subprocess
    import re
    
    hermes_bin = shutil.which("hermes") or str(Path.home() / ".local" / "bin" / "hermes")
    if Path(hermes_bin).exists() or shutil.which("hermes"):
        try:
            result = subprocess.run([hermes_bin, "--version"], capture_output=True, text=True, timeout=2)
            if result.returncode == 0:
                match = re.search(r'v\d+\.\d+\.\d+', result.stdout)
                if match:
                    _agent_version_cache = match.group(0)
                    return _agent_version_cache
        except Exception:
            pass
            
    return "vUnknown"

def read_config() -> dict:
    config_file = hermes_home() / "config.yaml"
    if not config_file.exists():
        return {}
    
    yaml = ruamel.yaml.YAML()
    with open(config_file, "r") as f:
        return yaml.load(f)

def write_config(section: str, key: str, value: str):
    config_file = hermes_home() / "config.yaml"
    yaml = ruamel.yaml.YAML()
    yaml.preserve_quotes = True
    
    if config_file.exists():
        with open(config_file, "r") as f:
            data = yaml.load(f)
    else:
        data = {}
        
    if section not in data:
        data[section] = {}
        
    data[section][key] = value
    
    with open(config_file, "w") as f:
        yaml.dump(data, f)

def read_env() -> list:
    env_file = hermes_home() / ".env"
    if not env_file.exists():
        return []
    
    KEY_PATTERN = re.compile(r'^[A-Z0-9_]+$')
    variables = []
    with open(env_file, "r") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" in stripped:
                k, v = stripped.split("=", 1)
                if not KEY_PATTERN.match(k):
                    continue
                variables.append({
                    "key": k,
                    "value": redact(v),
                    "is_set": bool(v)
                })
    return variables

def write_env(key: str, value: str):
    env_file = hermes_home() / ".env"
    if not env_file.exists():
        env_file.touch()
    dotenv.set_key(str(env_file), key, value)

@app.middleware("http")
async def verify_localhost(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and not origin.startswith("http://127.0.0.1") and not origin.startswith("http://localhost"):
        return JSONResponse(status_code=403, content={"detail": "Forbidden: localhost only"})
    response = await call_next(request)
    return response

@app.get("/api/config")
def get_config():
    return read_config()

class ConfigUpdateRequest(BaseModel):
    section: str
    key: str
    value: str

@app.put("/api/config")
def update_config(req: ConfigUpdateRequest):
    write_config(req.section, req.key, req.value)
    return {"status": "success"}

@app.get("/api/env")
def get_env():
    return {"variables": read_env()}

class EnvUpdateRequest(BaseModel):
    key: str
    value: str

@app.put("/api/env")
def update_env(req: EnvUpdateRequest):
    write_env(req.key, req.value)
    return {"status": "success"}

class ChatRequest(BaseModel):
    session_id: str
    content: str
    role: Optional[str] = "user"

@app.post("/api/chat")
def post_chat(req: ChatRequest):
    import shutil
    import subprocess
    import logging
    
    hermes_bin = shutil.which("hermes") or str(Path.home() / ".local" / "bin" / "hermes")
    if Path(hermes_bin).exists() or shutil.which("hermes"):
        try:
            cmd = [hermes_bin, "chat", "-q", req.content, "-Q", "--yolo"]
            if req.session_id and req.session_id != "sess_dash":
                cmd.extend(["--resume", req.session_id])
                
            process = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL)
            logging.info(f"Hermes process started with PID {process.pid}")
        except Exception as e:
            logging.error(f"Failed to start Hermes: {e}")
            return {"status": "error", "message": str(e)}
        return {"status": "success", "info": "CLI Triggered"}
    else:
        # Fallback for Windows unit testing where binary does not exist
        import uuid
        from datetime import datetime
        with get_db() as conn:
            cursor = conn.cursor()
            timestamp = datetime.utcnow().isoformat() + "Z"
            cursor.execute(
                "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                (req.session_id, req.role, req.content, timestamp)
            )
        return {"status": "success", "info": "Mock inserted"}

@app.get("/api/sessions")
def get_sessions(limit: int = 50, offset: int = 0):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, source, model, started_at FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?", (limit, offset))
            rows = cursor.fetchall()
            
            sessions = []
            for r in rows:
                sess_id = r[0]
                cursor.execute("SELECT COUNT(*) FROM messages WHERE session_id = ?", (sess_id,))
                msg_count = cursor.fetchone()[0]
                sessions.append({
                    "id": sess_id, 
                    "title": f"Session {sess_id[:6]}", 
                    "platform": r[1], 
                    "model": r[2], 
                    "started_at": r[3], 
                    "message_count": msg_count
                })
                
            cursor.execute("SELECT COUNT(*) FROM sessions")
            total = cursor.fetchone()[0]
        return {"sessions": sessions, "total": total, "limit": limit, "offset": offset}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"sessions": [], "total": 0, "limit": limit, "offset": offset}

@app.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role, content, timestamp, tool_name FROM messages WHERE session_id = ? ORDER BY timestamp ASC", (session_id,))
            rows = cursor.fetchall()
            messages = [
                {"role": r[0], "content": r[1], "timestamp": r[2], "tool_name": r[3]}
                for r in rows
            ]
        return {"messages": messages}
    except Exception:
        return {"messages": []}

def read_markdown(filename: str):
    file_path = hermes_home() / filename
    if not file_path.exists():
        return {"exists": False, "content": "", "char_count": 0, "file_path": str(file_path)}
    content = file_path.read_text(encoding="utf-8", errors="ignore")
    return {"exists": True, "content": content, "char_count": len(content), "file_path": str(file_path)}

@app.get("/api/memory")
def get_memory():
    return {
        "memory": read_markdown("MEMORY.md"),
        "user_profile": read_markdown("USER.md")
    }

@app.get("/api/soul")
def get_soul():
    return read_markdown("SOUL.md")

@app.get("/api/skills")
def get_skills():
    skills_dir = hermes_home() / "skills"
    skills = []
    if skills_dir.exists():
        yaml_parser = ruamel.yaml.YAML(typ='safe', pure=True)
        for skill_md in skills_dir.rglob("SKILL.md"):
            fm = {}
            try:
                content = skill_md.read_text(encoding="utf-8", errors="ignore")
                if content.startswith("---"):
                    end_idx = content.find("---", 3)
                    if end_idx != -1:
                        try:
                            fm = yaml_parser.load(content[3:end_idx]) or {}
                        except Exception:
                            fm = {"description": "Skipped invalid frontmatter"}
            except Exception:
                pass
            
            skills.append({
                "name": fm.get("name", skill_md.parent.name),
                "description": fm.get("description", ""),
                "category": skill_md.parent.parent.name if skill_md.parent.parent != skills_dir else "uncategorized",
                "path": str(skill_md)
            })
    return {"skills": skills, "total": len(skills)}

@app.get("/api/cron")
def get_cron():
    cron_file = hermes_home() / "cron" / "jobs.json"
    if cron_file.exists():
        try:
            with open(cron_file, "r", encoding="utf-8") as f:
                return {"jobs": json.load(f)}
        except Exception:
            pass
    return {"jobs": []}

@app.get("/api/status")
def get_status():
    hh = hermes_home()
    return {
        "hermes_home": str(hh),
        "hermes_version": get_hermes_version(),
        "files": {
            "config_yaml": (hh / "config.yaml").exists(),
            "env": (hh / ".env").exists(),
            "state_db": (hh / "state.db").exists(),
            "memory_md": (hh / "MEMORY.md").exists(),
            "soul_md": (hh / "SOUL.md").exists(),
            "skills_dir": (hh / "skills").exists()
        }
    }
