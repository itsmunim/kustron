#!/bin/sh
# Pretend the developer just edited the source: bump the version string.
sed -i '' "s/'v1'/'v2'/" server.js
echo "edited server.js ->"
grep 'const VERSION' server.js
