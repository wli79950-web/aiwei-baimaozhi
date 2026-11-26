#!/bin/bash
# mb_encode.sh subdir samples out.mp4  -> averages each group of S sub-frames into one 60fps frame
D=$1; S=$2; O=$3
if [ "$S" = "1" ]; then ffmpeg -v error -y -framerate 60 -i $D/s_%07d.png -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p $O
else ffmpeg -v error -y -framerate $((60*S)) -i $D/s_%07d.png -vf "tmix=frames=$S,select='eq(mod(n\,$S)\,$((S-1)))',setpts=N/60/TB" -r 60 -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p $O; fi
