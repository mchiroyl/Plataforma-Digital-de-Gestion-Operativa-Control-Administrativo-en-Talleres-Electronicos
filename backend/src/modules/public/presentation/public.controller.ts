import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import QRCode from 'qrcode';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma/prisma.service';
import { CoreService } from '../../core/application/core.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly core: CoreService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('tracking/:orderCode')
  tracking(@Param('orderCode') orderCode: string, @Query('token') token: string) {
    return this.core.tracking(orderCode, token);
  }

  @Patch('tracking/:orderCode/quote-decision')
  quoteDecision(
    @Param('orderCode') orderCode: string,
    @Query('token') token: string,
    @Body() body: { approved: boolean; customerName?: string; comment?: string },
  ) {
    return this.core.customerQuoteDecision(orderCode, token, body.approved, body.customerName, body.comment);
  }

  @Get('orders/:id/ticket')
  async ticket(@Param('id') id: string, @Res() response: any) {
    const order = await this.prisma.repairOrder.findUnique({
      where: { id: Number(id) },
      include: {
        client: true,
        equipment: { include: { equipmentType: true } },
        faults: { include: { faultType: true } },
      },
    });
    const settings = await this.core.settings();
    if (!order) {
      response.status(404).send('Orden no encontrada');
      return;
    }

    const frontendUrl = (process.env.PUBLIC_FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const trackingUrl = `${frontendUrl}/#/rastreo/${encodeURIComponent(order.orderCode)}?token=${encodeURIComponent(order.trackingToken)}`;
    const qr = await QRCode.toDataURL(trackingUrl, { margin: 1, width: 180 });
    const faults = order.faults.length
      ? order.faults.map((item) => `<li>${escapeHtml(item.faultType.name)}</li>`).join('')
      : `<li>${escapeHtml(order.reportedIssue)}</li>`;
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(order.orderCode)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
    .ticket { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 24px; border-radius: 8px; }
    .top { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 24px; }
    h2 { margin-top: 18px; font-size: 15px; text-transform: uppercase; color: #0f766e; }
    p, li { font-size: 14px; line-height: 1.45; }
    img { width: 150px; height: 150px; }
    .muted { color: #475569; }
    .url { word-break: break-all; font-size: 12px; }
    .signature { margin-top: 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .line { border-top: 1px solid #0f172a; padding-top: 8px; text-align: center; }
    @media print { button { display: none; } body { margin: 0; } .ticket { border: none; } }
  </style>
</head>
<body>
  <div class="ticket">
    <button onclick="window.print()">Imprimir ticket</button>
    <div class="top">
      <div>
        <p class="muted">${escapeHtml(settings?.shopName ?? 'Taller Electronico')}</p>
        <h1>${escapeHtml(order.orderCode)}</h1>
        <p>Fecha de ingreso: ${new Date(order.intakeDate).toLocaleString('es-GT')}</p>
      </div>
      <div>
        <img src="${qr}" alt="QR de rastreo" />
        <p class="muted">Escanee para ver el estado</p>
      </div>
    </div>

    <h2>Cliente</h2>
    <p>${escapeHtml(`${order.client.firstName} ${order.client.lastName}`)}</p>
    <p>Telefono: ${escapeHtml(order.client.phone || 'No registrado')}</p>

    <h2>Equipo recibido</h2>
    <p>${escapeHtml(`${order.equipment.equipmentType.name} ${order.equipment.brand} ${order.equipment.model}`)}</p>
    <p>Serie/IMEI: ${escapeHtml(order.equipment.serialNumber ?? 'N/A')} | Color: ${escapeHtml(order.equipment.color ?? 'N/A')}</p>

    <h2>Problema reportado y fallas marcadas</h2>
    <p>${escapeHtml(order.reportedIssue)}</p>
    <p>Falla adicional: ${escapeHtml(order.additionalFaultDetail ?? 'NO REGISTRADA')}</p>
    <p>Diagnostico tecnico: ${escapeHtml(order.diagnosis ?? 'PENDIENTE')}</p>
    <ul>${faults}</ul>

    <h2>Datos de desbloqueo</h2>
    <p>Tipo: ${escapeHtml(order.unlockCredentialType ?? 'NO REGISTRADO')}</p>
    <p>Valor recibido: ${escapeHtml(order.unlockCredentialValue ?? 'NO REGISTRADO')}</p>
    <p>Notas: ${escapeHtml(order.unlockCredentialNotes ?? 'SIN NOTAS')}</p>

    <h2>Estado fisico y accesorios</h2>
    <p>${escapeHtml(order.equipment.physicalDescription ?? 'Sin observaciones')}</p>
    <p>Accesorios: ${escapeHtml(order.equipment.accessories ?? 'Ninguno registrado')}</p>

    <h2>Rastreo publico</h2>
    <p class="url">${escapeHtml(trackingUrl)}</p>

    <h2>Terminos</h2>
    <p>${escapeHtml(settings?.termsText ?? 'El cliente debe presentar codigo de orden para retirar el equipo.')}</p>

    <div class="signature">
      <div class="line">Firma del cliente</div>
      <div class="line">Recibido por taller</div>
    </div>
  </div>
</body>
</html>`;

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.send(html);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
