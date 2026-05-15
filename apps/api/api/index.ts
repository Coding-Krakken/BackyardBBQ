import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/index.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance | undefined;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export default async function (req: VercelRequest, res: VercelResponse) {
  const fastify = await getApp();
  fastify.server.emit("request", req, res);
}
