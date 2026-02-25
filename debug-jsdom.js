const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><head></head><body></body></html>';
const script = fs.readFileSync('./dist/background.js', 'utf-8');

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  beforeParse(window) {
    // Mock chrome extension APIs
    window.chrome = {
      runtime: {
        getManifest: () => ({ version: '1.0.0', version_name: '' }),
        connect: () => ({
          onMessage: { addListener: () => {} },
          onDisconnect: { addListener: () => {} },
          postMessage: () => {}
        }),
        onConnect: { addListener: () => {} }
      },
      storage: {
        sync: {
          get: (key, cb) => cb && cb({}),
          set: (val, cb) => cb && cb(),
          remove: (key, cb) => cb && cb(),
          clear: (cb) => cb && cb()
        },
        local: {
          get: (key, cb) => cb && cb({}),
          set: (val, cb) => cb && cb(),
          remove: (key, cb) => cb && cb(),
          clear: (cb) => cb && cb()
        }
      }
    };
    
    // Capture console logs
    window.console.log = (...args) => {
      console.log('[BROWSER CONSOLE LOG]', ...args); // Tracing step
    };
    window.console.error = (...args) => {
      console.log('[BROWSER CONSOLE ERROR]', ...args);
    };
    window.console.warn = (...args) => {
      console.log('[BROWSER CONSOLE WARN]', ...args);
    };
  }
});

try {
  dom.window.eval(script);
  console.log('Script evaluated successfully.');
  
  // Wait a bit for async operations
  setTimeout(() => {
    console.log('App HTML snippet:', dom.window.document.getElementById('app').innerHTML.substring(0, 100));
  }, 1000);
} catch(e) {
  console.error('[FATAL JS ERROR]', e);
}
