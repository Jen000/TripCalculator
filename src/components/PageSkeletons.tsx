import { Box, Card, CardContent, Skeleton, Stack } from "@mui/material";

export function KpiRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: `repeat(${count}, 1fr)` }, gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent sx={{ py: 2 }}>
            <Skeleton variant="text" width={90} height={14} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="60%" height={42} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export function ChartCardSkeleton({ height = 260, title = true }: { height?: number; title?: boolean }) {
  return (
    <Card>
      <CardContent>
        {title && <Skeleton variant="text" width={170} height={28} sx={{ mb: 1.5 }} />}
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width={180} height={28} sx={{ mb: 1.5 }} />
        <Stack spacing={1}>
          {Array.from({ length: rows }).map((_, i) => (
            <Stack key={i} direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="text" width={70} />
              <Skeleton variant="text" sx={{ flex: 1 }} />
              <Skeleton variant="rounded" width={70} height={20} />
              <Skeleton variant="text" width={70} />
              <Skeleton variant="text" width={60} />
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function SummarySkeleton() {
  return (
    <Stack spacing={2}>
      <KpiRowSkeleton count={3} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </Box>
      <TableSkeleton rows={6} />
    </Stack>
  );
}

export function AllExpensesSkeleton() {
  return <TableSkeleton rows={10} />;
}

export function SettleUpSkeleton() {
  return (
    <Stack spacing={2}>
      <KpiRowSkeleton count={3} />
      <ChartCardSkeleton height={180} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <ChartCardSkeleton height={240} title />
        <ChartCardSkeleton height={240} title />
      </Box>
    </Stack>
  );
}
