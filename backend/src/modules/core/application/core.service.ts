import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { normalizeInput, normalizePlainText } from '../../../shared/utils/text-normalizer';

function token(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

@Injectable()
export class CoreService {
  constructor(private readonly prisma: PrismaService) {}

  settings() {
    return this.prisma.shopSettings.findUnique({ where: { id: 1 } });
  }

  updateSettings(data: Prisma.ShopSettingsUpdateInput) {
    return this.prisma.shopSettings.update({ where: { id: 1 }, data });
  }

  async dashboard() {
    const [ordersByStatus, clients, technicians, parts, income] = await Promise.all([
      this.prisma.repairOrder.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.technician.count({ where: { isActive: true } }),
      this.prisma.sparePart.findMany({ where: { isActive: true }, select: { currentStock: true, minimumStock: true } }),
      this.prisma.payment.aggregate({ _sum: { amount: true } }),
    ]);
    return {
      ordersByStatus,
      activeClients: clients,
      activeTechnicians: technicians,
      lowStockParts: parts.filter((p) => p.currentStock <= p.minimumStock).length,
      totalIncome: Number(income._sum.amount ?? 0),
    };
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

  equipmentTypes() {
    return this.prisma.equipmentType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  faultTypes() {
    return this.prisma.faultType.findMany({
      where: { isActive: true },
      include: { category: true, equipmentType: true },
      orderBy: { name: 'asc' },
    });
  }

  equipment(clientId?: number) {
    return this.prisma.equipment.findMany({
      where: clientId ? { clientId } : undefined,
      include: { client: true, equipmentType: true },
      orderBy: { createdAt: 'desc' },
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

  async orders() {
    return this.prisma.repairOrder.findMany({
      include: {
        client: true,
        equipment: { include: { equipmentType: true } },
        technician: true,
        faults: { include: { faultType: true } },
        quotes: { include: { sparePart: true } },
        payments: true,
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
          status: order.status === 'CREADO' ? 'EN_REVISION' : order.status,
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
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: orderId },
        data: {
          quoteApproved: approved,
          approvalMethod: method,
          approvedAt: new Date(),
          status: approved ? 'EN_REPARACION' : 'PRESUPUESTO_RECHAZADO',
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: updated.status,
          comment: approved ? 'Presupuesto aprobado' : 'Presupuesto rechazado',
          changedById,
        },
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
    const nextStatus = approved ? 'EN_REPARACION' : 'PRESUPUESTO_RECHAZADO';
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: order.id },
        data: {
          quoteApproved: approved,
          approvalMethod: 'PUBLIC_TRACKING',
          approvedAt: new Date(),
          status: nextStatus,
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: nextStatus,
          comment: `${approved ? 'Presupuesto aprobado' : 'Presupuesto rechazado'} por cliente${normalizedName ? `: ${normalizedName}` : ''}${normalizedComment ? `. ${normalizedComment}` : ''}`,
          changedById: order.createdById,
        },
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
    const nextStatus = approved ? 'EN_REPARACION' : 'PRESUPUESTO_RECHAZADO';
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repairOrder.update({
        where: { id: order.id },
        data: {
          quoteApproved: approved,
          approvalMethod: 'WHATSAPP',
          approvedAt: new Date(),
          status: nextStatus,
        },
      });
      await tx.statusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: nextStatus,
          comment: `${approved ? 'Presupuesto aprobado' : 'Presupuesto rechazado'} por WhatsApp${normalizedName ? `: ${normalizedName}` : ''}${normalizedComment ? `. ${normalizedComment}` : ''}`,
          changedById: order.createdById,
        },
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

  private async orderPaidTotal(orderId: number) {
    const result = await this.prisma.payment.aggregate({ where: { orderId }, _sum: { amount: true } });
    return Number(result._sum.amount ?? 0);
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
    return this.prisma.repairOrder.update({
      where: { id: orderId },
      data: { totalCost: total._sum.subtotal ?? 0, status: 'PRESUPUESTO_ENVIADO', quoteApproved: null, approvedAt: null, approvalMethod: null },
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
