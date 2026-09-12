# Android 调试签名：固定项目根目录的 debug.keystore

本项目的 Android 工程（`android/`）是 Expo（CNG，SDK 57）**生成目录**，已被 `.gitignore` 忽略。每次执行 `expo prebuild` / `expo run:android` 都会重新生成，默认的调试签名文件也随之变化，导致：

- 已安装的旧 debug 包签名不一致，覆盖安装失败（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`）；
- 团队成员 / CI 各自生成不同的调试签名，互相无法覆盖安装。

解决办法：在**项目根目录**固定一份 `debug.keystore`，再由 [plugins/withAndroidDebugKeystore.js](../plugins/withAndroidDebugKeystore.js) 在每次 prebuild 时自动拷贝到生成的 Android 工程中，保证调试签名稳定、人人一致。

## 1. 生成 debug.keystore（项目根目录）

在项目根目录执行（需已安装 JDK，`keytool` 随 JDK 提供）：

```bash
keytool -genkeypair -v \
  -keystore debug.keystore \
  -alias androiddebugkey \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass android \
  -keypass android \
  -dname "CN=Android Debug,O=Android,C=US"
```

生成后项目根目录出现 `debug.keystore`。

> 参数说明：alias、storepass/keypass 必须分别固定为 `androiddebugkey` / `android`，与 Expo 生成工程中 `android/app/build.gradle` 的 debug `signingConfig` 一致，否则打包/安装会因签名不匹配而失败。

## 2. 拷贝脚本（已注册）

[plugins/withAndroidDebugKeystore.js](../plugins/withAndroidDebugKeystore.js) 是一个 Expo config plugin，已通过 `app.json` 注册：

```json
"plugins": [
  "./plugins/withAndroidDebugKeystore.js"
]
```

它使用 `withDangerousMod` 在每次 **prebuild / sync（`expo run:android`、`expo prebuild`）** 时执行一次：

| 路径                                      | 说明                                        |
| ----------------------------------------- | ------------------------------------------- |
| 源：`<项目根>/debug.keystore`             | 步骤 1 生成、需提交到仓库的文件             |
| 目标：`<android 工程>/app/debug.keystore` | 生成的 Android 工程，debug 构建从此读取签名 |

即把“工程根目录的固定签名”同步到“每次重新生成的 android/app/debug.keystore”。控制台会输出 `[withAndroidDebugKeystore] Copied: ...` 日志。

## 3. 使用

```bash
npx expo run:android   # 或 npx expo prebuild --platform android
```

每次重新生成 Android 工程后，`android/app/debug.keystore` 都会与根目录保持一致。

## 4. 验证

```bash
# 查看根目录 keystore 指纹
keytool -list -v -keystore debug.keystore -storepass android | grep -A1 "SHA1:"

# 与生成工程中的指纹比对，应完全一致
keytool -list -v -keystore android/app/debug.keystore -storepass android | grep -A1 "SHA1:"
```

## 注意事项

- `debug.keystore` 的密码是公开约定的（`android`），**只用于 debug 构建，不是秘密**。请将它**提交到仓库**（当前 `.gitignore` 未忽略它），这样团队和 CI 才能共用同一份签名。
- 切换签名后，首次覆盖安装可能需要先卸载手机上旧的 debug 包。
- release 签名与 debug 签名相互独立，本方案不涉及 release（请另行按 Expo 官方文档配置 `android.keystore`）。
- 若想查看当前本机默认调试签名，可用 `~/.android/debug.keystore`，但建议统一使用本方案以保持一致。
