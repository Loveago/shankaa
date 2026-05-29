const prisma = require('../config/db');

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const createReferralCode = async (adminUserId, maxUses = null, expiresAt = null) => {
  let code;
  let exists = true;
  
  while (exists) {
    code = generateCode();
    const found = await prisma.referralCode.findUnique({ where: { code } });
    exists = !!found;
  }
  
  return await prisma.referralCode.create({
    data: {
      code,
      isActive: true,
      maxUses,
      expiresAt,
      createdBy: adminUserId,
    },
  });
};

const validateReferralCode = async (code) => {
  const referralCode = await prisma.referralCode.findUnique({
    where: { code },
  });
  
  if (!referralCode) {
    return { valid: false, error: 'Referral code not found' };
  }
  
  if (!referralCode.isActive) {
    return { valid: false, error: 'Referral code is inactive' };
  }
  
  if (referralCode.expiresAt && new Date() > referralCode.expiresAt) {
    return { valid: false, error: 'Referral code has expired' };
  }
  
  if (referralCode.maxUses && referralCode.usedCount >= referralCode.maxUses) {
    return { valid: false, error: 'Referral code has reached maximum uses' };
  }
  
  return { valid: true, referralCode };
};

const useReferralCode = async (codeId) => {
  return await prisma.referralCode.update({
    where: { id: codeId },
    data: { usedCount: { increment: 1 } },
  });
};

const getAllReferralCodes = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const [codes, total] = await Promise.all([
    prisma.referralCode.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    }),
    prisma.referralCode.count(),
  ]);
  
  return {
    codes: codes.map(c => ({
      ...c,
      usedByCount: c._count.users,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const deactivateReferralCode = async (codeId) => {
  return await prisma.referralCode.update({
    where: { id: codeId },
    data: { isActive: false },
  });
};

module.exports = {
  createReferralCode,
  validateReferralCode,
  useReferralCode,
  getAllReferralCodes,
  deactivateReferralCode,
};
