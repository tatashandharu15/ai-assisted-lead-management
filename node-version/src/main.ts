import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifyScalar from '@scalar/fastify-api-reference';
import leadsRoutes from './routes/leads.js';
import dashboardRoutes from './routes/dashboard.js';

const port = Number(process.env.PORT || 3000);

export async function buildApp() {
  const fastify = Fastify({ logger: false });
  await fastify.register(fastifyCors, { origin: true });
  await fastify.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'Lead Management API',
        description: 'Node.js TypeScript Fastify Lead Management System',
        version: '1.0.0'
      }
    }
  });
  await fastify.register(fastifyScalar, { routePrefix: '/reference' });
  await fastify.register(leadsRoutes);
  await fastify.register(dashboardRoutes);
  fastify.get('/', async () => {
    return { service: 'nodejs-ts-lead-mgmt', port: 3000, docs: '/reference' };
  });
  return fastify;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('main.ts') || process.argv[1] && process.argv[1].endsWith('main.js')) {
  start();
}

export { start };
