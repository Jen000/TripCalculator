import React from "react";
import CardWrapper from ".././components/CardWrapper";
import { TextField, Select, MenuItem, InputAdornment, Button, FormControl } from "@mui/material";

const ExpenseForm: React.FC = () => (
  <CardWrapper title="Add Expense">
    <form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TextField type="date" fullWidth />
      <TextField placeholder="Purchase Description" fullWidth />
      <TextField placeholder="Who Paid?" fullWidth />

      <FormControl fullWidth>
        <Select defaultValue="Lodging">
          <MenuItem value="Lodging">Lodging</MenuItem>
          <MenuItem value="Gas">Gas</MenuItem>
          <MenuItem value="Food">Food</MenuItem>
          <MenuItem value="Coffee">Coffee</MenuItem>
          <MenuItem value="Groceries">Groceries</MenuItem>
          <MenuItem value="Activities">Activities</MenuItem>
          <MenuItem value="Park Fees">Park Fees</MenuItem>
          <MenuItem value="Transit / Parking">Transit / Parking</MenuItem>
          <MenuItem value="Shopping">Shopping</MenuItem>
          <MenuItem value="Flights">Flights</MenuItem>
          <MenuItem value="Rental Car">Rental Car</MenuItem>
          <MenuItem value="Misc">Misc</MenuItem>
        </Select>
      </FormControl>

      <TextField
        placeholder="Cost"
        type="number"
        fullWidth
        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
      />

      <Button variant="contained" color="primary">
        Add Expense
      </Button>
    </form>
  </CardWrapper>
);

export default ExpenseForm;