/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Calendar,
  Check,
  Copy,
  DollarSign,
  Plus,
  Sparkles,
  Trash2,
  Users,
  MapPin,
  Clock,
  ArrowUpRight,
  LogOut,
  Share2,
  UserPlus,
  Send,
  ThumbsUp,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Layers,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import {
  ActivityPulse,
  BLUEPRINT_CONSTRAINTS,
  BudgetCategory,
  BudgetItem,
  CollabNote,
  CollabTopicTag,
  EventCategory,
  EventMember,
  EventPlan,
  generateSafeId,
  GuestEntry,
  IdeaCard,
  IdeaPillar,
  LiveParticipant,
  PaymentStatus,
  RsvpStatus,
  sanitizeCollaborators,
  sanitizeNumber,
  sanitizeString,
  TimelineItem,
  TimelinePhase,
  TimelineStatus,
  VendorContractStatus,
  VendorItem,
  VendorServiceType,
} from './types';
import { CURATED_PRESETS, CuratedEventPreset } from './sampleTemplates';
import { EditorialIllustration } from './components/EditorialIllustration';

type WorkspaceTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ai_collab';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: 'Wedding Celebration',
  birthday: 'Milestone Birthday',
  community: 'Community & Civic Event',
};

const BUDGET_CATEGORIES: { value: BudgetCategory; label: string }[] = [
  { value: 'venue', label: 'Venue & Architecture' },
  { value: 'catering', label: 'Culinary & Beverage' },
  { value: 'decor', label: 'Floral & Lighting' },
  { value: 'music', label: 'Music & Acoustics' },
  { value: 'attire', label: 'Attire & Styling' },
  { value: 'logistics', label: 'Transport & Operations' },
];

const TIMELINE_PHASES: { value: TimelinePhase; label: string }[] = [
  { value: 'pre_event', label: 'Pre-Event Preparation' },
  { value: 'setup', label: 'Site Load-In & Setup' },
  { value: 'ceremony_main', label: 'Main Ceremony / Program' },
  { value: 'reception', label: 'Culinary & Reception' },
  { value: 'wrap_up', label: 'Strike & Wrap-Up' },
];

const VENDOR_SERVICES: { value: VendorServiceType; label: string }[] = [
  { value: 'venue', label: 'Venue & Estate' },
  { value: 'catering', label: 'Catering & Bar' },
  { value: 'floral_decor', label: 'Floral & Spatial Design' },
  { value: 'photography', label: 'Photo & Cinema' },
  { value: 'entertainment', label: 'Music & Sound' },
  { value: 'rentals', label: 'Tableware & Rentals' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Navigation & Active Workspace
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [events, setEvents] = useState<EventPlan[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Subcollections for the active event
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [ideas, setIdeas] = useState<IdeaCard[]>([]);
  const [collabNotes, setCollabNotes] = useState<CollabNote[]>([]);
  const [members, setMembers] = useState<EventMember[]>([]);

  // Real-time WebSocket Presence & Activity Pulses
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipant[]>([]);
  const [activityPulses, setActivityPulses] = useState<ActivityPulse[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Modals / Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [uiBanner, setUiBanner] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  // Create Event Form State
  const [newTitle, setNewTitle] = useState('Clara & Julian — Courtyard Wedding');
  const [newCategory, setNewCategory] = useState<EventCategory>('wedding');
  const [newDate, setNewDate] = useState('2027-06-19');
  const [newLocation, setNewLocation] = useState('Villa Solis Limestone Courtyard, Sonoma');
  const [newGuestCount, setNewGuestCount] = useState(110);
  const [newBudgetLimit, setNewBudgetLimit] = useState(48000);
  const [newStyleBrief, setNewStyleBrief] = useState(
    'Warm architectural minimalism, long linen banquet tables, beeswax candlelight, seasonal harvest menu, and acoustic string quartet.'
  );
  const [useAiOnCreate, setUseAiOnCreate] = useState(true);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Join Event Form State
  const [joinEventIdInput, setJoinEventIdInput] = useState('');
  const [joinInviteCodeInput, setJoinInviteCodeInput] = useState('');
  const [joinRoleInput, setJoinRoleInput] = useState<'planner' | 'guest'>('planner');
  const [joiningEvent, setJoiningEvent] = useState(false);

  // Filter / Search States
  const [budgetFilter, setBudgetFilter] = useState<'all' | BudgetCategory>('all');
  const [timelineFilter, setTimelineFilter] = useState<'all' | TimelinePhase>('all');
  const [vendorSearch, setVendorSearch] = useState('');

  // Quick Add Forms
  const [budgetForm, setBudgetForm] = useState({
    title: '',
    category: 'catering' as BudgetCategory,
    estimatedAmount: 2500,
    actualAmount: 0,
    paymentStatus: 'planned' as PaymentStatus,
    notes: '',
  });

  const [timelineForm, setTimelineForm] = useState({
    timeSlot: '17:00',
    title: '',
    phase: 'ceremony_main' as TimelinePhase,
    leadPerson: '',
    notes: '',
  });

  const [vendorForm, setVendorForm] = useState({
    vendorName: '',
    serviceType: 'catering' as VendorServiceType,
    contractStatus: 'shortlisted' as VendorContractStatus,
    quotedPrice: 3500,
    contactPerson: '',
    deliverableNotes: '',
  });

  const [guestForm, setGuestForm] = useState({
    guestName: '',
    partySize: 2,
    rsvpStatus: 'confirmed' as RsvpStatus,
    tableGroup: 'Table 01',
    dietaryNotes: '',
  });

  const [noteInput, setNoteInput] = useState('');
  const [noteTopic, setNoteTopic] = useState<CollabTopicTag>('general');

  // GenAI Studio States
  const [aiPrompt, setAiPrompt] = useState(
    'Design an unforgettable twilight transition between ceremony and dinner that feels intimate and zero-waste'
  );
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiAdvisorResponse, setAiAdvisorResponse] = useState<{
    advisorNote: string;
    ideas: Array<{
      title: string;
      pillar: IdeaPillar;
      description: string;
      estimatedCostImpact: string;
    }>;
    suggestedTimelineCues: Array<{
      timeSlot: string;
      title: string;
      phase: TimelinePhase;
      leadPerson: string;
      notes: string;
    }>;
    suggestedVendors: Array<{
      vendorName: string;
      serviceType: VendorServiceType;
      quotedPrice: number;
      contactPerson: string;
      deliverableNotes: string;
    }>;
  } | null>(null);

  const [aiAuditingBudget, setAiAuditingBudget] = useState(false);
  const [aiBudgetAudit, setAiBudgetAudit] = useState<{
    executiveSummary: string;
    recommendedSavingsUSD: number;
    recommendations: Array<{
      headline: string;
      rationale: string;
      suggestedCategory: BudgetCategory;
      deltaAmount: number;
    }>;
  } | null>(null);

  // ===========================================================================
  // 1. Firebase Auth Listener
  // ===========================================================================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ===========================================================================
  // 2. Real-time Firestore Events Subscription (Owned + Collaborator Events)
  // ===========================================================================
  useEffect(() => {
    if (!authReady || !user) {
      setEvents([]);
      setSelectedEventId(null);
      return;
    }

    setLoadingEvents(true);
    const ownedMap = new Map<string, EventPlan>();
    const collabMap = new Map<string, EventPlan>();

    const mergeAndPublish = () => {
      const combined = new Map<string, EventPlan>();
      for (const [k, v] of ownedMap.entries()) combined.set(k, v);
      for (const [k, v] of collabMap.entries()) combined.set(k, v);
      const list = Array.from(combined.values()).sort((a, b) =>
        a.eventDate.localeCompare(b.eventDate)
      );
      setEvents(list);
      setLoadingEvents(false);
      setSelectedEventId((prev) => {
        if (prev && combined.has(prev)) return prev;
        return list[0]?.id ?? null;
      });
    };

    const qOwned = query(collection(db, 'events'), where('ownerId', '==', user.uid));
    const qCollab = query(
      collection(db, 'events'),
      where('collaboratorUids', 'array-contains', user.uid)
    );

    const unsubOwned = onSnapshot(
      qOwned,
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => {
          ownedMap.set(d.id, { id: d.id, ...(d.data() as Omit<EventPlan, 'id'>) });
        });
        mergeAndPublish();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'events')
    );

    const unsubCollab = onSnapshot(
      qCollab,
      (snap) => {
        collabMap.clear();
        snap.docs.forEach((d) => {
          collabMap.set(d.id, { id: d.id, ...(d.data() as Omit<EventPlan, 'id'>) });
        });
        mergeAndPublish();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'events')
    );

    return () => {
      unsubOwned();
      unsubCollab();
    };
  }, [authReady, user]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  // ===========================================================================
  // 3. Real-time Firestore Subcollection Listeners for Active Event
  // ===========================================================================
  useEffect(() => {
    if (!authReady || !user || !activeEvent) {
      setBudgetItems([]);
      setTimelineItems([]);
      setVendors([]);
      setGuests([]);
      setIdeas([]);
      setCollabNotes([]);
      setMembers([]);
      return;
    }

    const eventId = activeEvent.id;
    const isOwner = activeEvent.ownerId === user.uid;

    // Filter clause that matches Pillar 8 Secure List Query rules
    const accessFilter = isOwner
      ? where('eventOwnerId', '==', user.uid)
      : where('collaboratorUids', 'array-contains', user.uid);

    const unsubBudget = onSnapshot(
      query(collection(db, `events/${eventId}/budgetItems`), accessFilter),
      (snap) => {
        setBudgetItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BudgetItem, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/budgetItems`)
    );

    const unsubTimeline = onSnapshot(
      query(collection(db, `events/${eventId}/timelineItems`), accessFilter),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TimelineItem, 'id'>),
        }));
        list.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
        setTimelineItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/timelineItems`)
    );

    const unsubVendors = onSnapshot(
      query(collection(db, `events/${eventId}/vendors`), accessFilter),
      (snap) => {
        setVendors(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VendorItem, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/vendors`)
    );

    const unsubGuests = onSnapshot(
      query(collection(db, `events/${eventId}/guests`), accessFilter),
      (snap) => {
        setGuests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GuestEntry, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/guests`)
    );

    const unsubIdeas = onSnapshot(
      query(collection(db, `events/${eventId}/ideas`), accessFilter),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IdeaCard, 'id'>) }));
        list.sort((a, b) => b.votesCount - a.votesCount);
        setIdeas(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/ideas`)
    );

    const unsubNotes = onSnapshot(
      query(collection(db, `events/${eventId}/collabNotes`), accessFilter),
      (snap) => {
        setCollabNotes(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CollabNote, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/collabNotes`)
    );

    const memberFilter = isOwner
      ? where('eventOwnerId', '==', user.uid)
      : where('userId', '==', user.uid);
    const unsubMembers = onSnapshot(
      query(collection(db, `events/${eventId}/members`), memberFilter),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventMember, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `events/${eventId}/members`)
    );

    return () => {
      unsubBudget();
      unsubTimeline();
      unsubVendors();
      unsubGuests();
      unsubIdeas();
      unsubNotes();
      unsubMembers();
    };
  }, [authReady, user, activeEvent?.id, activeEvent?.ownerId]);

  // ===========================================================================
  // 4. Real-time WebSocket Connection for Presence & Live Activity Pulses
  // ===========================================================================
  useEffect(() => {
    if (!user || !activeEvent) {
      setLiveParticipants([]);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/collab`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'room:join',
          eventId: activeEvent.id,
          userId: user.uid,
          displayName: user.displayName || 'Lead Planner',
          role: activeEvent.ownerId === user.uid ? 'owner' : 'planner',
          activeTab,
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'presence:sync' && data.eventId === activeEvent.id) {
          setLiveParticipants(data.participants || []);
        } else if (data.type === 'activity:pulse' && data.eventId === activeEvent.id) {
          setActivityPulses((prev) => {
            if (prev.some((p) => p.id === data.id)) return prev;
            return [
              {
                id: data.id,
                actorName: data.actorName,
                summary: data.summary,
                timestamp: data.timestamp,
              },
              ...prev,
            ].slice(0, 8);
          });
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [user?.uid, activeEvent?.id]);

  // Broadcast activeTab changes to teammates over WebSocket
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'focus:changed',
          activeTab,
        })
      );
    }
  }, [activeTab]);

  const emitActivityPulse = (summary: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'activity:pulse',
          id: generateSafeId('pulse'),
          summary,
        })
      );
    }
  };

  // ===========================================================================
  // 5. Computed Metrics (Tabular Numerals)
  // ===========================================================================
  const metrics = useMemo(() => {
    const totalEstimated = budgetItems.reduce((sum, item) => sum + item.estimatedAmount, 0);
    const totalActual = budgetItems.reduce((sum, item) => sum + item.actualAmount, 0);
    const budgetLimit = activeEvent?.totalBudgetLimit || 1;
    const utilizationPct = Math.round((totalEstimated / Math.max(1, budgetLimit)) * 100);

    const completedTimeline = timelineItems.filter((t) => t.status === 'completed').length;
    const confirmedVendors = vendors.filter(
      (v) => v.contractStatus === 'confirmed' || v.contractStatus === 'contracted'
    ).length;

    const confirmedGuestHeadcount = guests
      .filter((g) => g.rsvpStatus === 'confirmed')
      .reduce((sum, g) => sum + g.partySize, 0);
    const totalInvitedHeadcount = guests.reduce((sum, g) => sum + g.partySize, 0);

    return {
      totalEstimated,
      totalActual,
      remainingBudget: (activeEvent?.totalBudgetLimit || 0) - totalEstimated,
      utilizationPct,
      completedTimeline,
      confirmedVendors,
      confirmedGuestHeadcount,
      totalInvitedHeadcount,
    };
  }, [budgetItems, timelineItems, vendors, guests, activeEvent?.totalBudgetLimit]);

  // ===========================================================================
  // 6. Core Firestore Mutations & GenAI Seeding
  // ===========================================================================
  const populateEventSubcollections = async (
    eventId: string,
    eventOwnerId: string,
    collaboratorUids: string[],
    source: {
      budgetItems?: Array<{
        title: string;
        category: BudgetCategory;
        estimatedAmount: number;
        actualAmount: number;
        paymentStatus: PaymentStatus;
        notes: string;
      }>;
      timelineItems?: Array<{
        timeSlot: string;
        title: string;
        phase: TimelinePhase;
        leadPerson: string;
        status: TimelineStatus;
        notes: string;
      }>;
      vendors?: Array<{
        vendorName: string;
        serviceType: VendorServiceType;
        contractStatus: VendorContractStatus;
        quotedPrice: number;
        contactPerson: string;
        deliverableNotes: string;
      }>;
      guests?: Array<{
        guestName: string;
        partySize: number;
        rsvpStatus: RsvpStatus;
        tableGroup: string;
        dietaryNotes: string;
      }>;
      ideas?: Array<{
        title: string;
        pillar: IdeaPillar;
        description: string;
        estimatedCostImpact: string;
      }>;
    }
  ) => {
    if (!user) return;
    const safeCollabs = sanitizeCollaborators(collaboratorUids);

    // 1. Budget Items
    for (const b of source.budgetItems || []) {
      const itemId = generateSafeId('bgt');
      const validCat: BudgetCategory = [
        'venue',
        'catering',
        'decor',
        'music',
        'attire',
        'logistics',
      ].includes(b.category)
        ? b.category
        : 'logistics';
      const validStatus: PaymentStatus = ['planned', 'deposit_paid', 'paid_in_full'].includes(
        b.paymentStatus
      )
        ? b.paymentStatus
        : 'planned';

      const path = `events/${eventId}/budgetItems/${itemId}`;
      try {
        await setDoc(doc(db, path), {
          eventId,
          eventOwnerId,
          authorId: user.uid,
          title: sanitizeString(b.title, BLUEPRINT_CONSTRAINTS.BUDGET_TITLE_MAX, 'Budget Line'),
          category: validCat,
          estimatedAmount: sanitizeNumber(b.estimatedAmount, 0, 100000000, 1000),
          actualAmount: sanitizeNumber(b.actualAmount, 0, 100000000, 0),
          paymentStatus: validStatus,
          notes: sanitizeString(b.notes, BLUEPRINT_CONSTRAINTS.BUDGET_NOTES_MAX, ''),
          collaboratorUids: safeCollabs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    // 2. Timeline Items
    for (const t of source.timelineItems || []) {
      const itemId = generateSafeId('cue');
      const validPhase: TimelinePhase = [
        'pre_event',
        'setup',
        'ceremony_main',
        'reception',
        'wrap_up',
      ].includes(t.phase)
        ? t.phase
        : 'ceremony_main';
      const validStatus: TimelineStatus = ['upcoming', 'in_progress', 'completed'].includes(
        t.status
      )
        ? t.status
        : 'upcoming';

      const path = `events/${eventId}/timelineItems/${itemId}`;
      try {
        await setDoc(doc(db, path), {
          eventId,
          eventOwnerId,
          authorId: user.uid,
          timeSlot: sanitizeString(t.timeSlot, BLUEPRINT_CONSTRAINTS.TIMELINE_SLOT_MAX, '17:00'),
          title: sanitizeString(t.title, BLUEPRINT_CONSTRAINTS.TIMELINE_TITLE_MAX, 'Milestone'),
          phase: validPhase,
          leadPerson: sanitizeString(
            t.leadPerson,
            BLUEPRINT_CONSTRAINTS.TIMELINE_LEAD_MAX,
            user.displayName || 'Lead Producer'
          ),
          status: validStatus,
          notes: sanitizeString(t.notes, BLUEPRINT_CONSTRAINTS.TIMELINE_NOTES_MAX, ''),
          collaboratorUids: safeCollabs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    // 3. Vendors
    for (const v of source.vendors || []) {
      const vendorId = generateSafeId('vnd');
      const validService: VendorServiceType = [
        'venue',
        'catering',
        'floral_decor',
        'photography',
        'entertainment',
        'rentals',
      ].includes(v.serviceType)
        ? v.serviceType
        : 'rentals';
      const validContract: VendorContractStatus = [
        'researching',
        'shortlisted',
        'contracted',
        'confirmed',
      ].includes(v.contractStatus)
        ? v.contractStatus
        : 'shortlisted';

      const path = `events/${eventId}/vendors/${vendorId}`;
      try {
        await setDoc(doc(db, path), {
          eventId,
          eventOwnerId,
          authorId: user.uid,
          vendorName: sanitizeString(
            v.vendorName,
            BLUEPRINT_CONSTRAINTS.VENDOR_NAME_MAX,
            'Partner Studio'
          ),
          serviceType: validService,
          contractStatus: validContract,
          quotedPrice: sanitizeNumber(v.quotedPrice, 0, 100000000, 1500),
          contactPerson: sanitizeString(
            v.contactPerson,
            BLUEPRINT_CONSTRAINTS.VENDOR_CONTACT_MAX,
            'Studio Lead'
          ),
          deliverableNotes: sanitizeString(
            v.deliverableNotes,
            BLUEPRINT_CONSTRAINTS.VENDOR_NOTES_MAX,
            ''
          ),
          collaboratorUids: safeCollabs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    // 4. Guests
    for (const g of source.guests || []) {
      const guestId = generateSafeId('gst');
      const validRsvp: RsvpStatus = ['confirmed', 'invited', 'declined'].includes(g.rsvpStatus)
        ? g.rsvpStatus
        : 'invited';
      const path = `events/${eventId}/guests/${guestId}`;
      try {
        await setDoc(doc(db, path), {
          eventId,
          eventOwnerId,
          authorId: user.uid,
          guestName: sanitizeString(g.guestName, BLUEPRINT_CONSTRAINTS.GUEST_NAME_MAX, 'Guest'),
          partySize: sanitizeNumber(g.partySize, 1, 50, 2),
          rsvpStatus: validRsvp,
          tableGroup: sanitizeString(
            g.tableGroup,
            BLUEPRINT_CONSTRAINTS.GUEST_TABLE_MAX,
            'Main Dining'
          ),
          dietaryNotes: sanitizeString(g.dietaryNotes, BLUEPRINT_CONSTRAINTS.GUEST_DIETARY_MAX, ''),
          collaboratorUids: safeCollabs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    // 5. Ideas
    for (const idea of source.ideas || []) {
      const ideaId = generateSafeId('idea');
      const validPillar: IdeaPillar = [
        'atmosphere',
        'culinary',
        'guest_experience',
        'floral_lighting',
        'music_ritual',
      ].includes(idea.pillar)
        ? idea.pillar
        : 'atmosphere';
      const path = `events/${eventId}/ideas/${ideaId}`;
      try {
        await setDoc(doc(db, path), {
          eventId,
          eventOwnerId,
          authorId: user.uid,
          authorName: sanitizeString(
            user.displayName || 'Lead Planner',
            BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
            'Lead Planner'
          ),
          title: sanitizeString(idea.title, BLUEPRINT_CONSTRAINTS.IDEA_TITLE_MAX, 'Concept Card'),
          pillar: validPillar,
          description: sanitizeString(
            idea.description,
            BLUEPRINT_CONSTRAINTS.IDEA_DESC_MAX,
            'Bespoke design element.'
          ),
          estimatedCostImpact: sanitizeString(
            idea.estimatedCostImpact,
            BLUEPRINT_CONSTRAINTS.IDEA_COST_MAX,
            'Included in target budget'
          ),
          votesCount: 1,
          collaboratorUids: safeCollabs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleSeedPresetEvent = async (presetCategory: EventCategory) => {
    if (!user) return;
    setCreatingEvent(true);
    setUiBanner(null);

    const preset = CURATED_PRESETS[presetCategory];
    const eventId = generateSafeId('evt');
    const inviteCode = `VELA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    try {
      await setDoc(doc(db, 'events', eventId), {
        title: sanitizeString(preset.title, BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX, 'Celebration'),
        category: preset.category,
        eventDate: sanitizeString(preset.eventDate, 32, '2027-06-15'),
        location: sanitizeString(preset.location, BLUEPRINT_CONSTRAINTS.LOCATION_MAX, 'Venue'),
        guestCountEstimate: sanitizeNumber(preset.guestCountEstimate, 1, 100000, 80),
        totalBudgetLimit: sanitizeNumber(preset.totalBudgetLimit, 0, 100000000, 25000),
        styleBrief: sanitizeString(preset.styleBrief, BLUEPRINT_CONSTRAINTS.STYLE_BRIEF_MAX, ''),
        inviteCode,
        status: 'planning',
        ownerId: user.uid,
        ownerName: sanitizeString(
          user.displayName || 'Lead Planner',
          BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
          'Lead Planner'
        ),
        collaboratorUids: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, `events/${eventId}/members/${user.uid}`), {
        eventId,
        eventOwnerId: user.uid,
        userId: user.uid,
        displayName: sanitizeString(
          user.displayName || 'Lead Planner',
          BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
          'Lead Planner'
        ),
        role: 'owner',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await populateEventSubcollections(eventId, user.uid, [], preset);
      setSelectedEventId(eventId);
      setShowCreateModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `events/${eventId}`);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreatingEvent(true);
    setUiBanner(null);

    const eventId = generateSafeId('evt');
    const inviteCode = `VELA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    try {
      let aiBlueprint: {
        refinedStyleBrief?: string;
        budgetItems?: CuratedEventPreset['budgetItems'];
        timelineItems?: CuratedEventPreset['timelineItems'];
        vendors?: CuratedEventPreset['vendors'];
        ideas?: CuratedEventPreset['ideas'];
      } | null = null;

      if (useAiOnCreate) {
        const response = await fetch('/api/ai/generate-blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle,
            category: newCategory,
            eventDate: newDate,
            location: newLocation,
            guestCountEstimate: newGuestCount,
            totalBudgetLimit: newBudgetLimit,
            styleBrief: newStyleBrief,
          }),
        });
        if (response.ok) {
          aiBlueprint = await response.json();
        }
      }

      const finalBrief = sanitizeString(
        aiBlueprint?.refinedStyleBrief || newStyleBrief,
        BLUEPRINT_CONSTRAINTS.STYLE_BRIEF_MAX,
        newStyleBrief
      );

      await setDoc(doc(db, 'events', eventId), {
        title: sanitizeString(
          newTitle,
          BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX,
          'Bespoke Celebration'
        ),
        category: newCategory,
        eventDate: sanitizeString(newDate, 32, '2027-06-19'),
        location: sanitizeString(newLocation, BLUEPRINT_CONSTRAINTS.LOCATION_MAX, 'Venue'),
        guestCountEstimate: sanitizeNumber(newGuestCount, 1, 100000, 80),
        totalBudgetLimit: sanitizeNumber(newBudgetLimit, 0, 100000000, 30000),
        styleBrief: finalBrief,
        inviteCode,
        status: 'planning',
        ownerId: user.uid,
        ownerName: sanitizeString(
          user.displayName || 'Lead Planner',
          BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
          'Lead Planner'
        ),
        collaboratorUids: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, `events/${eventId}/members/${user.uid}`), {
        eventId,
        eventOwnerId: user.uid,
        userId: user.uid,
        displayName: sanitizeString(
          user.displayName || 'Lead Planner',
          BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
          'Lead Planner'
        ),
        role: 'owner',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (aiBlueprint) {
        await populateEventSubcollections(eventId, user.uid, [], {
          budgetItems: aiBlueprint.budgetItems,
          timelineItems: aiBlueprint.timelineItems,
          vendors: aiBlueprint.vendors,
          ideas: aiBlueprint.ideas,
          guests: CURATED_PRESETS[newCategory].guests,
        });
      }

      setSelectedEventId(eventId);
      setShowCreateModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `events/${eventId}`);
    } finally {
      setCreatingEvent(false);
    }
  };

  // ===========================================================================
  // 7. Join Shared Event Workspace (Team & Guest Collaboration)
  // ===========================================================================
  const handleJoinSharedEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanEventId = joinEventIdInput.trim();
    if (!BLUEPRINT_CONSTRAINTS.ID_REGEX.test(cleanEventId)) {
      setUiBanner({ type: 'error', text: 'Please enter a valid Event Workspace ID.' });
      return;
    }

    setJoiningEvent(true);
    setUiBanner(null);

    try {
      const evRef = doc(db, 'events', cleanEventId);
      const snap = await getDoc(evRef);
      if (!snap.exists()) {
        setUiBanner({ type: 'error', text: 'No event workspace found with that ID.' });
        setJoiningEvent(false);
        return;
      }

      const evData = snap.data() as Omit<EventPlan, 'id'>;
      if (
        joinInviteCodeInput.trim() &&
        evData.inviteCode.toUpperCase() !== joinInviteCodeInput.trim().toUpperCase()
      ) {
        setUiBanner({ type: 'error', text: 'Invite code did not match this event workspace.' });
        setJoiningEvent(false);
        return;
      }

      if (evData.ownerId !== user.uid && !evData.collaboratorUids.includes(user.uid)) {
        if (evData.collaboratorUids.length >= BLUEPRINT_CONSTRAINTS.MAX_COLLABORATORS) {
          setUiBanner({
            type: 'error',
            text: 'This workspace has reached the maximum of 10 collaborators.',
          });
          setJoiningEvent(false);
          return;
        }

        const updatedCollabs = [...evData.collaboratorUids, user.uid];
        await updateDoc(evRef, {
          collaboratorUids: updatedCollabs,
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, `events/${cleanEventId}/members/${user.uid}`), {
          eventId: cleanEventId,
          eventOwnerId: evData.ownerId,
          userId: user.uid,
          displayName: sanitizeString(
            user.displayName || 'Collaborator',
            BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
            'Collaborator'
          ),
          role: joinRoleInput,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setSelectedEventId(cleanEventId);
      setShowJoinModal(false);
      setJoinEventIdInput('');
      setJoinInviteCodeInput('');
      setUiBanner({
        type: 'info',
        text: `Joined "${evData.title}" in real-time collaboration mode.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `events/${cleanEventId}`);
    } finally {
      setJoiningEvent(false);
    }
  };

  // ===========================================================================
  // 8. Item Creation & State Transitions
  // ===========================================================================
  const handleAddBudgetItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeEvent || !budgetForm.title.trim()) return;
    const itemId = generateSafeId('bgt');
    const path = `events/${activeEvent.id}/budgetItems/${itemId}`;
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        title: sanitizeString(budgetForm.title, BLUEPRINT_CONSTRAINTS.BUDGET_TITLE_MAX, 'Expense'),
        category: budgetForm.category,
        estimatedAmount: sanitizeNumber(budgetForm.estimatedAmount, 0, 100000000, 0),
        actualAmount: sanitizeNumber(budgetForm.actualAmount, 0, 100000000, 0),
        paymentStatus: budgetForm.paymentStatus,
        notes: sanitizeString(budgetForm.notes, BLUEPRINT_CONSTRAINTS.BUDGET_NOTES_MAX, ''),
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`added budget line "${budgetForm.title.trim()}"`);
      setBudgetForm({
        title: '',
        category: 'catering',
        estimatedAmount: 2500,
        actualAmount: 0,
        paymentStatus: 'planned',
        notes: '',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleCyclePaymentStatus = async (item: BudgetItem) => {
    if (!activeEvent) return;
    const order: PaymentStatus[] = ['planned', 'deposit_paid', 'paid_in_full'];
    const nextStatus = order[(order.indexOf(item.paymentStatus) + 1) % order.length];
    const nextActual =
      nextStatus === 'paid_in_full' && item.actualAmount === 0
        ? item.estimatedAmount
        : item.actualAmount;

    const path = `events/${activeEvent.id}/budgetItems/${item.id}`;
    try {
      await updateDoc(doc(db, path), {
        paymentStatus: nextStatus,
        actualAmount: nextActual,
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`marked "${item.title}" as ${nextStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleAddTimelineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeEvent || !timelineForm.title.trim()) return;
    const itemId = generateSafeId('cue');
    const path = `events/${activeEvent.id}/timelineItems/${itemId}`;
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        timeSlot: sanitizeString(
          timelineForm.timeSlot,
          BLUEPRINT_CONSTRAINTS.TIMELINE_SLOT_MAX,
          '18:00'
        ),
        title: sanitizeString(
          timelineForm.title,
          BLUEPRINT_CONSTRAINTS.TIMELINE_TITLE_MAX,
          'Production Cue'
        ),
        phase: timelineForm.phase,
        leadPerson: sanitizeString(
          timelineForm.leadPerson || user.displayName || 'Lead Producer',
          BLUEPRINT_CONSTRAINTS.TIMELINE_LEAD_MAX,
          'Lead Producer'
        ),
        status: 'upcoming',
        notes: sanitizeString(timelineForm.notes, BLUEPRINT_CONSTRAINTS.TIMELINE_NOTES_MAX, ''),
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`scheduled cue "${timelineForm.timeSlot} · ${timelineForm.title.trim()}"`);
      setTimelineForm({
        timeSlot: '18:00',
        title: '',
        phase: 'reception',
        leadPerson: '',
        notes: '',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleCycleTimelineStatus = async (item: TimelineItem) => {
    if (!activeEvent) return;
    const order: TimelineStatus[] = ['upcoming', 'in_progress', 'completed'];
    const nextStatus = order[(order.indexOf(item.status) + 1) % order.length];
    const path = `events/${activeEvent.id}/timelineItems/${item.id}`;
    try {
      await updateDoc(doc(db, path), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`updated cue "${item.title}" to ${nextStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeEvent || !vendorForm.vendorName.trim()) return;
    const vendorId = generateSafeId('vnd');
    const path = `events/${activeEvent.id}/vendors/${vendorId}`;
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        vendorName: sanitizeString(
          vendorForm.vendorName,
          BLUEPRINT_CONSTRAINTS.VENDOR_NAME_MAX,
          'Vendor'
        ),
        serviceType: vendorForm.serviceType,
        contractStatus: vendorForm.contractStatus,
        quotedPrice: sanitizeNumber(vendorForm.quotedPrice, 0, 100000000, 0),
        contactPerson: sanitizeString(
          vendorForm.contactPerson,
          BLUEPRINT_CONSTRAINTS.VENDOR_CONTACT_MAX,
          'Lead Coordinator'
        ),
        deliverableNotes: sanitizeString(
          vendorForm.deliverableNotes,
          BLUEPRINT_CONSTRAINTS.VENDOR_NOTES_MAX,
          ''
        ),
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`added vendor "${vendorForm.vendorName.trim()}"`);
      setVendorForm({
        vendorName: '',
        serviceType: 'catering',
        contractStatus: 'shortlisted',
        quotedPrice: 3500,
        contactPerson: '',
        deliverableNotes: '',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleCycleVendorStatus = async (vendor: VendorItem) => {
    if (!activeEvent) return;
    const order: VendorContractStatus[] = [
      'researching',
      'shortlisted',
      'contracted',
      'confirmed',
    ];
    const nextStatus = order[(order.indexOf(vendor.contractStatus) + 1) % order.length];
    const path = `events/${activeEvent.id}/vendors/${vendor.id}`;
    try {
      await updateDoc(doc(db, path), {
        contractStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`advanced vendor "${vendor.vendorName}" to ${nextStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeEvent || !guestForm.guestName.trim()) return;
    const guestId = generateSafeId('gst');
    const path = `events/${activeEvent.id}/guests/${guestId}`;
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        guestName: sanitizeString(
          guestForm.guestName,
          BLUEPRINT_CONSTRAINTS.GUEST_NAME_MAX,
          'Guest'
        ),
        partySize: sanitizeNumber(guestForm.partySize, 1, 50, 1),
        rsvpStatus: guestForm.rsvpStatus,
        tableGroup: sanitizeString(
          guestForm.tableGroup,
          BLUEPRINT_CONSTRAINTS.GUEST_TABLE_MAX,
          'Main Table'
        ),
        dietaryNotes: sanitizeString(
          guestForm.dietaryNotes,
          BLUEPRINT_CONSTRAINTS.GUEST_DIETARY_MAX,
          ''
        ),
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`logged RSVP for "${guestForm.guestName.trim()}"`);
      setGuestForm({
        guestName: '',
        partySize: 2,
        rsvpStatus: 'confirmed',
        tableGroup: 'Table 01',
        dietaryNotes: '',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleCycleGuestRsvp = async (g: GuestEntry) => {
    if (!activeEvent) return;
    const order: RsvpStatus[] = ['invited', 'confirmed', 'declined'];
    const nextRsvp = order[(order.indexOf(g.rsvpStatus) + 1) % order.length];
    const path = `events/${activeEvent.id}/guests/${g.id}`;
    try {
      await updateDoc(doc(db, path), {
        rsvpStatus: nextRsvp,
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`updated RSVP for "${g.guestName}" to ${nextRsvp}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleUpvoteIdea = async (idea: IdeaCard) => {
    if (!activeEvent) return;
    const path = `events/${activeEvent.id}/ideas/${idea.id}`;
    try {
      await updateDoc(doc(db, path), {
        votesCount: sanitizeNumber(idea.votesCount + 1, 0, 10000, 1),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`endorsed idea "${idea.title}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handlePostCollabNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeEvent || !noteInput.trim()) return;
    const noteId = generateSafeId('note');
    const path = `events/${activeEvent.id}/collabNotes/${noteId}`;
    const role = activeEvent.ownerId === user.uid ? 'owner' : 'planner';
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        authorName: sanitizeString(
          user.displayName || 'Planner',
          BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
          'Planner'
        ),
        authorRole: role,
        message: sanitizeString(noteInput, BLUEPRINT_CONSTRAINTS.COLLAB_MSG_MAX, ''),
        topicTag: noteTopic,
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`posted a team note under ${noteTopic}`);
      setNoteInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteSubItem = async (subcollection: string, itemId: string) => {
    if (!activeEvent) return;
    const path = `events/${activeEvent.id}/${subcollection}/${itemId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // ===========================================================================
  // 9. GenAI Co-Pilot Actions (Ideation + Budget Controller Audit)
  // ===========================================================================
  const handleRunAiIdeation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;
    setAiGenerating(true);
    setUiBanner(null);

    try {
      const response = await fetch('/api/ai/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTitle: activeEvent.title,
          category: activeEvent.category,
          location: activeEvent.location,
          guestCount: activeEvent.guestCountEstimate,
          totalBudgetLimit: activeEvent.totalBudgetLimit,
          currentBudgetCommitted: metrics.totalEstimated,
          styleBrief: activeEvent.styleBrief,
          userPrompt: aiPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI ideation request failed');
      }
      setAiAdvisorResponse(data);
      emitActivityPulse('generated bespoke AI event concepts');
    } catch (err: unknown) {
      setUiBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to reach Gemini planning advisor.',
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveAiIdeaToBoard = async (idea: {
    title: string;
    pillar: IdeaPillar;
    description: string;
    estimatedCostImpact: string;
  }) => {
    if (!user || !activeEvent) return;
    const ideaId = generateSafeId('idea');
    const path = `events/${activeEvent.id}/ideas/${ideaId}`;
    const validPillar: IdeaPillar = [
      'atmosphere',
      'culinary',
      'guest_experience',
      'floral_lighting',
      'music_ritual',
    ].includes(idea.pillar)
      ? idea.pillar
      : 'atmosphere';
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        authorName: sanitizeString(
          user.displayName || 'Lead Planner',
          BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
          'Lead Planner'
        ),
        title: sanitizeString(idea.title, BLUEPRINT_CONSTRAINTS.IDEA_TITLE_MAX, 'AI Concept'),
        pillar: validPillar,
        description: sanitizeString(idea.description, BLUEPRINT_CONSTRAINTS.IDEA_DESC_MAX, ''),
        estimatedCostImpact: sanitizeString(
          idea.estimatedCostImpact,
          BLUEPRINT_CONSTRAINTS.IDEA_COST_MAX,
          'TBD'
        ),
        votesCount: 1,
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`saved AI concept "${idea.title}" to board`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleSaveAiCueToTimeline = async (cue: {
    timeSlot: string;
    title: string;
    phase: TimelinePhase;
    leadPerson: string;
    notes: string;
  }) => {
    if (!user || !activeEvent) return;
    const itemId = generateSafeId('cue');
    const path = `events/${activeEvent.id}/timelineItems/${itemId}`;
    const validPhase: TimelinePhase = [
      'pre_event',
      'setup',
      'ceremony_main',
      'reception',
      'wrap_up',
    ].includes(cue.phase)
      ? cue.phase
      : 'ceremony_main';
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        timeSlot: sanitizeString(cue.timeSlot, BLUEPRINT_CONSTRAINTS.TIMELINE_SLOT_MAX, '18:00'),
        title: sanitizeString(cue.title, BLUEPRINT_CONSTRAINTS.TIMELINE_TITLE_MAX, 'Cue'),
        phase: validPhase,
        leadPerson: sanitizeString(
          cue.leadPerson,
          BLUEPRINT_CONSTRAINTS.TIMELINE_LEAD_MAX,
          'Producer'
        ),
        status: 'upcoming',
        notes: sanitizeString(cue.notes, BLUEPRINT_CONSTRAINTS.TIMELINE_NOTES_MAX, ''),
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`added AI timeline cue "${cue.title}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleSaveAiVendorToChecklist = async (v: {
    vendorName: string;
    serviceType: VendorServiceType;
    quotedPrice: number;
    contactPerson: string;
    deliverableNotes: string;
  }) => {
    if (!user || !activeEvent) return;
    const vendorId = generateSafeId('vnd');
    const path = `events/${activeEvent.id}/vendors/${vendorId}`;
    const validService: VendorServiceType = [
      'venue',
      'catering',
      'floral_decor',
      'photography',
      'entertainment',
      'rentals',
    ].includes(v.serviceType)
      ? v.serviceType
      : 'rentals';
    try {
      await setDoc(doc(db, path), {
        eventId: activeEvent.id,
        eventOwnerId: activeEvent.ownerId,
        authorId: user.uid,
        vendorName: sanitizeString(v.vendorName, BLUEPRINT_CONSTRAINTS.VENDOR_NAME_MAX, 'Vendor'),
        serviceType: validService,
        contractStatus: 'shortlisted',
        quotedPrice: sanitizeNumber(v.quotedPrice, 0, 100000000, 1500),
        contactPerson: sanitizeString(
          v.contactPerson,
          BLUEPRINT_CONSTRAINTS.VENDOR_CONTACT_MAX,
          'Studio Coordinator'
        ),
        deliverableNotes: sanitizeString(
          v.deliverableNotes,
          BLUEPRINT_CONSTRAINTS.VENDOR_NOTES_MAX,
          ''
        ),
        collaboratorUids: sanitizeCollaborators(activeEvent.collaboratorUids),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      emitActivityPulse(`shortlisted AI-recommended vendor "${v.vendorName}"`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleRunBudgetAudit = async () => {
    if (!activeEvent) return;
    setAiAuditingBudget(true);
    setUiBanner(null);

    try {
      const response = await fetch('/api/ai/optimize-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTitle: activeEvent.title,
          category: activeEvent.category,
          guestCount: activeEvent.guestCountEstimate,
          totalBudgetLimit: activeEvent.totalBudgetLimit,
          budgetItems: budgetItems.map((b) => ({
            title: b.title,
            category: b.category,
            estimatedAmount: b.estimatedAmount,
            actualAmount: b.actualAmount,
            paymentStatus: b.paymentStatus,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to audit budget');
      setAiBudgetAudit(data);
    } catch (err: unknown) {
      setUiBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Budget audit failed.',
      });
    } finally {
      setAiAuditingBudget(false);
    }
  };

  const handleCopyInviteDetails = () => {
    if (!activeEvent) return;
    const text = `Atelier Vela Collaboration Invite\nEvent: ${activeEvent.title}\nWorkspace ID: ${activeEvent.id}\nInvite Code: ${activeEvent.inviteCode}`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Filtered collections
  const filteredBudgetItems = useMemo(
    () =>
      budgetFilter === 'all'
        ? budgetItems
        : budgetItems.filter((b) => b.category === budgetFilter),
    [budgetItems, budgetFilter]
  );

  const filteredTimelineItems = useMemo(
    () =>
      timelineFilter === 'all'
        ? timelineItems
        : timelineItems.filter((t) => t.phase === timelineFilter),
    [timelineItems, timelineFilter]
  );

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.vendorName.toLowerCase().includes(q) ||
        v.serviceType.toLowerCase().includes(q) ||
        v.deliverableNotes.toLowerCase().includes(q)
    );
  }, [vendors, vendorSearch]);

  // ===========================================================================
  // Render Top Bar Contract (Strict 3-Zone Header)
  // ===========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
      <header className="flex items-center justify-between gap-8 px-6 lg:px-10 py-4 border-b border-stone-200 bg-[#FAF8F5]/95 sticky top-0 z-30 backdrop-blur-sm">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="font-display text-xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
        >
          Atelier Vela
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'overview'
                ? 'text-stone-900 border-b-2 border-stone-900 font-semibold'
                : ''
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'budget'
                ? 'text-stone-900 border-b-2 border-stone-900 font-semibold'
                : ''
            }`}
          >
            Budget Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'timeline'
                ? 'text-stone-900 border-b-2 border-stone-900 font-semibold'
                : ''
            }`}
          >
            Run of Show
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vendors')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'vendors'
                ? 'text-stone-900 border-b-2 border-stone-900 font-semibold'
                : ''
            }`}
          >
            Vendor Checklist
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_collab')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'ai_collab'
                ? 'text-stone-900 border-b-2 border-stone-900 font-semibold'
                : ''
            }`}
          >
            AI Studio &amp; Team
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {!user ? (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-4 py-2 text-xs font-medium text-stone-50 bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In with Google
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-xs font-medium text-stone-50 bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Celebration
            </button>
          )}
        </div>
      </header>

      {/* Banner Notification */}
      {uiBanner && (
        <div
          className={`px-6 lg:px-10 py-2.5 text-xs flex items-center justify-between border-b ${
            uiBanner.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-200'
              : 'bg-stone-100 text-stone-800 border-stone-200'
          }`}
        >
          <span>{uiBanner.text}</span>
          <button
            type="button"
            onClick={() => setUiBanner(null)}
            className="text-xs underline ml-4 whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Unauthenticated Editorial Landing Experience */}
      {/* ===================================================================== */}
      {!user ? (
        <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 lg:px-10 py-12 space-y-16">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8 pr-2">
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span>Architectural Event Production</span>
                  <span aria-hidden="true">·</span>
                  <span>Gemini 3.8 Flash Co-Pilot</span>
                  <span aria-hidden="true">·</span>
                  <span>Real-Time Multi-User Sync</span>
                </div>
                <h1
                  className="font-display text-4xl sm:text-5xl lg:text-[3.35rem] font-normal tracking-tight text-stone-900 leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  Orchestrate weddings, milestone suppers, and civic gatherings with calm precision.
                </h1>
                <p className="text-base text-stone-600 max-w-2xl leading-relaxed">
                  Atelier Vela unifies itemized budget ledgers, chronological run-of-show cues,
                  vendor contract checklists, and Gemini-powered creative direction in one shared
                  workspace for lead planners, partners, and guests.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="px-6 py-3 text-sm font-medium text-stone-50 bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
                >
                  <span>Continue with Google to Start Planning</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-stone-500">
                  Instant cloud sync via Firestore · Live team rooms · Zero setup required
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 flex">
              <EditorialIllustration
                category="wedding"
                title="Villa Solis Limestone Courtyard"
                subtitle="110 Guests · $48,000 Target Ledger · 5 Active Collaborators"
                className="w-full rounded-xl min-h-[340px] border border-stone-800"
              />
            </div>
          </section>

          {/* Three Celebration Archetypes Preview */}
          <section className="space-y-6 pt-6 border-t border-stone-200">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-stone-900">
                  Three Production Archetypes, Built for Real Collaboration
                </h2>
                <p className="text-sm text-stone-600 mt-1">
                  Sign in to generate a custom blueprint from scratch with AI or launch a curated
                  production template in one click.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['wedding', 'birthday', 'community'] as EventCategory[]).map((cat) => {
                const preset = CURATED_PRESETS[cat];
                return (
                  <div
                    key={cat}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <EditorialIllustration
                      category={cat}
                      className="h-48 border-b border-stone-200"
                    />
                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>{CATEGORY_LABELS[cat]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {preset.guestCountEstimate} Guests
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            ${preset.totalBudgetLimit.toLocaleString()}
                          </span>
                        </div>
                        <h3 className="font-display text-lg text-stone-900">{preset.title}</h3>
                        <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                          {preset.styleBrief}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        className="w-full py-2 px-4 text-xs font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Sign In to Launch Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      ) : (
        /* =================================================================== */
        /* Authenticated Workspace Layout (Sidebar + Main Viewport)            */
        /* =================================================================== */
        <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
          {/* Left Workspace Sidebar (270px) */}
          <aside className="w-full lg:w-[276px] shrink-0 border-b lg:border-b-0 lg:border-r border-stone-200 bg-[#F5F2EB]/60 p-5 flex flex-col justify-between gap-6">
            <div className="space-y-6">
              {/* Workspace Switcher */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">Celebrations</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowJoinModal(true)}
                      className="text-xs text-stone-600 hover:text-stone-900 underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Join by Code
                    </button>
                  </div>
                </div>

                {loadingEvents ? (
                  <div className="space-y-2">
                    <div className="h-11 rounded-lg bg-stone-200/70 animate-pulse" />
                    <div className="h-11 rounded-lg bg-stone-200/70 animate-pulse" />
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-xs text-stone-500 py-2">
                    No active celebrations yet. Launch a preset or generate one with Gemini below.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {events.map((ev) => {
                      const isSelected = ev.id === activeEvent?.id;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelectedEventId(ev.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer border ${
                            isSelected
                              ? 'bg-white border-stone-300 text-stone-900 shadow-2xs'
                              : 'border-transparent text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                          }`}
                        >
                          <div className="text-xs font-semibold truncate">{ev.title}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                            <span className="capitalize">{ev.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{ev.eventDate}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="flex-1 py-2 px-3 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(true)}
                    className="py-2 px-3 text-xs font-medium bg-white border border-stone-300 text-stone-800 rounded-lg hover:bg-stone-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    title="Join a teammate's celebration using their Workspace ID"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Join</span>
                  </button>
                </div>
              </div>

              {/* Mobile / Tablet Section Switcher */}
              <div className="space-y-1 pt-4 border-t border-stone-200">
                <span className="text-xs font-semibold text-stone-700 block mb-2">
                  Production Modules
                </span>
                {(
                  [
                    { id: 'overview', label: '01. Executive Overview' },
                    { id: 'budget', label: '02. Budget Ledger' },
                    { id: 'timeline', label: '03. Run-of-Show Timeline' },
                    { id: 'vendors', label: '04. Vendor Checklist' },
                    { id: 'ai_collab', label: '05. AI Studio & Team' },
                  ] as { id: WorkspaceTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-stone-900 text-stone-50'
                        : 'text-stone-700 hover:bg-stone-200/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Real-Time Room Presence */}
              {activeEvent && (
                <div className="space-y-2.5 pt-4 border-t border-stone-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700">Live Workspace Room</span>
                    <span className="font-mono tabular-nums text-stone-500">
                      {liveParticipants.length || 1} online
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(liveParticipants.length > 0
                      ? liveParticipants
                      : [
                          {
                            userId: user.uid,
                            displayName: user.displayName || 'Lead Planner',
                            role: activeEvent.ownerId === user.uid ? 'owner' : 'planner',
                            activeTab,
                          },
                        ]
                    ).map((p) => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between text-xs bg-white/80 border border-stone-200/80 rounded-lg px-2.5 py-1.5"
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium text-stone-800">{p.displayName}</span>
                          <span className="text-stone-400 mx-1">·</span>
                          <span className="text-stone-500 capitalize">{p.role}</span>
                        </div>
                        <span className="text-[11px] font-mono text-stone-500 shrink-0">
                          {p.activeTab}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Share Invite Code Card */}
                  <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500">Invite Code</span>
                      <span className="font-mono font-medium text-stone-900">
                        {activeEvent.inviteCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 truncate font-mono">
                      ID: {activeEvent.id}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyInviteDetails}
                      className="w-full py-1.5 px-3 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedInvite ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Invite Details Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Team Invite</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Signed-In User Account Footer */}
            <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="text-xs font-medium text-stone-900 truncate">
                  {user.displayName || 'Planner'}
                </div>
                <div className="text-[11px] text-stone-500 truncate">Verified Studio Session</div>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors shrink-0 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>

          {/* Main Workspace Viewport */}
          <main className="flex-1 p-6 lg:p-10 space-y-8 overflow-y-auto">
            {!activeEvent ? (
              /* Empty State with 1-Click Preset Seeding & AI Generator */
              <div className="bg-white border border-stone-200 rounded-xl p-8 lg:p-12 space-y-8">
                <div className="max-w-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span>Workspace Ready</span>
                    <span aria-hidden="true">·</span>
                    <span>Select an Event Archetype</span>
                  </div>
                  <h1 className="font-display text-3xl text-stone-900">
                    Initialize Your First Celebration Workspace
                  </h1>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Start with a custom AI-generated celebration blueprint tailored to your venue,
                    headcount, and budget—or load a complete curated template below to explore
                    budgets, timelines, vendor checklists, and real-time collaboration immediately.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Custom Plan with Gemini AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(true)}
                    className="px-5 py-2.5 text-xs font-medium bg-stone-100 text-stone-800 rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Join Teammate Workspace by ID</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-stone-200">
                  {(['wedding', 'birthday', 'community'] as EventCategory[]).map((cat) => {
                    const preset = CURATED_PRESETS[cat];
                    return (
                      <div
                        key={cat}
                        className="border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between bg-[#FAF8F5]"
                      >
                        <EditorialIllustration
                          category={cat}
                          className="h-40 border-b border-stone-200"
                        />
                        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="text-xs text-stone-500">
                              {CATEGORY_LABELS[cat]} ·{' '}
                              <span className="font-mono tabular-nums">
                                ${preset.totalBudgetLimit.toLocaleString()}
                              </span>
                            </div>
                            <h3 className="font-display text-base text-stone-900">
                              {preset.title}
                            </h3>
                            <p className="text-xs text-stone-600 line-clamp-2">
                              {preset.styleBrief}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={creatingEvent}
                            onClick={() => handleSeedPresetEvent(cat)}
                            className="w-full py-2 px-4 text-xs font-medium bg-white border border-stone-300 hover:bg-stone-100 text-stone-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {creatingEvent ? 'Initializing...' : `Load ${CATEGORY_LABELS[cat]}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Active Event Header Strip */}
                <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span>{CATEGORY_LABELS[activeEvent.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums">{activeEvent.eventDate}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{activeEvent.location}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Lead: {activeEvent.ownerName}</span>
                      </div>
                      <h1 className="font-display text-2xl sm:text-3xl text-stone-900">
                        {activeEvent.title}
                      </h1>
                      <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
                        {activeEvent.styleBrief}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('ai_collab')}
                        className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Ask Gemini Co-Pilot</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyInviteDetails}
                        className="px-3.5 py-2 text-xs font-medium bg-stone-100 text-stone-800 rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{copiedInvite ? 'Copied Invite' : 'Invite Team'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 4-Column Tabular KPI Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-stone-200">
                    <div className="space-y-1">
                      <div className="text-xs text-stone-500">Budget Committed vs Target</div>
                      <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
                        ${metrics.totalEstimated.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          / ${activeEvent.totalBudgetLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 font-mono tabular-nums">
                        {metrics.utilizationPct}% allocated · $
                        {metrics.totalActual.toLocaleString()} paid
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-stone-500">Production Timeline Cues</div>
                      <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
                        {metrics.completedTimeline} / {timelineItems.length}
                      </div>
                      <div className="text-xs text-stone-500">
                        Milestones verified on run-of-show
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-stone-500">Vendor Contracts</div>
                      <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
                        {metrics.confirmedVendors} / {vendors.length}
                      </div>
                      <div className="text-xs text-stone-500">
                        Contracted or confirmed deliverables
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-stone-500">Confirmed Guest Headcount</div>
                      <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
                        {metrics.confirmedGuestHeadcount}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          / {activeEvent.guestCountEstimate} est.
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 font-mono tabular-nums">
                        {guests.length} parties logged ({metrics.totalInvitedHeadcount} invited)
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* TAB 1: EXECUTIVE OVERVIEW + GUEST RSVP ROSTER             */}
                {/* ========================================================= */}
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      <div className="lg:col-span-5 flex">
                        <EditorialIllustration
                          category={activeEvent.category}
                          title={activeEvent.location}
                          subtitle={`${activeEvent.guestCountEstimate} Guests · Invite Code: ${activeEvent.inviteCode}`}
                          className="w-full rounded-xl min-h-[260px] border border-stone-800"
                        />
                      </div>

                      {/* Curated Ideas Board Preview */}
                      <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="font-display text-lg text-stone-900">
                              Curated Celebration Concepts &amp; Personalized Ideas
                            </h2>
                            <p className="text-xs text-stone-500">
                              Endorsed by team members and guests · Generate more in AI Studio
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('ai_collab')}
                            className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Generate Ideas with AI
                          </button>
                        </div>

                        {ideas.length === 0 ? (
                          <div className="py-8 text-center text-xs text-stone-500">
                            No concept cards saved yet. Use the AI Studio to generate personalized
                            ideas for {activeEvent.title}.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {ideas.slice(0, 4).map((idea) => (
                              <div
                                key={idea.id}
                                className="p-4 rounded-lg bg-[#FAF8F5] border border-stone-200/90 flex flex-col justify-between gap-3"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                                    <span className="capitalize">
                                      {idea.pillar.replace(/_/g, ' ')}
                                    </span>
                                    <span className="font-mono tabular-nums">
                                      {idea.estimatedCostImpact}
                                    </span>
                                  </div>
                                  <h3 className="text-sm font-semibold text-stone-900">
                                    {idea.title}
                                  </h3>
                                  <p className="text-xs text-stone-600 leading-relaxed">
                                    {idea.description}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-stone-200/70">
                                  <span className="text-[11px] text-stone-500">
                                    By {idea.authorName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpvoteIdea(idea)}
                                    className="px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-stone-300 rounded-md hover:bg-stone-100 transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <ThumbsUp className="w-3 h-3" />
                                    <span>{idea.votesCount}</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Guest RSVP & Seating Roster */}
                    <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h2 className="font-display text-xl text-stone-900">
                            Guest RSVP &amp; Seating Roster
                          </h2>
                          <p className="text-xs text-stone-500">
                            Click any guest’s status button to cycle between Invited, Confirmed, and
                            Declined in real time.
                          </p>
                        </div>
                        <div className="text-xs font-mono tabular-nums text-stone-600">
                          {metrics.confirmedGuestHeadcount} Confirmed Attendees across{' '}
                          {guests.length} Parties
                        </div>
                      </div>

                      {/* Add Guest Form */}
                      <form
                        onSubmit={handleAddGuest}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#FAF8F5] p-4 rounded-lg border border-stone-200"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Guest or party name (e.g. Clara & Henri Vance)"
                          value={guestForm.guestName}
                          onChange={(e) =>
                            setGuestForm({ ...guestForm, guestName: e.target.value })
                          }
                          className="sm:col-span-4 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={guestForm.partySize}
                          onChange={(e) =>
                            setGuestForm({ ...guestForm, partySize: Number(e.target.value) })
                          }
                          className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                          placeholder="Party size"
                        />
                        <input
                          type="text"
                          placeholder="Table / Seating group"
                          value={guestForm.tableGroup}
                          onChange={(e) =>
                            setGuestForm({ ...guestForm, tableGroup: e.target.value })
                          }
                          className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <input
                          type="text"
                          placeholder="Dietary or menu notes"
                          value={guestForm.dietaryNotes}
                          onChange={(e) =>
                            setGuestForm({ ...guestForm, dietaryNotes: e.target.value })
                          }
                          className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <button
                          type="submit"
                          className="sm:col-span-2 py-2 px-4 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Add Party
                        </button>
                      </form>

                      {/* Guest Table */}
                      {guests.length === 0 ? (
                        <div className="py-8 text-center text-xs text-stone-500">
                          No guest parties logged yet. Add your first party above.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                                <th className="py-2.5 pr-4">Guest / Party Name</th>
                                <th className="py-2.5 px-4 text-right">Party Size</th>
                                <th className="py-2.5 px-4">Seating Assignment</th>
                                <th className="py-2.5 px-4">Dietary &amp; Menu Notes</th>
                                <th className="py-2.5 px-4">RSVP Status</th>
                                <th className="py-2.5 pl-4 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200/70 text-xs">
                              {guests.map((g) => (
                                <tr key={g.id} className="hover:bg-stone-50/80 transition-colors">
                                  <td className="py-3 pr-4 font-medium text-stone-900">
                                    {g.guestName}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-800">
                                    {g.partySize}
                                  </td>
                                  <td className="py-3 px-4 text-stone-600">
                                    {g.tableGroup || 'Unassigned'}
                                  </td>
                                  <td className="py-3 px-4 text-stone-600">
                                    {g.dietaryNotes || 'Standard menu'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <button
                                      type="button"
                                      onClick={() => handleCycleGuestRsvp(g)}
                                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                        g.rsvpStatus === 'confirmed'
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                          : g.rsvpStatus === 'declined'
                                          ? 'bg-red-50 border-red-200 text-red-900'
                                          : 'bg-amber-50 border-amber-200 text-amber-900'
                                      }`}
                                    >
                                      {g.rsvpStatus === 'confirmed'
                                        ? 'Confirmed'
                                        : g.rsvpStatus === 'declined'
                                        ? 'Declined'
                                        : 'Invited · Pending'}
                                    </button>
                                  </td>
                                  <td className="py-3 pl-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubItem('guests', g.id)}
                                      className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                                      title="Remove guest entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 2: ITEMIZED BUDGET LEDGER & AI AUDIT                  */}
                {/* ========================================================= */}
                {activeTab === 'budget' && (
                  <div className="space-y-6">
                    <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h2 className="font-display text-xl text-stone-900">
                            Celebration Budget Ledger
                          </h2>
                          <p className="text-xs text-stone-500">
                            Track estimated allocations against actual vendor commitments · Click
                            any payment status button to advance state.
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={aiAuditingBudget}
                          onClick={handleRunBudgetAudit}
                          className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {aiAuditingBudget
                              ? 'Auditing Ledger...'
                              : 'Run Gemini Financial Audit'}
                          </span>
                        </button>
                      </div>

                      {/* AI Budget Audit Result Panel */}
                      {aiBudgetAudit && (
                        <div className="bg-[#FAF8F5] border border-stone-300 rounded-xl p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-stone-900">
                              Gemini Financial Controller Synthesis
                            </div>
                            <span className="font-mono tabular-nums text-xs text-emerald-800">
                              Potential Optimization: $
                              {aiBudgetAudit.recommendedSavingsUSD.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-stone-700 leading-relaxed">
                            {aiBudgetAudit.executiveSummary}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {aiBudgetAudit.recommendations.map((rec, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-stone-200 rounded-lg p-3.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-[11px] text-stone-500">
                                  <span className="capitalize">{rec.suggestedCategory}</span>
                                  <span className="font-mono tabular-nums text-stone-800">
                                    {rec.deltaAmount >= 0 ? '+' : ''}$
                                    {rec.deltaAmount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-stone-900">
                                  {rec.headline}
                                </div>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                  {rec.rationale}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive Category Filter Bar */}
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg w-fit">
                        <button
                          type="button"
                          onClick={() => setBudgetFilter('all')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            budgetFilter === 'all'
                              ? 'bg-white text-stone-900 shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          All Categories
                        </button>
                        {BUDGET_CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setBudgetFilter(cat.value)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              budgetFilter === cat.value
                                ? 'bg-white text-stone-900 shadow-2xs'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Add Budget Item Form */}
                      <form
                        onSubmit={handleAddBudgetItem}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#FAF8F5] p-4 rounded-lg border border-stone-200"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Budget line item title"
                          value={budgetForm.title}
                          onChange={(e) => setBudgetForm({ ...budgetForm, title: e.target.value })}
                          className="sm:col-span-3 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <select
                          value={budgetForm.category}
                          onChange={(e) =>
                            setBudgetForm({
                              ...budgetForm,
                              category: e.target.value as BudgetCategory,
                            })
                          }
                          className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        >
                          {BUDGET_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          placeholder="Estimated ($)"
                          value={budgetForm.estimatedAmount}
                          onChange={(e) =>
                            setBudgetForm({
                              ...budgetForm,
                              estimatedAmount: Number(e.target.value),
                            })
                          }
                          className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Actual Paid ($)"
                          value={budgetForm.actualAmount}
                          onChange={(e) =>
                            setBudgetForm({
                              ...budgetForm,
                              actualAmount: Number(e.target.value),
                            })
                          }
                          className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <input
                          type="text"
                          placeholder="Quote / payment notes"
                          value={budgetForm.notes}
                          onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                          className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                        />
                        <button
                          type="submit"
                          className="sm:col-span-1 py-2 px-3 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Add
                        </button>
                      </form>

                      {/* High-Density Tabular Ledger */}
                      {filteredBudgetItems.length === 0 ? (
                        <div className="py-10 text-center text-xs text-stone-500">
                          No budget items in this view. Add a line item above.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                                <th className="py-2.5 pr-4">Line Item</th>
                                <th className="py-2.5 px-4">Category</th>
                                <th className="py-2.5 px-4 text-right">Estimated (USD)</th>
                                <th className="py-2.5 px-4 text-right">Committed / Paid (USD)</th>
                                <th className="py-2.5 px-4">Payment State</th>
                                <th className="py-2.5 px-4">Notes</th>
                                <th className="py-2.5 pl-4 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200/70 text-xs">
                              {filteredBudgetItems.map((item) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-stone-50/80 transition-colors"
                                >
                                  <td className="py-3 pr-4 font-medium text-stone-900">
                                    {item.title}
                                  </td>
                                  <td className="py-3 px-4 text-stone-600 capitalize">
                                    {item.category}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900">
                                    ${item.estimatedAmount.toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">
                                    ${item.actualAmount.toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4">
                                    <button
                                      type="button"
                                      onClick={() => handleCyclePaymentStatus(item)}
                                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                        item.paymentStatus === 'paid_in_full'
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                          : item.paymentStatus === 'deposit_paid'
                                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                                          : 'bg-stone-100 border-stone-200 text-stone-700'
                                      }`}
                                    >
                                      {item.paymentStatus === 'paid_in_full'
                                        ? 'Paid in Full'
                                        : item.paymentStatus === 'deposit_paid'
                                        ? 'Deposit Paid'
                                        : 'Planned'}
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                                    {item.notes || '—'}
                                  </td>
                                  <td className="py-3 pl-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubItem('budgetItems', item.id)}
                                      className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                                      title="Delete budget line"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 3: CHRONOLOGICAL RUN-OF-SHOW TIMELINE                 */}
                {/* ========================================================= */}
                {activeTab === 'timeline' && (
                  <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl text-stone-900">
                          Chronological Run-of-Show &amp; Production Timeline
                        </h2>
                        <p className="text-xs text-stone-500">
                          Synchronized across all coordinators and vendors · Click any status button
                          to advance from Upcoming to In Progress or Completed.
                        </p>
                      </div>
                    </div>

                    {/* Phase Filter Controls */}
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg w-fit">
                      <button
                        type="button"
                        onClick={() => setTimelineFilter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          timelineFilter === 'all'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        All Phases
                      </button>
                      {TIMELINE_PHASES.map((ph) => (
                        <button
                          key={ph.value}
                          type="button"
                          onClick={() => setTimelineFilter(ph.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            timelineFilter === ph.value
                              ? 'bg-white text-stone-900 shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {ph.label}
                        </button>
                      ))}
                    </div>

                    {/* Add Timeline Cue Form */}
                    <form
                      onSubmit={handleAddTimelineItem}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#FAF8F5] p-4 rounded-lg border border-stone-200"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Time (e.g. 17:30)"
                        value={timelineForm.timeSlot}
                        onChange={(e) =>
                          setTimelineForm({ ...timelineForm, timeSlot: e.target.value })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Production cue or milestone title"
                        value={timelineForm.title}
                        onChange={(e) =>
                          setTimelineForm({ ...timelineForm, title: e.target.value })
                        }
                        className="sm:col-span-3 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <select
                        value={timelineForm.phase}
                        onChange={(e) =>
                          setTimelineForm({
                            ...timelineForm,
                            phase: e.target.value as TimelinePhase,
                          })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      >
                        {TIMELINE_PHASES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Lead person / vendor"
                        value={timelineForm.leadPerson}
                        onChange={(e) =>
                          setTimelineForm({ ...timelineForm, leadPerson: e.target.value })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <input
                        type="text"
                        placeholder="Acoustic / lighting / staging notes"
                        value={timelineForm.notes}
                        onChange={(e) =>
                          setTimelineForm({ ...timelineForm, notes: e.target.value })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-1 py-2 px-3 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Add Cue
                      </button>
                    </form>

                    {/* Timeline Rows */}
                    {filteredTimelineItems.length === 0 ? (
                      <div className="py-10 text-center text-xs text-stone-500">
                        No timeline cues in this phase. Add a milestone above.
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-200 border-t border-stone-200">
                        {filteredTimelineItems.map((cue) => (
                          <div
                            key={cue.id}
                            className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/70 px-2 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              <div className="font-mono tabular-nums text-sm font-semibold text-stone-900 w-20 shrink-0 pt-0.5">
                                {cue.timeSlot}
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-stone-900">
                                    {cue.title}
                                  </span>
                                  <span className="text-xs text-stone-400">·</span>
                                  <span className="text-xs text-stone-500 capitalize">
                                    {cue.phase.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-xs text-stone-400">·</span>
                                  <span className="text-xs text-stone-600">
                                    Lead: {cue.leadPerson}
                                  </span>
                                </div>
                                {cue.notes && (
                                  <p className="text-xs text-stone-600 leading-relaxed">
                                    {cue.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCycleTimelineStatus(cue)}
                                className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  cue.status === 'completed'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                    : cue.status === 'in_progress'
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-stone-100 border-stone-200 text-stone-700'
                                }`}
                              >
                                {cue.status === 'completed'
                                  ? 'Completed'
                                  : cue.status === 'in_progress'
                                  ? 'In Progress'
                                  : 'Upcoming'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubItem('timelineItems', cue.id)}
                                className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                                title="Delete cue"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 4: VENDOR CHECKLIST & DELIVERABLES                    */}
                {/* ========================================================= */}
                {activeTab === 'vendors' && (
                  <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl text-stone-900">
                          Vendor Checklist &amp; Contract Tracker
                        </h2>
                        <p className="text-xs text-stone-500">
                          Manage studio quotes, load-in windows, and contract states · Click any
                          contract stage button to advance status.
                        </p>
                      </div>
                      <input
                        type="search"
                        placeholder="Search vendors or deliverables..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className="px-3.5 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 w-full sm:w-64"
                      />
                    </div>

                    {/* Add Vendor Form */}
                    <form
                      onSubmit={handleAddVendor}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#FAF8F5] p-4 rounded-lg border border-stone-200"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Studio or vendor name"
                        value={vendorForm.vendorName}
                        onChange={(e) =>
                          setVendorForm({ ...vendorForm, vendorName: e.target.value })
                        }
                        className="sm:col-span-3 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <select
                        value={vendorForm.serviceType}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            serviceType: e.target.value as VendorServiceType,
                          })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      >
                        {VENDOR_SERVICES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        placeholder="Quote ($)"
                        value={vendorForm.quotedPrice}
                        onChange={(e) =>
                          setVendorForm({ ...vendorForm, quotedPrice: Number(e.target.value) })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <input
                        type="text"
                        placeholder="Point of contact name"
                        value={vendorForm.contactPerson}
                        onChange={(e) =>
                          setVendorForm({ ...vendorForm, contactPerson: e.target.value })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <input
                        type="text"
                        placeholder="Arrival window & deliverables"
                        value={vendorForm.deliverableNotes}
                        onChange={(e) =>
                          setVendorForm({ ...vendorForm, deliverableNotes: e.target.value })
                        }
                        className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-1 py-2 px-3 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Add
                      </button>
                    </form>

                    {/* Vendor Table */}
                    {filteredVendors.length === 0 ? (
                      <div className="py-10 text-center text-xs text-stone-500">
                        No vendors match this filter. Add a vendor above.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                              <th className="py-2.5 pr-4">Vendor / Studio</th>
                              <th className="py-2.5 px-4">Discipline</th>
                              <th className="py-2.5 px-4">Lead Contact</th>
                              <th className="py-2.5 px-4 text-right">Quoted Price</th>
                              <th className="py-2.5 px-4">Contract Stage</th>
                              <th className="py-2.5 px-4">Deliverable &amp; Load-In Notes</th>
                              <th className="py-2.5 pl-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200/70 text-xs">
                            {filteredVendors.map((v) => (
                              <tr key={v.id} className="hover:bg-stone-50/80 transition-colors">
                                <td className="py-3 pr-4 font-medium text-stone-900">
                                  {v.vendorName}
                                </td>
                                <td className="py-3 px-4 text-stone-600 capitalize">
                                  {v.serviceType.replace(/_/g, ' ')}
                                </td>
                                <td className="py-3 px-4 text-stone-600">
                                  {v.contactPerson || '—'}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-900">
                                  ${v.quotedPrice.toLocaleString()}
                                </td>
                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() => handleCycleVendorStatus(v)}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer capitalize ${
                                      v.contractStatus === 'confirmed'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                        : v.contractStatus === 'contracted'
                                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                                        : 'bg-stone-100 border-stone-200 text-stone-700'
                                    }`}
                                  >
                                    {v.contractStatus}
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-stone-600 max-w-xs">
                                  {v.deliverableNotes || '—'}
                                </td>
                                <td className="py-3 pl-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubItem('vendors', v.id)}
                                    className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                                    title="Delete vendor"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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

                {/* ========================================================= */}
                {/* TAB 5: GENAI STUDIO CO-PILOT & REAL-TIME TEAM COLLAB      */}
                {/* ========================================================= */}
                {activeTab === 'ai_collab' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left 7 Columns: Gemini Creative & Production Co-Pilot */}
                    <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>Gemini 3.8 Flash Planning Assistant</span>
                          <span aria-hidden="true">·</span>
                          <span>Context-Grounded Ideation</span>
                        </div>
                        <h2 className="font-display text-xl text-stone-900">
                          Personalized Concept, Timeline &amp; Vendor Generator
                        </h2>
                        <p className="text-xs text-stone-600">
                          Describe a mood, cultural ritual, dietary experience, or logistical
                          challenge. Gemini generates tailored concepts, timeline cues, and vendor
                          profiles you can add directly to your live workspace.
                        </p>
                      </div>

                      <form onSubmit={handleRunAiIdeation} className="space-y-3">
                        <textarea
                          rows={3}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Ask for personalized tablescape concepts, rain-plan choreography, zero-waste floral ideas, or acoustic transitions..."
                          className="w-full p-3.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 leading-relaxed"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              'Candlelit zero-waste botanical tablescape',
                              'Interactive late-night culinary station',
                              'Rain-contingency courtyard lighting & flow',
                            ].map((presetPrompt) => (
                              <button
                                key={presetPrompt}
                                type="button"
                                onClick={() => setAiPrompt(presetPrompt)}
                                className="px-2.5 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {presetPrompt}
                              </button>
                            ))}
                          </div>
                          <button
                            type="submit"
                            disabled={aiGenerating}
                            className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {aiGenerating ? 'Curating with Gemini...' : 'Generate Proposals'}
                            </span>
                          </button>
                        </div>
                      </form>

                      {aiAdvisorResponse && (
                        <div className="space-y-6 pt-4 border-t border-stone-200">
                          <div className="p-4 rounded-lg bg-[#FAF8F5] border border-stone-200 text-xs text-stone-800 leading-relaxed">
                            <span className="font-semibold text-stone-900 block mb-1">
                              Director’s Note
                            </span>
                            {aiAdvisorResponse.advisorNote}
                          </div>

                          {/* Generated Ideas */}
                          <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-stone-700">
                              Personalized Concept Proposals (Click to Commit to Event Board)
                            </h3>
                            <div className="space-y-2.5">
                              {aiAdvisorResponse.ideas.map((idea, i) => (
                                <div
                                  key={i}
                                  className="p-4 border border-stone-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                  <div className="space-y-1">
                                    <div className="text-[11px] text-stone-500">
                                      <span className="capitalize">
                                        {idea.pillar.replace(/_/g, ' ')}
                                      </span>{' '}
                                      ·{' '}
                                      <span className="font-mono tabular-nums">
                                        {idea.estimatedCostImpact}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-stone-900">
                                      {idea.title}
                                    </div>
                                    <p className="text-xs text-stone-600">{idea.description}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAiIdeaToBoard(idea)}
                                    className="px-3 py-1.5 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Save to Board
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Suggested Timeline Cues */}
                          <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-stone-700">
                              Recommended Run-of-Show Cues
                            </h3>
                            <div className="space-y-2">
                              {aiAdvisorResponse.suggestedTimelineCues.map((cue, i) => (
                                <div
                                  key={i}
                                  className="p-3.5 border border-stone-200 rounded-lg flex items-center justify-between gap-4"
                                >
                                  <div className="text-xs space-y-0.5">
                                    <div className="font-medium text-stone-900">
                                      <span className="font-mono tabular-nums mr-2">
                                        {cue.timeSlot}
                                      </span>
                                      {cue.title}
                                    </div>
                                    <div className="text-stone-500">
                                      Lead: {cue.leadPerson} · {cue.notes}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAiCueToTimeline(cue)}
                                    className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    + Add to Timeline
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Suggested Vendors */}
                          <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-stone-700">
                              Recommended Vendor Profiles
                            </h3>
                            <div className="space-y-2">
                              {aiAdvisorResponse.suggestedVendors.map((v, i) => (
                                <div
                                  key={i}
                                  className="p-3.5 border border-stone-200 rounded-lg flex items-center justify-between gap-4"
                                >
                                  <div className="text-xs space-y-0.5">
                                    <div className="font-medium text-stone-900">
                                      {v.vendorName} ·{' '}
                                      <span className="font-mono tabular-nums">
                                        ${v.quotedPrice.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="text-stone-500">{v.deliverableNotes}</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAiVendorToChecklist(v)}
                                    className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    + Shortlist Vendor
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right 5 Columns: Real-Time Team & Guest Collaboration Feed */}
                    <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-6 space-y-6">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-stone-500">
                          <span>Real-Time Team &amp; Guest Stream</span>
                          <span className="font-mono tabular-nums">
                            {collabNotes.length} notes
                          </span>
                        </div>
                        <h2 className="font-display text-xl text-stone-900">
                          Production Decision Log &amp; Chat
                        </h2>
                        <p className="text-xs text-stone-600">
                          Coordinate with co-planners, family members, and vendors in real time.
                        </p>
                      </div>

                      {/* Live WebSocket Activity Pulses */}
                      {activityPulses.length > 0 && (
                        <div className="bg-[#FAF8F5] border border-stone-200 rounded-lg p-3 space-y-1.5">
                          <div className="text-[11px] font-semibold text-stone-600">
                            Recent Live Workspace Activity
                          </div>
                          {activityPulses.slice(0, 3).map((p) => (
                            <div key={p.id} className="text-[11px] text-stone-600 truncate">
                              <span className="font-medium text-stone-900">{p.actorName}</span>{' '}
                              {p.summary}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Post Collaboration Note Form */}
                      <form onSubmit={handlePostCollabNote} className="space-y-2.5">
                        <div className="flex gap-2">
                          <select
                            value={noteTopic}
                            onChange={(e) => setNoteTopic(e.target.value as CollabTopicTag)}
                            className="px-2.5 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                          >
                            <option value="general">Topic: General</option>
                            <option value="budget">Topic: Budget</option>
                            <option value="timeline">Topic: Run of Show</option>
                            <option value="vendors">Topic: Vendors</option>
                            <option value="rsvp">Topic: Guest RSVPs</option>
                          </select>
                          <input
                            type="text"
                            required
                            placeholder="Share an update or decision with the team..."
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Post</span>
                          </button>
                        </div>
                      </form>

                      {/* Collaboration Notes Feed */}
                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {collabNotes.length === 0 ? (
                          <div className="py-8 text-center text-xs text-stone-500">
                            No team notes yet. Post the first update above or share your Workspace
                            ID ({activeEvent.id}) with teammates.
                          </div>
                        ) : (
                          collabNotes.map((note) => (
                            <div
                              key={note.id}
                              className="p-3.5 rounded-lg bg-[#FAF8F5] border border-stone-200 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[11px] text-stone-500">
                                <div>
                                  <span className="font-semibold text-stone-900">
                                    {note.authorName}
                                  </span>
                                  <span className="mx-1.5">·</span>
                                  <span className="capitalize">{note.authorRole}</span>
                                  <span className="mx-1.5">·</span>
                                  <span className="uppercase font-mono">{note.topicTag}</span>
                                </div>
                                {(note.authorId === user.uid ||
                                  activeEvent.ownerId === user.uid) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubItem('collabNotes', note.id)}
                                    className="text-stone-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-stone-800 leading-relaxed">
                                {note.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal 1: Create New Celebration Plan (with Gemini Blueprint Option)   */}
      {/* ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-stone-900">
                Create Celebration Workspace
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Quick 1-Click Curated Presets */}
            <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-stone-200 space-y-2">
              <div className="text-xs font-medium text-stone-700">
                Or Instant-Load a Curated Production Preset:
              </div>
              <div className="flex flex-wrap gap-2">
                {(['wedding', 'birthday', 'community'] as EventCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    disabled={creatingEvent}
                    onClick={() => handleSeedPresetEvent(cat)}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded-md hover:bg-stone-100 text-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Load {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">Celebration Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="wedding">Wedding Celebration</option>
                    <option value="birthday">Milestone Birthday</option>
                    <option value="community">Community &amp; Civic Event</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700">Event Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1 space-y-1">
                  <label className="text-xs font-medium text-stone-700">Guest Estimate</label>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    value={newGuestCount}
                    onChange={(e) => setNewGuestCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-stone-700">
                    Target Total Budget (USD)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={newBudgetLimit}
                    onChange={(e) => setNewBudgetLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">Venue / City Location</label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">
                  Aesthetic &amp; Sensory Brief
                </label>
                <textarea
                  rows={3}
                  value={newStyleBrief}
                  onChange={(e) => setNewStyleBrief(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAiOnCreate}
                  onChange={(e) => setUseAiOnCreate(e.target.checked)}
                  className="rounded border-stone-300"
                />
                <span>
                  Auto-populate itemized budget, run-of-show timeline, vendor checklist, and ideas
                  using <strong>Gemini 3.8 Flash</strong>
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEvent}
                  className="px-5 py-2 text-xs font-medium text-stone-50 bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {creatingEvent ? 'Generating Workspace...' : 'Create Celebration Plan'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal 2: Join Shared Celebration Workspace                            */}
      {/* ===================================================================== */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-stone-900">
                Join Shared Celebration
              </h2>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-xs text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleJoinSharedEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">
                  Event Workspace ID (shared by host)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. evt_m8x9a_4f82k1"
                  value={joinEventIdInput}
                  onChange={(e) => setJoinEventIdInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">
                  Invite Code (optional verification)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VELA-9X2A"
                  value={joinInviteCodeInput}
                  onChange={(e) => setJoinInviteCodeInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">Your Role</label>
                <select
                  value={joinRoleInput}
                  onChange={(e) => setJoinRoleInput(e.target.value as 'planner' | 'guest')}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                >
                  <option value="planner">Co-Planner / Production Team</option>
                  <option value="guest">VIP Guest / Family Collaborator</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningEvent}
                  className="px-5 py-2 text-xs font-medium text-stone-50 bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {joiningEvent ? 'Joining...' : 'Join Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
