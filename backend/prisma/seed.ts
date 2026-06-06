import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: `Rol ${name}` },
      }),
    ),
  );

  const adminRole = roles.find((role) => role.name === 'ADMIN');
  if (!adminRole) throw new Error('No se pudo crear el rol ADMIN');

  const passwordHash = await bcrypt.hash('Admin123*', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      roleId: adminRole.id,
      username: 'admin',
      email: 'admin@taller.local',
      fullName: 'Administrador del sistema',
      passwordHash,
    },
  });

  await prisma.shopSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName:
        'Plataforma Digital de Gestion Operativa para el Fortalecimiento del Control Administrativo en Talleres Electronicos',
      slogan: 'Control operativo, trazabilidad y servicio al cliente',
      phone: '0000-0000',
      whatsapp: '0000-0000',
      address: 'Retalhuleu, Guatemala',
      contactEmail: 'contacto@taller.local',
      termsText:
        'El cliente declara que los datos del equipo y accesorios entregados son correctos. La entrega requiere codigo de orden o autorizacion expresa.',
      privacyText:
        'La informacion del cliente se usa solo para gestionar reparaciones, garantias y comunicaciones del servicio.',
      updatedById: admin.id,
    },
  });

  const baseClients = [
    { firstName: 'Eddy Gerardo', lastName: 'Cuyuch', phone: '+502 4928 0961' },
    { firstName: 'Josue David', lastName: 'Sanchez', phone: '+502 4221 4924' },
    { firstName: 'Obady', lastName: 'Perez', phone: '+502 3249 9143' },
    { firstName: 'Zaqueo', lastName: 'Chivalan', phone: '+502 4487 9588' },
  ];

  for (const client of baseClients) {
    const existing = await prisma.client.findFirst({ where: { phone: client.phone } });
    if (existing) {
      await prisma.client.update({
        where: { id: existing.id },
        data: { ...client, isActive: true },
      });
    } else {
      await prisma.client.create({ data: client });
    }
  }

  const celular = await prisma.equipmentType.upsert({
    where: { name: 'Celular' },
    update: { serviceLine: 'TELEFONIA', requiresCredential: true, allowsUnlockCase: true },
    create: { name: 'Celular', serviceLine: 'TELEFONIA', requiresCredential: true, allowsUnlockCase: true },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Telefono Android' },
    update: { serviceLine: 'TELEFONIA', requiresCredential: true, allowsUnlockCase: true },
    create: { name: 'Telefono Android', serviceLine: 'TELEFONIA', requiresCredential: true, allowsUnlockCase: true },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'iPhone' },
    update: { serviceLine: 'TELEFONIA', requiresCredential: true, allowsUnlockCase: true },
    create: { name: 'iPhone', serviceLine: 'TELEFONIA', requiresCredential: true, allowsUnlockCase: true },
  });
  const laptop = await prisma.equipmentType.upsert({
    where: { name: 'Laptop' },
    update: { serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: true, allowsUnlockCase: false },
    create: { name: 'Laptop', serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: true, allowsUnlockCase: false },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Computadora de escritorio' },
    update: { serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: true, allowsUnlockCase: false },
    create: { name: 'Computadora de escritorio', serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: true, allowsUnlockCase: false },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Impresora' },
    update: { serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Impresora', serviceLine: 'EQUIPOS_DE_COMPUTO' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Teclado' },
    update: { serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Teclado', serviceLine: 'EQUIPOS_DE_COMPUTO' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Mouse' },
    update: { serviceLine: 'EQUIPOS_DE_COMPUTO', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Mouse', serviceLine: 'EQUIPOS_DE_COMPUTO' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Televisor' },
    update: { serviceLine: 'EQUIPOS_GENERALES', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Televisor', serviceLine: 'EQUIPOS_GENERALES' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Equipo de sonido' },
    update: { serviceLine: 'EQUIPOS_GENERALES', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Equipo de sonido', serviceLine: 'EQUIPOS_GENERALES' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Plancha' },
    update: { serviceLine: 'EQUIPOS_GENERALES', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Plancha', serviceLine: 'EQUIPOS_GENERALES' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Licuadora' },
    update: { serviceLine: 'EQUIPOS_GENERALES', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'Licuadora', serviceLine: 'EQUIPOS_GENERALES' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'DVD' },
    update: { serviceLine: 'EQUIPOS_GENERALES', requiresCredential: false, allowsUnlockCase: false },
    create: { name: 'DVD', serviceLine: 'EQUIPOS_GENERALES' },
  });

  const hardware = await prisma.faultCategory.upsert({
    where: { name: 'HARDWARE' },
    update: {},
    create: { name: 'HARDWARE', description: 'Fallas fisicas o electronicas' },
  });
  const software = await prisma.faultCategory.upsert({
    where: { name: 'SOFTWARE' },
    update: {},
    create: { name: 'SOFTWARE', description: 'Sistema operativo, virus o configuracion' },
  });

  await prisma.faultType.createMany({
    data: [
      { categoryId: hardware.id, equipmentTypeId: celular.id, name: 'Pantalla rota', requiresCredential: true },
      { categoryId: hardware.id, equipmentTypeId: celular.id, name: 'No carga', requiresCredential: false },
      { categoryId: software.id, equipmentTypeId: celular.id, name: 'Bloqueo o lentitud', requiresCredential: true },
      { categoryId: hardware.id, equipmentTypeId: laptop.id, name: 'No enciende', requiresCredential: false },
    ],
    skipDuplicates: true,
  });

  const recepcionRole = roles.find((role) => role.name === 'RECEPCIONISTA');
  const tecnicoRole = roles.find((role) => role.name === 'TECNICO');
  if (recepcionRole && tecnicoRole) {
    await prisma.user.upsert({
      where: { username: 'recepcion' },
      update: {},
      create: {
        roleId: recepcionRole.id,
        username: 'recepcion',
        email: 'recepcion@taller.local',
        fullName: 'Recepcion del taller',
        passwordHash,
      },
    });
    const techUser = await prisma.user.upsert({
      where: { username: 'tecnico' },
      update: {},
      create: {
        roleId: tecnicoRole.id,
        username: 'tecnico',
        email: 'tecnico@taller.local',
        fullName: 'Tecnico principal',
        passwordHash,
      },
    });
    await prisma.technician.upsert({
      where: { code: 'TEC-001' },
      update: {},
      create: {
        userId: techUser.id,
        code: 'TEC-001',
        firstName: 'Tecnico',
        lastName: 'Principal',
        specialty: 'Electronica general',
      },
    });
  }

  console.log('Seed completado. Usuario inicial: admin / Admin123*');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
