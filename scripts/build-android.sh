#!/bin/bash

set +e
. ~/.bashrc
set -e

# 脚本位于 scripts/ 下,项目根是它的上一级
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "build android"



# 在项目根执行 nvm use,读取根目录的 .nvmrc
cd "$PROJECT_ROOT"
nvm use

cd "$PROJECT_ROOT/android"
"$PROJECT_ROOT/android/gradlew" app:assembleRelease

mv "$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk" \
   "$PROJECT_ROOT/android/app/build/outputs/apk/release/com.zhxlp.LearningTools.apk"

echo "$PROJECT_ROOT/android/app/build/outputs/apk/release/com.zhxlp.LearningTools.apk"
echo "build android done"
exit 0