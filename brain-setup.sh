#!/bin/bash
# brain-setup.sh — Level 7 Digital Brain Setup Script
# Usage: ./brain-setup.sh
# This script echoes the brain structure, reads CLAUDE.md for context,
# lists the most recently modified files, and shows the MOC master.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "=========================================="
echo " Level 7 Digital Brain — Setup Overview"
echo "=========================================="
echo ""

# 1. Echo the file structure
echo "--- Brain Structure ---"
echo ""
find "$SCRIPT_DIR" -maxdepth 2 -type f -name "*.md" | sort | while read -r f; do
    rel="${f#$SCRIPT_DIR/}"
    lines=$(wc -l < "$f")
    printf "  %-40s %s lines\n" "$rel" "$lines"
done
echo ""
echo "Total files: $(find "$SCRIPT_DIR" -maxdepth 2 -type f -name '*.md' | wc -l)"
echo ""

# 2. Read CLAUDE.md for context
echo "--- CLAUDE.md (Layer 1: Strategy) ---"
echo ""
if [ -f "$SCRIPT_DIR/CLAUDE.md" ]; then
    head -5 "$SCRIPT_DIR/CLAUDE.md"
    echo "  ..."
    echo "  (full CLAUDE.md available at $SCRIPT_DIR/CLAUDE.md)"
else
    echo "  [WARNING: CLAUDE.md not found]"
fi
echo ""

# 3. Show most recently modified files
echo "--- Most Recently Modified Files ---"
echo ""
find "$SCRIPT_DIR" -maxdepth 2 -type f -name "*.md" -printf '%T@ %p\n' | sort -rn | head -8 | while read -r ts path; do
    rel="${path#$SCRIPT_DIR/}"
    mod_time=$(date -d "@$ts" "+%Y-%m-%d %H:%M" 2>/dev/null || date -r "$ts" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
    printf "  %s  %s\n" "$mod_time" "$rel"
done
echo ""

# 4. Show MOC master overview
echo "--- MOC Master (Navigation Hub) ---"
echo ""
if [ -f "$SCRIPT_DIR/00-MOC-MASTER.md" ]; then
    grep -E '\[\[.*MOC' "$SCRIPT_DIR/00-MOC-MASTER.md" 2>/dev/null | head -10 || echo "  (no MOC links found in 00-MOC-MASTER.md)"
else
    echo "  [WARNING: 00-MOC-MASTER.md not found]"
fi
echo ""

echo "=========================================="
echo " Brain is ready. Start at 00-MOC-MASTER.md"
echo "=========================================="