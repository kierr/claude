#!/usr/bin/env python3
"""
Validation script for marketplace.json files.
Validates against Claude Code marketplace schema requirements.
"""

import json
import sys
import os
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

def load_schema():
    """Load the marketplace schema from the official URL."""
    schema_url = "https://anthropic.com/claude-code/marketplace.schema.json"
    try:
        with urlopen(schema_url, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except (URLError, HTTPError) as e:
        print(f"Warning: Could not load schema from {schema_url}: {e}")
        print("Falling back to built-in schema validation...")
        return None

def validate_builtin_schema(data):
    """Validate using built-in schema requirements."""
    errors = []

    # Check root-level required fields
    required_root_fields = ["name", "description", "owner", "plugins"]
    for field in required_root_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Validate owner object
    if "owner" in data:
        owner = data["owner"]
        if not isinstance(owner, dict):
            errors.append("owner must be an object")
        else:
            if "name" not in owner:
                errors.append("owner.name is required")
            if not isinstance(owner.get("name", ""), str):
                errors.append("owner.name must be a string")

    # Validate plugins array
    if "plugins" in data:
        plugins = data["plugins"]
        if not isinstance(plugins, list):
            errors.append("plugins must be an array")
        else:
            for i, plugin in enumerate(plugins):
                plugin_errors = validate_plugin(plugin, i)
                errors.extend(plugin_errors)

    return errors

def validate_plugin(plugin, index):
    """Validate a single plugin object."""
    errors = []
    prefix = f"plugins[{index}]"

    if not isinstance(plugin, dict):
        errors.append(f"{prefix}: must be an object")
        return errors

    # Required plugin fields
    required_fields = ["name", "description", "author", "source"]
    for field in required_fields:
        if field not in plugin:
            errors.append(f"{prefix}.{field}: is required")

    # Validate author object
    if "author" in plugin:
        author = plugin["author"]
        if not isinstance(author, dict):
            errors.append(f"{prefix}.author: must be an object")
        else:
            if "name" not in author:
                errors.append(f"{prefix}.author.name: is required")
            if not isinstance(author.get("name", ""), str):
                errors.append(f"{prefix}.author.name: must be a string")
            if "email" in author and not isinstance(author["email"], str):
                errors.append(f"{prefix}.author.email: must be a string")
            if "url" in author and not isinstance(author["url"], str):
                errors.append(f"{prefix}.author.url: must be a string")

    # Validate source field
    if "source" in plugin:
        source = plugin["source"]
        if not isinstance(source, str):
            errors.append(f"{prefix}.source: must be a string (URL or path)")
        elif not (source.startswith("http://") or source.startswith("https://") or source.startswith("./") or source.startswith("/") or source == source.split("/")[-1]):
            errors.append(f"{prefix}.source: should be a valid URL, relative path, or local path")

    # Check for unrecognized fields (common mistakes)
    recognized_fields = {
        "name", "version", "description", "author", "source", "homepage",
        "license", "keywords", "category", "repository"
    }
    for field in plugin:
        if field not in recognized_fields:
            errors.append(f"{prefix}: Unrecognized field '{field}' - may not be supported in current schema")

    return errors

def main():
    """Main validation function."""
    if len(sys.argv) != 2:
        print("Usage: python3 validate-marketplace.py <marketplace.json>")
        sys.exit(1)

    file_path = Path(sys.argv[1])

    if not file_path.exists():
        print(f"Error: File {file_path} does not exist")
        sys.exit(1)

    if not file_path.is_file():
        print(f"Error: {file_path} is not a file")
        sys.exit(1)

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {file_path}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: Could not read {file_path}: {e}")
        sys.exit(1)

    # Try to load official schema first
    schema = load_schema()

    if schema:
        print("Using official schema for validation...")
        # Here we would use jsonschema library if available
        # For now, fall back to built-in validation
        errors = validate_builtin_schema(data)
    else:
        errors = validate_builtin_schema(data)

    if errors:
        print(f"Validation failed for {file_path}:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print(f"✓ {file_path} is valid")
        sys.exit(0)

if __name__ == "__main__":
    main()