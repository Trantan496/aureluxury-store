export type Pagination = { page: number; pageSize: number; skip: number; take: number };

export function pagination(input: { page?: unknown; pageSize?: unknown } = {}): Pagination {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  if (!Number.isInteger(page) || (page as number) < 1 || (page as number) > 10000 ||
      !Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > 100) {
    throw new Error("Invalid pagination");
  }
  return { page: page as number, pageSize: pageSize as number, skip: ((page as number) - 1) * (pageSize as number), take: pageSize as number };
}

export function pageInfo(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: page * pageSize < total };
}
