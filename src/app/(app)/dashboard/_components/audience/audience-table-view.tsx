import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AudienceSegment } from "@/lib/services/meta/audience-breakdowns"
import {
  formatAudienceCpa,
  formatAudiencePurchases,
  formatAudienceSpend,
} from "@/lib/services/meta/audience-breakdowns"

export function AudienceTableView({
  segments,
  cpaAvailable,
}: {
  segments: AudienceSegment[]
  cpaAvailable: boolean
}) {
  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 text-xs">Segmento</TableHead>
          <TableHead className="h-8 text-right text-xs">%</TableHead>
          <TableHead className="h-8 text-right text-xs">Ventas</TableHead>
          <TableHead className="h-8 text-right text-xs">Gasto</TableHead>
          {cpaAvailable ? (
            <TableHead className="h-8 text-right text-xs">CPA</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {segments.map((segment) => (
          <TableRow key={segment.key} className="hover:bg-muted/40">
            <TableCell className="py-2 text-sm">{segment.label}</TableCell>
            <TableCell className="py-2 text-right text-sm tabular-nums">
              {segment.percent}%
            </TableCell>
            <TableCell className="py-2 text-right text-sm tabular-nums">
              {formatAudiencePurchases(segment.purchases)}
            </TableCell>
            <TableCell className="py-2 text-right text-sm tabular-nums">
              {formatAudienceSpend(segment.spend)}
            </TableCell>
            {cpaAvailable ? (
              <TableCell className="py-2 text-right text-sm tabular-nums">
                {formatAudienceCpa(segment.cpa)}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
