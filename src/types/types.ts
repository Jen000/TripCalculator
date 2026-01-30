// types.ts
export interface Expense {
  date: string;
  description: string;
  paidBy: 'Jenna' | 'Sam';
  category:
    | 'Lodging'
    | 'Gas'
    | 'Food'
    | 'Coffee'
    | 'Groceries'
    | 'Activities'
    | 'Park Fees'
    | 'Transit / Parking'
    | 'Shopping'
    | 'Flights'
    | 'Rental Car'
    | 'Misc';
  amount: number;
}