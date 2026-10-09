const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow a pre-populated SQLite database to be bundled as a static asset.
if (!config.resolver.assetExts.includes("db")) {
  config.resolver.assetExts.push("db");
}

module.exports = config;
