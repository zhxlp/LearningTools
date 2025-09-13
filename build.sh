#!/bin/bash
set -e

# 获取脚本所在位置变量记录并切换到这个目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

. ~/.bashrc


if [[ "$1" == "android" ]];then
  echo "build android"
  cd "$SCRIPT_DIR"
  nvm use
  npx expo prebuild -p android
  cp -f "$SCRIPT_DIR/debug.keystore" "$SCRIPT_DIR/android/app/debug.keystore"
  cd "$SCRIPT_DIR/android"
  "$SCRIPT_DIR/android/gradlew" app:assembleRelease
  mv "$SCRIPT_DIR/android/app/build/outputs/apk/release/app-release.apk" "$SCRIPT_DIR/android/app/build/outputs/apk/release/com.zhxlp.LearningTools.apk"
  echo "$SCRIPT_DIR/android/app/build/outputs/apk/release/com.zhxlp.LearningTools.apk"
  echo build android done
  exit 0
fi

echo "参数错误"
exit 0