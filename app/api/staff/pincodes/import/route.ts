// app/api/staff/pincodes/import/route.ts
// Pincode CSV upsert — admin roadmap Wave 2 (#129).
//
// POST /api/staff/pincodes/import  { csv: string, dryRun?: boolean }
//
// Bulk-upserts serviceable delivery areas by pincode (existing pincode ->
// update, new -> create). Parsing/validation is pure and lives in
// lib/admin/pincodeImport; this route is the staff-gated writer. dryRun
// performs the existence check and reports would-create/would-update counts
// without writing.
//
// Path depth: app/api/staff/pincodes/import/ = 5 dirs under app/ -> 5 `../`.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../lib/api/errors';
import { getPayloadAdminUser } from '../../../../../lib/api/adminAuth';
import {
  parsePincodeCsv,
  PINCODE_IMPORT_MAX_ROWS,
} from '../../../../../lib/admin/pincodeImport';

const Body = z.object({
  csv: z.string().min(1).max(500_000),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const user = await getPayloadAdminUser(req);
    if (!user) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Staff auth required');
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid import body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { csv, dryRun } = parsed.data;

    const result = parsePincodeCsv(csv);
    const payload = await getPayload({ config });

    // One batched existence check instead of a find per row.
    const existing = result.rows.length
      ? await payload.find({
          collection: 'serviceablePincodes',
          where: { pincode: { in: result.rows.map((r) => r.pincode) } },
          limit: PINCODE_IMPORT_MAX_ROWS,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] };
    const existingByPin = new Map(
      existing.docs.map((d) => [String(d.pincode), String(d.id)]),
    );

    let created = 0;
    let updated = 0;
    if (!dryRun) {
      for (const row of result.rows) {
        const id = existingByPin.get(row.pincode);
        if (id) {
          await payload.update({
            collection: 'serviceablePincodes',
            id,
            data: row,
            overrideAccess: true,
          });
          updated += 1;
        } else {
          await payload.create({
            collection: 'serviceablePincodes',
            data: row,
            overrideAccess: true,
          });
          created += 1;
        }
      }
    } else {
      for (const row of result.rows) {
        if (existingByPin.has(row.pincode)) updated += 1;
        else created += 1;
      }
    }

    return jsonResponse(
      {
        dryRun,
        rows: result.rows.length,
        created, // dryRun: would-create
        updated, // dryRun: would-update
        duplicates: result.duplicates,
        errors: result.errors,
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
