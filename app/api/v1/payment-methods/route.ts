import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { fail, ok, okList } from '@/lib/api/http';
import { buildMeta } from '@/lib/api/pagination';
import { parseQuery } from '@/lib/api/query';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { PaymentMethodService } from '@/lib/payment-methods/payment-method-service';
import { paymentMethodListQuerySchema } from '@/lib/validation/schemas';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const query = parseQuery(paymentMethodListQuerySchema, new URL(req.url).searchParams);

    const { items, total } = await PaymentMethodService.listPaymentMethods(user.id, {
      filters: { name: query.name, id: query.id },
      pagination: { limit: query.limit, offset: query.offset },
      sort: { field: query.sort, order: query.order },
    });

    return okList(items, buildMeta(total, { limit: query.limit, offset: query.offset }));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const body = await req.json();
    const paymentMethod = await PaymentMethodService.createPaymentMethod(user.id, body);
    return ok(paymentMethod, 201);
  } catch (error) {
    return handleError(error);
  }
}