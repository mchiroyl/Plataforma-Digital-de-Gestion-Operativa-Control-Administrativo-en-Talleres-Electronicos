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

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tracking/:orderCode')
  tracking(@Param('orderCode') orderCode: string, @Query('token') token: string) {
    return this.core.tracking(orderCode, token);
  }

  @Get('settings')
  settings() {
    return this.core.publicSettings();
  }

  @Get('settings/logo')
  async logo(@Res() response: any) {
    const logo = await this.core.logo();
    if (!logo) {
      response.status(404).send('Logo no configurado');
      return;
    }
    response.setHeader('Content-Type', logo.contentType);
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (logo.updatedAt) response.setHeader('Last-Modified', new Date(logo.updatedAt).toUTCString());
    response.send(logo.buffer);
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
    const settings = await this.core.publicSettings();
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
    const isThermal = settings?.ticketFormat === 'THERMAL_80MM';
    const logoHtml = settings?.hasLogo
      ? `<img class="brand-logo" src="/api/public/settings/logo?v=${encodeURIComponent(String(settings.logoUpdatedAt ?? settings.updatedAt ?? ''))}" alt="Logotipo del taller" />`
      : `<div class="brand-fallback">ST</div>`;
    const shopContact = [
      settings?.phone ? `Tel. ${settings.phone}` : '',
      settings?.whatsapp ? `WhatsApp ${settings.whatsapp}` : '',
      settings?.contactEmail ?? '',
    ].filter(Boolean).join(' | ');
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(order.orderCode)}</title>
  <style>
    :root { color: #0f172a; font-family: Arial, sans-serif; }
    body { margin: 0; background: #eef4f8; padding: ${isThermal ? '0' : '24px'}; }
    .ticket { width: ${isThermal ? '80mm' : 'min(100%, 780px)'}; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: ${isThermal ? '0' : '14px'}; background: #fff; padding: ${isThermal ? '10px' : '26px'}; box-shadow: ${isThermal ? 'none' : '0 18px 48px rgba(15,23,42,.12)'}; }
    button { margin-bottom: 14px; border: 0; border-radius: 8px; background: #2f90c4; color: #fff; padding: 10px 14px; font-weight: 800; }
    h1, h2, h3, p { margin: 0; }
    .brand { display: grid; grid-template-columns: ${isThermal ? '1fr' : '76px 1fr auto'}; gap: 14px; align-items: center; border: 1px solid #d8e4ec; border-radius: 12px; background: linear-gradient(135deg, #f8fbfd, #eef7fb); padding: ${isThermal ? '10px' : '14px'}; text-align: ${isThermal ? 'center' : 'left'}; }
    .brand-logo { width: ${isThermal ? '52px' : '66px'}; height: ${isThermal ? '52px' : '66px'}; object-fit: contain; margin: ${isThermal ? '0 auto 6px' : '0'}; }
    .brand-fallback { display: grid; place-items: center; width: ${isThermal ? '52px' : '66px'}; height: ${isThermal ? '52px' : '66px'}; border-radius: 10px; background: #0ea5e9; color: #fff; font-size: 22px; font-weight: 900; margin: ${isThermal ? '0 auto 6px' : '0'}; }
    .brand h1 { font-size: ${isThermal ? '18px' : '23px'}; line-height: 1.08; }
    .brand p { color: #475569; font-size: ${isThermal ? '10px' : '12px'}; line-height: 1.35; }
    .status { display: inline-block; border-radius: 999px; background: #ccfbf1; color: #115e59; padding: 5px 10px; font-size: 11px; font-weight: 900; }
    .qr { text-align: center; }
    .qr img { width: ${isThermal ? '116px' : '132px'}; height: ${isThermal ? '116px' : '132px'}; }
    .order-title { margin: 18px 0 12px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .order-title h2 { font-size: ${isThermal ? '20px' : '26px'}; }
    .section { margin-top: 12px; border: 1px solid #d8e4ec; border-radius: 10px; padding: ${isThermal ? '9px' : '13px'}; }
    .section h3 { margin-bottom: 8px; color: #0f766e; font-size: ${isThermal ? '12px' : '14px'}; text-transform: uppercase; }
    p, li { font-size: ${isThermal ? '11px' : '14px'}; line-height: 1.45; }
    ul { margin: 6px 0 0 18px; padding: 0; }
    .grid { display: grid; grid-template-columns: ${isThermal ? '1fr' : '1fr 1fr'}; gap: 10px; }
    .url { word-break: break-all; font-size: ${isThermal ? '9px' : '12px'}; color: #475569; }
    .terms { color: #475569; }
    .signature { margin-top: ${isThermal ? '22px' : '38px'}; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .line { border-top: 1px solid #0f172a; padding-top: 7px; text-align: center; font-size: ${isThermal ? '10px' : '12px'}; }
    @page { size: ${isThermal ? '80mm auto' : 'letter'}; margin: ${isThermal ? '4mm' : '12mm'}; }
    @media print { button { display: none; } body { background: #fff; margin: 0; padding: 0; } .ticket { border: none; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="ticket">
    <button onclick="window.print()">Imprimir ticket</button>
    <div class="brand">
      ${logoHtml}
      <div>
        <h1>${escapeHtml(settings?.shopName ?? 'Taller Electronico')}</h1>
        ${settings?.slogan ? `<p>${escapeHtml(settings.slogan)}</p>` : ''}
        ${shopContact ? `<p>${escapeHtml(shopContact)}</p>` : ''}
        ${settings?.address ? `<p>${escapeHtml(settings.address)}</p>` : ''}
      </div>
      <div class="qr">
        <img src="${qr}" alt="QR de rastreo" />
        <p>Rastreo publico</p>
      </div>
    </div>

    <div class="order-title">
      <div>
        <p>Ticket de recepcion</p>
        <h2>${escapeHtml(order.orderCode)}</h2>
      </div>
      <span class="status">${escapeHtml(order.status)}</span>
    </div>

    <div class="grid">
      <section class="section">
        <h3>Cliente</h3>
        <p><strong>${escapeHtml(`${order.client.firstName} ${order.client.lastName}`)}</strong></p>
        <p>Telefono: ${escapeHtml(order.client.phone || 'No registrado')}</p>
      </section>
      <section class="section">
        <h3>Ingreso</h3>
        <p>Fecha: ${new Date(order.intakeDate).toLocaleString('es-GT')}</p>
        <p>Estado: ${escapeHtml(order.status)}</p>
      </section>
    </div>

    <section class="section">
      <h3>Equipo recibido</h3>
      <p><strong>${escapeHtml(`${order.equipment.equipmentType.name} ${order.equipment.brand} ${order.equipment.model}`)}</strong></p>
      <p>Serie/IMEI: ${escapeHtml(order.equipment.serialNumber ?? 'N/A')} | Color: ${escapeHtml(order.equipment.color ?? 'N/A')}</p>
      <p>Estado fisico: ${escapeHtml(order.equipment.physicalDescription ?? 'Sin observaciones')}</p>
      <p>Accesorios: ${escapeHtml(order.equipment.accessories ?? 'Ninguno registrado')}</p>
    </section>

    <section class="section">
      <h3>Problema reportado</h3>
      <p>${escapeHtml(order.reportedIssue)}</p>
      <p>Falla adicional: ${escapeHtml(order.additionalFaultDetail ?? 'NO REGISTRADA')}</p>
      <p>Diagnostico tecnico: ${escapeHtml(order.diagnosis ?? 'PENDIENTE')}</p>
      <ul>${faults}</ul>
    </section>

    <section class="section">
      <h3>Datos de desbloqueo</h3>
      <p>Tipo: ${escapeHtml(order.unlockCredentialType ?? 'NO REGISTRADO')}</p>
      <p>Valor recibido: ${escapeHtml(order.unlockCredentialValue ?? 'NO REGISTRADO')}</p>
      <p>Notas: ${escapeHtml(order.unlockCredentialNotes ?? 'SIN NOTAS')}</p>
    </section>

    <section class="section">
      <h3>Rastreo publico</h3>
      <p class="url">${escapeHtml(trackingUrl)}</p>
    </section>

    <section class="section terms">
      <h3>Terminos</h3>
      <p>${escapeHtml(settings?.termsText ?? 'El cliente debe presentar codigo de orden para retirar el equipo.')}</p>
    </section>

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
