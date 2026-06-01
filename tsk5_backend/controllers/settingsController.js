const settingsService = require('../services/settingsService');

// GET /api/settings (admin)
const getSettings = async (_req, res) => {
  try {
    const [momoNumber, momoName, paystackSecret, registrationEnabled] = await Promise.all([
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MOMO_NUMBER, ''),
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MOMO_NAME, ''),
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.PAYSTACK_SECRET, null),
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.REGISTRATION_ENABLED, 'true')
    ]);

    res.json({
      success: true,
      settings: {
        momoNumber,
        momoName,
        hasPaystackSecret: Boolean(paystackSecret),
        registrationEnabled: registrationEnabled === 'true'
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

// GET /api/settings/public (no auth) — only non-sensitive fields
const getPublicSettings = async (_req, res) => {
  try {
    const [momoNumber, momoName] = await Promise.all([
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MOMO_NUMBER, ''),
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MOMO_NAME, '')
    ]);

    res.json({ success: true, settings: { momoNumber, momoName } });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

// PUT /api/settings (admin)
const updateSettings = async (req, res) => {
  try {
    const { momoNumber, momoName, paystackSecretKey, registrationEnabled } = req.body;
    const updates = {
      [settingsService.SETTINGS_KEYS.MOMO_NUMBER]: momoNumber,
      [settingsService.SETTINGS_KEYS.MOMO_NAME]: momoName,
      [settingsService.SETTINGS_KEYS.PAYSTACK_SECRET]: paystackSecretKey?.trim() ? paystackSecretKey.trim() : undefined,
      [settingsService.SETTINGS_KEYS.REGISTRATION_ENABLED]: registrationEnabled !== undefined ? String(registrationEnabled) : undefined
    };
    const saved = await settingsService.upsertSettings(updates);

    res.json({
      success: true,
      settings: {
        momoNumber: saved[settingsService.SETTINGS_KEYS.MOMO_NUMBER] ?? momoNumber ?? '',
        momoName: saved[settingsService.SETTINGS_KEYS.MOMO_NAME] ?? momoName ?? '',
        hasPaystackSecret: Boolean(saved[settingsService.SETTINGS_KEYS.PAYSTACK_SECRET]) || Boolean(paystackSecretKey),
        registrationEnabled: saved[settingsService.SETTINGS_KEYS.REGISTRATION_ENABLED] === 'true'
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

module.exports = {
  getSettings,
  getPublicSettings,
  updateSettings
};
