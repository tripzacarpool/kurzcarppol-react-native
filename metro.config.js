const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure resolver to handle socket.io-client Node.js imports
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect Node.js-specific engine.io-client imports to web versions
  if (moduleName.endsWith('.node.js')) {
    const webModule = moduleName.replace(/\.node\.js$/, '.js');
    try {
      return context.resolveRequest(context, webModule, platform);
    } catch (e) {
      // If web version doesn't exist, return empty module
      return {
        type: 'empty',
      };
    }
  }

  // Use default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
