const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.maxWorkers = Number(process.env.METRO_MAX_WORKERS || 2);
config.resolver.blockList = [
  /[/\\]\.brave-webtest-profile[/\\].*/,
  /[/\\]\.tripza-services[/\\].*/,
  /[/\\]\.local-infra[/\\].*/,
  /[/\\]backend[/\\]services[/\\]matching-service[/\\]\.venv[/\\].*/,
];

// Configure resolver to handle socket.io-client Node.js imports
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'call-bind/callBound') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('call-bind/callBound'),
    };
  }

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
