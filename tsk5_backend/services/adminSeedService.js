const prisma = require('../config/db');

const seedAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const adminPhone = process.env.ADMIN_PHONE || null;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  const existingAdmin = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        name: adminName,
        password: adminPassword,
        phone: adminPhone,
        role: 'ADMIN',
        isSuspended: false,
      },
    });
    console.log(`[Admin Seed] Updated admin user: ${normalizedEmail}`);
    return;
  }

  await prisma.user.create({
    data: {
      name: adminName,
      email: normalizedEmail,
      password: adminPassword,
      phone: adminPhone,
      role: 'ADMIN',
      isLoggedIn: false,
      isSuspended: false,
    },
  });

  console.log(`[Admin Seed] Created admin user: ${normalizedEmail}`);
};

module.exports = { seedAdminUser };
