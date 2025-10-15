import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

interface SettlementPageProps {
  params: Promise<{
    tripId: string;
    version: string;
  }>;
}

export default async function SettlementExportPage({ params }: SettlementPageProps) {
  const { tripId, version } = await params;

  const settlement = await prisma.settlement.findUnique({
    where: {
      tripId_version: {
        tripId,
        version: parseInt(version),
      },
    },
    include: {
      trip: true,
    },
  });

  if (!settlement) {
    notFound();
  }

  const tableData = settlement.tableJson as any;
  const households = tableData.households || [];
  const categories = tableData.categories || [];
  const totalWeight = tableData.totalWeight || 0;

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">{settlement.trip.name}</h1>
        <p className="text-gray-600 text-center mb-8">Settlement Report v{settlement.version}</p>

        {/* Main Settlement Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-2 px-4 text-left font-semibold">Category</th>
                {households.map((h: any) => (
                  <th key={h.householdId} className="py-2 px-4 text-right font-semibold border-b-2 border-gray-800">
                    {h.householdName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {/* Adults/Kids/Total Weight */}
              <tr className="text-sm text-gray-600">
                <td className="py-1 px-4">Adults (x1)</td>
                {households.map((h: any) => (
                  <td key={h.householdId} className="py-1 px-4 text-right">
                    {h.adults}
                  </td>
                ))}
              </tr>
              <tr className="text-sm text-gray-600">
                <td className="py-1 px-4">Kids (x0.5)</td>
                {households.map((h: any) => (
                  <td key={h.householdId} className="py-1 px-4 text-right">
                    {h.kids}
                  </td>
                ))}
              </tr>
              <tr className="text-sm font-medium border-b border-gray-300">
                <td className="py-1 px-4">Total Weight</td>
                {households.map((h: any) => (
                  <td key={h.householdId} className="py-1 px-4 text-right">
                    {h.weight.toFixed(1)}
                  </td>
                ))}
              </tr>

              {/* Expense Categories */}
              {categories.map((cat: any) => (
                <tr key={cat.category} className="hover:bg-gray-50">
                  <td className="py-2 px-4">{cat.category}</td>
                  {households.map((h: any) => (
                    <td key={h.householdId} className="py-2 px-4 text-right">
                      {(cat.expenses[h.householdId] || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Subtotal (Should Pay) */}
              <tr className="font-semibold border-t-2 border-gray-400">
                <td className="py-2 px-4">Should Pay</td>
                {households.map((h: any) => (
                  <td key={h.householdId} className="py-2 px-4 text-right">
                    {h.shouldPay.toFixed(2)}
                  </td>
                ))}
              </tr>

              {/* Paid */}
              <tr className="text-gray-600">
                <td className="py-2 px-4">Paid</td>
                {households.map((h: any) => (
                  <td key={h.householdId} className="py-2 px-4 text-right">
                    ({h.paid.toFixed(2)})
                  </td>
                ))}
              </tr>

              {/* Net Amount */}
              <tr className="font-bold text-lg border-b-4 border-gray-900">
                <td className="py-3 px-4">Net Amount</td>
                {households.map((h: any) => {
                  const isPositive = h.netAmount > 0;
                  return (
                    <td
                      key={h.householdId}
                      className={`py-3 px-4 text-right ${
                        isPositive ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {isPositive ? '' : '('}
                      {Math.abs(h.netAmount).toFixed(2)}
                      {isPositive ? '' : ')'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-sm text-gray-500 text-right">
          <p>Total Weight: {totalWeight.toFixed(1)}</p>
          <p>Currency: {settlement.trip.currency}</p>
          <p>Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
