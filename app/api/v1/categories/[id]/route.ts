import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/http';
import { parseId } from '@/lib/api/ids';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { CategoryService } from '@/lib/categories/category-service';

interface RouteContext {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const id = parseId(params.id);
    const category = await CategoryService.getCategory(user.id, id);
    return ok(category);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const id = parseId(params.id);
    const body = await req.json();
    const category = await CategoryService.updateCategory(user.id, id, body);
    return ok(category);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const id = parseId(params.id);
    const category = await CategoryService.deleteCategory(user.id, id);
    return ok(category);
  } catch (error) {
    return handleError(error);
  }
}