#!/bin/bash
# Double-click to build the website and open a preview in your browser.
# Close this window (or press Ctrl+C) to stop the preview.
cd "$(dirname "$0")" || exit 1
echo "Building the Out and About Books website..."
if ! node build.mjs; then
  echo
  echo "The build didn't work. Read the message above for the reason."
  read -r -p "Press Enter to close."
  exit 1
fi
echo
echo "Starting the preview at http://localhost:3000 ..."
echo "To stop it, close this window or press Ctrl+C."
(sleep 3; open "http://localhost:3000") &
npx -y serve _site -l 3000
