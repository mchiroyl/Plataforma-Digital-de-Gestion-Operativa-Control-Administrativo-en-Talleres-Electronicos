import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { AuthRequest } from '../../../shared/presentation/http/auth-request.type';
import { CoreService } from '../application/core.service';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';

@UseGuards(AuthGuard)
@Controller()
export class CoreController {
  constructor(private readonly core: CoreService) {}

  @Get('settings')
  settings() {
    return this.core.settings();
  }

  @Patch('settings')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.core.updateSettings(body);
  }

  @Get('dashboard')
  dashboard() {
    return this.core.dashboard();
  }

  @Get('clients')
  clients(@Query('q') query?: string) {
    return this.core.clients(query);
  }

  @Post('clients')
  createClient(@Body() body: { firstName: string; lastName: string; phone: string; dpi?: string; nit?: string; email?: string; address?: string }) {
    return this.core.createClient(body);
  }

  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() body: { firstName?: string; lastName?: string; phone?: string; dpi?: string; nit?: string; email?: string; address?: string }) {
    return this.core.updateClient(Number(id), body);
  }

  @Get('equipment-types')
  equipmentTypes() {
    return this.core.equipmentTypes();
  }

  @Get('fault-types')
  faultTypes() {
    return this.core.faultTypes();
  }

  @Get('equipment')
  equipment(@Query('clientId') clientId?: string) {
    return this.core.equipment(clientId ? Number(clientId) : undefined);
  }

  @Post('equipment')
  createEquipment(@Body() body: { clientId: number; equipmentTypeId: number; brand: string; model: string; serialNumber?: string; color?: string; physicalDescription?: string; accessories?: string }) {
    return this.core.createEquipment(body);
  }

  @Patch('equipment/:id')
  updateEquipment(@Param('id') id: string, @Body() body: { clientId?: number; equipmentTypeId?: number; brand?: string; model?: string; serialNumber?: string; color?: string; physicalDescription?: string; accessories?: string }) {
    return this.core.updateEquipment(Number(id), body);
  }

  @Get('technicians')
  technicians() {
    return this.core.technicians();
  }

  @Get('spare-parts')
  spareParts() {
    return this.core.spareParts();
  }

  @Post('spare-parts')
  createSparePart(@Body() body: { internalCode: string; name: string; category: string; purchasePrice: number; publicSalePrice: number; currentStock?: number; minimumStock?: number; description?: string; compatibleWith?: string }) {
    return this.core.createSparePart(body);
  }

  @Post('spare-parts/bulk-import')
  bulkImportSpareParts(
    @Body()
    body: {
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
      }[];
    },
  ) {
    return this.core.bulkImportSpareParts(body.items);
  }

  @Patch('spare-parts/:id')
  updateSparePart(@Param('id') id: string, @Body() body: { internalCode?: string; name?: string; category?: string; purchasePrice?: number; publicSalePrice?: number; currentStock?: number; minimumStock?: number; description?: string; compatibleWith?: string }) {
    return this.core.updateSparePart(Number(id), body);
  }

  @Post('spare-parts/:id/sale')
  sellSparePart(@Param('id') id: string, @Body() body: { quantity: number; unitPrice?: number; notes?: string }, @Req() request: AuthRequest) {
    return this.core.sellSparePart(Number(id), body.quantity, request.user.sub, body.unitPrice, body.notes);
  }

  @Get('inventory-sales')
  inventorySales() {
    return this.core.inventorySales();
  }

  @Post('inventory-sales')
  createInventorySale(
    @Body()
    body: {
      clientId: number;
      paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'QR_PAGO';
      notes?: string;
      items: { sparePartId: number; quantity: number; unitPrice: number }[];
    },
    @Req() request: AuthRequest,
  ) {
    return this.core.createInventorySale({ ...body, registeredById: request.user.sub });
  }

  @Get('orders')
  orders() {
    return this.core.orders();
  }

  @Post('orders')
  createOrder(
    @Body()
    body: {
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
    },
    @Req() request: AuthRequest,
  ) {
    return this.core.createOrder({ ...body, createdById: request.user.sub });
  }

  @Patch('orders/:id')
  updateOrder(
    @Param('id') id: string,
    @Body()
    body: {
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
    @Req() request: AuthRequest,
  ) {
    return this.core.updateOrder(Number(id), body, request.user.sub);
  }

  @Patch('orders/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: { status: OrderStatus; comment?: string }, @Req() request: AuthRequest) {
    return this.core.changeStatus(Number(id), body.status, request.user.sub, body.comment);
  }

  @Patch('orders/:id/diagnosis')
  updateDiagnosis(@Param('id') id: string, @Body() body: { diagnosis: string; additionalFaultDetail?: string }, @Req() request: AuthRequest) {
    return this.core.updateDiagnosis(Number(id), body, request.user.sub);
  }

  @Patch('orders/:id/approve-quote')
  approveQuote(@Param('id') id: string, @Body() body: { approved: boolean; method: string }, @Req() request: AuthRequest) {
    return this.core.approveQuote(Number(id), body.approved, body.method, request.user.sub);
  }

  @Post('orders/:id/quotes')
  addQuote(@Param('id') id: string, @Body() body: { description: string; type: 'REPUESTO' | 'MANO_OBRA' | 'OTRO'; quantity: number; unitPrice: number; sparePartId?: number }) {
    return this.core.addQuote(Number(id), body);
  }

  @Patch('orders/:orderId/quotes/:quoteId')
  updateQuote(
    @Param('orderId') orderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { description: string; type: 'REPUESTO' | 'MANO_OBRA' | 'OTRO'; quantity: number; unitPrice: number; sparePartId?: number },
  ) {
    return this.core.updateQuote(Number(orderId), Number(quoteId), body);
  }

  @Patch('orders/:orderId/quotes/:quoteId/remove')
  removeQuote(@Param('orderId') orderId: string, @Param('quoteId') quoteId: string) {
    return this.core.removeQuote(Number(orderId), Number(quoteId));
  }

  @Post('orders/:id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; paymentMethod: string; paymentType?: string; reference?: string; notes?: string },
    @Req() request: AuthRequest,
  ) {
    return this.core.addPayment(Number(id), { ...body, registeredById: request.user.sub });
  }
}
