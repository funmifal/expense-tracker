import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { fail, ok, okList } from '@/lib/api/http';
import { buildMeta } from '@/lib/api/pagination';
import { parseQuery } from '@/lib/api/query';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { CategoryService } from '@/lib/categories/category-service';
import { categoryListQuerySchema } from '@/lib/validation/schemas';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const query = parseQuery(categoryListQuerySchema, new URL(req.url).searchParams);

    const { items, total } = await CategoryService.listCategories(user.id, {
      filters: { name: query.name, isDefault: query.isDefault },
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
    const category = await CategoryService.createCategory(user.id, body);
    return ok(category, 201);
  } catch (error) {
    return handleError(error);
  }
}