const settingsService = require('../services/settingsService');

// GET /api/settings (admin)
const getSettings = async (_req, res) => {
  try {
    const [momoNumber, momoName, paystackSecret] = await Promise.all([
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MOMO_NUMBER, ''),
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MOMO_NAME, ''),
      settingsService.getSettingValue(settingsService.SETTINGS_KEYS.PAYSTACK_SECRET, null)
    ]);

    res.json({
      success: true,
      settings: {
        momoNumber,
        momoName,
        hasPaystackSecret: Boolean(paystackSecret)
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
    const { momoNumber, momoName, paystackSecretKey } = req.body;
    const updates = {
      [settingsService.SETTINGS_KEYS.MOMO_NUMBER]: momoNumber,
      [settingsService.SETTINGS_KEYS.MOMO_NAME]: momoName,
      [settingsService.SETTINGS_KEYS.PAYSTACK_SECRET]: paystackSecretKey?.trim() ? paystackSecretKey.trim() : undefined
    };
    const saved = await settingsService.upsertSettings(updates);

    res.json({
      success: true,
      settings: {
        momoNumber: saved[settingsService.SETTINGS_KEYS.MOMO_NUMBER] ?? momoNumber ?? '',
        momoName: saved[settingsService.SETTINGS_KEYS.MOMO_NAME] ?? momoName ?? '',
        hasPaystackSecret: Boolean(saved[settingsService.SETTINGS_KEYS.PAYSTACK_SECRET]) || Boolean(paystackSecretKey)
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
