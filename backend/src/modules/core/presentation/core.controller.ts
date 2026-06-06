import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrderStatus, ServiceLine } from '@prisma/client';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AuthRequest } from '../../../shared/presentation/http/auth-request.type';
import { CoreService } from '../application/core.service';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';

const evidenceUploadDir = join(process.cwd(), 'uploads', 'evidences');
mkdirSync(evidenceUploadDir, { recursive: true });

const evidenceStorage = diskStorage({
  destination: evidenceUploadDir,
  filename: (_request, file, callback) => {
    callback(null, `${Date.now()}-${randomUUID()}${extname(file.originalname) || '.jpg'}`);
  },
});

@UseGuards(AuthGuard)
@Controller()
export class CoreController {
  constructor(private readonly core: CoreService) {}

  @Get('settings')
  settings() {
    return this.core.settings();
  }

  @Patch('settings')
  updateSettings(@Body() body: Record<string, unknown>, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede actualizar ajustes');
    return this.core.updateSettings({ ...body, updatedById: request.user.sub });
  }

  @Post('settings/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  updateLogo(@UploadedFile() file: Express.Multer.File, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede actualizar el logotipo');
    return this.core.updateLogo(file);
  }

  @Get('dashboard')
  dashboard(@Req() request: AuthRequest, @Query('period') period?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.core.dashboard(request.user, { period, from, to });
  }

  @Get('users')
  users(@Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede administrar usuarios');
    return this.core.users();
  }

  @Post('users')
  createUser(@Body() body: { username: string; email: string; fullName: string; password: string; role: 'ADMIN' | 'RECEPCIONISTA' | 'TECNICO'; isActive?: boolean }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede administrar usuarios');
    return this.core.createUser(body);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: { username?: string; email?: string; fullName?: string; password?: string; role?: 'ADMIN' | 'RECEPCIONISTA' | 'TECNICO'; isActive?: boolean },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede administrar usuarios');
    return this.core.updateUser(Number(id), body);
  }

  @Get('expenses')
  expenses(@Req() request: AuthRequest, @Query('category') category?: string, @Query('from') from?: string, @Query('to') to?: string) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede consultar gastos');
    return this.core.expenses({ category, from, to });
  }

  @Post('expenses')
  createExpense(
    @Body() body: { spentAt?: string; category: string; description: string; amount: number; paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'QR_PAGO'; responsible: string; notes?: string },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede registrar gastos');
    return this.core.createExpense({ ...body, registeredById: request.user.sub });
  }

  @Patch('expenses/:id')
  updateExpense(
    @Param('id') id: string,
    @Body() body: { spentAt?: string; category?: string; description?: string; amount?: number; paymentMethod?: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'QR_PAGO'; responsible?: string; notes?: string; isActive?: boolean },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede actualizar gastos');
    return this.core.updateExpense(Number(id), body);
  }

  @Get('clients')
  clients(@Query('q') query?: string) {
    return this.core.clients(query);
  }

  @Post('clients')
  createClient(@Body() body: { firstName: string; lastName: string; phone: string; dpi?: string; nit?: string; email?: string; address?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede registrar clientes');
    return this.core.createClient(body);
  }

  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() body: { firstName?: string; lastName?: string; phone?: string; dpi?: string; nit?: string; email?: string; address?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede actualizar clientes');
    return this.core.updateClient(Number(id), body);
  }

  @Get('equipment-types')
  equipmentTypes(@Query('includeInactive') includeInactive?: string, @Query('serviceLine') serviceLine?: ServiceLine) {
    return this.core.equipmentTypes({ includeInactive: includeInactive === 'true', serviceLine });
  }

  @Post('equipment-types')
  createEquipmentType(
    @Body() body: { name: string; serviceLine: ServiceLine; requiresCredential?: boolean; allowsUnlockCase?: boolean; isActive?: boolean },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede configurar tipos de equipo');
    return this.core.createEquipmentType(body);
  }

  @Patch('equipment-types/:id')
  updateEquipmentType(
    @Param('id') id: string,
    @Body() body: { name?: string; serviceLine?: ServiceLine; requiresCredential?: boolean; allowsUnlockCase?: boolean; isActive?: boolean },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede configurar tipos de equipo');
    return this.core.updateEquipmentType(Number(id), body);
  }

  @Get('fault-types')
  faultTypes() {
    return this.core.faultTypes();
  }

  @Get('equipment')
  equipment(
    @Req() request: AuthRequest,
    @Query('clientId') clientId?: string,
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('serialNumber') serialNumber?: string,
    @Query('serviceLine') serviceLine?: ServiceLine,
    @Query('equipmentTypeId') equipmentTypeId?: string,
  ) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede consultar equipos');
    return this.core.equipment({
      clientId: clientId ? Number(clientId) : undefined,
      brand,
      model,
      serialNumber,
      serviceLine,
      equipmentTypeId: equipmentTypeId ? Number(equipmentTypeId) : undefined,
    });
  }

  @Post('equipment')
  createEquipment(@Body() body: { clientId: number; equipmentTypeId: number; brand: string; model: string; serialNumber?: string; color?: string; physicalDescription?: string; accessories?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede registrar equipos');
    return this.core.createEquipment(body);
  }

  @Patch('equipment/:id')
  updateEquipment(@Param('id') id: string, @Body() body: { clientId?: number; equipmentTypeId?: number; brand?: string; model?: string; serialNumber?: string; color?: string; physicalDescription?: string; accessories?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede actualizar equipos');
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
  createSparePart(@Body() body: { internalCode: string; name: string; category: string; purchasePrice: number; publicSalePrice: number; currentStock?: number; minimumStock?: number; description?: string; compatibleWith?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede modificar inventario');
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
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede importar inventario');
    return this.core.bulkImportSpareParts(body.items);
  }

  @Get('spare-parts/:id/label')
  async sparePartLabel(@Param('id') id: string, @Res() response: any) {
    const file = await this.core.sparePartLabel(Number(id));
    return this.sendGeneratedFile(response, file);
  }

  @Patch('spare-parts/:id')
  updateSparePart(@Param('id') id: string, @Body() body: { internalCode?: string; name?: string; category?: string; purchasePrice?: number; publicSalePrice?: number; currentStock?: number; minimumStock?: number; description?: string; compatibleWith?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede modificar inventario');
    return this.core.updateSparePart(Number(id), body);
  }

  @Post('spare-parts/:id/sale')
  sellSparePart(@Param('id') id: string, @Body() body: { quantity: number; unitPrice?: number; notes?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede registrar ventas');
    return this.core.sellSparePart(Number(id), body.quantity, request.user.sub, body.unitPrice, body.notes);
  }

  @Get('inventory-sales')
  inventorySales(@Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede consultar ventas');
    return this.core.inventorySales();
  }

  @Get('inventory-sales/:id/receipt')
  async inventorySaleReceipt(@Param('id') id: string, @Res() response: any) {
    const file = await this.core.inventorySaleReceipt(Number(id));
    return this.sendGeneratedFile(response, file);
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
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede registrar ventas');
    return this.core.createInventorySale({ ...body, registeredById: request.user.sub });
  }

  @Get('orders/export/pdf')
  async exportOrdersPdf(@Query('status') status: string, @Query('client') client: string, @Query('from') from: string, @Query('to') to: string, @Res() response: any, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede exportar servicios');
    const file = await this.core.exportOrdersPdf({ status, client, from, to });
    return this.sendGeneratedFile(response, file);
  }

  @Get('orders/export/excel')
  async exportOrdersExcel(@Query('status') status: string, @Query('client') client: string, @Query('from') from: string, @Query('to') to: string, @Res() response: any, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede exportar servicios');
    const file = await this.core.exportOrdersExcel({ status, client, from, to });
    return this.sendGeneratedFile(response, file);
  }

  @Get('orders')
  orders(@Req() request: AuthRequest) {
    return this.core.ordersForUser(request.user);
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
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede crear ordenes');
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
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede editar datos administrativos de ordenes');
    return this.core.updateOrder(Number(id), body, request.user.sub);
  }

  @Patch('orders/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: { status: OrderStatus; comment?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'TECNICO'], 'Solo ADMIN o TECNICO puede cambiar estados tecnicos');
    return this.core.changeStatus(Number(id), body.status, request.user.sub, body.comment);
  }

  @Patch('orders/:id/diagnosis')
  updateDiagnosis(@Param('id') id: string, @Body() body: { diagnosis: string; additionalFaultDetail?: string }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'TECNICO'], 'Solo ADMIN o TECNICO puede registrar diagnostico tecnico');
    return this.core.updateDiagnosis(Number(id), body, request.user.sub);
  }

  @Patch('orders/:id/approve-quote')
  approveQuote(@Param('id') id: string, @Body() body: { approved: boolean; method: string }, @Req() request: AuthRequest) {
    return this.core.approveQuote(Number(id), body.approved, body.method, request.user.sub);
  }

  @Get('orders/:id/evidences')
  evidences(@Param('id') id: string) {
    return this.core.evidences(Number(id));
  }

  @Post('orders/:id/evidences')
  @UseInterceptors(FileInterceptor('file', { storage: evidenceStorage, limits: { fileSize: 6 * 1024 * 1024 } }))
  addEvidence(
    @Param('id') id: string,
    @Body() body: { evidenceType: 'RECEPCION' | 'DIAGNOSTICO' | 'REPARACION' | 'ENTREGA'; description?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN', 'TECNICO'], 'Solo ADMIN o TECNICO puede agregar evidencias tecnicas');
    return this.core.addEvidence(Number(id), { ...body, uploadedById: request.user.sub }, file);
  }

  @Get('orders/:id/evidences/:evidenceId/file')
  async evidenceFile(@Param('id') id: string, @Param('evidenceId') evidenceId: string, @Res() response: any) {
    const file = await this.core.evidenceFile(Number(id), Number(evidenceId));
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
    return file.stream.pipe(response);
  }

  @Delete('orders/:id/evidences/:evidenceId')
  deleteEvidence(@Param('id') id: string, @Param('evidenceId') evidenceId: string) {
    return this.core.deleteEvidence(Number(id), Number(evidenceId));
  }

  @Post('orders/:id/quotes')
  addQuote(@Param('id') id: string, @Body() body: { description: string; type: 'REPUESTO' | 'MANO_OBRA' | 'OTRO'; quantity: number; unitPrice: number; sparePartId?: number }, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'TECNICO'], 'Solo ADMIN o TECNICO puede preparar presupuesto tecnico');
    return this.core.addQuote(Number(id), body);
  }

  @Patch('orders/:orderId/quotes/:quoteId')
  updateQuote(
    @Param('orderId') orderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { description: string; type: 'REPUESTO' | 'MANO_OBRA' | 'OTRO'; quantity: number; unitPrice: number; sparePartId?: number },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN', 'TECNICO'], 'Solo ADMIN o TECNICO puede actualizar presupuesto tecnico');
    return this.core.updateQuote(Number(orderId), Number(quoteId), body);
  }

  @Patch('orders/:orderId/quotes/:quoteId/remove')
  removeQuote(@Param('orderId') orderId: string, @Param('quoteId') quoteId: string, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'TECNICO'], 'Solo ADMIN o TECNICO puede eliminar detalles de presupuesto');
    return this.core.removeQuote(Number(orderId), Number(quoteId));
  }

  @Post('orders/:id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; paymentMethod: string; paymentType?: string; reference?: string; notes?: string },
    @Req() request: AuthRequest,
  ) {
    this.assertRoles(request, ['ADMIN'], 'Solo ADMIN puede registrar pagos');
    return this.core.addPayment(Number(id), { ...body, registeredById: request.user.sub });
  }

  @Get('payments/:id/receipt')
  async paymentReceipt(@Param('id') id: string, @Res() response: any, @Req() request: AuthRequest) {
    this.assertRoles(request, ['ADMIN', 'RECEPCIONISTA'], 'Solo ADMIN o RECEPCIONISTA puede descargar comprobantes');
    const file = await this.core.paymentReceipt(Number(id));
    return this.sendGeneratedFile(response, file);
  }

  private sendGeneratedFile(response: any, file: { buffer: Buffer; filename: string; contentType: string }) {
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/"/g, '')}"`);
    return response.send(file.buffer);
  }

  private assertRoles(request: AuthRequest, roles: string[], message: string) {
    if (!roles.includes(request.user.role)) {
      throw new ForbiddenException(message);
    }
  }
}
