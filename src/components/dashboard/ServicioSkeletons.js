import React from "react";
import { Box, Grid } from "@mui/material";
import Skeleton from "@mui/material/Skeleton";

function MobileSkeletonCard({ keyProp }) {
  return (
    <Box
      key={keyProp}
      sx={{
        mb: 1.5,
        p: 1,
        borderRadius: 1.5,
        boxShadow: 1,
        bgcolor: 'grey.50',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="rounded" width={80} height={22} />
      </Box>
      <Skeleton variant="text" width="60%" sx={{ mb: 0.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Skeleton variant="text" width={160} height={18} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width={100} height={14} />
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Skeleton variant="text" width={70} height={14} />
          <Skeleton variant="text" width={50} height={14} />
        </Box>
      </Box>
      <Skeleton variant="text" width="80%" height={14} sx={{ mt: 0.5 }} />
    </Box>
  );
}

function DesktopSkeletonCard({ keyProp }) {
  return (
    <Grid key={keyProp} sx={{ mb: 3 }}>
      <Box
        sx={{
          width: 210,
          minWidth: 210,
          maxWidth: 210,
          minHeight: 180,
          mx: 1.5,
          display: "flex",
          flexDirection: "column",
          p: 0.8,
          borderRadius: 2,
          boxShadow: 2,
          bgcolor: "background.paper",
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Skeleton variant="text" width={70} height={12} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width={90} height={12} />
          </Box>
          <Skeleton variant="rounded" width={90} height={22} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={1} sx={{ my: 1, opacity: 0.4 }} />
        <Box sx={{ mb: 0.5 }}>
          <Skeleton variant="text" width={150} height={14} sx={{ mb: 0.3 }} />
          <Skeleton variant="text" width={110} height={14} />
        </Box>
        <Skeleton variant="text" width={140} height={16} sx={{ mb: 0.5 }} />
        <Skeleton variant="rectangular" width={180} height={18} sx={{ mb: 0.5 }} />
        <Skeleton variant="rectangular" width={160} height={18} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width={150} height={14} />
      </Box>
    </Grid>
  );
}

export default function ServicioSkeletons({ variant = 'mobile', count = 1 }) {
  const items = Array.from({ length: count }, (_, i) => i);
  if (variant === 'desktop') {
    return <>{items.map((i) => <DesktopSkeletonCard keyProp={i} key={i} />)}</>;
  }
  return <>{items.map((i) => <MobileSkeletonCard keyProp={i} key={i} />)}</>;
}
