const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withAndroidDebugKeystore = (config, props) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const src = path.resolve(config.modRequest.projectRoot, "debug.keystore");
      const dest = path.join(projectRoot, "app", "debug.keystore");
      fs.copyFileSync(src, dest);
      console.log(`[withAndroidDebugKeystore] Copied: ${src} -> ${dest}`);
      return config;
    },
  ]);
};

exports.default = withAndroidDebugKeystore;
