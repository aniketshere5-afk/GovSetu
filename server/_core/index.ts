import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Simulated federated department systems: each endpoint owns its source-shaped payload and returns only a canonical exchange response.
  app.post("/api/connectors/:system/:action", (req, res) => {
    const { system, action } = req.params;
    const payload = req.body || {};
    if (system === "revenue" && action === "verify") return res.json({ sourceSystem: "Revenue e-Verify Registry", canonical: { verificationStatus: "verified", name: payload.citizen_name || payload.fullName, dateOfBirth: payload.dob || payload.date_of_birth }, sourceRecordRetained: true });
    if (system === "municipal" && action === "address") return res.json({ sourceSystem: "Municipal Property Ledger", canonical: { verificationStatus: "verified", registeredAddress: payload.fullAddress || payload.address }, sourceRecordRetained: true });
    if (system === "registry" && action === "decision") return res.json({ sourceSystem: "National Business Register", canonical: { decision: "pending_review", registrationNumber: null }, sourceRecordRetained: true });
    return res.status(404).json({ error: "Connector route not found" });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
