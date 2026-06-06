import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, OrderStatus, RoleName, PaymentMethod, EvidenceType, ServiceLine } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import type { AuthUser } from '../../../shared/presentation/http/auth-request.type';
import { normalizeInput, normalizePlainText } from '../../../shared/utils/text-normalizer';
import { buildQuoteDecisionHistory, quoteDecisionFinalStatus } from './quote-decision-flow';

const PROJECT_TITLE = 'Plataforma Digital de Gestion Operativa para el Fortalecimiento del Control Administrativo en Talleres Electronicos';
const LOGO_URL = '/api/public/settings/logo';

function token(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

type OrderExportFilters = {
  status?: string;
  client?: string;
  from?: string;
  to?: string;
};

type GeneratedFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

type DashboardFilters = {
  period?: string;
  from?: string;
  to?: string;
};

/** Devuelve el símbolo de moneda a partir del código ISO configurado.
 * GTQ (Quetzal guatemalteco) → 'Q'.
 * Otros códigos se usan tal cual (USD, EUR, etc.).
 */
function currencySymbol(currency?: string | null) {
  if (!currency || currency === 'GTQ') return 'Q';
  return currency.trim();
}

/** Formatea un valor monetario usando el símbolo de la configuración del taller. */
function moneyWith(settings: { currency?: string | null } | null | undefined) {
  const sym = currencySymbol(settings?.currency);
  return (value: unknown) => `${sym} ${Number(value ?? 0).toFixed(2)}`;
}

function dateLabel(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString('es-GT') : 'N/A';
}

@Injectable()
export class CoreService {
  constructor(private readonly prisma: PrismaService) {}

  async settings() {
    const settings = await this.fullSettings();
    return this.safeSettings(settings);
  }

  updateSettings(data: Record<string, unknown>) {
    const text = (value: unknown) => typeof value === 'string' ? value : undefined;
    const nullableText = (value: unknown) => typeof value === 'string' ? value : value === null ? null : undefined;
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    const allowed: Prisma.ShopSettingsUncheckedUpdateInput = {
      shopName: text(data.shopName),
      slogan: nullableText(data.slogan),
      phone: text(data.phone),
      whatsapp: text(data.whatsapp),
      address: nullableText(data.address),
      contactEmail: nullableText(data.contactEmail),
      defaultWarrantyDays: number(data.defaultWarrantyDays),
      termsText: nullableText(data.termsText),
      privacyText: nullableText(data.privacyText),
      currency: text(data.currency),
      ticketFormat: text(data.ticketFormat),
      updatedById: number(data.updatedById),
    };
    return this.prisma.shopSettings.update({ where: { id: 1 }, data: allowed }).then((settings) => this.safeSettings(settings));
  }

  async publicSettings() {
    const settings = await this.fullSettings();
    return this.safeSettings(settings);
  }

  async logo() {
    const settings = await this.fullSettings();
    if (!settings?.logoData || !settings.logoMimeType) return null;
    return {
      buffer: Buffer.from(settings.logoData),
      contentType: settings.logoMimeType,
      filename: settings.logoFileName ?? 'logo-taller',
      updatedAt: settings.logoUpdatedAt,
    };
  }

  async updateLogo(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Seleccione un logotipo');
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      throw new BadRequestException('El logotipo debe ser PNG o JPG');
    }
    const settings = await this.prisma.shopSettings.update({
      where: { id: 1 },
      data: {
        logoData: file.buffer as any,
        logoMimeType: file.mimetype,
        logoFileName: file.originalname,
        logoUrl: LOGO_URL,
        logoUpdatedAt: new Date(),
      },
    });
    return this.safeSettings(settings);
  }

  async dashboard(user: AuthUser, filters: DashboardFilters = {}) {
    const period = this.dashboardPeriod(filters);
    const createdAt = { gte: period.from, lte: period.to };
    const role = user.role;
    const orderWhere = role === 'TECNICO' ? { technician: { userId: user.sub }, createdAt } : { createdAt };
    
    // ordersByStatus must show active orders + orders in the selected period
    const activeStatusOrPeriodCreated = {
      OR: [
        {
          status: {
            notIn: [
              'FINALIZADO' as const,
              'PRESUPUESTO_RECHAZADO' as const,
              'DEVUELTO_SIN_REPARAR' as const,
            ],
          },
        },
        {
          createdAt,
        },
      ],
    };
    const orderStatusWhere = role === 'TECNICO'
      ? { technician: { userId: user.sub }, ...activeStatusOrPeriodCreated }
      : activeStatusOrPeriodCreated;

    const salesWhere = { createdAt };
    const movementWhere = { createdAt };
    const expenseWhere = { isActive: true, spentAt: { gte: period.from, lte: period.to } };
    const paymentWhere = { createdAt, paymentType: 'PAGO' as const };

    const [
      ordersByStatus,
      clients,
      technicians,
      parts,
      payments,
      sales,
      expenses,
      inventoryMovements,
      ordersInPeriod,
    ] = await Promise.all([
      this.prisma.repairOrder.groupBy({ by: ['status'], where: orderStatusWhere, _count: { id: true } }),
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.technician.count({ where: { isActive: true } }),
      this.prisma.sparePart.findMany({ where: { isActive: true }, select: { id: true, internalCode: true, name: true, category: true, purchasePrice: true, publicSalePrice: true, currentStock: true, minimumStock: true } }),
      this.prisma.payment.findMany({ where: paymentWhere, select: { amount: true, createdAt: true } }),
      this.prisma.inventorySale.findMany({
        where: salesWhere,
        select: {
          totalAmount: true,
          createdAt: true,
          items: { select: { quantity: true, subtotal: true, sparePart: { select: { name: true, category: true, purchasePrice: true } } } },
        },
      }),
      role === 'ADMIN'
        ? this.prisma.expense.findMany({ where: expenseWhere, select: { amount: true, category: true, spentAt: true } })
        : Promise.resolve([] as { amount: Prisma.Decimal; category: string; spentAt: Date }[]),
      this.prisma.inventoryMovement.findMany({
        where: { ...movementWhere, movementType: { in: ['SALIDA_VENTA', 'SALIDA_ORDEN'] } },
        select: { movementType: true, quantity: true, unitPrice: true, createdAt: true, sparePart: { select: { purchasePrice: true, category: true, name: true } } },
      }),
      this.prisma.repairOrder.findMany({
        where: orderWhere,
        select: {
          id: true,
          status: true,
          createdAt: true,
          totalCost: true,
          quoteApproved: true,
          intakeDate: true,
          actualDeliveryDate: true,
          equipment: {
            select: {
              brand: true,
              equipmentType: {
                select: {
                  name: true,
                  serviceLine: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const orderPaymentsRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const inventorySalesRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const inventoryInvestment = parts.reduce((sum, part) => sum + part.currentStock * Number(part.purchasePrice ?? 0), 0);
    const inventoryPotentialSaleValue = parts.reduce((sum, part) => sum + part.currentStock * Number(part.publicSalePrice ?? 0), 0);
    const lowStockItems = parts.filter((part) => part.currentStock <= part.minimumStock);
    const inventorySalesCost = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity * Number(item.sparePart.purchasePrice ?? 0), 0),
      0,
    );
    const orderSparePartsCost = inventoryMovements
      .filter((movement) => movement.movementType === 'SALIDA_ORDEN')
      .reduce((sum, movement) => sum + movement.quantity * Number(movement.sparePart.purchasePrice ?? 0), 0);
    const capitalRecovered = inventorySalesCost + orderSparePartsCost;
    const grossProfit = orderPaymentsRevenue + inventorySalesRevenue - inventorySalesCost - orderSparePartsCost;
    const netProfit = grossProfit - expensesTotal;
    const buckets = this.dashboardBuckets(period.from, period.to, filters.period);
    const timeSeries = buckets.map((bucket) => {
      const inBucket = (value: Date) => value >= bucket.from && value <= bucket.to;
      const paymentRevenue = payments.filter((payment) => inBucket(payment.createdAt)).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const salesRevenue = sales.filter((sale) => inBucket(sale.createdAt)).reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0);
      const salesCost = sales
        .filter((sale) => inBucket(sale.createdAt))
        .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity * Number(item.sparePart.purchasePrice ?? 0), 0), 0);
      const orderPartsCost = inventoryMovements
        .filter((movement) => movement.movementType === 'SALIDA_ORDEN' && inBucket(movement.createdAt))
        .reduce((sum, movement) => sum + movement.quantity * Number(movement.sparePart.purchasePrice ?? 0), 0);
      const expenseAmount = expenses.filter((expense) => inBucket(expense.spentAt)).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
      return {
        label: bucket.label,
        orderPaymentsRevenue: paymentRevenue,
        inventorySalesRevenue: salesRevenue,
        expensesTotal: expenseAmount,
        netProfit: paymentRevenue + salesRevenue - salesCost - orderPartsCost - expenseAmount,
      };
    });

    const expenseCategories = this.sumBy(expenses, (expense) => expense.category, (expense) => Number(expense.amount ?? 0));
    const salesCategories = this.sumBy(
      sales.flatMap((sale) => sale.items),
      (item) => item.sparePart.category,
      (item) => Number(item.subtotal ?? 0),
    );
    // Unify parts usage: direct sales + workshop usage from movements
    const topSellingParts = this.sumBy(
      inventoryMovements,
      (mov) => mov.sparePart.name,
      (mov) => mov.quantity,
    ).slice(0, 5);

    // New business decision metrics
    const ordersWithQuote = ordersInPeriod.filter((o) => o.quoteApproved !== null);
    const approvedQuotes = ordersWithQuote.filter((o) => o.quoteApproved === true).length;
    const quoteAcceptanceRate = ordersWithQuote.length > 0
      ? Math.round((approvedQuotes / ordersWithQuote.length) * 100)
      : 0;

    const finalizedOrders = ordersInPeriod.filter((o) => o.status === 'FINALIZADO' && o.actualDeliveryDate && o.intakeDate);
    const avgRepairDays = finalizedOrders.length > 0
      ? Number((finalizedOrders.reduce((sum, o) => {
          if (!o.actualDeliveryDate || !o.intakeDate) return sum;
          const diffMs = o.actualDeliveryDate.getTime() - o.intakeDate.getTime();
          return sum + Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        }, 0) / finalizedOrders.length).toFixed(1))
      : 0;

    const serviceLines = this.sumBy(
      ordersInPeriod,
      (o) => o.equipment?.equipmentType?.serviceLine ?? 'EQUIPOS_GENERALES',
      () => 1,
    );

    const topBrands = this.sumBy(
      ordersInPeriod,
      (o) => o.equipment?.brand ?? 'Otros',
      () => 1,
    ).slice(0, 5);

    return {
      period: { key: filters.period ?? 'month', from: period.from.toISOString().slice(0, 10), to: period.to.toISOString().slice(0, 10) },
      ordersByStatus,
      activeClients: clients,
      activeTechnicians: technicians,
      lowStockParts: lowStockItems.length,
      totalIncome: orderPaymentsRevenue,
      totalOrders: ordersInPeriod.length,
      financial: {
        orderPaymentsRevenue,
        inventorySalesRevenue,
        inventorySalesCost,
        orderSparePartsCost,
        expensesTotal,
        grossProfit,
        netProfit,
        inventoryInvestment,
        inventoryPotentialSaleValue,
        inventoryPotentialProfit: inventoryPotentialSaleValue - inventoryInvestment,
        capitalRecovered,
      },
      timeSeries,
      expenseCategories,
      salesCategories,
      topSellingParts,
      lowStockItems: lowStockItems.slice(0, 6),
      quoteAcceptanceRate,
      avgRepairDays,
      serviceLines,
      topBrands,
    };
  }

  users() {
    return this.prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(data: { username: string; email: string; fullName: string; password: string; role: RoleName; isActive?: boolean }) {
    if (!data.username?.trim()) throw new BadRequestException('Ingrese el usuario');
    if (!data.email?.trim()) throw new BadRequestException('Ingrese el correo');
    if (!data.fullName?.trim()) throw new BadRequestException('Ingrese el nombre completo');
    if (!data.password) throw new BadRequestException('Ingrese la contrasena');
    const role = await this.prisma.role.findUnique({ where: { name: data.role } });
    if (!role) throw new BadRequestException('Rol no valido');
    return this.persistUnique(
      async () => {
        const user = await this.prisma.user.create({
          data: {
            username: data.username.trim().toLowerCase(),
            email: data.email.trim().toLowerCase(),
            fullName: normalizePlainText(data.fullName),
            passwordHash: bcrypt.hashSync(data.password, 10),
            roleId: role.id,
            isActive: data.isActive ?? true,
          },
          include: { role: true },
        });

        if (user.role.name === 'TECNICO') {
          const parts = user.fullName.split(' ');
          const firstName = parts[0] || 'Tecnico';
          const lastName = parts.slice(1).join(' ') || 'N/A';
          await this.prisma.technician.create({
            data: {
              userId: user.id,
              code: `TEC-${user.id.toString().padStart(3, '0')}`,
              firstName,
              lastName,
              isActive: user.isActive,
            },
          });
        }

        return user;
      },
      'Ya existe un usuario con ese usuario o correo',
    );
  }

  async updateUser(id: number, data: { username?: string; email?: string; fullName?: string; password?: string; role?: RoleName; isActive?: boolean }) {
    const role = data.role ? await this.prisma.role.findUnique({ where: { name: data.role } }) : undefined;
    if (data.role && !role) throw new BadRequestException('Rol no valido');
    return this.persistUnique(
      async () => {
        const user = await this.prisma.user.update({
          where: { id },
          data: {
            username: data.username ? data.username.trim().toLowerCase() : undefined,
            email: data.email ? data.email.trim().toLowerCase() : undefined,
            fullName: data.fullName ? normalizePlainText(data.fullName) : undefined,
            passwordHash: data.password ? bcrypt.hashSync(data.password, 10) : undefined,
            roleId: role?.id,
            isActive: data.isActive,
          },
          include: { role: true },
        });

        if (user.role.name === 'TECNICO') {
          const parts = user.fullName.split(' ');
          const firstName = parts[0] || 'Tecnico';
          const lastName = parts.slice(1).join(' ') || 'N/A';
          await this.prisma.technician.upsert({
            where: { userId: user.id },
            update: { firstName, lastName, isActive: user.isActive },
            create: {
              userId: user.id,
              code: `TEC-${user.id.toString().padStart(3, '0')}`,
              firstName,
              lastName,
              isActive: user.isActive,
            },
          });
        } else {
          await this.prisma.technician.updateMany({
            where: { userId: user.id },
            data: { isActive: false },
          });
        }

        return user;
      },
      'No se pudo actualizar: usuario o correo repetido',
    );
  }

  expenses(filters?: { category?: string; from?: string; to?: string }) {
    return this.prisma.expense.findMany({
      where: {
        isActive: true,
        category: filters?.category ? { contains: normalizePlainText(filters.category), mode: 'insensitive' } : undefined,
        spentAt: this.dateRange(filters?.from, filters?.to),
      },
      include: { registeredBy: { select: { fullName: true } } },
      orderBy: { spentAt: 'desc' },
    });
  }

  createExpense(data: { spentAt?: string; category: string; description: string; amount: number; paymentMethod: PaymentMethod; responsible: string; notes?: string; registeredById: number }) {
    const normalized = normalizeInput(data);
    if (!normalized.category?.trim()) throw new BadRequestException('Ingrese la categoria del gasto');
    if (!normalized.description?.trim()) throw new BadRequestException('Ingrese la descripcion del gasto');
    if (!normalized.amount || Number(normalized.amount) <= 0) throw new BadRequestException('El monto del gasto debe ser mayor que cero');
    return this.prisma.expense.create({
      data: {
        spentAt: normalized.spentAt ? new Date(normalized.spentAt) : undefined,
        category: normalized.category,
        description: normalized.description,
        amount: normalized.amount,
        paymentMethod: normalized.paymentMethod,
        responsible: normalized.responsible || 'NO REGISTRADO',
        notes: normalized.notes,
        registeredById: normalized.registeredById,
      },
      include: { registeredBy: { select: { fullName: true } } },
    });
  }

  updateExpense(id: number, data: { spentAt?: string; category?: string; description?: string; amount?: number; paymentMethod?: PaymentMethod; responsible?: string; notes?: string; isActive?: boolean }) {
    const normalized = normalizeInput(data);
    return this.prisma.expense.update({
      where: { id },
      data: {
        spentAt: normalized.spentAt ? new Date(normalized.spentAt) : undefined,
        category: normalized.category,
        description: normalized.description,
        amount: normalized.amount,
        paymentMethod: normalized.paymentMethod,
        responsible: normalized.responsible,
        notes: normalized.notes,
        isActive: normalized.isActive,
      },
      include: { registeredBy: { select: { fullName: true } } },
    });
  }

  clients(query?: string) {
    return this.prisma.client.findMany({
      where: query
        ? {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
              { dpi: { contains: query } },
              { nit: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  createClient(data: Prisma.ClientCreateInput) {
    const normalized = normalizeInput(data);
    return this.persistUnique(() => this.prisma.client.create({ data: normalized }), 'Ya existe un cliente con DPI, NIT o usuario repetido');
  }

  updateClient(id: number, data: Prisma.ClientUpdateInput) {
    const normalized = normalizeInput(data);
    return this.persistUnique(
      () => this.prisma.client.update({ where: { id }, data: normalized }),
      'No se pudo actualizar: DPI o NIT ya esta registrado en otro cliente',
    );
  }

  equipmentTypes(filters?: { includeInactive?: boolean; serviceLine?: ServiceLine }) {
    return this.prisma.equipmentType.findMany({
      where: {
        isActive: filters?.includeInactive ? undefined : true,
        serviceLine: filters?.serviceLine,
      },
      orderBy: [{ serviceLine: 'asc' }, { name: 'asc' }],
    });
  }

  createEquipmentType(data: { name: string; serviceLine: ServiceLine; requiresCredential?: boolean; allowsUnlockCase?: boolean; isActive?: boolean }) {
    const normalized = normalizeInput(data);
    if (!normalized.name?.trim()) throw new BadRequestException('Ingrese el nombre del tipo de equipo');
    return this.persistUnique(
      () =>
        this.prisma.equipmentType.create({
          data: {
            name: normalized.name,
            serviceLine: normalized.serviceLine,
            requiresCredential: normalized.requiresCredential ?? false,
            allowsUnlockCase: normalized.allowsUnlockCase ?? false,
            isActive: normalized.isActive ?? true,
          },
        }),
      'Ya existe un tipo de equipo con ese nombre',
    );
  }

  updateEquipmentType(id: number, data: { name?: string; serviceLine?: ServiceLine; requiresCredential?: boolean; allowsUnlockCase?: boolean; isActive?: boolean }) {
    const normalized = normalizeInput(data);
    return this.persistUnique(
      () =>
        this.prisma.equipmentType.update({
          where: { id },
          data: {
            name: normalized.name,
            serviceLine: normalized.serviceLine,
            requiresCredential: normalized.requiresCredential,
            allowsUnlockCase: normalized.allowsUnlockCase,
            isActive: normalized.isActive,
          },
        }),
      'No se pudo actualizar: ya existe un tipo de equipo con ese nombre',
    );
  }

  faultTypes() {
    return this.prisma.faultType.findMany({
      where: { isActive: true },
      include: { category: true, equipmentType: true },
      orderBy: { name: 'asc' },
    });
  }

  async equipment(filters?: { clientId?: number; brand?: string; model?: string; serialNumber?: string; serviceLine?: ServiceLine; equipmentTypeId?: number }) {
    const equipment = await this.prisma.equipment.findMany({
      where: {
        clientId: filters?.clientId,
        brand: filters?.brand ? { contains: normalizePlainText(filters.brand), mode: 'insensitive' } : undefined,
        model: filters?.model ? { contains: normalizePlainText(filters.model), mode: 'insensitive' } : undefined,
        serialNumber: filters?.serialNumber ? { contains: filters.serialNumber.trim(), mode: 'insensitive' } : undefined,
        equipmentTypeId: filters?.equipmentTypeId,
        equipmentType: filters?.serviceLine ? { serviceLine: filters.serviceLine } : undefined,
      },
      include: {
        client: true,
        equipmentType: true,
        orders: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { orderCode: true, status: true, reportedIssue: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return equipment.map((item) => {
      const [lastOrder] = item.orders;
      return { ...item, lastOrder: lastOrder ?? null };
    });
  }

  createEquipment(data: Prisma.EquipmentUncheckedCreateInput) {
    const normalized = normalizeInput(data);
    return this.persistUnique(() => this.prisma.equipment.create({ data: normalized }), 'Ya existe un equipo con esa serie o IMEI');
  }

  updateEquipment(id: number, data: Prisma.EquipmentUncheckedUpdateInput) {
    const normalized = normalizeInput(data);
    return this.persistUnique(
      () => this.prisma.equipment.update({ where: { id }, data: normalized }),
      'No se pudo actualizar: la serie o IMEI pertenece a otro equipo',
    );
  }

  technicians() {
    return this.prisma.technician.findMany({ where: { isActive: true }, orderBy: { firstName: 'asc' } });
  }

  spareParts() {
    return this.prisma.sparePart.findMany({ orderBy: { name: 'asc' } });
  }

  createSparePart(data: Prisma.SparePartCreateInput) {
    const normalized = normalizeInput(data);
    return this.persistUnique(() => this.prisma.sparePart.create({ data: normalized }), 'Ya existe un repuesto con ese codigo interno');
  }

  async bulkImportSpareParts(
    items: {
      internalCode: string;
      name: string;
      category: string;
      purchasePrice: number;
      publicSalePrice: number;
      currentStock?: number;
      minimumStock?: number;
      description?: string;
      compatibleWith?: string;
      brand?: string;
      model?: string;
      series?: string;
      quality?: string;
      color?: string;
      technicianSalePrice?: number;
      location?: string;
      supplier?: string;
      warrantyPolicy?: string;
    }[],
  ) {
    if (!items?.length) throw new BadRequestException('No se recibieron repuestos para importar');

    let created = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.internalCode?.trim()) {
          throw new BadRequestException('Cada repuesto importado debe tener codigo interno');
        }
        if (!item.name?.trim()) {
          throw new BadRequestException(`El repuesto ${item.internalCode} no tiene nombre`);
        }
        if (!item.category?.trim()) {
          throw new BadRequestException(`El repuesto ${item.internalCode} no tiene categoria`);
        }

        const normalized = normalizeInput({
          ...item,
          currentStock: Number(item.currentStock ?? 0),
          minimumStock: Number(item.minimumStock ?? 0),
          purchasePrice: Number(item.purchasePrice ?? 0),
          publicSalePrice: Number(item.publicSalePrice ?? 0),
          technicianSalePrice: item.technicianSalePrice == null ? undefined : Number(item.technicianSalePrice),
        });

        const existing = await tx.sparePart.findUnique({
          where: { internalCode: normalized.internalCode },
          select: { id: true },
        });

        if (existing) {
          await tx.sparePart.update({
            where: { id: existing.id },
            data: normalized,
          });
          updated += 1;
        } else {
          await tx.sparePart.create({
            data: normalized,
          });
          created += 1;
        }
      }
    });

    return {
      created,
      updated,
      total: created + updated,
    };
  }

  updateSparePart(id: number, data: Prisma.SparePartUpdateInput) {
    const normalized = normalizeInput(data);
    return this.persistUnique(
      () => this.prisma.sparePart.update({ where: { id }, data: normalized }),
      'No se pudo actualizar: el codigo interno pertenece a otro repuesto',
    );
  }

  async sellSparePart(sparePartId: number, quantity: number, registeredById: number, unitPrice?: number, notes?: string) {
    if (!quantity || quantity <= 0) throw new BadRequestException('La cantidad vendida debe ser mayor que cero');
    const part = await this.prisma.sparePart.findUnique({ where: { id: sparePartId } });
    if (!part) throw new NotFoundException('Repuesto no encontrado');
    if (part.currentStock < quantity) throw new BadRequestException('No hay stock suficiente para vender este repuesto');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sparePart.update({
        where: { id: sparePartId },
        data: { currentStock: { decrement: quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          sparePartId,
          movementType: 'SALIDA_VENTA',
          quantity,
          unitPrice: unitPrice ?? part.publicSalePrice,
          referenceType: 'DIRECT_SALE',
          notes,
          registeredById,
        },
      });
      return updated;
    });
  }

  inventorySales() {
    return this.prisma.inventorySale.findMany({
      include: { client: true, items: { include: { sparePart: true } }, registeredBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInventorySale(data: {
    clientId: number;
    paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'QR_PAGO';
    notes?: string;
    registeredById: number;
    items: { sparePartId: number; quantity: number; unitPrice: number }[];
  }) {
    if (!data.clientId) throw new BadRequestException('Seleccione el cliente de la venta');
    const normalized = normalizeInput(data);
    if (!data.items?.length) throw new BadRequestException('Agregue al menos un articulo a la venta');
    for (const item of data.items) {
      if (!item.sparePartId) throw new BadRequestException('Seleccione un repuesto valido');
      if (!item.quantity || item.quantity <= 0) throw new BadRequestException('La cantidad vendida debe ser mayor que cero');
      if (!item.unitPrice || item.unitPrice <= 0) throw new BadRequestException('El precio unitario debe ser mayor que cero');
    }

    return this.prisma.$transaction(async (tx) => {
      const parts = await tx.sparePart.findMany({ where: { id: { in: data.items.map((item) => item.sparePartId) } } });
      for (const item of data.items) {
        const part = parts.find((candidate) => candidate.id === item.sparePartId);
        if (!part) throw new NotFoundException('Uno de los repuestos no existe');
        if (part.currentStock < item.quantity) throw new BadRequestException(`No hay stock suficiente para ${part.name}`);
      }

      const year = new Date().getFullYear();
      const count = await tx.inventorySale.count({ where: { saleCode: { startsWith: `VEN-${year}-` } } });
      const saleCode = `VEN-${year}-${String(count + 1).padStart(5, '0')}`;
      const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const sale = await tx.inventorySale.create({
        data: {
          saleCode,
          clientId: normalized.clientId,
          paymentMethod: normalized.paymentMethod,
          notes: normalized.notes,
          totalAmount,
          registeredById: normalized.registeredById,
          items: {
            create: data.items.map((item) => ({
              sparePartId: item.sparePartId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
            })),
          },
        },
      });

      for (const item of data.items) {
        await tx.sparePart.update({
          where: { id: item.sparePartId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            sparePartId: item.sparePartId,
            movementType: 'SALIDA_VENTA',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            referenceType: 'INVENTORY_SALE',
            referenceId: sale.id,
            notes: `Venta ${sale.saleCode}`,
            registeredById: data.registeredById,
          },
        });
      }
      return tx.inventorySale.findUnique({
        where: { id: sale.id },
        include: { client: true, items: { include: { sparePart: true } } },
      });
    });
  }

  async ordersForUser(user: AuthUser) {
    const where = user.role === 'TECNICO' ? { technician: { userId: user.sub } } : undefined;
    return this.prisma.repairOrder.findMany({
      where,
      include: {
        client: true,
        equipment: { include: { equipmentType: true } },
        technician: true,
        faults: { include: { faultType: true } },
        quotes: { include: { sparePart: true } },
        payments: true,
        evidences: { where: { isActive: true }, include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
        history: { orderBy: { changedAt: 'asc' }, select: { previousStatus: true, newStatus: true, comment: true, changedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrder(data: {
    clientId: number;
    equipmentId: number;
    technicianId?: number;
    reportedIssue: string;
    additionalFaultDetail?: string;
    unlockCredentialType?: string;
    unlockCredentialValue?: string;
    unlockCredentialNotes?: string;
    priority?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
    estimatedDeliveryDate?: string;
    faultTypeIds?: number[];
    createdById: number;
  }) {
    const normalized = normalizeInput(data);
    const year = new Date().getFullYear();
    const count = await this.prisma.repairOrder.count({
      where: { orderCode: { startsWith: `ORD-${year}-` } },
    });
    const orderCode = `ORD-${year}-${String(count + 1).padStart(5, '0')}`;
    const trackingToken = token();

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.repairOrder.create({
        data: {
          orderCode,
          trackingToken,
          clientId: normalized.clientId,
          equipmentId: normalized.equipmentId,
          technicianId: normalized.technicianId,
          reportedIssue: normalized.reportedIssue,
          additionalFaultDetail: normalized.additionalFaultDetail,
          unlockCredentialType: normalized.unlockCredentialType,
          unlockCredentialValue: data.unlockCredentialValue?.trim(),
          unlockCredentialNotes: normalized.unlockCredentialNotes,
          priority: normalized.priority ?? 'NORMAL',
          estimatedDeliveryDate: normalized.estimatedDeliveryDate ? new Date(normalized.estimatedDeliveryDate) : undefined,
          createdById: normalized.createdById,
          faults: {
            create: normalized.faultTypeIds?.map((faultTypeId) => ({ faultTypeId })) ?? [],
          },
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          newStatus: 'CREADO',
          comment: 'Orden creada',
          changedById: data.createdById,
        },
      });
      return tx.repairOrder.findUnique({
        where: { id: order.id },
        include: { client: true, equipment: { include: { equipmentType: true } }, faults: { include: { faultType: true } } },
      });
    });
  }

  async updateOrder(
    orderId: number,
    data: {
      clientId?: number;
      equipmentId?: number;
      technicianId?: number;
      reportedIssue?: string;
      additionalFaultDetail?: string;
      unlockCredentialType?: string;
      unlockCredentialValue?: string;
      unlockCredentialNotes?: string;
      totalCost?: number;
      priority?: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
      estimatedDeliveryDate?: string;
      faultTypeIds?: number[];
    },
    changedById: number,
  ) {
    const normalized = normalizeInput(data);
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: orderId },
        data: {
          clientId: normalized.clientId,
          equipmentId: normalized.equipmentId,
          technicianId: normalized.technicianId,
          reportedIssue: normalized.reportedIssue,
          additionalFaultDetail: normalized.additionalFaultDetail,
          unlockCredentialType: normalized.unlockCredentialType,
          unlockCredentialValue: data.unlockCredentialValue?.trim(),
          unlockCredentialNotes: normalized.unlockCredentialNotes,
          totalCost: normalized.totalCost,
          priority: normalized.priority,
          estimatedDeliveryDate: normalized.estimatedDeliveryDate ? new Date(normalized.estimatedDeliveryDate) : undefined,
        },
      });
      if (normalized.faultTypeIds) {
        await tx.orderFaultType.deleteMany({ where: { orderId } });
        await tx.orderFaultType.createMany({
          data: normalized.faultTypeIds.map((faultTypeId) => ({ orderId, faultTypeId })),
          skipDuplicates: true,
        });
      }
      await tx.statusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: order.status,
          comment: 'Datos de la orden actualizados',
          changedById,
        },
      });
      return updated;
    });
  }

  async changeStatus(orderId: number, newStatus: OrderStatus, changedById: number, comment?: string) {
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (newStatus === 'EN_REPARACION' && order.quoteApproved !== true) {
      throw new BadRequestException('El presupuesto debe estar aprobado antes de iniciar reparacion');
    }
    if (newStatus === 'LISTO_PARA_RECOGER' && !['EN_REPARACION', 'LISTO_PARA_RECOGER'].includes(order.status)) {
      throw new BadRequestException('Primero debe aprobar el presupuesto y pasar la orden a reparacion');
    }
    if (newStatus === 'FINALIZADO') {
      if (order.status !== 'LISTO_PARA_RECOGER') {
        throw new BadRequestException('La orden debe estar marcada como lista para recoger antes de finalizar');
      }
      const paid = await this.orderPaidTotal(orderId);
      if (Number(order.totalCost) - paid > 0) {
        throw new BadRequestException('No se puede finalizar una orden con saldo pendiente');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          actualDeliveryDate: newStatus === 'FINALIZADO' ? new Date() : undefined,
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus,
          comment,
          changedById,
        },
      });
      return updated;
    });
  }

  async updateDiagnosis(orderId: number, data: { diagnosis: string; additionalFaultDetail?: string }, changedById: number) {
    const normalized = normalizeInput(data);
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (!normalized.diagnosis?.trim()) throw new BadRequestException('Ingrese el diagnostico tecnico');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: orderId },
        data: {
          diagnosis: normalized.diagnosis,
          additionalFaultDetail: normalized.additionalFaultDetail,
          status: (order.status === 'CREADO' || order.status === 'EN_REVISION') ? 'PRESUPUESTO_ENVIADO' : order.status,
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: updated.status,
          comment: `DIAGNOSTICO TECNICO: ${normalized.diagnosis}`,
          changedById,
        },
      });
      return updated;
    });
  }

  async approveQuote(orderId: number, approved: boolean, method: string, changedById: number) {
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId }, include: { quotes: true } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (approved && order.quotes.length === 0) {
      throw new BadRequestException('Agregue al menos un detalle de presupuesto antes de aprobar');
    }
    const nextStatus = quoteDecisionFinalStatus(approved);
    const history = buildQuoteDecisionHistory({
      previousStatus: order.status,
      approved,
      sourceLabel: method === 'IN_PERSON' ? 'personal del taller' : method.toLowerCase(),
    });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: orderId },
        data: {
          quoteApproved: approved,
          approvalMethod: method,
          approvedAt: new Date(),
          status: nextStatus as OrderStatus,
        },
      });
      await tx.statusHistory.createMany({
        data: history.map((item) => ({
          orderId,
          previousStatus: item.previousStatus as OrderStatus,
          newStatus: item.newStatus as OrderStatus,
          comment: item.comment,
          changedById,
        })),
      });
      if (approved) await this.consumeOrderSpareParts(tx, orderId, changedById);
      return updated;
    });
  }

  async addQuote(orderId: number, data: { description: string; type: Prisma.QuoteDetailCreateInput['type']; quantity: number; unitPrice: number; sparePartId?: number }) {
    const normalized = normalizeInput(data);
    this.validateQuote(normalized);
    const subtotal = normalized.quantity * normalized.unitPrice;
    const quote = await this.prisma.quoteDetail.create({
      data: {
        orderId,
        description: normalized.description,
        type: normalized.type,
        quantity: normalized.quantity,
        unitPrice: normalized.unitPrice,
        subtotal,
        sparePartId: normalized.sparePartId,
      },
    });
    await this.recalculateOrderTotal(orderId);
    return quote;
  }

  async updateQuote(orderId: number, quoteId: number, data: { description: string; type: Prisma.QuoteDetailCreateInput['type']; quantity: number; unitPrice: number; sparePartId?: number }) {
    const normalized = normalizeInput(data);
    this.validateQuote(normalized);
    const existing = await this.prisma.quoteDetail.findFirst({ where: { id: quoteId, orderId } });
    if (!existing) throw new NotFoundException('Detalle de presupuesto no encontrado');
    await this.ensureQuoteNotConsumed(quoteId);
    const subtotal = normalized.quantity * normalized.unitPrice;
    const quote = await this.prisma.quoteDetail.update({
      where: { id: quoteId },
      data: {
        description: normalized.description,
        type: normalized.type,
        quantity: normalized.quantity,
        unitPrice: normalized.unitPrice,
        subtotal,
        sparePartId: normalized.sparePartId,
      },
    });
    await this.recalculateOrderTotal(orderId);
    return quote;
  }

  async removeQuote(orderId: number, quoteId: number) {
    const existing = await this.prisma.quoteDetail.findFirst({ where: { id: quoteId, orderId } });
    if (!existing) throw new NotFoundException('Detalle de presupuesto no encontrado');
    await this.ensureQuoteNotConsumed(quoteId);
    await this.prisma.quoteDetail.delete({ where: { id: quoteId } });
    await this.recalculateOrderTotal(orderId);
    return { ok: true };
  }

  async addPayment(orderId: number, data: { amount: number; paymentMethod: string; paymentType?: string; reference?: string; notes?: string; registeredById: number }) {
    const normalized = normalizeInput(data);
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (!normalized.amount || Number(normalized.amount) <= 0) throw new BadRequestException('El monto del pago debe ser mayor que cero');
    const paid = await this.orderPaidTotal(orderId);
    if (paid + Number(normalized.amount) > Number(order.totalCost) && Number(order.totalCost) > 0) {
      throw new BadRequestException('El pago supera el saldo pendiente de la orden');
    }
    return this.prisma.payment.create({
      data: {
        orderId,
        amount: normalized.amount,
        paymentMethod: normalized.paymentMethod as never,
        paymentType: (normalized.paymentType ?? 'PAGO') as never,
        reference: normalized.reference,
        notes: normalized.notes,
        registeredById: normalized.registeredById,
      },
    });
  }

  evidences(orderId: number) {
    return this.prisma.repairOrderEvidence.findMany({
      where: { orderId, isActive: true },
      include: { uploadedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addEvidence(
    orderId: number,
    data: { evidenceType: EvidenceType; description?: string; uploadedById: number },
    file?: Express.Multer.File,
  ) {
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (!file) throw new BadRequestException('Seleccione una imagen de evidencia');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('La evidencia debe ser una imagen');
    const normalized = normalizeInput(data);
    return this.prisma.repairOrderEvidence.create({
      data: {
        orderId,
        evidenceType: normalized.evidenceType,
        description: normalized.description,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: normalized.uploadedById,
      },
      include: { uploadedBy: { select: { fullName: true } } },
    });
  }

  async evidenceFile(orderId: number, evidenceId: number) {
    const evidence = await this.prisma.repairOrderEvidence.findFirst({
      where: { id: evidenceId, orderId, isActive: true },
    });
    if (!evidence) throw new NotFoundException('Evidencia no encontrada');
    const path = join(process.cwd(), 'uploads', 'evidences', evidence.fileName);
    if (!existsSync(path)) throw new NotFoundException('Archivo de evidencia no encontrado');
    return {
      stream: createReadStream(path),
      filename: evidence.originalName,
      contentType: evidence.mimeType,
    };
  }

  deleteEvidence(orderId: number, evidenceId: number) {
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.repairOrderEvidence.findFirst({ where: { id: evidenceId, orderId } });
      if (!evidence) throw new NotFoundException('Evidencia no encontrada');
      return tx.repairOrderEvidence.update({ where: { id: evidenceId }, data: { isActive: false } });
    });
  }

  async paymentReceipt(paymentId: number): Promise<GeneratedFile> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        registeredBy: { select: { fullName: true } },
        order: {
          include: {
            client: true,
            equipment: { include: { equipmentType: true } },
            payments: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    const settings = await this.fullSettings();
    const money = moneyWith(settings);
    const paid = payment.order.payments.reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = Math.max(Number(payment.order.totalCost) - paid, 0);
    const buffer = await this.createPdf((doc) => {
      this.pdfHeader(doc, settings, 'Comprobante de pago');
      this.pdfSectionTitle(doc, 'Datos del comprobante');
      this.pdfKeyValue(doc, 'Folio', `PAGO-${String(payment.id).padStart(6, '0')}`);
      this.pdfKeyValue(doc, 'Orden', payment.order.orderCode);
      this.pdfKeyValue(doc, 'Cliente', `${payment.order.client.firstName} ${payment.order.client.lastName}`);
      this.pdfKeyValue(doc, 'Equipo', `${payment.order.equipment.equipmentType.name} ${payment.order.equipment.brand} ${payment.order.equipment.model}`);
      doc.moveDown(0.6);
      this.pdfSectionTitle(doc, 'Pago recibido');
      this.pdfKeyValue(doc, 'Monto recibido', money(payment.amount));
      this.pdfKeyValue(doc, 'Metodo', payment.paymentMethod);
      this.pdfKeyValue(doc, 'Tipo', payment.paymentType);
      this.pdfKeyValue(doc, 'Referencia', payment.reference ?? 'N/A');
      this.pdfKeyValue(doc, 'Fecha', dateLabel(payment.createdAt));
      this.pdfKeyValue(doc, 'Saldo pendiente', money(balance));
      this.pdfKeyValue(doc, 'Registrado por', payment.registeredBy.fullName);
      if (payment.notes) doc.moveDown().text(`Notas: ${payment.notes}`);
      this.pdfSignatureRow(doc, 'Recibido por cliente', 'Autorizado por taller');
    });
    return { buffer, filename: `comprobante-${payment.order.orderCode}-pago-${payment.id}.pdf`, contentType: 'application/pdf' };
  }

  async inventorySaleReceipt(saleId: number): Promise<GeneratedFile> {
    const sale = await this.prisma.inventorySale.findUnique({
      where: { id: saleId },
      include: { client: true, registeredBy: { select: { fullName: true } }, items: { include: { sparePart: true } } },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    const settings = await this.fullSettings();
    const money = moneyWith(settings);
    const buffer = await this.createPdf((doc) => {
      this.pdfHeader(doc, settings, 'Comprobante de venta');
      this.pdfSectionTitle(doc, 'Datos de la venta');
      this.pdfKeyValue(doc, 'Folio', sale.saleCode);
      this.pdfKeyValue(doc, 'Cliente', `${sale.client.firstName} ${sale.client.lastName}`);
      this.pdfKeyValue(doc, 'Fecha', dateLabel(sale.createdAt));
      this.pdfKeyValue(doc, 'Metodo', sale.paymentMethod);
      doc.moveDown(0.6);
      this.pdfSectionTitle(doc, 'Articulos');
      sale.items.forEach((item) => {
        doc.text(`${item.sparePart.internalCode} - ${item.sparePart.name} x ${item.quantity}`, { continued: true });
        doc.text(money(item.subtotal), { align: 'right' });
      });
      doc.moveDown();
      this.pdfKeyValue(doc, 'Total', money(sale.totalAmount));
      this.pdfKeyValue(doc, 'Registrado por', sale.registeredBy.fullName);
      if (sale.notes) doc.moveDown().text(`Notas: ${sale.notes}`);
    });
    return { buffer, filename: `comprobante-${sale.saleCode}.pdf`, contentType: 'application/pdf' };
  }

  async sparePartLabel(sparePartId: number): Promise<GeneratedFile> {
    const part = await this.prisma.sparePart.findUnique({ where: { id: sparePartId } });
    if (!part) throw new NotFoundException('Repuesto no encontrado');
    const settings = await this.fullSettings();
    const money = moneyWith(settings);
    const barcode = await bwipjs.toBuffer({
      bcid: 'code128',
      text: part.internalCode,
      scale: 3,
      height: 14,
      includetext: true,
      textxalign: 'center',
    });
    const buffer = await this.createPdf((doc) => {
      doc.fontSize(17).font('Helvetica-Bold').text('Etiqueta de repuesto', { align: 'center' });
      doc.moveDown(0.7);
      doc.fontSize(12).font('Helvetica-Bold').text(part.name, { align: 'center' });
      doc.font('Helvetica').fontSize(10).text(`Codigo: ${part.internalCode}`, { align: 'center' });
      doc.text(`Precio: ${money(part.publicSalePrice)}`, { align: 'center' });
      doc.text(`Ubicacion: ${part.location ?? 'N/A'}`, { align: 'center' });
      doc.moveDown(0.6);
      doc.image(barcode, 90, doc.y, { fit: [360, 90], align: 'center' });
    }, { size: [420, 260], margin: 28 });
    return { buffer, filename: `etiqueta-${part.internalCode}.pdf`, contentType: 'application/pdf' };
  }

  async exportOrdersPdf(filters: OrderExportFilters): Promise<GeneratedFile> {
    const orders = await this.findOrdersForExport(filters);
    const settings = await this.fullSettings();
    const money = moneyWith(settings);
    const buffer = await this.createPdf((doc) => {
      this.pdfHeader(doc, settings, 'Reporte de servicios');
      doc.fontSize(10).text(`Filtros: ${this.filterLabel(filters)}`);
      doc.moveDown();
      orders.forEach((order) => {
        doc.font('Helvetica-Bold').text(`${order.orderCode} - ${order.status}`, { continued: true });
        doc.font('Helvetica').text(money(order.totalCost), { align: 'right' });
        doc.text(`${order.client.firstName} ${order.client.lastName} | ${order.equipment.equipmentType.name} ${order.equipment.brand} ${order.equipment.model}`);
        doc.fontSize(9).fillColor('#475569').text(`Creado: ${dateLabel(order.createdAt)} | Diagnostico: ${order.diagnosis ?? 'N/A'}`);
        doc.fillColor('#0f172a').fontSize(10).moveDown(0.6);
      });
    });
    return { buffer, filename: `servicios-${Date.now()}.pdf`, contentType: 'application/pdf' };
  }

  async exportOrdersExcel(filters: OrderExportFilters): Promise<GeneratedFile> {
    const orders = await this.findOrdersForExport(filters);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Servicios');
    sheet.columns = [
      { header: 'Orden', key: 'orderCode', width: 18 },
      { header: 'Estado', key: 'status', width: 24 },
      { header: 'Cliente', key: 'client', width: 28 },
      { header: 'Telefono', key: 'phone', width: 18 },
      { header: 'Equipo', key: 'equipment', width: 32 },
      { header: 'Problema', key: 'issue', width: 42 },
      { header: 'Diagnostico', key: 'diagnosis', width: 42 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Pagado', key: 'paid', width: 12 },
      { header: 'Creado', key: 'createdAt', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    orders.forEach((order) => {
      const paid = order.payments.reduce((sum, item) => sum + Number(item.amount), 0);
      sheet.addRow({
        orderCode: order.orderCode,
        status: order.status,
        client: `${order.client.firstName} ${order.client.lastName}`,
        phone: order.client.phone,
        equipment: `${order.equipment.equipmentType.name} ${order.equipment.brand} ${order.equipment.model}`,
        issue: order.reportedIssue,
        diagnosis: order.diagnosis ?? '',
        total: Number(order.totalCost),
        paid,
        createdAt: dateLabel(order.createdAt),
      });
    });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `servicios-${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async tracking(orderCode: string, trackingToken: string) {
    const order = await this.prisma.repairOrder.findFirst({
      where: { orderCode, trackingToken },
      include: {
        equipment: { include: { equipmentType: true } },
        history: { orderBy: { changedAt: 'asc' }, select: { newStatus: true, comment: true, changedAt: true } },
        quotes: { include: { sparePart: true } },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return {
      orderCode: order.orderCode,
      status: order.status,
      equipment: order.equipment,
      reportedIssue: order.reportedIssue,
      additionalFaultDetail: order.additionalFaultDetail,
      unlockCredentialType: order.unlockCredentialType,
      unlockCredentialNotes: order.unlockCredentialNotes,
      diagnosis: order.diagnosis,
      totalCost: order.totalCost,
      quoteApproved: order.quoteApproved,
      approvalMethod: order.approvalMethod,
      approvedAt: order.approvedAt,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      history: order.history,
      quotes: order.quotes,
    };
  }

  async customerQuoteDecision(orderCode: string, trackingToken: string, approved: boolean, customerName?: string, comment?: string) {
    const normalizedName = customerName ? normalizePlainText(customerName) : undefined;
    const normalizedComment = comment ? normalizePlainText(comment) : undefined;
    const order = await this.prisma.repairOrder.findFirst({
      where: { orderCode, trackingToken },
      include: { quotes: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.quotes.length === 0) throw new BadRequestException('Aun no hay presupuesto para aceptar o rechazar');
    if (!['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(order.status)) {
      throw new BadRequestException('Esta orden ya no esta pendiente de decision de presupuesto');
    }
    const nextStatus = quoteDecisionFinalStatus(approved);
    const history = buildQuoteDecisionHistory({
      previousStatus: order.status,
      approved,
      sourceLabel: 'cliente',
      customerName: normalizedName,
      comment: normalizedComment,
    });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: order.id },
        data: {
          quoteApproved: approved,
          approvalMethod: 'PUBLIC_TRACKING',
          approvedAt: new Date(),
          status: nextStatus as OrderStatus,
        },
      });
      await tx.statusHistory.createMany({
        data: history.map((item) => ({
          orderId: order.id,
          previousStatus: item.previousStatus as OrderStatus,
          newStatus: item.newStatus as OrderStatus,
          comment: item.comment,
          changedById: order.createdById,
        })),
      });
      if (approved) await this.consumeOrderSpareParts(tx, order.id, order.createdById);
      return updated;
    }, { timeout: 20000, maxWait: 10000 });
  }

  async customerQuoteDecisionFromWhatsapp(orderCode: string, approved: boolean, sourcePhone: string, customerName?: string, comment?: string) {
    const normalizedName = customerName ? normalizePlainText(customerName) : undefined;
    const normalizedComment = comment ? normalizePlainText(comment) : undefined;
    const order = await this.prisma.repairOrder.findFirst({
      where: { orderCode },
      include: { quotes: true, client: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (!this.phonesMatch(order.client.phone, sourcePhone)) {
      throw new BadRequestException('El numero que respondio no coincide con el cliente de la orden');
    }
    if (order.quotes.length === 0) throw new BadRequestException('Aun no hay presupuesto para aceptar o rechazar');
    if (order.quoteApproved === approved && ['EN_REPARACION', 'PRESUPUESTO_RECHAZADO'].includes(order.status)) {
      return order;
    }
    if (!['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(order.status)) {
      throw new BadRequestException('Esta orden ya no esta pendiente de decision de presupuesto');
    }
    const nextStatus = quoteDecisionFinalStatus(approved);
    const history = buildQuoteDecisionHistory({
      previousStatus: order.status,
      approved,
      sourceLabel: 'WhatsApp',
      customerName: normalizedName,
      comment: normalizedComment,
    });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: order.id },
        data: {
          quoteApproved: approved,
          approvalMethod: 'WHATSAPP',
          approvedAt: new Date(),
          status: nextStatus as OrderStatus,
        },
      });
      await tx.statusHistory.createMany({
        data: history.map((item) => ({
          orderId: order.id,
          previousStatus: item.previousStatus as OrderStatus,
          newStatus: item.newStatus as OrderStatus,
          comment: item.comment,
          changedById: order.createdById,
        })),
      });
      if (approved) await this.consumeOrderSpareParts(tx, order.id, order.createdById);
      return updated;
    }, { timeout: 20000, maxWait: 10000 });
  }

  async findPendingQuoteOrdersByPhone(sourcePhone: string) {
    return this.prisma.repairOrder.findMany({
      where: {
        client: {
          phone: {
            not: undefined,
          },
        },
        status: {
          in: ['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'],
        },
      },
      include: {
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    }).then((orders) => orders.filter((order) => this.phonesMatch(order.client.phone, sourcePhone)));
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) return undefined;
    return {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(`${to}T23:59:59.999`) : undefined,
    };
  }

  private findOrdersForExport(filters: OrderExportFilters) {
    const status = filters.status?.trim();
    const client = filters.client?.trim();
    return this.prisma.repairOrder.findMany({
      where: {
        status: status ? (status as OrderStatus) : undefined,
        createdAt: this.dateRange(filters.from, filters.to),
        client: client
          ? {
              OR: [
                { firstName: { contains: normalizePlainText(client), mode: 'insensitive' } },
                { lastName: { contains: normalizePlainText(client), mode: 'insensitive' } },
                { phone: { contains: client } },
              ],
            }
          : undefined,
      },
      include: {
        client: true,
        equipment: { include: { equipmentType: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private filterLabel(filters: OrderExportFilters) {
    const parts = [
      filters.status ? `Estado ${filters.status}` : undefined,
      filters.client ? `Cliente ${filters.client}` : undefined,
      filters.from ? `Desde ${filters.from}` : undefined,
      filters.to ? `Hasta ${filters.to}` : undefined,
    ].filter(Boolean);
    return parts.length ? parts.join(' | ') : 'Sin filtros';
  }

  private createPdf(writer: (doc: PDFKit.PDFDocument) => void, options?: PDFKit.PDFDocumentOptions) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 42, ...options });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      writer(doc);
      doc.end();
    });
  }

  private async fullSettings() {
    return this.prisma.shopSettings.findUnique({ where: { id: 1 } });
  }

  private safeSettings(settings: Awaited<ReturnType<CoreService['fullSettings']>>) {
    if (!settings) return null;
    const { logoData: _logoData, ...safe } = settings;
    return {
      ...safe,
      projectTitle: PROJECT_TITLE,
      hasLogo: Boolean(settings.logoData),
      logoUrl: settings.logoData ? LOGO_URL : settings.logoUrl,
    };
  }

  private pdfHeader(doc: PDFKit.PDFDocument, settings: Awaited<ReturnType<CoreService['fullSettings']>>, title: string) {
    const top = doc.y;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const shopName = settings?.shopName ?? 'Taller Electronico';
    const contact = [
      settings?.phone ? `Tel: ${settings.phone}` : undefined,
      settings?.whatsapp ? `WhatsApp: ${settings.whatsapp}` : undefined,
      settings?.contactEmail,
    ].filter(Boolean).join('  •  ');
    const logoBuffer = settings?.logoData && ['image/png', 'image/jpeg'].includes(settings.logoMimeType ?? '')
      ? Buffer.from(settings.logoData as Uint8Array)
      : null;

    // Logo
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, left, top, { fit: [65, 65] });
      } catch {
        doc.fillColor('#0ea5e9').font('Helvetica-Bold').fontSize(24).text('ST', left, top + 15, { width: 65, align: 'center' });
      }
    } else {
      doc.fillColor('#0ea5e9').font('Helvetica-Bold').fontSize(24).text('ST', left, top + 15, { width: 65, align: 'center' });
    }

    // Título del documento (ej. ORDEN DE SERVICIO) a la derecha
    doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(14).text(title.toUpperCase(), left, top + 5, { align: 'right', width: right - left });

    const textLeft = left + 85;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text(shopName, textLeft, top + 4, { width: right - textLeft - 100 });
    
    doc.fillColor('#64748b').font('Helvetica').fontSize(9);
    if (settings?.slogan) {
      doc.text(settings.slogan, textLeft, doc.y + 3, { width: right - textLeft });
    }
    if (contact) {
      doc.text(contact, textLeft, doc.y + 4, { width: right - textLeft });
    }
    if (settings?.address) {
      doc.text(settings.address, textLeft, doc.y + 2, { width: right - textLeft });
    }

    // Línea separadora
    doc.moveTo(left, top + 75).lineTo(right, top + 75).lineWidth(1).stroke('#e2e8f0');

    doc.y = top + 90;
    doc.fillColor('#0f172a').font('Helvetica');
  }

  private pdfSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(11).text(title.toUpperCase());
    doc.moveDown(0.35);
    doc.fillColor('#0f172a').font('Helvetica').fontSize(11);
  }

  private pdfKeyValue(doc: PDFKit.PDFDocument, label: string, value: string) {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value);
  }

  private pdfSignatureRow(doc: PDFKit.PDFDocument, leftLabel: string, rightLabel: string) {
    const y = Math.max(doc.y + 38, doc.page.height - 128);
    const left = doc.page.margins.left;
    const width = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 28) / 2;
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor('#0f172a').stroke();
    doc.moveTo(left + width + 28, y).lineTo(left + width * 2 + 28, y).stroke();
    doc.fillColor('#475569').fontSize(9).text(leftLabel, left, y + 8, { width, align: 'center' });
    doc.text(rightLabel, left + width + 28, y + 8, { width, align: 'center' });
    doc.fillColor('#0f172a').fontSize(11);
  }

  private async orderPaidTotal(orderId: number) {
    const result = await this.prisma.payment.aggregate({ where: { orderId }, _sum: { amount: true } });
    return Number(result._sum.amount ?? 0);
  }

  private dashboardPeriod(filters: DashboardFilters) {
    const offsetMs = -6 * 60 * 60 * 1000; // Guatemala UTC-6
    const getLocalNow = () => new Date(Date.now() + offsetMs);
    
    const startOfLocalDay = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      return new Date(Date.UTC(y, m, d) - offsetMs);
    };

    const endOfLocalDay = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      return new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - offsetMs);
    };

    if (filters.period === 'custom' && filters.from && filters.to) {
      const partsFrom = filters.from.split('-').map(Number);
      const partsTo = filters.to.split('-').map(Number);
      const fromLocal = new Date(Date.UTC(partsFrom[0], partsFrom[1] - 1, partsFrom[2]) - offsetMs);
      const toLocal = new Date(Date.UTC(partsTo[0], partsTo[1] - 1, partsTo[2], 23, 59, 59, 999) - offsetMs);
      return { from: fromLocal, to: toLocal };
    }

    const localNow = getLocalNow();

    if (filters.period === 'day') {
      return { from: startOfLocalDay(localNow), to: endOfLocalDay(localNow) };
    }
    if (filters.period === 'week') {
      const localFrom = new Date(localNow);
      localFrom.setUTCDate(localFrom.getUTCDate() - 6);
      return { from: startOfLocalDay(localFrom), to: endOfLocalDay(localNow) };
    }
    if (filters.period === 'year') {
      const localFrom = new Date(Date.UTC(localNow.getUTCFullYear(), 0, 1) - offsetMs);
      return { from: localFrom, to: endOfLocalDay(localNow) };
    }
    // Default to 'month'
    const localFrom = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1) - offsetMs);
    return { from: localFrom, to: endOfLocalDay(localNow) };
  }

  private dashboardBuckets(from: Date, to: Date, period?: string) {
    const offsetMs = -6 * 60 * 60 * 1000;
    const toLocalDate = (date: Date) => new Date(date.getTime() + offsetMs);

    if (period === 'year') {
      const localTo = toLocalDate(to);
      return Array.from({ length: localTo.getUTCMonth() + 1 }, (_, month) => {
        const startLocal = new Date(Date.UTC(localTo.getUTCFullYear(), month, 1) - offsetMs);
        const endLocal = new Date(Date.UTC(localTo.getUTCFullYear(), month + 1, 0, 23, 59, 59, 999) - offsetMs);
        const label = toLocalDate(startLocal).toLocaleDateString('es-GT', { month: 'short', timeZone: 'UTC' });
        return { label, from: startLocal, to: endLocal };
      });
    }

    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    const step = days > 45 ? 7 : 1;
    const buckets: { label: string; from: Date; to: Date }[] = [];

    for (let index = 0; index < days; index += step) {
      const startLocalVal = toLocalDate(from);
      startLocalVal.setUTCDate(startLocalVal.getUTCDate() + index);
      const start = new Date(Date.UTC(startLocalVal.getUTCFullYear(), startLocalVal.getUTCMonth(), startLocalVal.getUTCDate()) - offsetMs);

      const endLocalVal = new Date(startLocalVal);
      endLocalVal.setUTCDate(startLocalVal.getUTCDate() + step - 1);
      const end = new Date(Date.UTC(endLocalVal.getUTCFullYear(), endLocalVal.getUTCMonth(), endLocalVal.getUTCDate(), 23, 59, 59, 999) - offsetMs);

      if (end > to) end.setTime(to.getTime());
      
      const labelDate = toLocalDate(start);
      const label = step === 1 
        ? labelDate.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) 
        : `${labelDate.getUTCDate()}/${labelDate.getUTCMonth() + 1}`;

      buckets.push({ label, from: start, to: end });
    }
    return buckets;
  }

  private sumBy<T>(items: T[], label: (item: T) => string, value: (item: T) => number) {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = label(item) || 'Sin clasificar';
      map.set(key, (map.get(key) ?? 0) + value(item));
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);
  }

  private validateQuote(data: { description: string; quantity: number; unitPrice: number }) {
    if (!data.description?.trim()) throw new BadRequestException('Ingrese el detalle del presupuesto');
    if (!data.quantity || Number(data.quantity) <= 0) throw new BadRequestException('La cantidad debe ser mayor que cero');
    if (!data.unitPrice || Number(data.unitPrice) <= 0) throw new BadRequestException('El precio debe ser mayor que cero');
  }

  private async ensureQuoteNotConsumed(quoteId: number) {
    const movement = await this.prisma.inventoryMovement.findFirst({
      where: { movementType: 'SALIDA_ORDEN', referenceType: 'ORDER_QUOTE', referenceId: quoteId },
    });
    if (movement) throw new BadRequestException('Este repuesto ya fue consumido del inventario y no se puede modificar desde el presupuesto');
  }

  private async consumeOrderSpareParts(tx: Prisma.TransactionClient, orderId: number, registeredById: number) {
    const quotes = await tx.quoteDetail.findMany({
      where: { orderId, sparePartId: { not: null } },
      include: { sparePart: true },
    });
    for (const quote of quotes) {
      if (!quote.sparePartId || !quote.sparePart) continue;
      const alreadyConsumed = await tx.inventoryMovement.findFirst({
        where: { movementType: 'SALIDA_ORDEN', referenceType: 'ORDER_QUOTE', referenceId: quote.id },
      });
      if (alreadyConsumed) continue;
      const quantity = Number(quote.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(`La cantidad del repuesto ${quote.description} debe ser un numero entero`);
      }
      if (quote.sparePart.currentStock < quantity) {
        throw new BadRequestException(`No hay stock suficiente para ${quote.sparePart.name}`);
      }
      await tx.sparePart.update({
        where: { id: quote.sparePartId },
        data: { currentStock: { decrement: quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          sparePartId: quote.sparePartId,
          movementType: 'SALIDA_ORDEN',
          quantity,
          unitPrice: quote.unitPrice,
          referenceType: 'ORDER_QUOTE',
          referenceId: quote.id,
          notes: `Consumo por orden ${orderId}`,
          registeredById,
        },
      });
    }
  }

  private async recalculateOrderTotal(orderId: number) {
    const total = await this.prisma.quoteDetail.aggregate({ where: { orderId }, _sum: { subtotal: true } });
    const order = await this.prisma.repairOrder.findUnique({ where: { id: orderId }, select: { status: true, quoteApproved: true } });
    // Solo resetear el estado de aprobación si el presupuesto NO había sido aprobado aún.
    // Si ya fue aprobado (quoteApproved === true), solo actualizar el monto total sin tocar el estado.
    const pendingStatuses = ['CREADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO', 'PRESUPUESTO_ENVIADO'];
    const shouldResetApproval = !order?.quoteApproved && pendingStatuses.includes(order?.status ?? '');
    return this.prisma.repairOrder.update({
      where: { id: orderId },
      data: {
        totalCost: total._sum.subtotal ?? 0,
        ...(shouldResetApproval ? { status: 'PRESUPUESTO_ENVIADO', quoteApproved: null, approvedAt: null, approvalMethod: null } : {}),
      },
    });
  }

  private async persistUnique<T>(operation: () => Promise<T>, message: string) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException(message);
      }
      throw error;
    }
  }

  private phonesMatch(left: string, right: string) {
    const normalize = (value: string) => {
      const digits = value.replace(/\D/g, '');
      return digits.length > 8 ? digits.slice(-8) : digits;
    };
    return normalize(left) !== '' && normalize(left) === normalize(right);
  }
}
