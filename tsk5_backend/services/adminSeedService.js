const prisma = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const seedAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const adminPhone = process.env.ADMIN_PHONE || null;

  if (!adminEmail || !adminPassword) {
    console.log('[Admin Seed] Skipped — ADMIN_EMAIL or ADMIN_PASSWORD not set');
    return;
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  // Hash the password before storing
  const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingAdmin) {
    // Check if existing password is already hashed (starts with $2b$ or $2a$)
    const isAlreadyHashed = existingAdmin.password.startsWith('$2b$') || existingAdmin.password.startsWith('$2a$');
    
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        name: adminName,
        password: isAlreadyHashed ? existingAdmin.password : hashedPassword,
        phone: adminPhone,
        role: 'ADMIN',
        isSuspended: false,
      },
    });
    console.log(`[Admin Seed] Updated admin user: ${normalizedEmail}${isAlreadyHashed ? ' (password preserved)' : ' (password hashed)'}`);
    return;
  }

  await prisma.user.create({
    data: {
      name: adminName,
      email: normalizedEmail,
      password: hashedPassword,
      phone: adminPhone,
      role: 'ADMIN',
      isLoggedIn: false,
      isSuspended: false,
    },
  });

  console.log(`[Admin Seed] Created admin user: ${normalizedEmail} (bcrypt hashed)`);
};

module.exports = { seedAdminUser };
