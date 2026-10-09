import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { withParams } from "@/lib/search-params"

// Numbered pages (SEARCH-03). Each is a plain link, so pages are shareable and keep every
// other filter in the URL. Shows 1 … current±1 … last.
function pageList(page: number, last: number): (number | "gap-start" | "gap-end")[] {
  const keep = new Set([1, last, page - 1, page, page + 1].filter((n) => n >= 1 && n <= last))
  const sorted = [...keep].sort((a, b) => a - b)
  const out: (number | "gap-start" | "gap-end")[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(i === 1 ? "gap-start" : "gap-end")
    out.push(n)
  })
  return out
}

export function ResultsPagination({ page, totalPages, params }: { page: number; totalPages: number; params: URLSearchParams }) {
  if (totalPages <= 1) return null
  const href = (n: number) => `/search?${withParams(params, { page: n })}`

  return (
    <Pagination aria-label="Search results pages">
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={href(page - 1)} />
          </PaginationItem>
        )}
        {pageList(page, totalPages).map((n) =>
          typeof n === "number" ? (
            <PaginationItem key={n}>
              <PaginationLink href={href(n)} isActive={n === page}>
                {n}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={n}>
              <PaginationEllipsis />
            </PaginationItem>
          )
        )}
        {page < totalPages && (
          <PaginationItem>
            <PaginationNext href={href(page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
