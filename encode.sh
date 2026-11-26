#!/usr/bin/env bash
# re-encode raw/<date>_<id8>.mp4 → videos/<date>_<id8>.mp4 (H.264 CRF 25 slow, 60 fps kept, ≤4 Mbps, AAC 160k, faststart)
FF=/c/Users/monkh/devter-remotion/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe
cd /c/Users/monkh/gabriel-reels
mkdir -p videos
for f in raw/*.mp4; do
  o=videos/$(basename "$f")
  [ -s "$o" ] && continue
  "$FF" -v error -y -i "$f" -c:v libx264 -preset slow -crf 25 -maxrate 4000k -bufsize 8000k -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$o.tmp.mp4" && mv "$o.tmp.mp4" "$o"
  echo "$(basename "$f") $(stat -c %s "$o" | awk '{printf "%.1f", $1/1e6}')MB"
done
echo ENCODE-DONE
