const { notarize } = require('@electron/notarize');

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize for macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Check if we should skip signing (unsigned build)
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
    console.log('Skipping notarization - unsigned build');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  // Check for API Key (Preferred method)
  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
    console.log(`Notarizing ${appPath} with API Key...`);
    try {
      await notarize({
        tool: 'notarytool',
        appPath: appPath,
        appleApiKey: process.env.APPLE_API_KEY,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
        appleApiIssuer: process.env.APPLE_API_ISSUER,
      });
      console.log('Notarization complete!');
      return;
    } catch (error) {
      console.error('Notarization failed:', error);
      throw error;
    }
  }

  // Fallback to Apple ID (Legacy method)
  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) {
    console.log(`Notarizing ${appPath} with Apple ID...`);
    try {
      await notarize({
        tool: 'notarytool',
        appPath: appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      });
      console.log('Notarization complete!');
      return;
    } catch (error) {
      console.error('Notarization failed:', error);
      throw error;
    }
  }

  console.log('Skipping notarization - missing credentials (APPLE_API_KEY or APPLE_ID)');
};
