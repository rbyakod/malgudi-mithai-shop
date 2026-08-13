// app/api/health/route.ts
// Liveness/readiness health endpoint — Task 5.6 (Mishran Mobile Apps v1).
//
// Used by Vercel/uptime monitors + container orchestrators. Probes Mongo with
// a 2s serverSelectionTimeout so a down DB degrades (503) instead of hanging.
// Uncustomized/unauthenticated on purpose: it must respond even when auth or
// the app's business logic is misconfigured, so monitors get a signal. No
// secrets in the payload — only aggregate ok/degraded/down per dependency.
//
// Path depth: app/api/health/ = 2 dirs under app/ -> 3 `../` to repo root.
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { config } from '../../../lib/config';

type CheckState = 'ok' | 'degraded' | 'down';

export async function GET() {
  const checks: Record<string, CheckState> = {};

  try {
    const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();
    checks.mongo = 'ok';
  } catch {
    checks.mongo = 'down';
  }

  const overall: CheckState = Object.values(checks).some((s) => s !== 'ok')
    ? 'degraded'
    : 'ok';

  return NextResponse.json(
    { status: overall, checks, ts: new Date().toISOString() },
    { status: overall === 'ok' ? 200 : 503 },
  );
}
