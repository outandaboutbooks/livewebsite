#!/bin/bash
# Double-click to open the website editor on this computer.
# Close this window (or press Ctrl+C) when you've finished.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed. Get it from nodejs.org, then try again."
  read -r -p "Press Enter to close."
  exit 1
fi
(sleep 2; open "http://localhost:3001") &
node editor/server.mjs
read -r -p "The editor has stopped. Press Enter to close."
