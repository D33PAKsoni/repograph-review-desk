// Isolated mock server for Member 3 browser checks; never reads production switches.
import { createAppServer } from '../bootstrap/server.mjs';
const server = await createAppServer({ apiHandlerModule: null, bundlePath: 'fixtures/artifact-bundle.fixture.json' });
server.listen(4310, '127.0.0.1', () => console.log('UI test fixture server: http://127.0.0.1:4310'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()));
