'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Trip {
  id: string;
  name: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
}

interface Receipt {
  id: string;
  tripId: string;
  filePath: string;
  fileHash: string | null;
  status: string;
  uploaderId: string;
  uploader: {
    name: string;
    email: string;
  };
  parsedJson: any;
  createdAt: string;
}

interface Participant {
  id: string;
  tripId: string;
  householdId: string;
  household: {
    id: string;
    displayName: string;
    members: Array<{
      id: string;
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>;
  };
  weight: number;
}

interface Settlement {
  id: string;
  tripId: string;
  version: number;
  tableJson: any;
  transfersJson: any;
  locked: boolean;
  createdAt: string;
}

interface Photo {
  id: string;
  tripId: string;
  filePath: string;
  thumbPath: string | null;
  uploaderId: string;
  uploader: {
    name: string;
    email: string;
  };
  createdAt: string;
}

type TabType = 'receipts' | 'settlements' | 'photos' | 'participants';

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const router = useRouter();
  const [tripId, setTripId] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('receipts');
  const [loading, setLoading] = useState(true);

  // Data states
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Participant management states
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [availableHouseholds, setAvailableHouseholds] = useState<Array<{
    id: string;
    displayName: string;
  }>>([]);
  const [selectedHousehold, setSelectedHousehold] = useState('');
  const [participantWeight, setParticipantWeight] = useState(1.0);
  const [addingParticipant, setAddingParticipant] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));

    params.then(({ tripId: id }) => {
      setTripId(id);
      fetchTripData(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchTripData = async (id: string) => {
    try {
      // Fetch trip details
      const tripRes = await fetch(`/api/trips/${id}`);
      const tripData = await tripRes.json();
      setTrip(tripData);

      // Fetch all data in parallel
      await Promise.all([
        fetchReceipts(id),
        fetchParticipants(id),
        fetchSettlements(id),
        fetchPhotos(id),
      ]);
    } catch (error) {
      console.error('Failed to fetch trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/receipts`);
      const data = await res.json();
      setReceipts(data.receipts || []);
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
    }
  };

  const fetchParticipants = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/participants`);
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  const fetchSettlements = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/settlements`);
      const data = await res.json();
      setSettlements(data.settlements || []);
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
    }
  };

  const fetchPhotos = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/photos`);
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('uploaderId', user.id);

      const res = await fetch(`/api/trips/${tripId}/receipts`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      await fetchReceipts(tripId);
      e.target.value = '';
    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('uploaderId', user.id);

      const res = await fetch(`/api/trips/${tripId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      await fetchPhotos(tripId);
      e.target.value = '';
    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRecalculateSettlement = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/settlements/recompute`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to recalculate settlement');
      }

      await fetchSettlements(tripId);
    } catch (error) {
      console.error('Failed to recalculate settlement:', error);
    }
  };

  const fetchAvailableHouseholds = async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/households?userId=${user.id}`);
      const data = await res.json();
      const participantIds = new Set(participants.map(p => p.householdId));
      const filtered = (data.households || []).filter(
        (household: { id: string }) => !participantIds.has(household.id)
      );
      setAvailableHouseholds(filtered);
    } catch (error) {
      console.error('Failed to fetch households:', error);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHousehold) return;

    setAddingParticipant(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: selectedHousehold,
          weight: participantWeight,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add participant');
      }

      await fetchParticipants(tripId);
      setShowAddParticipantModal(false);
      setSelectedHousehold('');
      setParticipantWeight(1.0);
    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
      const res = await fetch(`/api/trips/${tripId}/participants?participantId=${participantId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to remove participant');
      }

      await fetchParticipants(tripId);
    } catch (error) {
      console.error('Failed to remove participant:', error);
      setUploadError('Failed to remove participant');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 inline-block"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {trip?.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Currency: {trip?.currency}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('receipts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'receipts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Receipts ({receipts.length})
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settlements'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Settlements ({settlements.length})
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Photos ({photos.length})
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'participants'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Participants ({participants.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {uploadError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {uploadError}
          </div>
        )}

        {/* Receipts Tab */}
        {activeTab === 'receipts' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Receipt Management
              </h2>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                {uploading ? 'Uploading...' : '+ Upload Receipt'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {receipts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400">
                  No receipts uploaded yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                  >
                    {/* Receipt Image Preview */}
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700">
                      <img
                        src={`/api/files/${receipt.filePath}`}
                        alt="Receipt"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => window.open(`/api/files/${receipt.filePath}`, '_blank')}
                      />
                    </div>
                    <div className="p-4">
                      <div className="mb-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                            receipt.status === 'REVIEWED'
                              ? 'bg-green-100 text-green-800'
                              : receipt.status === 'PARSED'
                              ? 'bg-blue-100 text-blue-800'
                              : receipt.status === 'ERROR'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {receipt.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Uploaded by: {receipt.uploader.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(receipt.createdAt).toLocaleDateString()}
                      </p>
                      {receipt.parsedJson && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Amount: {receipt.parsedJson.amount || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {receipt.parsedJson.merchant || 'Unknown merchant'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settlements Tab */}
        {activeTab === 'settlements' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Settlement History
              </h2>
              <button
                onClick={handleRecalculateSettlement}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Recalculate Settlement
              </button>
            </div>

            {settlements.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No settlements calculated yet
                </p>
                <button
                  onClick={handleRecalculateSettlement}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Calculate First Settlement
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {settlements.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Version {settlement.version}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(settlement.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {settlement.locked && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded">
                            Locked
                          </span>
                        )}
                        <Link
                          href={`/export/settlement/${tripId}/${settlement.version}`}
                          target="_blank"
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          View Export
                        </Link>
                      </div>
                    </div>

                    {settlement.transfersJson && settlement.transfersJson.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                          Recommended Transfers:
                        </h4>
                        <div className="space-y-2">
                          {settlement.transfersJson.map((transfer: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                            >
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {transfer.from} → {transfer.to}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {trip?.currency} {transfer.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Photo Gallery
              </h2>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                {uploading ? 'Uploading...' : '+ Upload Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400">
                  No photos uploaded yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-200 dark:bg-gray-700">
                      <img
                        src={`/api/files/${photo.filePath}`}
                        alt="Trip photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {photo.uploader.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(photo.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Trip Participants
              </h2>
              <button
                onClick={() => {
                  setShowAddParticipantModal(true);
                  fetchAvailableHouseholds();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Participant
              </button>
            </div>

            {participants.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No participants added yet
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Members
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Household
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Household Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {participants.map((participant) => (
                      <tr key={participant.id}>
                        <td className="px-6 py-4">
                          {participant.household.members.map((member, idx) => (
                            <div key={member.id} className={idx > 0 ? 'mt-2' : ''}>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {member.user.name || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {member.user.email}
                              </div>
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {participant.household.displayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              participant.weight === 0.5
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {participant.weight === 0.5 ? 'Kid (0.5x)' : 'Adult (1.0x)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {participant.weight.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleRemoveParticipant(participant.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Participant Modal */}
      {showAddParticipantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Add Participant
            </h3>
            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Household
                </label>
                <select
                  value={selectedHousehold}
                  onChange={(e) => setSelectedHousehold(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Choose a household...</option>
                  {availableHouseholds.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Weight (0.5 for kids, 1.0 for adults)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={participantWeight}
                  onChange={(e) => setParticipantWeight(parseFloat(e.target.value))}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddParticipantModal(false);
                    setSelectedHousehold('');
                    setParticipantWeight(1.0);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingParticipant}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingParticipant ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
