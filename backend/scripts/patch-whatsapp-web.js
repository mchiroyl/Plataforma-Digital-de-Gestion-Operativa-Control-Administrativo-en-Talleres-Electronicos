const fs = require('node:fs');
const path = require('node:path');

const clientPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');

if (!fs.existsSync(clientPath)) {
  console.warn('[patch-whatsapp-web] Client.js no encontrado; se omite parche.');
  process.exit(0);
}

const source = fs.readFileSync(clientPath, 'utf8');
let output = source;

const retryHelper = `const isTransientInjectError = (err) => {
            const message = String(err && err.message ? err.message : err);
            return message.includes('Execution context was destroyed')
                || message.includes('most likely because of a navigation')
                || message.includes('Cannot find context with specified id');
        };
        const injectWithRetry = async (attempts = 4, delayMs = 1500) => {
            let lastError;
            for (let attempt = 1; attempt <= attempts; attempt += 1) {
                try {
                    await this.inject();
                    return;
                } catch (err) {
                    if (!isTransientInjectError(err) || attempt === attempts) {
                        throw err;
                    }
                    lastError = err;
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            throw lastError;
        };`;

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
const oldPatchedInitialInject = `        try {
            await this.inject();
        } catch (err) {
            if (!String(err && err.message ? err.message : err).includes('Execution context was destroyed')) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.inject();
        }

        this.pupPage.on('framenavigated', async (frame) => {`;
const patchedInitialInject = `        ${retryHelper}

        await injectWithRetry();

        this.pupPage.on('framenavigated', async (frame) => {`;

if (!output.includes('const injectWithRetry = async')) {
  if (output.includes(oldPatchedInitialInject)) {
    output = output.replace(oldPatchedInitialInject, patchedInitialInject);
  } else if (output.includes(originalInitialInject)) {
    output = output.replace(originalInitialInject, patchedInitialInject);
  } else {
    console.warn('[patch-whatsapp-web] No se encontro el bloque de inyeccion inicial esperado.');
  }
}

const originalFrameInject = `            await this.inject();
        });
    }`;
const oldPatchedFrameInject = `            try {
                await this.inject();
            } catch (err) {
                if (!String(err && err.message ? err.message : err).includes('Execution context was destroyed')) throw err;
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.inject();
            }
        });
    }`;
const patchedFrameInject = `            try {
                await injectWithRetry();
            } catch (err) {
                if (!isTransientInjectError(err)) throw err;
            }
        });
    }`;

if (!output.includes('await injectWithRetry();')) {
  if (output.includes(oldPatchedFrameInject)) {
    output = output.replace(oldPatchedFrameInject, patchedFrameInject);
  } else if (output.includes(originalFrameInject)) {
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
