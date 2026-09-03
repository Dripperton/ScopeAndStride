const path = require('path');
const fs = require('fs');

module.exports = ({ config }) => {
  const slug = process.env.BRAND_SLUG || 'hidden-hill-farm';

  let brand;
  try {
    const brandPath = path.join(__dirname, 'constants', 'brands', `${slug}.json`);
    brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
  } catch (e) {
    // Fallback to HHF if brand file not found
    const fallbackPath = path.join(__dirname, 'constants', 'brands', 'hidden-hill-farm.json');
    brand = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
  }

  return {
    ...config,
    name: brand.barnName,
    ios: {
      ...config.ios,
      bundleIdentifier: brand.bundleId,
    },
    extra: {
      ...config.extra,
      barnSlug: brand.slug,
      barnName: brand.barnName,
      appName: brand.appName,
      tagline: brand.tagline ?? '',
      themePrimary: brand.theme.primary,
      themeSecondary: brand.theme.secondary,
      themeSurface: brand.theme.surface,
    },
  };
};
