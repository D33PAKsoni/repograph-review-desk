// Executable hosting entry point. PM2 imports ESM files instead of invoking their
// CLI guard. Keep the frozen launcher's API/static implementation unchanged.
import { createAppServer } from '../bootstrap/server.mjs';

try {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer from 0 to 65535');
  }
  const server = await createAppServer();
  server.on('error', error => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Review Desk hosting entry listening on 0.0.0.0:${server.address().port}`);
    if (typeof process.send === 'function') process.send('ready');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 8000).unref();
    });
  }
} catch (error) {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
}
