const prisma = require('../config/db');

const SETTINGS_KEYS = {
  PAYSTACK_SECRET: 'paystack_secret_key',
  MOMO_NUMBER: 'momo_number',
  MOMO_NAME: 'momo_name',
  REGISTRATION_ENABLED: 'registration_enabled',
  AUTO_PROCESS_ORDERS: 'auto_process_orders',
  SKANKA5_API_KEY: 'skanka5_api_key',
  SKANKA5_WEBHOOK_SECRET: 'skanka5_webhook_secret',
  MTN_EXPRESS_BUNDLE_SIZE: 'mtn_express_bundle_size',
  MTN_EXPRESS_AMOUNT: 'mtn_express_amount',
  MTN_EXPRESS_ENABLED: 'mtn_express_enabled'
};

const getAllSettings = async () => {
  const rows = await prisma.appSetting.findMany();
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
};

const getSettingValue = async (key, fallback = null) => {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
};

const upsertSettings = async (updates = {}) => {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return {};

  const results = {};
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of entries) {
      const row = await tx.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });
      results[key] = row.value;
    }
  });
  return results;
};

module.exports = {
  SETTINGS_KEYS,
  getAllSettings,
  getSettingValue,
  upsertSettings
};
