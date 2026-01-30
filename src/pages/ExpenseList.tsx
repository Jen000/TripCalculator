// src/pages/ExpenseList.tsx
import { useState } from "react";

type Expense = {
  date: string;
  description: string;
  paidBy: string;
  category: string;
  cost: number;
};

export default function ExpenseList() {
  // placeholder data for now
  const [expenses] = useState<Expense[]>([
    {
      date: "2026-01-28",
      description: "Hotel",
      paidBy: "Jenna",
      category: "Lodging",
      cost: 120,
    },
    {
      date: "2026-01-28",
      description: "Coffee",
      paidBy: "Sam",
      category: "Coffee",
      cost: 5,
    },
  ]);

  if (expenses.length === 0) {
    return <p className="text-neutral-700">No expenses added yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Expenses</h2>
      <div className="flex flex-col gap-2">
        {expenses.map((expense, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center border rounded px-3 py-2 bg-white shadow-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{expense.description}</span>
              <span className="text-xs text-neutral-500">
                {expense.date} • {expense.category} • Paid by {expense.paidBy}
              </span>
            </div>
            <span className="font-medium">${expense.cost.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}