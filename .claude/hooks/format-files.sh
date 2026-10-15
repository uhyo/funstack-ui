#!/bin/bash
# Format files with oxfmt after write/edit

file_path=$(jq -r '.tool_input.file_path' 2>/dev/null)

if [ -z "$file_path" ] || [ "$file_path" = "null" ]; then
  exit 0
fi

# Run oxfmt from the project root, suppress errors, always exit 0
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
pnpm exec oxfmt "$file_path" >/dev/null 2>&1 || true
