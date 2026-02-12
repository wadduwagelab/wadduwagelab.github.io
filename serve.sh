#!/bin/bash
# Jekyll serve script that avoids inotify issues
# Run without file watching to prevent inotify max watches exceeded error

echo "Starting Jekyll server without file watching..."
echo "Note: You'll need to manually refresh the browser after making changes."
echo "Or press Ctrl+C and restart the server to see changes."
echo ""
bundle exec jekyll serve --no-watch
