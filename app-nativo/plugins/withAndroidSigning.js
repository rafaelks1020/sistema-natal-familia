// Assina o build release do Android com a chave de envio lida das propriedades do Gradle
// (-PNATAL_UPLOAD_STORE_FILE=... etc.). Sem as propriedades, o release continua com a chave de debug.
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCO = `
        release {
            if (project.hasProperty('NATAL_UPLOAD_STORE_FILE')) {
                storeFile file(NATAL_UPLOAD_STORE_FILE)
                storePassword NATAL_UPLOAD_STORE_PASSWORD
                keyAlias NATAL_UPLOAD_KEY_ALIAS
                keyPassword NATAL_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('NATAL_UPLOAD_STORE_FILE')) {
      g = g.replace(/signingConfigs\s*\{/, (m) => `${m}${BLOCO}`);
      // No buildType release, troca a assinatura de debug pela release quando houver chave.
      g = g.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
        `$1signingConfig project.hasProperty('NATAL_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
      );
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
