import fs from "node:fs/promises";
import path from "node:path";

import { Presentation, PresentationFile } from "file:///C:/Users/Anonymous/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const OUT = "C:/Users/Anonymous/.gemini/antigravity/scratch/ing_Software/plataforma-talleres-electronicos/outputs/manual-20260530-proceso-sistema/presentations/diagrama-proceso-sistema/output/proceso-operativo-talleres-electronicos.pptx";
const PREVIEW = "C:/Users/Anonymous/.gemini/antigravity/scratch/ing_Software/plataforma-talleres-electronicos/outputs/manual-20260530-proceso-sistema/presentations/diagrama-proceso-sistema/preview";
const W = 1280;
const H = 720;

const c = {
  ink: "#082032",
  muted: "#52606D",
  line: "#D7DEE8",
  bg: "#F6F8FA",
  teal: "#0F766E",
  teal2: "#14B8A6",
  blue: "#2563EB",
  amber: "#D97706",
  red: "#DC2626",
  green: "#15803D",
  dark: "#0B1220",
  white: "#FFFFFF",
};

const deck = Presentation.create({ slideSize: { width: W, height: H } });

function addSlide(title, kicker = "Proceso operativo del sistema") {
  const slide = deck.slides.add();
  rect(slide, 0, 0, W, H, c.bg, c.bg);
  rect(slide, 0, 0, 18, H, c.teal, c.teal);
  text(slide, kicker.toUpperCase(), 56, 34, 760, 24, { size: 14, color: c.teal, bold: true });
  text(slide, title, 56, 60, 940, 54, { size: 34, color: c.ink, bold: true, face: "Aptos Display" });
  rect(slide, 56, 126, 1168, 1, c.line, c.line);
  return slide;
}

function rect(slide, x, y, w, h, fill = c.white, line = c.line, radius = "rect") {
  return slide.shapes.add({
    geometry: radius,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: line, width: line === "transparent" ? 0 : 1 },
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const box = rect(slide, x, y, w, h, opts.fill ?? "#00000000", opts.line ?? "#00000000");
  box.text = value;
  box.text.fontSize = opts.size ?? 20;
  box.text.color = opts.color ?? c.ink;
  box.text.bold = Boolean(opts.bold);
  box.text.typeface = opts.face ?? "Aptos";
  box.text.alignment = opts.align ?? "left";
  box.text.verticalAlignment = opts.valign ?? "top";
  box.text.insets = opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  return box;
}

function pill(slide, label, x, y, w, fill, color = c.white) {
  rect(slide, x, y, w, 34, fill, fill, "roundRect");
  text(slide, label, x, y + 7, w, 20, { size: 13, color, bold: true, align: "center" });
}

function card(slide, title, body, x, y, w, h, accent = c.teal) {
  rect(slide, x, y, w, h, c.white, c.line, "roundRect");
  rect(slide, x, y, 6, h, accent, accent);
  text(slide, title, x + 20, y + 18, w - 36, 26, { size: 20, bold: true });
  text(slide, body, x + 20, y + 54, w - 36, h - 70, { size: 15, color: c.muted });
}

function step(slide, n, title, body, x, y, w, h, accent = c.teal) {
  rect(slide, x, y, w, h, c.white, c.line, "roundRect");
  rect(slide, x + 16, y + 16, 38, 38, accent, accent, "roundRect");
  text(slide, String(n), x + 16, y + 24, 38, 18, { size: 16, color: c.white, bold: true, align: "center" });
  text(slide, title, x + 68, y + 16, w - 84, 26, { size: 18, bold: true });
  text(slide, body, x + 68, y + 47, w - 84, h - 56, { size: 14, color: c.muted });
}

function arrow(slide, x, y, w = 46, label = "→") {
  text(slide, label, x, y, w, 34, { size: 28, color: c.teal, bold: true, align: "center" });
}

function footer(slide, n) {
  text(slide, `Ingeniería de software · UMG · ${String(n).padStart(2, "0")}`, 990, 682, 230, 20, { size: 10, color: "#7A8694", align: "right" });
}

// 1
{
  const s = deck.slides.add();
  rect(s, 0, 0, W, H, c.dark, c.dark);
  rect(s, 0, 0, W, 110, "#0F766E", "#0F766E");
  text(s, "Universidad Mariano Gálvez de Guatemala", 64, 38, 760, 28, { size: 20, color: c.white, bold: true });
  text(s, "Diagrama de proceso del sistema", 64, 182, 850, 64, { size: 44, color: c.white, bold: true, face: "Aptos Display" });
  text(s, "Plataforma digital de gestion operativa para talleres electronicos", 64, 258, 850, 36, { size: 22, color: "#B8FFF5" });
  card(s, "Curso", "Ingeniería de software\nInstructora: Ing. Karen Patricia Hernández", 64, 365, 360, 126, c.teal2);
  card(s, "Integrantes", "Marvin Chiroy · Obady Pérez · Zaqueo Chivalan\nEddy Cuyuch · Josue Sanchez", 452, 365, 560, 126, c.blue);
  rect(s, 1060, 166, 88, 88, "#14B8A6", "#14B8A6", "roundRect");
  rect(s, 1102, 208, 88, 88, "#2563EB", "#2563EB", "roundRect");
  rect(s, 1018, 250, 88, 88, "#D97706", "#D97706", "roundRect");
  footer(s, 1);
}

// 2
{
  const s = addSlide("El sistema digitaliza el ciclo completo de una reparacion");
  text(s, "La plataforma conecta recepcion, tecnico, cliente e inventario para que cada orden avance con trazabilidad, evidencia y decisiones registradas.", 56, 145, 1100, 44, { size: 21, color: c.muted });
  const steps = [
    ["Recepcion", "Cliente, equipo, falla y ticket QR"],
    ["Revision tecnica", "Diagnostico, hallazgos y presupuesto"],
    ["Decision cliente", "Rastreo publico o WhatsApp"],
    ["Ejecucion", "Reparacion, inventario, pago y entrega"],
  ];
  steps.forEach(([t, b], i) => {
    const x = 72 + i * 288;
    step(s, i + 1, t, b, x, 270, 238, 160, [c.teal, c.blue, c.amber, c.green][i]);
    if (i < 3) arrow(s, x + 244, 330);
  });
  card(s, "Resultado administrativo", "Una orden conserva codigo unico, token de rastreo, historial de estados, presupuesto, pagos y movimientos de inventario.", 126, 520, 1028, 88, c.teal);
  footer(s, 2);
}

// 3
{
  const s = addSlide("Mapa general del flujo operativo");
  const labels = [
    ["Cliente llega", "Entrega equipo y describe el problema"],
    ["Registro", "Cliente + equipo + fallas + clave si aplica"],
    ["Orden y QR", "Codigo ORD-YYYY-00001 y token publico"],
    ["Diagnostico", "Tecnico registra hallazgos"],
    ["Presupuesto", "Mano de obra, repuestos y total"],
    ["Decision", "Aceptar o rechazar"],
    ["Reparacion", "Consumo de inventario si aplica"],
    ["Pago y entrega", "Saldo cero para finalizar"],
  ];
  labels.forEach(([t, b], i) => {
    const row = i < 4 ? 0 : 1;
    const col = i % 4;
    const x = 62 + col * 298;
    const y = row === 0 ? 172 : 440;
    step(s, i + 1, t, b, x, y, 230, 120, [c.teal, c.teal, c.blue, c.blue, c.amber, c.amber, c.green, c.green][i]);
    if (col < 3) arrow(s, x + 232, y + 44);
  });
  text(s, "El flujo se mueve de la recepcion hacia la entrega; cada etapa agrega datos que reducen errores y reclamos.", 96, 332, 1088, 40, { size: 20, color: c.muted, align: "center" });
  footer(s, 3);
}

// 4
{
  const s = addSlide("Recepcion: captura inicial y control de evidencia");
  step(s, 1, "Buscar o registrar cliente", "Nombre, telefono, DPI/NIT y datos de contacto.", 70, 170, 300, 130, c.teal);
  step(s, 2, "Registrar equipo", "Tipo, marca, modelo, serie/IMEI, color, estado fisico y accesorios.", 490, 170, 300, 130, c.blue);
  step(s, 3, "Crear orden", "Problema reportado, fallas marcadas y tecnico asignado si aplica.", 910, 170, 300, 130, c.amber);
  arrow(s, 388, 218, 74);
  arrow(s, 808, 218, 74);
  card(s, "Decision importante", "Si alguna falla requiere desbloqueo, el sistema pide PIN, contrasena o patron. Ese valor se guarda exacto, sin convertirlo a mayusculas.", 110, 420, 500, 118, c.red);
  card(s, "Salida de la recepcion", "Se genera codigo de orden, token de rastreo y ticket con QR. El cliente puede conservar el ticket impreso o recibir enlace por WhatsApp.", 670, 420, 500, 118, c.teal);
  footer(s, 4);
}

// 5
{
  const s = addSlide("Ticket QR y rastreo publico");
  card(s, "Ticket con QR", "Incluye codigo de orden, datos del cliente, equipo recibido, problema reportado, diagnostico pendiente y terminos.", 70, 170, 340, 170, c.blue);
  arrow(s, 430, 230, 70);
  card(s, "Pagina publica", "No requiere login. El cliente ve estado, diagnostico, presupuesto e historial de avances.", 500, 170, 340, 170, c.teal);
  arrow(s, 860, 230, 70);
  card(s, "Decision del cliente", "Cuando hay presupuesto pendiente, la pagina permite aceptar o rechazar directamente.", 930, 170, 280, 170, c.amber);
  rect(s, 174, 438, 930, 86, "#ECFDF5", "#A7F3D0", "roundRect");
  text(s, "El rastreo publico funciona como puente entre taller y cliente: reduce llamadas, evita perdida de informacion y registra la autorizacion del presupuesto.", 210, 463, 860, 32, { size: 20, color: c.teal, bold: true, align: "center" });
  footer(s, 5);
}

// 6
{
  const s = addSlide("Diagnostico y presupuesto tecnico");
  const items = [
    ["Revision", "Pruebas fisicas, electronicas o de software."],
    ["Diagnostico", "Hallazgos reales y fallas nuevas detectadas."],
    ["Detalle", "Mano de obra, repuesto de inventario o cargo adicional."],
    ["Total", "Subtotal automatico y total del presupuesto."],
  ];
  items.forEach(([t, b], i) => {
    const x = 78 + i * 292;
    step(s, i + 1, t, b, x, 184, 232, 142, [c.blue, c.teal, c.amber, c.green][i]);
    if (i < 3) arrow(s, x + 235, 236);
  });
  card(s, "Regla central", "No se aprueba presupuesto sin detalles. Si se edita o elimina un detalle, la decision del cliente vuelve a quedar pendiente.", 120, 435, 500, 130, c.red);
  card(s, "Control de inventario", "Cotizar no descuenta stock. El descuento ocurre hasta que el cliente aprueba y el repuesto fue seleccionado desde inventario.", 670, 435, 500, 130, c.green);
  footer(s, 6);
}

// 7
{
  const s = addSlide("Decision del presupuesto: tres canales, una sola regla");
  const lanes = [
    ["Rastreo publico", "Cliente abre enlace/QR y presiona aceptar o rechazar.", c.teal],
    ["WhatsApp", "Cliente responde SI ACEPTO o NO ACEPTO con codigo de orden.", c.green],
    ["Presencial", "Operador registra la decision tomada en mostrador.", c.blue],
  ];
  lanes.forEach(([t, b, color], i) => card(s, t, b, 86 + i * 390, 178, 320, 160, color));
  text(s, "Todas las rutas terminan en la misma bifurcacion operativa:", 100, 398, 1080, 28, { size: 24, bold: true, align: "center" });
  card(s, "Acepta", "Orden pasa a EN_REPARACION y consume repuestos de inventario si aplica.", 205, 475, 390, 104, c.green);
  card(s, "Rechaza", "Orden pasa a PRESUPUESTO_RECHAZADO y se define devolucion o nuevo presupuesto.", 685, 475, 390, 104, c.red);
  footer(s, 7);
}

// 8
{
  const s = addSlide("Estados de la orden: trazabilidad desde ingreso hasta entrega");
  const states = [
    ["CREADO", c.teal],
    ["EN_REVISION", c.blue],
    ["PRESUPUESTO_ENVIADO", c.amber],
    ["EN_REPARACION", c.green],
    ["LISTO_PARA_RECOGER", c.green],
    ["FINALIZADO", c.dark],
  ];
  states.forEach(([label, color], i) => {
    const x = 62 + i * 195;
    pill(s, label, x, 246, 166, color);
    if (i < states.length - 1) arrow(s, x + 166, 245, 34);
  });
  pill(s, "PRESUPUESTO_RECHAZADO", 446, 390, 260, c.red);
  text(s, "Ruta alterna cuando el cliente no autoriza el trabajo", 730, 398, 360, 22, { size: 16, color: c.muted });
  rect(s, 530, 292, 2, 95, c.line, c.line);
  text(s, "Cada cambio genera historial: estado anterior, nuevo estado, comentario, usuario y fecha.", 120, 520, 1040, 44, { size: 22, bold: true, color: c.teal, align: "center" });
  footer(s, 8);
}

// 9
{
  const s = addSlide("Responsabilidades por rol");
  const roles = [
    ["ADMIN", "Gestiona todos los modulos y configuracion general.", c.dark],
    ["RECEPCIONISTA", "Clientes, equipos, ordenes, tickets, pagos, ventas y comunicacion.", c.teal],
    ["TECNICO", "Revision, diagnostico, presupuesto y avance de reparacion.", c.blue],
    ["CLIENTE", "Consulta rastreo, acepta/rechaza presupuesto y paga.", c.amber],
  ];
  roles.forEach(([t, b, color], i) => card(s, t, b, 86 + i * 292, 178, 244, 180, color));
  rect(s, 128, 450, 1024, 96, "#EFF6FF", "#BFDBFE", "roundRect");
  text(s, "Separar responsabilidades ayuda a controlar permisos, reducir errores y dejar evidencia de quien hizo cada cambio.", 170, 478, 940, 34, { size: 22, color: c.blue, bold: true, align: "center" });
  footer(s, 9);
}

// 10
{
  const s = addSlide("Cierre: valor operativo del sistema", "Conclusiones");
  card(s, "Trazabilidad", "Cada orden conserva estado, historial, tecnico, diagnostico, presupuesto y pagos.", 74, 170, 340, 150, c.teal);
  card(s, "Control administrativo", "Evita registros manuales dispersos y centraliza decisiones y movimientos.", 470, 170, 340, 150, c.blue);
  card(s, "Comunicacion", "QR, rastreo publico y WhatsApp reducen consultas presenciales y llamadas.", 866, 170, 340, 150, c.amber);
  text(s, "Integrantes", 100, 425, 200, 24, { size: 18, color: c.teal, bold: true });
  text(s, "Marvin Chiroy · Obady Pérez · Zaqueo Chivalan · Eddy Cuyuch · Josue Sanchez", 100, 456, 780, 26, { size: 20, bold: true });
  text(s, "Instructora: Ing. Karen Patricia Hernández", 100, 500, 520, 24, { size: 18, color: c.muted });
  text(s, "Universidad Mariano Gálvez de Guatemala · Ingeniería de software", 100, 532, 700, 24, { size: 18, color: c.muted });
  footer(s, 10);
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.mkdir(PREVIEW, { recursive: true });

for (let i = 0; i < deck.slides.count; i += 1) {
  const slide = deck.slides.getItem(i);
  const blob = await deck.export({ slide, format: "png", scale: 1 });
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(path.join(PREVIEW, `slide-${String(i + 1).padStart(2, "0")}.png`), buffer);
}

const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(OUT);
