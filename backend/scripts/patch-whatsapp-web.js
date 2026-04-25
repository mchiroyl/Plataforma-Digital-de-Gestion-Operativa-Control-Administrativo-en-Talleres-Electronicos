const fs = require('node:fs');
const path = require('node:path');

const clientPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');

if (!fs.existsSync(clientPath)) {
  console.warn('[patch-whatsapp-web] Client.js no encontrado; se omite parche.');
  process.exit(0);
}

const source = fs.readFileSync(clientPath, 'utf8');
let output = source;

const originalCache = `if(res.ok() && res.url() === WhatsWebURL) {
                    const indexHtml = await res.text();
                    this.currentIndexHtml = indexHtml;
                }`;
const patchedCache = `if(res.ok() && res.url() === WhatsWebURL) {
                    try {
                        const indexHtml = await res.text();
                        this.currentIndexHtml = indexHtml;
                    } catch (err) {
                        // Ignore responses without a readable body.
                    }
                }`;

if (!output.includes('Ignore responses without a readable body') && !output.includes('Some Chromium/Puppeteer versions throw')) {
  if (output.includes(originalCache)) {
    output = output.replace(originalCache, patchedCache);
  } else {
    console.warn('[patch-whatsapp-web] No se encontro el bloque de cache esperado.');
  }
}

const originalInitialInject = `        await this.inject();

        this.pupPage.on('framenavigated', async (frame) => {`;
const patchedInitialInject = `        try {
            await this.inject();
        } catch (err) {
            if (!String(err && err.message ? err.message : err).includes('Execution context was destroyed')) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.inject();
        }

        this.pupPage.on('framenavigated', async (frame) => {`;

if (!output.includes('Execution context was destroyed')) {
  if (output.includes(originalInitialInject)) {
    output = output.replace(originalInitialInject, patchedInitialInject);
  } else {
    console.warn('[patch-whatsapp-web] No se encontro el bloque de inyeccion inicial esperado.');
  }
}

const originalFrameInject = `            await this.inject();
        });
    }`;
const patchedFrameInject = `            try {
                await this.inject();
            } catch (err) {
                if (!String(err && err.message ? err.message : err).includes('Execution context was destroyed')) throw err;
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.inject();
            }
        });
    }`;

if (!output.includes('await new Promise(resolve => setTimeout(resolve, 1000));')) {
  if (output.includes(originalFrameInject)) {
    output = output.replace(originalFrameInject, patchedFrameInject);
  } else {
    console.warn('[patch-whatsapp-web] No se encontro el bloque de framenavigated esperado.');
  }
}

if (output !== source) {
  fs.writeFileSync(clientPath, output);
  console.log('[patch-whatsapp-web] Parche aplicado.');
} else {
  console.log('[patch-whatsapp-web] Parche ya aplicado.');
}
