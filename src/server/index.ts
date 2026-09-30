import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { config } from '../config/index.js';
import { healthRouter } from './routes/health.route.js';
import { demoRouter } from './routes/demo.route.js';
import { areasRouter } from './routes/areas.route.js';
import { dataSourceRouter } from './routes/data-source.route.js';
import { citizenRouter } from './routes/citizen.route.js';
import { radarRouter } from './routes/radar.route.js';
import { priorityRouter } from './routes/priority.route.js';
import { briefRouter } from './routes/brief.route.js';
import { auditRouter } from './routes/audit.route.js';
import { authRouter } from './routes/auth.route.js';
import { evidenceGraphRouter } from './routes/evidence-graph.route.js';
import { investmentRouter } from './routes/investment.route.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { authenticate } from './middleware/auth.js';
import { randomUUID } from 'node:crypto';
import { prisma } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export const app = express();

// Trust reverse proxies (NGINX, Ingress, Load Balancers) for accurate client IP in rate limiting
app.set('trust proxy', 1);

// Correlation ID & Request Context Middleware
app.use((req, res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-Id', reqId);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${statusColor}${res.statusCode}\x1b[0m - ${duration}ms [req:${reqId.slice(0, 8)}]`
      );
    }
  });
  next();
});

// Security and standard middlewares
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com', 'https://*.openstreetmap.org'],
        connectSrc: ["'self'", 'https://generativelanguage.googleapis.com', 'ws:', 'wss:'],
        frameAncestors: ["'none'"], // Prevent clickjacking
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests)
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API v1 Router Registration
const apiRouter = express.Router();
apiRouter.use(rateLimiter({ maxRequests: 300, windowMs: 60 * 1000 }));
apiRouter.use(authenticate);

// Mount domain routes
apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(demoRouter);
apiRouter.use(areasRouter);
apiRouter.use(dataSourceRouter);
apiRouter.use(citizenRouter);
apiRouter.use(radarRouter);
apiRouter.use(priorityRouter);
apiRouter.use(briefRouter);
apiRouter.use(auditRouter);
apiRouter.use(evidenceGraphRouter);
apiRouter.use(investmentRouter);

// Catch unmatched /api routes
apiRouter.all('*', notFoundHandler);

app.use('/api/v1', apiRouter);

// Serve static client bundle if built with caching
const clientDistPath = path.resolve(process.cwd(), 'dist/client');
app.use(express.static(clientDistPath, { maxAge: '1h', etag: true }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Centralized Error Handler (must be last)
app.use(errorHandler);

let serverInstance: any = null;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  serverInstance = app.listen(config.port, () => {
    console.log(`🏛️ CivicTwin AI Server running on http://localhost:${config.port}`);
    console.log(`🔍 Health check: http://localhost:${config.port}/api/v1/health`);
    console.log(`📡 Readiness probe: http://localhost:${config.port}/api/v1/readiness`);
    console.log(`💓 Liveness probe: http://localhost:${config.port}/api/v1/liveness`);
  });

  // Graceful Shutdown
  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
    if (serverInstance) {
      serverInstance.close(async () => {
        console.log('🔌 HTTP server closed.');
        try {
          await prisma.$disconnect();
          console.log('🗄️ Database connections closed cleanly.');
          process.exit(0);
        } catch (err) {
          console.error('Error during database disconnect:', err);
          process.exit(1);
        }
      });
      // Force exit after 10s if stuck
      setTimeout(() => {
        console.error('⚠️ Shutdown timeout exceeded. Forcing exit.');
        process.exit(1);
      }, 10000).unref();
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Global Process Error Resilience
  process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    setTimeout(() => process.exit(1), 1000).unref();
  });
}
