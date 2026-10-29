export const PAGE_SIZE = 10;

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
	return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, total: number, pageSize = PAGE_SIZE): number {
	return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function pageSlice<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): T[] {
	const start = (page - 1) * pageSize;
	return items.slice(start, start + pageSize);
}
