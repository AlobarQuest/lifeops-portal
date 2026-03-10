import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: process.env.APP_NAME ?? "LifeOpsPortal",
    authConfigured: Boolean(process.env.AUTH_EMAIL && process.env.SESSION_SECRET),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  });
}
