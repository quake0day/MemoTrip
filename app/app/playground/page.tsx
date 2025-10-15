'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Feedback = { type: 'success' | 'error'; message: string } | null;

interface ApiUser {
  id: string;
  email: string;
  name?: string | null;
}

interface HouseholdMember {
  id: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface Household {
  id: string;
  displayName: string;
  members: HouseholdMember[];
}

interface TripSummary {
  id: string;
  name: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  _count: {
    receipts: number;
    photos: number;
  };
}

interface TripDetail extends TripSummary {
  createdAt: string;
  updatedAt: string;
}

interface Participant {
  id: string;
  tripId: string;
  householdId: string;
  weight: number;
  household: {
    id: string;
    displayName: string;
    members: HouseholdMember[];
  };
}

interface Receipt {
  id: string;
  filePath: string;
  status: string;
  uploader: {
    name: string | null;
    email: string;
  };
  createdAt: string;
  parsedJson: unknown;
}

interface Photo {
  id: string;
  filePath: string;
  createdAt: string;
  uploader: {
    name: string | null;
    email: string;
  };
}

interface SettlementTableHousehold {
  householdId: string;
  householdName: string;
  shouldPay: number;
  paid: number;
  netAmount: number;
  weight?: number;
}

interface SettlementTable {
  households?: SettlementTableHousehold[];
  totalWeight?: number;
}

interface SettlementTransfer {
  fromName: string;
  toName: string;
  amount: number;
}

interface SettlementRecord {
  id: string;
  version: number;
  createdAt: string;
  locked: boolean;
  tableJson: SettlementTable;
  transfersJson: SettlementTransfer[] | null;
}

const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'CNY'];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ApiPlaygroundPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [isLoadingTripData, setIsLoadingTripData] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [householdName, setHouseholdName] = useState('');
  const [tripForm, setTripForm] = useState({ name: '', currency: 'USD' });
  const [participantForm, setParticipantForm] = useState({
    householdId: '',
    weight: 1,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        window.localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) {
      window.localStorage.setItem('user', JSON.stringify(user));
    } else {
      window.localStorage.removeItem('user');
    }
  }, [user]);

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, []);

  const fetchHouseholds = useCallback(async () => {
    if (!user) return [];
    const response = await fetch(`/api/households?userId=${user.id}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch households');
    }
    setHouseholds(data.households || []);
    return data.households || [];
  }, [user]);

  const fetchTrips = useCallback(async () => {
    if (!user) return [];
    const response = await fetch(`/api/trips?userId=${user.id}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch trips');
    }
    setTrips(data.trips || []);
    return data.trips || [];
  }, [user]);

  const loadTripData = useCallback(
    async (tripId: string) => {
      if (!tripId) return;
      setIsLoadingTripData(true);
      try {
        const [tripRes, participantRes, receiptRes, photoRes, settlementRes] = await Promise.all([
          fetch(`/api/trips/${tripId}`),
          fetch(`/api/trips/${tripId}/participants`),
          fetch(`/api/trips/${tripId}/receipts`),
          fetch(`/api/trips/${tripId}/photos`),
          fetch(`/api/trips/${tripId}/settlements`),
        ]);

        const tripData = await tripRes.json();
        if (!tripRes.ok) {
          throw new Error(tripData.error || 'Failed to fetch trip');
        }
        setTripDetail(tripData);

        const participantData = await participantRes.json();
        if (!participantRes.ok) {
          throw new Error(participantData.error || 'Failed to fetch participants');
        }
        setParticipants(participantData.participants || []);

        const receiptData = await receiptRes.json();
        if (!receiptRes.ok) {
          throw new Error(receiptData.error || 'Failed to fetch receipts');
        }
        setReceipts(receiptData.receipts || []);

        const photoData = await photoRes.json();
        if (!photoRes.ok) {
          throw new Error(photoData.error || 'Failed to fetch photos');
        }
        setPhotos(photoData.photos || []);

        const settlementData = await settlementRes.json();
        if (!settlementRes.ok) {
          throw new Error(settlementData.error || 'Failed to fetch settlements');
        }
        setSettlements(settlementData.settlements || []);
      } catch (error: any) {
        console.error(error);
        showFeedback('error', error.message || 'Failed to load trip data');
      } finally {
        setIsLoadingTripData(false);
      }
    },
    [showFeedback]
  );

  useEffect(() => {
    if (user) {
      Promise.all([fetchHouseholds(), fetchTrips()]).catch((error) => {
        console.error(error);
        showFeedback('error', error.message || 'Failed to load account data');
      });
    } else {
      setHouseholds([]);
      setTrips([]);
      setTripDetail(null);
      setParticipants([]);
      setReceipts([]);
      setPhotos([]);
      setSettlements([]);
      setSelectedTripId('');
    }
  }, [user, fetchHouseholds, fetchTrips, showFeedback]);

  useEffect(() => {
    if (trips.length > 0) {
      setSelectedTripId((current) => current || trips[0].id);
    } else {
      setSelectedTripId('');
    }
  }, [trips]);

  useEffect(() => {
    if (selectedTripId) {
      loadTripData(selectedTripId);
    } else {
      setTripDetail(null);
      setParticipants([]);
      setReceipts([]);
      setPhotos([]);
      setSettlements([]);
    }
  }, [selectedTripId, loadTripData]);

  const availableHouseholds = useMemo(() => {
    const existing = new Set(participants.map((participant) => participant.householdId));
    return households.filter((household) => !existing.has(household.id));
  }, [households, participants]);

  const latestSettlement = settlements[0] ?? null;

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (registerForm.password.length < 6) {
      showFeedback('error', 'Password must be at least 6 characters long.');
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      showFeedback('error', 'Passwords do not match.');
      return;
    }
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
          name: registerForm.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      setUser(data.user);
      setRegisterForm({ name: '', email: '', password: '', confirm: '' });
      await Promise.all([fetchHouseholds(), fetchTrips()]);
      showFeedback('success', 'Registration successful. Default household created.');
    } catch (error: any) {
      showFeedback('error', error.message || 'Registration failed');
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginForm.email,
          password: loginForm.password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      setUser(data.user);
      setLoginForm({ email: '', password: '' });
      await Promise.all([fetchHouseholds(), fetchTrips()]);
      showFeedback('success', 'Signed in successfully.');
    } catch (error: any) {
      showFeedback('error', error.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    showFeedback('success', 'Signed out. Local session cleared.');
  };

  const handleCreateHousehold = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      showFeedback('error', 'Please sign in first.');
      return;
    }
    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: householdName, userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create household');
      }
      setHouseholdName('');
      await fetchHouseholds();
      showFeedback('success', `Household "${data.household.displayName}" created.`);
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to create household');
    }
  };

  const handleCreateTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      showFeedback('error', 'Please sign in first.');
      return;
    }
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tripForm.name,
          currency: tripForm.currency,
          userId: user.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create trip');
      }
      setTripForm({ name: '', currency: tripForm.currency });
      const list = await fetchTrips();
      setSelectedTripId(data.trip?.id || list?.[0]?.id || '');
      showFeedback('success', `Trip "${data.trip.name}" created and ready.`);
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to create trip');
    }
  };

  const handleAddParticipant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTripId) {
      showFeedback('error', 'Please select a trip first.');
      return;
    }
    try {
      const response = await fetch(`/api/trips/${selectedTripId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: participantForm.householdId,
          weight: Number(participantForm.weight),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add participant');
      }
      setParticipantForm({ householdId: '', weight: 1 });
      await loadTripData(selectedTripId);
      showFeedback('success', 'Participant added to the trip.');
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to add participant');
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedTripId) return;
    try {
      const response = await fetch(
        `/api/trips/${selectedTripId}/participants?participantId=${participantId}`,
        {
          method: 'DELETE',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove participant');
      }
      await loadTripData(selectedTripId);
      showFeedback('success', 'Participant removed.');
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to remove participant');
    }
  };

  const handleUploadReceipt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTripId || !user) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('uploaderId', user.id);

      const response = await fetch(`/api/trips/${selectedTripId}/receipts`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload receipt');
      }
      event.target.value = '';
      await loadTripData(selectedTripId);
      showFeedback('success', 'Receipt uploaded successfully.');
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to upload receipt');
    }
  };

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTripId || !user) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const response = await fetch(`/api/trips/${selectedTripId}/photos`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload photo');
      }
      event.target.value = '';
      await loadTripData(selectedTripId);
      showFeedback('success', 'Photo uploaded successfully.');
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to upload photo');
    }
  };

  const handleRecomputeSettlement = async () => {
    if (!selectedTripId) {
      showFeedback('error', 'Please select a trip first.');
      return;
    }
    try {
      const response = await fetch(`/api/trips/${selectedTripId}/settlements/recompute`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to recompute settlement');
      }
      await loadTripData(selectedTripId);
      showFeedback('success', `Settlement v${data.settlement.version} generated.`);
    } catch (error: any) {
      showFeedback('error', error.message || 'Failed to recompute settlement');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-12">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">MemoTrip API Playground</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Explore every available API route in a single page. Authenticate, manage households and trips, upload receipts/photos, and recompute settlements without leaving the browser.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ← Back to home
          </Link>
        </div>

        {feedback && (
          <div
            className={`mt-6 rounded-lg px-4 py-3 text-sm font-medium shadow ${
              feedback.type === 'success'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="mt-8 space-y-8">
          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Authentication</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Use the register or login endpoints to obtain a session stored in your browser&apos;s localStorage.
            </p>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <form onSubmit={handleRegister} className="space-y-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Register</h3>
                <input
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  placeholder="Name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  type="password"
                  placeholder="Password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  value={registerForm.confirm}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirm: event.target.value }))}
                  required
                  type="password"
                  placeholder="Confirm password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  POST /api/auth/register
                </button>
              </form>

              <form onSubmit={handleLogin} className="space-y-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Login</h3>
                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  type="password"
                  placeholder="Password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  POST /api/auth/login
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Clear local session
                  </button>
                )}
              </form>
            </div>

            {user && (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="font-medium text-slate-800 dark:text-slate-200">Active user</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">ID: {user.id}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Email: {user.email}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Name: {user.name || '—'}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Households</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Automatically created with registration and manageable via the households API.
                </p>
              </div>
              <button
                onClick={() => fetchHouseholds().catch((error) => showFeedback('error', error.message))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>

            {!user ? (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">
                Sign in to create or view households.
              </p>
            ) : (
              <>
                <form onSubmit={handleCreateHousehold} className="mt-4 flex flex-col gap-3 md:flex-row">
                  <input
                    value={householdName}
                    onChange={(event) => setHouseholdName(event.target.value)}
                    required
                    placeholder="Household name"
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    POST /api/households
                  </button>
                </form>

                <div className="mt-6 space-y-4">
                  {households.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No households yet. Create one with the form above.
                    </p>
                  ) : (
                    households.map((household) => (
                      <div
                        key={household.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {household.displayName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">ID: {household.id}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {household.members.length} member(s)
                          </span>
                        </div>
                        <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          {household.members.map((member) => (
                            <li key={member.id}>
                              {member.user.name || 'Unnamed'} — {member.user.email}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Trips</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Create trips, then add participants, receipts, photos, and settlements.
                </p>
              </div>
              <button
                onClick={() => fetchTrips().catch((error) => showFeedback('error', error.message))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>

            {!user ? (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">Sign in to manage trips.</p>
            ) : (
              <>
                <form onSubmit={handleCreateTrip} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input
                    value={tripForm.name}
                    onChange={(event) => setTripForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    placeholder="Trip name"
                    className="md:col-span-2 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <select
                    value={tripForm.currency}
                    onChange={(event) => setTripForm((prev) => ({ ...prev, currency: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="md:col-span-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    POST /api/trips
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  {trips.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No trips yet. Create one above to continue.
                    </p>
                  ) : (
                    trips.map((trip) => (
                      <button
                        key={trip.id}
                        onClick={() => setSelectedTripId(trip.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          selectedTripId === trip.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-base font-semibold">{trip.name}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {trip.currency}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Receipts: {trip._count.receipts} • Photos: {trip._count.photos}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Selected trip data</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Aggregates GET requests for trip details, participants, receipts, photos, and settlements.
                </p>
              </div>
              <button
                onClick={() => selectedTripId && loadTripData(selectedTripId)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Reload trip data
              </button>
            </div>

            {!selectedTripId || !tripDetail ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Choose a trip to see aggregated information.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{tripDetail.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">ID: {tripDetail.id}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {tripDetail.currency}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Created {formatDate(tripDetail.createdAt)} • Updated {formatDate(tripDetail.updatedAt)}
                  </p>
                  {isLoadingTripData && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Refreshing data…</p>
                  )}
                </div>

                <details className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                    View raw trip JSON (GET /api/trips/{selectedTripId})
                  </summary>
                  <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {JSON.stringify(tripDetail, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Participants</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Manage households participating in the selected trip.
                </p>
              </div>
            </div>

            {!selectedTripId ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Select a trip to manage participants.</p>
            ) : (
              <>
                <form onSubmit={handleAddParticipant} className="mt-4 grid gap-3 md:grid-cols-4">
                  <select
                    value={participantForm.householdId}
                    onChange={(event) => setParticipantForm((prev) => ({ ...prev, householdId: event.target.value }))}
                    required
                    className="md:col-span-2 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">Select household…</option>
                    {availableHouseholds.map((household) => (
                      <option key={household.id} value={household.id}>
                        {household.displayName}
                      </option>
                    ))}
                  </select>
                  <input
                    value={participantForm.weight}
                    onChange={(event) => setParticipantForm((prev) => ({ ...prev, weight: Number(event.target.value) }))}
                    required
                    min={0}
                    max={2}
                    step={0.1}
                    type="number"
                    placeholder="Weight"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="md:col-span-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    POST /api/trips/[id]/participants
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  {participants.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No participants yet. Add one above.
                    </p>
                  ) : (
                    participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {participant.household.displayName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Household ID: {participant.householdId}</p>
                          </div>
                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                            Weight {participant.weight.toFixed(1)}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          {participant.household.members.map((member) => (
                            <li key={member.id}>
                              {member.user.name || 'Unnamed'} — {member.user.email}
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleRemoveParticipant(participant.id)}
                          className="mt-3 text-sm font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                        >
                          DELETE /api/trips/[id]/participants
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Receipts</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Upload images and browse the stored metadata for this trip.
                </p>
              </div>
            </div>

            {!selectedTripId ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Select a trip to manage receipts.</p>
            ) : (
              <>
                <label className="mt-4 flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-blue-400 dark:hover:text-blue-200">
                  <span>POST /api/trips/[id]/receipts</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadReceipt} />
                </label>

                <div className="mt-6 space-y-3">
                  {receipts.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">No receipts uploaded yet.</p>
                  ) : (
                    receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{receipt.status}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Uploaded by {receipt.uploader.name || receipt.uploader.email}</p>
                          </div>
                          <a
                            href={`/api/files/${receipt.filePath}`}
                            target="_blank"
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-500/20 dark:hover:text-blue-200"
                            rel="noreferrer"
                          >
                            View file
                          </a>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Created {formatDate(receipt.createdAt)}
                        </p>
                        {receipt.parsedJson && (
                          <details className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                            <summary className="cursor-pointer font-semibold">Parsed data</summary>
                            <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 text-[11px] leading-relaxed dark:bg-slate-950">
                              {JSON.stringify(receipt.parsedJson, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Photos</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Store trip photos through the same upload pipeline.
                </p>
              </div>
            </div>

            {!selectedTripId ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Select a trip to manage photos.</p>
            ) : (
              <>
                <label className="mt-4 flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-blue-400 dark:hover:text-blue-200">
                  <span>POST /api/trips/[id]/photos</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />
                </label>

                <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {photos.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400 md:col-span-2 lg:col-span-3">
                      No photos uploaded yet.
                    </p>
                  ) : (
                    photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex flex-col rounded-xl border border-slate-200 overflow-hidden dark:border-slate-800"
                      >
                        <div className="aspect-video bg-slate-200 dark:bg-slate-800">
                          <img
                            src={`/api/files/${photo.filePath}`}
                            alt="Trip photo"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-3 text-xs text-slate-600 dark:text-slate-400">
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            {photo.uploader.name || photo.uploader.email}
                          </p>
                          <p className="mt-1">Created {formatDate(photo.createdAt)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Settlements</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Generate and inspect settlement versions computed from uploaded receipts.
                </p>
              </div>
              <button
                onClick={handleRecomputeSettlement}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                POST /api/trips/[id]/settlements/recompute
              </button>
            </div>

            {!selectedTripId ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Select a trip to view settlements.</p>
            ) : latestSettlement ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Settlement version {latestSettlement.version}
                    </p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Generated {formatDate(latestSettlement.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Total participant weight: {latestSettlement.tableJson?.totalWeight?.toFixed?.(2) ?? '—'}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">Household</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">Weight</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">Should pay</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">Paid</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(latestSettlement.tableJson?.households || []).map((household) => (
                        <tr key={household.householdId} className="bg-white dark:bg-slate-950">
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{household.householdName}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{household.weight?.toFixed?.(1) ?? '—'}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                            {household.shouldPay.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{household.paid.toFixed(2)}</td>
                          <td className={`px-4 py-2 font-semibold ${
                            household.netAmount >= 0
                              ? 'text-emerald-600 dark:text-emerald-300'
                              : 'text-rose-600 dark:text-rose-300'
                          }`}>
                            {household.netAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Suggested transfers</h3>
                  {latestSettlement.transfersJson && latestSettlement.transfersJson.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      {latestSettlement.transfersJson.map((transfer, index) => (
                        <li key={`${transfer.fromName}-${transfer.toName}-${index}`}>
                          {transfer.fromName} → {transfer.toName}: {transfer.amount.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      No transfers needed — everyone is settled.
                    </p>
                  )}
                </div>

                <details className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                    View raw settlement payload (GET /api/trips/[id]/settlements)
                  </summary>
                  <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {JSON.stringify(settlements, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Recalculate a settlement to see the latest results.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
