#!/bin/bash
# Double-click launcher (used by the Desktop app "Emily阅读.app").
# If the reader is not running yet, start it in the background; then open it in the default browser.
# Safe to run many times: it never starts a second copy.
#   EMILY_READER_NO_OPEN=1  start/check only, don't open the browser (used by tests)
set -u
PORT=8766
URL="http://localhost:$PORT"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/emily-reader.log"
# apps started from Finder get a bare PATH; node lives in ~/.local/bin on this Mac
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

running() { curl -s -o /dev/null --max-time 1 "$URL/"; }

fail() {
  osascript -e "display alert \"Emily阅读 没能打开\" message \"$1\"" >/dev/null 2>&1 || echo "$1" >&2
  exit 1
}

if ! running; then
  command -v node >/dev/null || fail "找不到 Node（运行阅读器需要它）。"
  [ -d "$DIR/node_modules" ] || fail "项目还没装好依赖。请在终端运行：cd \"$DIR\" && npm install"
  mkdir -p "$(dirname "$LOG")"
  cd "$DIR" || fail "找不到项目文件夹：$DIR"
  # nohup + background: the reader keeps running after this script (and the app) exit
  echo "--- $(date '+%F %T') starting" >>"$LOG"
  nohup node node_modules/vite/bin/vite.js >>"$LOG" 2>&1 &
  for _ in $(seq 1 100); do running && break; sleep 0.1; done
  running || fail "启动超时。记录在：$LOG"
fi

[ "${EMILY_READER_NO_OPEN:-}" = 1 ] || open "$URL"
