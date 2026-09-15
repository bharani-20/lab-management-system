'use strict';

/**
 * Prisma Seed Script
 * ===================
 * Idempotent: safe to run multiple times.
 * Creates default users and all 64 lab systems.
 *
 * DEFAULT CREDENTIALS:
 *   admin    / admin@123
 *   faculty  / faculty@123
 *   staff    / staff@123
 *
 * Run with: node prisma/seed.js
 * Or:       npm run db:seed
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// ─── Seed Users ───────────────────────────────────────────────────────────────

const SEED_USERS = [
  {
    username: 'admin',
    password: 'admin@123',
    name: 'Administrator',
    role: 'ADMIN',
  },
  {
    username: 'faculty',
    password: 'faculty@123',
    name: 'Faculty User',
    role: 'FACULTY',
  },
  {
    username: 'staff',
    password: 'staff@123',
    name: 'Non-Teaching Staff',
    role: 'NON_TEACHING_STAFF',
  },
];

// ─── Seed Systems (PC-01 to PC-64) ───────────────────────────────────────────

function generateSystems() {
  const systems = [];
  for (let i = 1; i <= 64; i++) {
    const num = String(i).padStart(2, '0');
    systems.push({
      systemCode: `PC-${num}`,
      hostname: `LAB-PC-${num}`,
      ipAddress: null,
      status: 'AVAILABLE',
    });
  }
  return systems;
}

// ─── Main Seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('Creating seed users...');
  let usersCreated = 0;
  let usersSkipped = 0;

  for (const userData of SEED_USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: userData.username },
    });

    if (existing) {
      console.log(`  ⏭  Skipped user: ${userData.username} (already exists)`);
      usersSkipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);
    await prisma.user.create({
      data: {
        username: userData.username,
        passwordHash,
        name: userData.name,
        role: userData.role,
        isActive: true,
      },
    });

    console.log(`  ✅ Created user: ${userData.username} (${userData.role})`);
    usersCreated++;
  }

  // ── Systems ────────────────────────────────────────────────────────────────
  console.log('\nCreating lab systems (PC-01 to PC-64)...');
  const systems = generateSystems();
  let systemsCreated = 0;
  let systemsSkipped = 0;

  for (const system of systems) {
    const existing = await prisma.system.findUnique({
      where: { systemCode: system.systemCode },
    });

    if (existing) {
      systemsSkipped++;
      continue;
    }

    await prisma.system.create({ data: system });
    systemsCreated++;
  }

  if (systemsCreated > 0) {
    console.log(`  ✅ Created ${systemsCreated} systems`);
  }
  if (systemsSkipped > 0) {
    console.log(`  ⏭  Skipped ${systemsSkipped} systems (already exist)`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('✅ Seed completed successfully!');
  console.log(`   Users created: ${usersCreated} | skipped: ${usersSkipped}`);
  console.log(`   Systems created: ${systemsCreated} | skipped: ${systemsSkipped}`);
  console.log('\n📋 Default credentials:');
  console.log('   admin    → admin@123');
  console.log('   faculty  → faculty@123');
  console.log('   staff    → staff@123');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
