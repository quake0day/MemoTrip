'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import JSZip from 'jszip';
import { useI18n } from '../../providers';

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
  manualEditsJson?: any;
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
      weight: number;
      role: 'OWNER' | 'MEMBER';
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
  exifJson?: Record<string, unknown> | null;
  width?: number | null;
  height?: number | null;
  tags?: string[];
}

interface Invite {
  id: string;
  email: string | null;
  householdId: string | null;
  expiresAt: string;
  createdAt: string;
  used: number;
  household?: {
    id: string;
    displayName: string;
  } | null;
}

type TabType = 'receipts' | 'settlements' | 'photos' | 'participants';

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const router = useRouter();
  const { t } = useI18n();
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
  const [invites, setInvites] = useState<Invite[]>([]);

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  // Settlement editing states
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [isEditingSettlement, setIsEditingSettlement] = useState(false);
  const [savingSettlement, setSavingSettlement] = useState(false);

  // Participant management states
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [participantError, setParticipantError] = useState('');
  const [addParticipantMode, setAddParticipantMode] = useState<'member' | 'invite'>('member');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberHouseholdId, setNewMemberHouseholdId] = useState('');
  const [newMemberWeight, setNewMemberWeight] = useState(1);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteWeight, setInviteWeight] = useState(1);
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Photo interaction states
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoTagInput, setPhotoTagInput] = useState('');
  const [photoUpdateError, setPhotoUpdateError] = useState('');
  const [receiptAssignments, setReceiptAssignments] = useState<Record<string, string[]>>({});
  const [photoAssignments, setPhotoAssignments] = useState<Record<string, string[]>>({});

  const receiptAssignmentsStorageKey = useMemo(
    () => (tripId ? `trip-${tripId}-receipt-households` : null),
    [tripId]
  );

  const photoAssignmentsStorageKey = useMemo(
    () => (tripId ? `trip-${tripId}-photo-members` : null),
    [tripId]
  );

  const currencyFormatter = useMemo(() => {
    const currency = trip?.currency || 'USD';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      });
    } catch (error) {
      console.warn('Falling back to USD currency formatter', error);
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      });
    }
  }, [trip?.currency]);

  const formatCurrency = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) {
        return Number.isNaN(value) ? '—' : value.toString();
      }
      return currencyFormatter.format(value);
    },
    [currencyFormatter]
  );

  const extractNumericValue = useCallback((input: unknown): number | null => {
    if (typeof input === 'number' && Number.isFinite(input)) {
      return input;
    }
    if (typeof input === 'string') {
      const cleaned = input.replace(/[^0-9.\-]/g, '');
      const parsed = parseFloat(cleaned);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, []);

  const getReceiptAmount = useCallback(
    (receipt: Receipt): number => {
      const manual = receipt.manualEditsJson as Record<string, unknown> | undefined;
      const parsed = receipt.parsedJson as Record<string, unknown> | undefined;
      const candidates = [
        manual?.total,
        manual?.amount,
        parsed?.total,
        parsed?.amount,
        parsed?.grandTotal,
      ];

      for (const candidate of candidates) {
        const value = extractNumericValue(candidate);
        if (value !== null) {
          return value;
        }
      }

      return 0;
    },
    [extractNumericValue]
  );

  useEffect(() => {
    if (!receiptAssignmentsStorageKey) {
      setReceiptAssignments({});
      return;
    }

    try {
      const stored = localStorage.getItem(receiptAssignmentsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setReceiptAssignments(parsed as Record<string, string[]>);
        } else {
          setReceiptAssignments({});
        }
      } else {
        setReceiptAssignments({});
      }
    } catch (error) {
      console.warn('Failed to parse stored receipt households', error);
      setReceiptAssignments({});
    }
  }, [receiptAssignmentsStorageKey]);

  useEffect(() => {
    if (!photoAssignmentsStorageKey) {
      setPhotoAssignments({});
      return;
    }

    try {
      const stored = localStorage.getItem(photoAssignmentsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setPhotoAssignments(parsed as Record<string, string[]>);
        } else {
          setPhotoAssignments({});
        }
      } else {
        setPhotoAssignments({});
      }
    } catch (error) {
      console.warn('Failed to parse stored photo households', error);
      setPhotoAssignments({});
    }
  }, [photoAssignmentsStorageKey]);

  useEffect(() => {
    if (receiptAssignmentsStorageKey) {
      localStorage.setItem(
        receiptAssignmentsStorageKey,
        JSON.stringify(receiptAssignments)
      );
    }
  }, [receiptAssignments, receiptAssignmentsStorageKey]);

  useEffect(() => {
    if (photoAssignmentsStorageKey) {
      localStorage.setItem(
        photoAssignmentsStorageKey,
        JSON.stringify(photoAssignments)
      );
    }
  }, [photoAssignments, photoAssignmentsStorageKey]);

  useEffect(() => {
    if (participants.length === 0) {
      if (Object.keys(receiptAssignments).length > 0) {
        setReceiptAssignments({});
      }
      if (Object.keys(photoAssignments).length > 0) {
        setPhotoAssignments({});
      }
      return;
    }

    const validHouseholds = new Set(participants.map(participant => participant.householdId));
    const validMemberIds = new Set(
      participants.flatMap(participant =>
        participant.household.members.map(member => member.id)
      )
    );

    setReceiptAssignments(prev => {
      let changed = false;
      const next: Record<string, string[]> = {};

      Object.entries(prev).forEach(([receiptId, householdIds]) => {
        const filtered = householdIds.filter(id => validHouseholds.has(id));
        if (filtered.length !== householdIds.length) {
          changed = true;
        }
        if (filtered.length > 0) {
          next[receiptId] = filtered;
        } else if (householdIds.length > 0) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setPhotoAssignments(prev => {
      let changed = false;
      const next: Record<string, string[]> = {};

      Object.entries(prev).forEach(([photoId, memberIds]) => {
        const filtered = memberIds.filter(id => validMemberIds.has(id));
        if (filtered.length !== memberIds.length) {
          changed = true;
        }
        if (filtered.length > 0) {
          next[photoId] = filtered;
        } else if (memberIds.length > 0) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [participants, photoAssignments, receiptAssignments]);

  useEffect(() => {
    if (receipts.length === 0) {
      setReceiptAssignments({});
      return;
    }

    const validReceipts = new Set(receipts.map(receipt => receipt.id));

    setReceiptAssignments(prev => {
      let changed = false;
      const next: Record<string, string[]> = {};

      Object.entries(prev).forEach(([receiptId, householdIds]) => {
        if (!validReceipts.has(receiptId)) {
          changed = true;
          return;
        }
        next[receiptId] = householdIds;
      });

      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }

      return next;
    });
  }, [receipts]);

  useEffect(() => {
    if (photos.length === 0) {
      setPhotoAssignments({});
      return;
    }

    const validPhotos = new Set(photos.map(photo => photo.id));

    setPhotoAssignments(prev => {
      let changed = false;
      const next: Record<string, string[]> = {};

      Object.entries(prev).forEach(([photoId, householdIds]) => {
        if (!validPhotos.has(photoId)) {
          changed = true;
          return;
        }
        next[photoId] = householdIds;
      });

      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }

      return next;
    });
  }, [photos]);

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
        fetchInvites(id),
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
      const settlementRecords: Settlement[] = data.settlements || [];
      setSettlements(settlementRecords);
      if (!isEditingSettlement && settlementRecords.length > 0) {
        setEditingSettlement(JSON.parse(JSON.stringify(settlementRecords[0])));
      }
      if (settlementRecords.length === 0) {
        setEditingSettlement(null);
      }
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
    }
  };

  const fetchPhotos = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/photos`);
      const data = await res.json();
      const normalized = (data.photos || []).map((photo: Photo) => ({
        ...photo,
        tags: Array.isArray(photo.tags) ? photo.tags : [],
      }));
      setPhotos(normalized);
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    }
  };

  const fetchInvites = async (id: string) => {
    try {
      const res = await fetch(`/api/trips/${id}/invites`);
      const data = await res.json();
      setInvites(data.invites || []);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
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

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberHouseholdId) {
      setParticipantError(t('trip.participants.errorNoHousehold'));
      return;
    }

    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      setParticipantError(t('trip.participants.errorMissingMemberFields'));
      return;
    }

    setParticipantError('');
    setAddingParticipant(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/participants/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: newMemberHouseholdId,
          name: newMemberName,
          email: newMemberEmail,
          weight: newMemberWeight,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create member');
      }

      await fetchParticipants(tripId);
      setShowAddParticipantModal(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberHouseholdId('');
      setNewMemberWeight(1);
    } catch (error: any) {
      setParticipantError(error.message);
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setParticipantError('You must be logged in to invite participants.');
      return;
    }

    setParticipantError('');
    setCreatingInvite(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          householdName: inviteName || inviteEmail,
          weight: inviteWeight,
          createdBy: user.id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send invite');
      }

      await Promise.all([fetchParticipants(tripId), fetchInvites(tripId)]);
      setShowAddParticipantModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteWeight(1);
    } catch (error: any) {
      setParticipantError(error.message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCloseParticipantModal = () => {
    setShowAddParticipantModal(false);
    setParticipantError('');
    setAddParticipantMode('member');
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberHouseholdId('');
    setNewMemberWeight(1);
    setInviteEmail('');
    setInviteName('');
    setInviteWeight(1);
  };

  const householdMap = useMemo(() => {
    const map = new Map<string, Participant>();
    participants.forEach(participant => {
      map.set(participant.householdId, participant);
    });
    return map;
  }, [participants]);

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) =>
        a.household.displayName.localeCompare(
          b.household.displayName,
          undefined,
          { sensitivity: 'base' }
        )
      ),
    [participants]
  );

  const sortedMembers = useMemo(() => {
    const members = sortedParticipants.flatMap(participant =>
      participant.household.members.map(member => ({
        id: member.id,
        weight: member.weight ?? 1,
        name: member.user.name || member.user.email,
        email: member.user.email,
        householdId: participant.householdId,
        householdName: participant.household.displayName,
      }))
    );

    return members.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [sortedParticipants]);

  useEffect(() => {
    if (
      showAddParticipantModal &&
      !newMemberHouseholdId &&
      sortedParticipants.length > 0
    ) {
      setNewMemberHouseholdId(sortedParticipants[0].householdId);
    }
  }, [showAddParticipantModal, newMemberHouseholdId, sortedParticipants]);

  const toggleReceiptHousehold = useCallback(
    (receiptId: string, householdId: string) => {
      setReceiptAssignments(prev => {
        const current = prev[receiptId] ?? [];
        const exists = current.includes(householdId);
        const nextSelections = exists
          ? current.filter(id => id !== householdId)
          : [...current, householdId];
        const next = { ...prev };
        if (nextSelections.length > 0) {
          next[receiptId] = nextSelections;
        } else {
          delete next[receiptId];
        }
        return next;
      });
    },
    []
  );

  const togglePhotoMember = useCallback(
    (photoId: string, memberId: string) => {
      setPhotoAssignments(prev => {
        const current = prev[photoId] ?? [];
        const exists = current.includes(memberId);
        const nextSelections = exists
          ? current.filter(id => id !== memberId)
          : [...current, memberId];
        const next = { ...prev };
        if (nextSelections.length > 0) {
          next[photoId] = nextSelections;
        } else {
          delete next[photoId];
        }
        return next;
      });
    },
    []
  );

  const weightedAllocation = useMemo(() => {
    const allocation = new Map<
      string,
      {
        amount: number;
        name: string;
      }
    >();
    let total = 0;

    receipts.forEach(receipt => {
      const selected = receiptAssignments[receipt.id];
      if (!selected || selected.length === 0) {
        return;
      }

      const amount = getReceiptAmount(receipt);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      const participatingHouseholds = selected
        .map(id => householdMap.get(id))
        .filter(
          (participant): participant is Participant =>
            Boolean(participant) && participant.weight > 0
        );

      if (participatingHouseholds.length === 0) {
        return;
      }

      const totalWeight = participatingHouseholds.reduce(
        (sum, participant) => sum + participant.weight,
        0
      );

      if (totalWeight <= 0) {
        return;
      }

      total += amount;

      participatingHouseholds.forEach(participant => {
        const share = (amount * participant.weight) / totalWeight;
        const existing = allocation.get(participant.householdId) || {
          amount: 0,
          name: participant.household.displayName,
        };
        existing.amount += share;
        allocation.set(participant.householdId, existing);
      });
    });

    return {
      total,
      entries: Array.from(allocation.entries()).map(([householdId, data]) => ({
        householdId,
        ...data,
      })),
    };
  }, [getReceiptAmount, householdMap, receiptAssignments, receipts]);

  useEffect(() => {
    if (photos.length === 0) {
      setSelectedPhotos(new Set());
      return;
    }

    setSelectedPhotos(prev => {
      const validIds = new Set(photos.map(photo => photo.id));
      const next = new Set<string>();
      prev.forEach(id => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [photos]);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const handleSelectAllPhotos = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(photo => photo.id)));
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.size === 0) return;

    setIsBulkDownloading(true);
    try {
      const zip = new JSZip();
      const selected = photos.filter(photo => selectedPhotos.has(photo.id));

      await Promise.all(
        selected.map(async photo => {
          const response = await fetch(`/api/files/${photo.filePath}`);
          if (!response.ok) {
            throw new Error('无法下载照片');
          }
          const blob = await response.blob();
          const fileName = photo.filePath.split('/').pop() || `${photo.id}.jpg`;
          zip.file(fileName, blob);
        })
      );

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${trip?.name || 'trip'}-photos.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download photos:', error);
      alert('批量下载失败，请稍后再试。');
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleOpenPhoto = (photo: Photo) => {
    setActivePhoto(photo);
    setPhotoZoom(1);
    setPhotoTagInput('');
    setPhotoUpdateError('');
  };

  const handleClosePhotoModal = () => {
    setActivePhoto(null);
    setPhotoZoom(1);
    setPhotoTagInput('');
    setPhotoUpdateError('');
  };

  const handleDownloadSinglePhoto = async (photo: Photo) => {
    try {
      const response = await fetch(`/api/files/${photo.filePath}`);
      if (!response.ok) {
        throw new Error('无法下载照片');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = photo.filePath.split('/').pop() || `${photo.id}.jpg`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download photo:', error);
      alert('下载失败，请稍后再试。');
    }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm(t('trip.photos.deleteConfirm'))) {
      return;
    }

    setDeletingPhotoId(photo.id);
    try {
      const res = await fetch(`/api/trips/${tripId}/photos/${photo.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete photo');
      }

      setSelectedPhotos(prev => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });

      if (activePhoto && activePhoto.id === photo.id) {
        setActivePhoto(null);
      }

      await fetchPhotos(tripId);
    } catch (error: any) {
      setUploadError(error.message || 'Failed to delete photo');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const getExifEntries = (photo: Photo | null) => {
    if (!photo?.exifJson || typeof photo.exifJson !== 'object') return [];

    const preferredKeys = [
      'Make',
      'Model',
      'LensModel',
      'ExposureTime',
      'FNumber',
      'ISO',
      'FocalLength',
      'ShutterSpeedValue',
    ];

    const exif = photo.exifJson as Record<string, unknown>;
    const preferred = preferredKeys
      .map((key) => [key, exif[key]] as [string, unknown])
      .filter(([, value]) => value !== undefined && value !== null);

    const remainingEntries = Object.entries(exif)
      .filter(([key]) => !preferredKeys.includes(key))
      .slice(0, Math.max(0, 10 - preferred.length));

    return [...preferred, ...remainingEntries];
  };

  const updatePhotoTags = async (photoId: string, tags: string[]) => {
    const response = await fetch(`/api/trips/${tripId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '更新标签失败');
    }

    const data = await response.json();
    setPhotos(prev =>
      prev.map(photo =>
        photo.id === photoId
          ? { ...photo, tags: data.photo.tags }
          : photo
      )
    );

    setActivePhoto(prev =>
      prev && prev.id === photoId
        ? { ...prev, tags: data.photo.tags }
        : prev
    );
  };

  const handleAddTag = async () => {
    if (!activePhoto) return;
    const newTag = photoTagInput.trim();
    if (!newTag) return;

    const currentTags = activePhoto.tags || [];
    if (currentTags.includes(newTag)) {
      setPhotoUpdateError('标签已存在');
      return;
    }

    try {
      await updatePhotoTags(activePhoto.id, [...currentTags, newTag]);
      setPhotoTagInput('');
      setPhotoUpdateError('');
    } catch (error: any) {
      setPhotoUpdateError(error.message || '更新标签失败');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!activePhoto) return;
    const currentTags = activePhoto.tags || [];
    try {
      await updatePhotoTags(
        activePhoto.id,
        currentTags.filter(existing => existing !== tag)
      );
      setPhotoUpdateError('');
    } catch (error: any) {
      setPhotoUpdateError(error.message || '删除标签失败');
    }
  };

  const adjustPhotoZoom = (delta: number) => {
    setPhotoZoom(prev => {
      const next = prev + delta;
      return Math.min(4, Math.max(0.5, Number(next.toFixed(2))));
    });
  };

  const latestSettlement = useMemo(
    () => (settlements.length > 0 ? settlements[0] : null),
    [settlements]
  );

  const displaySettlement = useMemo(() => {
    if (isEditingSettlement && editingSettlement) {
      return editingSettlement;
    }
    return latestSettlement;
  }, [isEditingSettlement, editingSettlement, latestSettlement]);

  const handleSettlementHouseholdChange = (
    index: number,
    field: 'shouldPay' | 'paid' | 'netAmount' | 'weight',
    value: number
  ) => {
    setEditingSettlement(prev => {
      if (!prev || !prev.tableJson?.households) return prev;
      const households = prev.tableJson.households.map((row: any, rowIndex: number) =>
        rowIndex === index ? { ...row, [field]: value } : row
      );
      return {
        ...prev,
        tableJson: {
          ...prev.tableJson,
          households,
        },
      };
    });
  };

  const handleTransferAmountChange = (index: number, amount: number) => {
    setEditingSettlement(prev => {
      if (!prev || !Array.isArray(prev.transfersJson)) return prev;
      const transfers = prev.transfersJson.map((transfer: any, transferIndex: number) =>
        transferIndex === index ? { ...transfer, amount } : transfer
      );
      return { ...prev, transfersJson: transfers };
    });
  };

  const handleToggleSettlementLock = () => {
    if (!displaySettlement) return;
    setEditingSettlement(prev => {
      const base = prev
        ? { ...prev }
        : JSON.parse(JSON.stringify(displaySettlement));
      base.locked = !base.locked;
      return base;
    });
    setIsEditingSettlement(true);
  };

  const handleEditSettlement = () => {
    if (!latestSettlement) return;
    setEditingSettlement(JSON.parse(JSON.stringify(latestSettlement)));
    setIsEditingSettlement(true);
  };

  const handleResetSettlement = () => {
    if (latestSettlement) {
      setEditingSettlement(JSON.parse(JSON.stringify(latestSettlement)));
    } else {
      setEditingSettlement(null);
    }
    setIsEditingSettlement(false);
  };

  const handleExportSettlement = () => {
    const active = editingSettlement || latestSettlement;
    if (!active || !active.tableJson?.households) return;

    const headers = ['Household', 'Weight', 'Should Pay', 'Paid', 'Net Amount'];
    const rows = active.tableJson.households.map((row: any) => [
      row.householdName,
      row.weight,
      row.shouldPay,
      row.paid,
      row.netAmount,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${trip?.name || 'trip'}-settlement.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSettlement = async () => {
    if (!editingSettlement) return;
    setSavingSettlement(true);
    try {
      const response = await fetch(
        `/api/trips/${tripId}/settlements/${editingSettlement.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableJson: editingSettlement.tableJson,
            transfersJson: editingSettlement.transfersJson,
            locked: editingSettlement.locked,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settlement');
      }

      await fetchSettlements(tripId);
      setIsEditingSettlement(false);
    } catch (error) {
      console.error('Failed to update settlement:', error);
      alert('保存结算数据失败，请稍后再试。');
    } finally {
      setSavingSettlement(false);
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
        <div className="text-xl">{t('trip.loading')}</div>
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
                {t('trip.backToDashboard')}
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {trip?.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('trip.currency', { currency: trip?.currency ?? '' })}
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
              {t('trip.tabs.receipts', { count: receipts.length })}
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settlements'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('trip.tabs.settlements', { count: settlements.length })}
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('trip.tabs.photos', { count: photos.length })}
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'participants'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('trip.tabs.participants', { count: participants.length })}
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
                {t('trip.receipts.title')}
              </h2>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                {uploading ? t('trip.receipts.uploading') : t('trip.receipts.upload')}
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
                <p className="text-gray-600 dark:text-gray-400">{t('trip.receipts.empty')}</p>
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
                        {t('trip.receipts.uploader', { name: receipt.uploader.name })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(receipt.createdAt).toLocaleDateString()}
                      </p>
                      {receipt.parsedJson && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {t('trip.receipts.parsed.amount', {
                              amount:
                                receipt.parsedJson.total ??
                                receipt.parsedJson.amount ??
                                t('trip.receipts.parsed.noAmount'),
                            })}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {receipt.parsedJson.merchant || t('trip.receipts.parsed.unknownMerchant')}
                          </p>
                        </div>
                      )}
                      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t('trip.receipts.attendanceTitle')}
                          </h4>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {t('trip.receipts.attendanceHint')}
                          </p>
                        </div>
                        {sortedParticipants.length === 0 ? (
                          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            {t('trip.receipts.attendanceEmpty')}
                          </p>
                        ) : (
                          <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                            {sortedParticipants.map(participant => {
                              const isChecked = (receiptAssignments[receipt.id] ?? []).includes(
                                participant.householdId
                              );
                              return (
                                <label
                                  key={`${receipt.id}-${participant.householdId}`}
                                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 transition hover:bg-white dark:text-gray-200 dark:hover:bg-gray-800"
                                  onClick={event => event.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={event => {
                                      event.stopPropagation();
                                      toggleReceiptHousehold(
                                        receipt.id,
                                        participant.householdId
                                      );
                                    }}
                                    className="h-4 w-4 accent-blue-600"
                                  />
                                  <span className="flex-1">
                                    {participant.household.displayName}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('trip.participants.weight', {
                                      weight: participant.weight.toFixed(1),
                                    })}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {(() => {
                          const assignedHouseholds = receiptAssignments[receipt.id] ?? [];
                          if (assignedHouseholds.length === 0) {
                            return null;
                          }
                          const participatingHouseholds = assignedHouseholds
                            .map(id => householdMap.get(id))
                            .filter(
                              (participant): participant is Participant => Boolean(participant)
                            );
                          if (participatingHouseholds.length === 0) {
                            return null;
                          }
                          const totalWeight = participatingHouseholds.reduce(
                            (sum, participant) => sum + Math.max(participant.weight, 0),
                            0
                          );
                          if (totalWeight <= 0) {
                            return (
                              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-200">
                                {t('trip.receipts.attendanceMissingWeight')}
                              </div>
                            );
                          }
                          const amount = getReceiptAmount(receipt);
                          if (!Number.isFinite(amount) || amount <= 0) {
                            return (
                              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-200">
                                {t('trip.receipts.attendanceNoAmount')}
                              </div>
                            );
                          }
                          return (
                            <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                              <p className="font-medium">
                                {t('trip.receipts.attendanceTotal', {
                                  amount: formatCurrency(amount),
                                  weight: totalWeight.toFixed(1),
                                })}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {participatingHouseholds.map(participant => {
                                  const share = (amount * participant.weight) / totalWeight;
                                  return (
                                    <li
                                      key={`${receipt.id}-share-${participant.householdId}`}
                                      className="flex items-center justify-between gap-3"
                                    >
                                      <span>{participant.household.displayName}</span>
                                      <span>
                                        {t('trip.receipts.attendanceShare', {
                                          amount: formatCurrency(share),
                                          weight: participant.weight.toFixed(1),
                                        })}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settlements Tab */}
        {activeTab === 'settlements' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('trip.settlements.workspaceTitle')}
                </h2>
                {displaySettlement ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trip.settlements.latestVersion', {
                      version: displaySettlement.version,
                      date: new Date(displaySettlement.createdAt).toLocaleString(),
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trip.settlements.generatePrompt')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRecalculateSettlement}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('trip.settlements.recalculate')}
                </button>
                <button
                  onClick={handleExportSettlement}
                  disabled={!displaySettlement}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t('trip.settlements.exportCsv')}
                </button>
                <button
                  onClick={handleToggleSettlementLock}
                  disabled={!displaySettlement}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {displaySettlement?.locked
                    ? t('trip.settlements.unlockTable')
                    : t('trip.settlements.lockTable')}
                </button>
                {isEditingSettlement ? (
                  <>
                    <button
                      onClick={handleResetSettlement}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
                    >
                      {t('trip.settlements.cancel')}
                    </button>
                    <button
                      onClick={handleSaveSettlement}
                      disabled={savingSettlement}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingSettlement
                        ? t('trip.settlements.saving')
                        : t('trip.settlements.save')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEditSettlement}
                    disabled={!latestSettlement}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {t('trip.settlements.edit')}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('trip.settlements.weightedSummaryTitle')}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {t('trip.settlements.weightedSummaryDescription')}
                </p>
              </div>
              {weightedAllocation.entries.length === 0 ? (
                <div className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {t('trip.settlements.weightedSummaryEmpty')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.weightedSummaryHousehold')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.weightedSummaryAmount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {weightedAllocation.entries.map(entry => (
                        <tr key={entry.householdId}>
                          <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                            {entry.name}
                          </td>
                          <td className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(entry.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {weightedAllocation.entries.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t('trip.settlements.weightedSummaryTotal', {
                      amount: formatCurrency(
                        weightedAllocation.entries.reduce(
                          (sum, entry) => sum + entry.amount,
                          0
                        )
                      ),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {t('trip.settlements.weightedSummaryDisclaimer')}
                  </p>
                </div>
              )}
            </div>

            {displaySettlement ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('trip.settlements.totalWeight', {
                        weight:
                          displaySettlement.tableJson?.totalWeight?.toFixed?.(2) ??
                          displaySettlement.tableJson?.totalWeight ??
                          '—',
                      })}
                    </p>
                    {displaySettlement.locked && (
                      <p className="text-sm text-red-500">
                        {t('trip.settlements.lockedNotice')}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/export/settlement/${tripId}/${displaySettlement.version}`}
                    target="_blank"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('trip.settlements.viewReport')}
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.table.household')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.table.weight')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.table.shouldPay')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.table.paid')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                          {t('trip.settlements.table.net')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {(displaySettlement.tableJson?.households || []).map(
                        (row: any, index: number) => (
                          <tr key={row.householdId || index}>
                            <td className="px-6 py-4">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {row.householdName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('trip.settlements.table.adultsKids', {
                                  adults: row.adults ?? 0,
                                  kids: row.kids ?? 0,
                                })}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              {isEditingSettlement ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={row.weight ?? 0}
                                  onChange={(event) =>
                                    handleSettlementHouseholdChange(
                                      index,
                                      'weight',
                                      parseFloat(event.target.value || '0')
                                    )
                                  }
                                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                                  disabled={displaySettlement.locked}
                                />
                              ) : (
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {row.weight?.toFixed?.(2) ?? row.weight}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditingSettlement ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.shouldPay ?? 0}
                                  onChange={(event) =>
                                    handleSettlementHouseholdChange(
                                      index,
                                      'shouldPay',
                                      parseFloat(event.target.value || '0')
                                    )
                                  }
                                  className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                                  disabled={displaySettlement.locked}
                                />
                              ) : (
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {row.shouldPay?.toFixed?.(2) ?? row.shouldPay}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditingSettlement ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.paid ?? 0}
                                  onChange={(event) =>
                                    handleSettlementHouseholdChange(
                                      index,
                                      'paid',
                                      parseFloat(event.target.value || '0')
                                    )
                                  }
                                  className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                                  disabled={displaySettlement.locked}
                                />
                              ) : (
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {row.paid?.toFixed?.(2) ?? row.paid}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditingSettlement ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.netAmount ?? 0}
                                  onChange={(event) =>
                                    handleSettlementHouseholdChange(
                                      index,
                                      'netAmount',
                                      parseFloat(event.target.value || '0')
                                    )
                                  }
                                  className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                                  disabled={displaySettlement.locked}
                                />
                              ) : (
                                <span
                                  className={`text-sm font-medium ${
                                    (row.netAmount ?? 0) >= 0
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'
                                  }`}
                                >
                                  {row.netAmount?.toFixed?.(2) ?? row.netAmount}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Recommended Transfers
                  </h3>
                  {displaySettlement.transfersJson &&
                  displaySettlement.transfersJson.length > 0 ? (
                    <div className="space-y-2">
                      {displaySettlement.transfersJson.map(
                        (transfer: any, index: number) => (
                          <div
                            key={`${transfer.from}-${transfer.to}-${index}`}
                            className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-3 py-2"
                          >
                            <span className="text-sm text-gray-700 dark:text-gray-200">
                              {transfer.fromName} → {transfer.toName}
                            </span>
                            {isEditingSettlement ? (
                              <input
                                type="number"
                                step="0.01"
                                value={transfer.amount ?? 0}
                                onChange={(event) =>
                                  handleTransferAmountChange(
                                    index,
                                    parseFloat(event.target.value || '0')
                                  )
                                }
                                className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                                disabled={displaySettlement.locked}
                              />
                            ) : (
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {trip?.currency} {transfer.amount?.toFixed?.(2) ?? transfer.amount}
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No transfers suggested.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('trip.settlements.empty')}
                </p>
                <button
                  onClick={handleRecalculateSettlement}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('trip.settlements.calculateFirst')}
                </button>
              </div>
            )}

            {settlements.length > 1 && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {t('trip.settlements.previousVersions')}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {settlements.slice(1).map((settlement) => (
                    <div
                      key={settlement.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t('trip.settlements.versionLabel', { version: settlement.version })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(settlement.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Link
                          href={`/export/settlement/${tripId}/${settlement.version}`}
                          target="_blank"
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {t('trip.settlements.openReport')}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('trip.photos.title')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('trip.photos.selectedCount', {
                    selected: selectedPhotos.size,
                    total: photos.length,
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSelectAllPhotos}
                  disabled={photos.length === 0}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  {selectedPhotos.size === photos.length
                    ? t('trip.photos.clearSelection')
                    : t('trip.photos.selectAll')}
                </button>
                <button
                  onClick={handleDownloadSelected}
                  disabled={selectedPhotos.size === 0 || isBulkDownloading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isBulkDownloading
                    ? t('trip.photos.preparing')
                    : t('trip.photos.downloadSelected')}
                </button>
                <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                  {uploading ? t('trip.photos.uploading') : t('trip.photos.upload')}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            {photos.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400">{t('trip.photos.empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow transition-shadow ${
                        isSelected ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <img
                          src={`/api/files/${photo.filePath}`}
                          alt="Trip photo"
                          className="h-full w-full object-cover cursor-zoom-in"
                          onClick={() => handleOpenPhoto(photo)}
                        />
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePhotoSelection(photo.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="absolute left-3 top-3 h-4 w-4 accent-blue-600"
                        />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {photo.uploader.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(photo.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <button
                              onClick={() => handleDownloadSinglePhoto(photo)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              {t('trip.photos.downloadSingle')}
                            </button>
                            <button
                              onClick={() => handleDeletePhoto(photo)}
                              disabled={deletingPhotoId === photo.id}
                              className="text-red-500 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingPhotoId === photo.id
                                ? t('trip.photos.deleting')
                                : t('trip.photos.delete')}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {photo.tags && photo.tags.length > 0 ? (
                            photo.tags.map((tag) => (
                              <span
                                key={`${photo.id}-${tag}`}
                                className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700"
                              >
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400">{t('trip.photos.noTags')}</span>
                          )}
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                            {t('trip.photos.peopleTitle')}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {t('trip.photos.peopleHint')}
                          </p>
                          {sortedMembers.length === 0 ? (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {t('trip.photos.peopleEmpty')}
                            </p>
                          ) : (
                            <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                              {sortedMembers.map(member => {
                                const isTagged = (photoAssignments[photo.id] ?? []).includes(member.id);
                                return (
                                  <label
                                    key={`${photo.id}-member-${member.id}`}
                                    className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-700 transition hover:bg-white dark:text-gray-200 dark:hover:bg-gray-800"
                                    onClick={event => event.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isTagged}
                                      onChange={event => {
                                        event.stopPropagation();
                                        togglePhotoMember(photo.id, member.id);
                                      }}
                                      className="h-3.5 w-3.5 accent-blue-600"
                                    />
                                    <span className="flex-1">
                                      {member.name}
                                      <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">
                                        {member.householdName}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleOpenPhoto(photo)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {t('trip.photos.viewDetails')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activePhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <button
                onClick={handleClosePhotoModal}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex h-80 items-center justify-center overflow-hidden rounded-xl bg-black">
                    <img
                      src={`/api/files/${activePhoto.filePath}`}
                      alt="Selected photo"
                      style={{ transform: `scale(${photoZoom})`, transformOrigin: 'center center' }}
                      className="max-h-full"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <span>
                      {t('trip.photos.zoomLabel', {
                        percent: Math.round(photoZoom * 100),
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => adjustPhotoZoom(-0.25)}
                        className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <button
                        onClick={() => adjustPhotoZoom(0.25)}
                        className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-100"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setPhotoZoom(1)}
                        className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-100"
                      >
                        {t('trip.photos.resetZoom')}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadSinglePhoto(activePhoto)}
                    className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700"
                  >
                    {t('trip.photos.downloadOriginal')}
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(activePhoto)}
                    disabled={deletingPhotoId === activePhoto.id}
                    className="w-full rounded-lg border border-red-200 py-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-400/50 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    {deletingPhotoId === activePhoto.id
                      ? t('trip.photos.deleting')
                      : t('trip.photos.delete')}
                  </button>
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {activePhoto.uploader.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('trip.photos.uploadedAt', {
                        timestamp: new Date(activePhoto.createdAt).toLocaleString(),
                      })}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('trip.photos.resolution', {
                        resolution:
                          activePhoto.width && activePhoto.height
                            ? `${activePhoto.width}×${activePhoto.height}`
                            : t('trip.photos.resolutionUnknown'),
                      })}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('trip.photos.tagsTitle')}
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activePhoto.tags && activePhoto.tags.length > 0 ? (
                        activePhoto.tags.map((tag) => (
                          <span
                            key={`${activePhoto.id}-${tag}`}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                          >
                            #{tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">{t('trip.photos.noTags')}</span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={photoTagInput}
                        onChange={(event) => setPhotoTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddTag();
                          }
                        }}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder={t('trip.photos.addTagPlaceholder')}
                      />
                      <button
                        onClick={handleAddTag}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        {t('trip.photos.addTag')}
                      </button>
                    </div>
                    {photoUpdateError && (
                      <p className="mt-2 text-sm text-red-500">{photoUpdateError}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('trip.photos.metadataTitle')}
                    </h4>
                    {(() => {
                      const entries = getExifEntries(activePhoto);
                      if (entries.length === 0) {
                        return (
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {t('trip.photos.noMetadata')}
                          </p>
                        );
                      }
                      return (
                        <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
                          {entries.map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-3">
                              <dt className="font-medium text-gray-600 dark:text-gray-400">
                                {key}
                              </dt>
                              <dd className="text-gray-900 dark:text-gray-200">
                                {String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Participants Tab */}
        {activeTab === 'participants' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('trip.participants.title')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('trip.participants.subtitle')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setShowAddParticipantModal(true);
                    setParticipantError('');
                    setAddParticipantMode('member');
                    setNewMemberName('');
                    setNewMemberEmail('');
                    setNewMemberWeight(1);
                    setNewMemberHouseholdId(participants[0]?.householdId ?? '');
                    setInviteEmail('');
                    setInviteName('');
                    setInviteWeight(1);
                  }}
                  disabled={participants.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('trip.participants.addMember')}
                </button>
              </div>
            </div>

            {participants.length === 0 ? (
              <div className="rounded-lg bg-white py-12 text-center shadow dark:bg-gray-800">
                <p className="text-gray-600 dark:text-gray-400">{t('trip.participants.none')}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {sortedParticipants.map(participant => (
                  <div
                    key={participant.id}
                    className="rounded-2xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {participant.household.displayName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('trip.participants.memberCount', {
                            count: participant.household.members.length,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                          {t('trip.participants.totalWeight', {
                            weight: participant.weight.toFixed(2),
                          })}
                        </span>
                        <button
                          onClick={() => handleRemoveParticipant(participant.id)}
                          className="rounded-lg border border-red-200 px-3 py-1 text-red-500 transition hover:bg-red-50 dark:border-red-400/40 dark:hover:bg-red-900/20"
                        >
                          {t('trip.participants.removeHousehold')}
                        </button>
                      </div>
                    </div>
                    <div className="px-4 py-4">
                      {participant.household.members.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t('trip.participants.waitingMembers')}
                        </p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {participant.household.members.map(member => (
                            <div
                              key={member.id}
                              className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {member.user.name || member.user.email}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {member.user.email}
                                  </p>
                                </div>
                                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-800/80 dark:text-gray-200">
                                  {t('trip.participants.memberWeight', {
                                    weight: (member.weight ?? 1).toFixed(2),
                                  })}
                                </span>
                              </div>
                              <p className="mt-2 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {member.role === 'OWNER'
                                  ? t('trip.participants.ownerRole')
                                  : t('trip.participants.memberRole')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {invites.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('trip.participants.pendingInvites')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                          {t('trip.participants.table.email')}
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                          {t('trip.participants.table.household')}
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                          {t('trip.participants.table.expires')}
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                          {t('trip.participants.table.status')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {invites.map((invite) => (
                        <tr key={invite.id}>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {invite.email || '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                            {invite.household?.displayName || '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                invite.used > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {invite.used > 0
                                ? t('trip.participants.joined')
                                : t('trip.participants.pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Participant Modal */}
      {showAddParticipantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('trip.participants.manage')}
              </h3>
              <button
                onClick={handleCloseParticipantModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAddParticipantMode('member')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                  addParticipantMode === 'member'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('trip.participants.addMemberTab')}
              </button>
              <button
                type="button"
                onClick={() => setAddParticipantMode('invite')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                  addParticipantMode === 'invite'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('trip.participants.inviteByEmail')}
              </button>
            </div>

            {participantError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {participantError}
              </div>
            )}

            {addParticipantMode === 'member' ? (
              <form onSubmit={handleCreateMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.memberName')}
                  </label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.memberEmail')}
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.memberHousehold')}
                  </label>
                  <select
                    value={newMemberHouseholdId}
                    onChange={(e) => setNewMemberHouseholdId(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">{t('trip.participants.chooseHousehold')}</option>
                    {sortedParticipants.map(participant => (
                      <option key={participant.householdId} value={participant.householdId}>
                        {participant.household.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.memberWeightLabel')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={newMemberWeight}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setNewMemberWeight(Number.isNaN(value) ? 1 : value);
                    }}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('trip.participants.memberWeightHint')}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseParticipantModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {t('trip.settlements.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={addingParticipant}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingParticipant ? t('trip.participants.savingMember') : t('trip.participants.addMemberAction')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.inviteeEmail')}
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder={t('trip.participants.inviteEmailPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.householdNickname')}
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Smith family"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trip.participants.initialWeight')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={inviteWeight}
                    onChange={(event) => {
                      const value = parseFloat(event.target.value);
                      setInviteWeight(Number.isNaN(value) ? 1 : value);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('trip.participants.inviteHint')}
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseParticipantModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {t('trip.settlements.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingInvite ? t('trip.participants.sending') : t('trip.participants.sendInvite')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
