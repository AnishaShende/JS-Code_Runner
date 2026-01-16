const http = require('http');
const vm = require('vm');

const PORT = 3001;
const TIMEOUT_MS = 1000; // 1 second timeout per snippet

function executeCode(code) {
  const output = [];
  const errors = [];

  // Create a sandbox with limited globals
  const sandbox = {
    console: {
      log: (...args) => output.push(args.map(String).join(' ')),
      error: (...args) => errors.push(args.map(String).join(' ')),
      warn: (...args) => output.push('[WARN] ' + args.map(String).join(' ')),
      info: (...args) => output.push('[INFO] ' + args.map(String).join(' ')),
    },
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    clearTimeout: undefined,
    clearInterval: undefined,
    clearImmediate: undefined,
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    __dirname: undefined,
    __filename: undefined,
    Buffer: undefined,
    // Safe globals
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
  };

  const context = vm.createContext(sandbox);
  const startTime = process.hrtime.bigint();

  let result = null;
  let error = null;

  try {
    const script = new vm.Script(code, {
      timeout: TIMEOUT_MS,
      filename: 'snippet.js',
    });

    result = script.runInContext(context, {
      timeout: TIMEOUT_MS,
    });
  } catch (err) {
    if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      error = `Execution timed out (limit: ${TIMEOUT_MS}ms)`;
    } else {
      error = err.message;
    }
  }

  const endTime = process.hrtime.bigint();
  const executionTimeMs = Number(endTime - startTime) / 1_000_000;

  return {
    output: output.join('\n'),
    errors: errors.length > 0 ? errors.join('\n') : null,
    result: result !== undefined ? String(result) : null,
    error,
    executionTimeMs: Math.round(executionTimeMs * 100) / 100,
  };
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Execute code
  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { code } = JSON.parse(body);

        if (!code || typeof code !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Code is required and must be a string' }));
          return;
        }

        const result = executeCode(code);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Runner listening on port ${PORT}`);
});
