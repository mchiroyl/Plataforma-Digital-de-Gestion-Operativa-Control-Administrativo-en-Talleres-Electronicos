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

  const celular = await prisma.equipmentType.upsert({
    where: { name: 'Celular' },
    update: {},
    create: { name: 'Celular' },
  });
  const laptop = await prisma.equipmentType.upsert({
    where: { name: 'Laptop' },
    update: {},
    create: { name: 'Laptop' },
  });
  await prisma.equipmentType.upsert({
    where: { name: 'Televisor' },
    update: {},
    create: { name: 'Televisor' },
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
