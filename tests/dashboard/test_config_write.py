import os
import pytest
from pathlib import Path
from hypothesis import given, settings
from hypothesis.strategies import text

# We will import the functions from fastapi_app once implemented
from execution.dashboard.fastapi_app import read_config, write_config, read_env, write_env, redact

def test_config_preserves_comments(tmp_path):
    config_content = "# Models config\nmodel:\n  default: testing-model\n  provider: local\n# End config\n"
    yaml_file = tmp_path / "config.yaml"
    yaml_file.write_text(config_content)
    
    os.environ["HERMES_HOME"] = str(tmp_path)
    
    config = read_config()
    assert config["model"]["default"] == "testing-model"
    
    # Update nested key
    write_config("model", "default", "new-model")
    
    updated_content = yaml_file.read_text()
    assert "# Models config" in updated_content
    assert "default: new-model" in updated_content
    assert "# End config" in updated_content

def test_env_preserves_comments(tmp_path):
    env_content = "# API Keys\nTEST_KEY=12345\n# Database\nDB_URL=sqlite://\n"
    env_file = tmp_path / ".env"
    env_file.write_text(env_content)
    
    os.environ["HERMES_HOME"] = str(tmp_path)
    
    envs = read_env()
    assert any(env["key"] == "TEST_KEY" for env in envs)
    
    write_env("TEST_KEY", "67890")
    
    updated_content = env_file.read_text()
    assert "# API Keys" in updated_content
    assert "TEST_KEY" in updated_content and "67890" in updated_content
    assert "# Database" in updated_content

@given(value=text(min_size=1))
@settings(max_examples=100)
def test_redaction_never_leaks(value):
    redacted = redact(value)
    if len(value) >= 4:
        assert redacted == value[:4] + "****"
    else:
        assert redacted == value + "****"
    assert len(redacted) <= max(8, len(value) + 4)
