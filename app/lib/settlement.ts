export interface HouseholdExpense {
  householdId: string;
  householdName: string;
  adults: number;
  kids: number;
  weight: number;
  shouldPay: number;
  paid: number;
  netAmount: number;
}

export interface ExpenseCategory {
  category: string;
  expenses: Record<string, number>; // householdId -> amount
}

export interface Transfer {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface SettlementData {
  households: HouseholdExpense[];
  categories: ExpenseCategory[];
  transfers: Transfer[];
  totalWeight: number;
}

interface Receipt {
  id: string;
  grandTotal: number;
  category: string;
  paidBy: string;
  participants: string[]; // householdIds
}

interface Participant {
  householdId: string;
  householdName: string;
  weight: number;
}

export function calculateSettlement(
  receipts: Receipt[],
  participants: Participant[]
): SettlementData {
  // Initialize household data
  const householdMap = new Map<string, HouseholdExpense>();
  let totalWeight = 0;

  participants.forEach(p => {
    totalWeight += p.weight;
    householdMap.set(p.householdId, {
      householdId: p.householdId,
      householdName: p.householdName,
      adults: p.weight === 1 ? 1 : 0,
      kids: p.weight === 0.5 ? 1 : 0,
      weight: p.weight,
      shouldPay: 0,
      paid: 0,
      netAmount: 0,
    });
  });

  // Category tracking
  const categoryMap = new Map<string, Record<string, number>>();

  // Process each receipt
  receipts.forEach(receipt => {
    const { grandTotal, category, paidBy, participants: receiptParticipants } = receipt;

    // Calculate participating weight
    const participatingHouseholds = participants.filter(p =>
      receiptParticipants.includes(p.householdId)
    );
    const participatingWeight = participatingHouseholds.reduce((sum, p) => sum + p.weight, 0);

    if (participatingWeight === 0) return;

    // Split cost by weight
    participatingHouseholds.forEach(p => {
      const household = householdMap.get(p.householdId);
      if (!household) return;

      const share = (p.weight / participatingWeight) * grandTotal;
      household.shouldPay += share;

      // Track by category
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {});
      }
      const categoryData = categoryMap.get(category)!;
      categoryData[p.householdId] = (categoryData[p.householdId] || 0) + share;
    });

    // Track payment
    const payer = householdMap.get(paidBy);
    if (payer) {
      payer.paid += grandTotal;

      // Track payment in category (as negative)
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {});
      }
    }
  });

  // Calculate net amounts
  householdMap.forEach(household => {
    household.netAmount = household.paid - household.shouldPay;
    // Round to 2 decimals
    household.shouldPay = Math.round(household.shouldPay * 100) / 100;
    household.paid = Math.round(household.paid * 100) / 100;
    household.netAmount = Math.round(household.netAmount * 100) / 100;
  });

  // Generate transfers (minimum number)
  const transfers = generateTransfers(Array.from(householdMap.values()));

  // Format categories
  const categories: ExpenseCategory[] = Array.from(categoryMap.entries()).map(
    ([category, expenses]) => ({
      category,
      expenses,
    })
  );

  return {
    households: Array.from(householdMap.values()),
    categories,
    transfers,
    totalWeight,
  };
}

function generateTransfers(households: HouseholdExpense[]): Transfer[] {
  const transfers: Transfer[] = [];

  // Separate creditors (positive net) and debtors (negative net)
  const creditors = households
    .filter(h => h.netAmount > 0.01)
    .map(h => ({ ...h }))
    .sort((a, b) => b.netAmount - a.netAmount);

  const debtors = households
    .filter(h => h.netAmount < -0.01)
    .map(h => ({ ...h }))
    .sort((a, b) => a.netAmount - b.netAmount);

  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.min(creditor.netAmount, Math.abs(debtor.netAmount));

    if (amount > 0.01) {
      transfers.push({
        from: debtor.householdId,
        fromName: debtor.householdName,
        to: creditor.householdId,
        toName: creditor.householdName,
        amount: Math.round(amount * 100) / 100,
      });
    }

    creditor.netAmount -= amount;
    debtor.netAmount += amount;

    if (creditor.netAmount < 0.01) i++;
    if (Math.abs(debtor.netAmount) < 0.01) j++;
  }

  return transfers;
}
