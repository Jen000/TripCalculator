import React from "react";
import type { ReactNode } from "react";
import { Card, CardContent, Typography } from "@mui/material";

interface CardWrapperProps {
  title: string;
  children: ReactNode;
}

const CardWrapper: React.FC<CardWrapperProps> = ({ title, children }) => (
  <Card sx={{ width: "100%", maxWidth: 400 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {children}
    </CardContent>
  </Card>
);

export default CardWrapper;