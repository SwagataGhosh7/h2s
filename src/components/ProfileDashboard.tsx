import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Check,
  Copy,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Calendar,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import {
  db,
  firebaseConfig,
  handleFirestoreError,
  OperationType,
  signOutUser,
  updateAuthDisplayName,
} from '../firebase';
import {
  BLUEPRINT_CONSTRAINTS,
  EventCategory,
  EventPlan,
  sanitizeString,
  UserProfile,
} from '../types';

interface ProfileDashboardProps {
  user: User;
  events: EventPlan[];
  activeEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: 'Wedding Celebration',
  birthday: 'Milestone Birthday',
  community: 'Community & Civic Event',
};

export const ProfileDashboard: React.FC<ProfileDashboardProps> = ({
  user,
  events,
  activeEventId,
  onSelectEvent,
  onOpenCreateModal,
  onOpenJoinModal,
}) => {
  const [profileDocExists, setProfileDocExists] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || 'Lead Planner');
  const [studioTitle, setStudioTitle] = useState('Principal Celebration Architect');
  const [specialty, setSpecialty] = useState<EventCategory>('wedding');
  const [locationCity, setLocationCity] = useState('San Francisco, CA');
  const [bio, setBio] = useState(
    'Designing architectural weddings, milestone suppers, and civic gatherings with warm minimalism and zero-waste hospitality.'
  );
  const [preferredCurrency, setPreferredCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Subscribe to /users/{userId} profile document in Firestore
  useEffect(() => {
    const profileRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfileDocExists(true);
          setDisplayName(data.displayName || user.displayName || 'Lead Planner');
          setStudioTitle(data.studioTitle || 'Principal Celebration Architect');
          setSpecialty(data.specialty || 'wedding');
          setLocationCity(data.locationCity || '');
          setBio(data.bio || '');
          setPreferredCurrency(data.preferredCurrency || 'USD');
        } else {
          setProfileDocExists(false);
        }
      },
      (err) => {
        // Keep local defaults if rules are not yet deployed on custom project
        console.warn('Profile read note:', err);
      }
    );

    return () => unsub();
  }, [user.uid, user.displayName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedToast(false);

    const cleanName = sanitizeString(
      displayName,
      BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX,
      'Lead Planner'
    );
    const cleanTitle = sanitizeString(
      studioTitle,
      BLUEPRINT_CONSTRAINTS.PROFILE_TITLE_MAX,
      'Celebration Architect'
    );
    const cleanCity = sanitizeString(locationCity, BLUEPRINT_CONSTRAINTS.PROFILE_CITY_MAX, '');
    const cleanBio = sanitizeString(bio, BLUEPRINT_CONSTRAINTS.PROFILE_BIO_MAX, '');

    const path = `users/${user.uid}`;
    try {
      await updateAuthDisplayName(cleanName);
      if (!profileDocExists) {
        await setDoc(doc(db, path), {
          userId: user.uid,
          displayName: cleanName,
          studioTitle: cleanTitle,
          specialty,
          locationCity: cleanCity,
          bio: cleanBio,
          preferredCurrency,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, path), {
          displayName: cleanName,
          studioTitle: cleanTitle,
          specialty,
          locationCity: cleanCity,
          bio: cleanBio,
          preferredCurrency,
          updatedAt: serverTimestamp(),
        });
      }
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err) {
      handleFirestoreError(
        err,
        profileDocExists ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    } finally {
      setSaving(false);
    }
  };

  // Portfolio-wide aggregated statistics
  const ownedEvents = events.filter((e) => e.ownerId === user.uid);
  const collabEvents = events.filter((e) => e.ownerId !== user.uid);
  const totalPortfolioBudget = events.reduce((sum, e) => sum + e.totalBudgetLimit, 0);
  const totalPortfolioGuests = events.reduce((sum, e) => sum + e.guestCountEstimate, 0);

  const initials = (displayName || user.email || 'AV')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const providerId = user.providerData?.[0]?.providerId || 'firebase';
  const createdTime = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : 'Active';
  const lastSignInTime = user.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Current session';

  return (
    <div className="space-y-8">
      {/* Top Identity Banner */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-stone-300 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-display text-xl font-semibold shrink-0">
                {initials}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span>{studioTitle}</span>
                <span aria-hidden="true">·</span>
                <span>Specialty: {CATEGORY_LABELS[specialty]}</span>
                {locationCity && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{locationCity}</span>
                  </>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl text-stone-900">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 font-mono tabular-nums">
                <span>{user.email || 'Authenticated Planner'}</span>
                <span aria-hidden="true">·</span>
                <span>Provider: {providerId}</span>
                <span aria-hidden="true">·</span>
                <span>Member since {createdTime}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Celebration</span>
            </button>
            <button
              type="button"
              onClick={onOpenJoinModal}
              className="px-3.5 py-2 text-xs font-medium bg-stone-100 text-stone-800 rounded-lg hover:bg-stone-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Join Shared Workspace
            </button>
            <button
              type="button"
              onClick={signOutUser}
              className="px-3.5 py-2 text-xs font-medium bg-white border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4-Column Executive Portfolio KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-stone-200">
          <div className="space-y-1">
            <div className="text-xs text-stone-500">Total Celebrations Managed</div>
            <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
              {events.length}
            </div>
            <div className="text-xs text-stone-500 font-mono tabular-nums">
              {ownedEvents.length} owned · {collabEvents.length} collaborating
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-stone-500">Portfolio Target Budget</div>
            <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
              ${totalPortfolioBudget.toLocaleString()}
            </div>
            <div className="text-xs text-stone-500">
              Preferred display currency: {preferredCurrency}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-stone-500">Total Estimated Guests</div>
            <div className="font-mono tabular-nums text-xl font-semibold text-stone-900">
              {totalPortfolioGuests.toLocaleString()}
            </div>
            <div className="text-xs text-stone-500">Across all active celebration plans</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-stone-500">Firebase Project &amp; Session</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-stone-900 truncate">
              {firebaseConfig.projectId}
            </div>
            <div className="text-xs text-stone-500 font-mono tabular-nums">
              Last login: {lastSignInTime}
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Editable Planner Profile + Celebration Portfolio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Studio Profile Settings Form */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-stone-900">Planner Profile &amp; Studio</h2>
              <p className="text-xs text-stone-500">
                Synced to Firebase Auth &amp; Firestore (`/users/{user.uid.slice(0, 8)}...`)
              </p>
            </div>
            <UserIcon className="w-4 h-4 text-stone-400" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">
                Studio / Producer Title
              </label>
              <input
                type="text"
                required
                value={studioTitle}
                onChange={(e) => setStudioTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 block">
                  Primary Specialty
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value as EventCategory)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                >
                  <option value="wedding">Weddings</option>
                  <option value="birthday">Milestone Birthdays</option>
                  <option value="community">Community Galas</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 block">Currency</label>
                <select
                  value={preferredCurrency}
                  onChange={(e) =>
                    setPreferredCurrency(e.target.value as 'USD' | 'EUR' | 'GBP')
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">
                Studio Base City / Region
              </label>
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g. San Francisco · Sonoma · Brooklyn"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">
                Planning Philosophy &amp; Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {savedToast ? (
                <span className="text-xs text-emerald-800 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Profile saved to Firestore</span>
                </span>
              ) : (
                <span className="text-[11px] text-stone-500 font-mono">
                  UID: {user.uid.slice(0, 14)}...
                </span>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>

          {/* Connected Firebase Configuration Summary */}
          <div className="pt-4 border-t border-stone-200 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-stone-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Firebase Authentication &amp; Analytics Active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-600 font-mono bg-[#FAF8F5] p-3 rounded-lg border border-stone-200">
              <div>Project: {firebaseConfig.projectId}</div>
              <div>Analytics: {firebaseConfig.measurementId}</div>
              <div className="col-span-2 truncate">Auth Domain: {firebaseConfig.authDomain}</div>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Celebration Portfolio Ledger */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-stone-900">
                Your Celebration Workspaces ({events.length})
              </h2>
              <p className="text-xs text-stone-500">
                Select any celebration to open its live Budget Ledger, Run of Show, and Vendor
                Checklist.
              </p>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#FAF8F5] border border-stone-200 text-center space-y-3">
              <p className="text-xs text-stone-600">
                You haven’t created or joined any celebration workspaces yet.
              </p>
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Your First Celebration</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => {
                const isOwner = ev.ownerId === user.uid;
                const isCurrent = ev.id === activeEventId;
                return (
                  <div
                    key={ev.id}
                    className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCurrent
                        ? 'bg-[#FAF8F5] border-stone-900'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                        <span className="font-semibold text-stone-800">
                          {isOwner ? 'Lead Owner' : 'Team Collaborator'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{CATEGORY_LABELS[ev.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Calendar className="w-3 h-3" />
                          {ev.eventDate}
                        </span>
                      </div>

                      <h3 className="font-display text-base text-stone-900">{ev.title}</h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          {ev.location}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {ev.guestCountEstimate} Guests
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          ${ev.totalBudgetLimit.toLocaleString()} Cap
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `Workspace ID: ${ev.id} | Invite Code: ${ev.inviteCode}`
                          );
                          setCopiedId(ev.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="px-3 py-1.5 text-xs font-mono bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        title="Copy Workspace ID & Invite Code"
                      >
                        {copiedId === ev.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{ev.inviteCode}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectEvent(ev.id)}
                        className="px-3.5 py-1.5 text-xs font-medium bg-stone-900 text-stone-50 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Open Studio</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
