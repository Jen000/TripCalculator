import React from "react";
import CardWrapper from ".././components/CardWrapper";
import { Typography } from "@mui/material";

const Summary: React.FC = () => (
  <CardWrapper title="Summary">
    <Typography>Total expenses will go here.</Typography>
  </CardWrapper>
);

export default Summary;