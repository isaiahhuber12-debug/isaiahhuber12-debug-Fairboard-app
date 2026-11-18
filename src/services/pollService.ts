import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { getStoredGuestSession, isGuestUid } from '../lib/guestSession';
import {
  type GroupPoll,
  MemberRole,
  parsePollStatus,
  type PollBallot,
  PollStatus,
} from '../types/rally';

export const POLL_CONSTRAINTS = {
  QUESTION_MIN: 2,
  QUESTION_MAX: 240,
  DESCRIPTION_MAX: 500,
  OPTION_MIN: 1,
  OPTION_MAX: 120,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 10,
  NAME_MAX: 60,
} as const;

const GUEST_POLL_VOTES_PREFIX = 'rallyhub_guest_poll_votes_v1';

function guestPollStorageKey(userId: string, groupId: string): string {
  return `${GUEST_POLL_VOTES_PREFIX}_${userId}_${groupId}`;
}

export function readGuestPollVotes(userId: string, groupId: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(guestPollStorageKey(userId, groupId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clean: Record<string, number> = {};
    for (const [pollId, val] of Object.entries(parsed)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 0) {
        clean[pollId] = val;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function writeGuestPollVote(
  userId: string,
  groupId: string,
  pollId: string,
  optionIndex: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readGuestPollVotes(userId, groupId);
    current[pollId] = optionIndex;
    localStorage.setItem(guestPollStorageKey(userId, groupId), JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('rallyhub:guest-poll-votes-changed'));
  } catch {
    // Ignore storage quota errors
  }
}

function makePollId(): string {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 14);
  return `poll_${raw}`;
}

function tsToMs(val: unknown, fallback = Date.now()): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    const secs = Number((val as { seconds: number }).seconds);
    if (!Number.isNaN(secs)) return secs * 1000;
  }
  return fallback;
}

function requireActiveActorId(): string {
  const uid = auth.currentUser?.uid ?? getStoredGuestSession()?.uid;
  if (!uid) {
    throw new Error('Join a group or sign in first.');
  }
  return uid;
}

export function subscribeGroupPolls(
  groupId: string,
  onData: (polls: GroupPoll[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/polls`;
  const q = query(collection(db, 'groups', groupId, 'polls'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const polls: GroupPoll[] = snap.docs.map((d) => {
        const data = d.data();
        const options = Array.isArray(data.options)
          ? data.options.filter((x): x is string => typeof x === 'string')
          : [];
        const rawCounts = Array.isArray(data.optionCounts)
          ? data.optionCounts.map((n) =>
              typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
            )
          : [];
        const optionCounts = options.map((_, idx) => rawCounts[idx] ?? 0);
        const computedTotal = optionCounts.reduce((acc, c) => acc + c, 0);
        const totalVotes =
          typeof data.totalVotes === 'number' && Number.isFinite(data.totalVotes)
            ? Math.max(computedTotal, Math.round(data.totalVotes))
            : computedTotal;

        return {
          id: d.id,
          question: String(data.question ?? ''),
          description: typeof data.description === 'string' ? data.description : null,
          options,
          optionCounts,
          totalVotes,
          status: parsePollStatus(typeof data.status === 'string' ? data.status : null),
          createdBy: String(data.createdBy ?? ''),
          createdByName: String(data.createdByName ?? 'Organizer'),
          createdByRole: String(data.createdByRole ?? MemberRole.ORGANIZER),
          createdAtMs: tsToMs(data.createdAt, 0),
          updatedAtMs: tsToMs(data.updatedAt, 0),
        };
      });
      onData(polls);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeOwnPollBallots(
  groupId: string,
  pollIds: string[],
  userId: string,
  isGuest: boolean,
  onData: (votesByPollId: Record<string, number>) => void
): Unsubscribe {
  if (!groupId || !userId || pollIds.length === 0) {
    onData({});
    return () => {};
  }

  // Code-joined guest members cannot read Firestore ballot docs directly (allow get requires auth);
  // track their cast choices safely in local storage.
  if (isGuest || (!auth.currentUser && isGuestUid(userId))) {
    const syncLocal = () => {
      const stored = readGuestPollVotes(userId, groupId);
      const filtered: Record<string, number> = {};
      for (const pollId of pollIds) {
        if (pollId in stored) {
          filtered[pollId] = stored[pollId];
        }
      }
      onData(filtered);
    };
    syncLocal();
    window.addEventListener('rallyhub:guest-poll-votes-changed', syncLocal);
    window.addEventListener('storage', syncLocal);
    return () => {
      window.removeEventListener('rallyhub:guest-poll-votes-changed', syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }

  let currentMap: Record<string, number> = {};
  const emit = () => onData({ ...currentMap });

  const unsubs = pollIds.map((pollId) => {
    const path = `groups/${groupId}/polls/${pollId}/ballots/${userId}`;
    return onSnapshot(
      doc(db, 'groups', groupId, 'polls', pollId, 'ballots', userId),
      (snap) => {
        if (snap.exists()) {
          const idx = snap.data().optionIndex;
          if (typeof idx === 'number' && Number.isInteger(idx) && idx >= 0) {
            currentMap = { ...currentMap, [pollId]: idx };
          }
        } else if (pollId in currentMap) {
          const next = { ...currentMap };
          delete next[pollId];
          currentMap = next;
        }
        emit();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          // Non-fatal fallback for own ballot listener
        }
      }
    );
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}

export function subscribeAllPollBallotsForCreator(
  groupId: string,
  pollIds: string[],
  onData: (ballotsByPollId: Record<string, PollBallot[]>) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!groupId || pollIds.length === 0) {
    onData({});
    return () => {};
  }

  let currentMap: Record<string, PollBallot[]> = {};
  const emit = () => onData({ ...currentMap });

  const unsubs = pollIds.map((pollId) => {
    const path = `groups/${groupId}/polls/${pollId}/ballots`;
    const q = query(
      collection(db, 'groups', groupId, 'polls', pollId, 'ballots'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const ballots: PollBallot[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId ?? d.id),
            displayName: String(data.displayName ?? 'Member'),
            optionIndex:
              typeof data.optionIndex === 'number' && Number.isInteger(data.optionIndex)
                ? data.optionIndex
                : 0,
            createdAtMs: tsToMs(data.createdAt, 0),
          };
        });
        currentMap = { ...currentMap, [pollId]: ballots };
        emit();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (e) {
          onError(e);
        }
      }
    );
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function createGroupPoll(
  groupId: string,
  params: {
    question: string;
    description?: string | null;
    options: string[];
    authorName: string;
    authorRole: MemberRole;
  }
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Sign in with Google as an Organizer, Admin, or Creator to create polls.');
  }
  if (
    params.authorRole !== MemberRole.CREATOR &&
    params.authorRole !== MemberRole.ADMIN &&
    params.authorRole !== MemberRole.ORGANIZER
  ) {
    throw new Error('Only Creators, Admins, and Organizers can create group polls.');
  }

  const cleanQuestion = params.question.trim().slice(0, POLL_CONSTRAINTS.QUESTION_MAX);
  if (cleanQuestion.length < POLL_CONSTRAINTS.QUESTION_MIN) {
    throw new Error(
      `Poll question must be at least ${POLL_CONSTRAINTS.QUESTION_MIN} characters.`
    );
  }

  const cleanOptions = params.options
    .map((o) => o.trim().slice(0, POLL_CONSTRAINTS.OPTION_MAX))
    .filter((o) => o.length >= POLL_CONSTRAINTS.OPTION_MIN)
    .slice(0, POLL_CONSTRAINTS.MAX_OPTIONS);

  if (cleanOptions.length < POLL_CONSTRAINTS.MIN_OPTIONS) {
    throw new Error(`Please provide at least ${POLL_CONSTRAINTS.MIN_OPTIONS} poll options.`);
  }

  const cleanDesc = params.description?.trim().slice(0, POLL_CONSTRAINTS.DESCRIPTION_MAX) || null;
  const cleanAuthorName = (params.authorName.trim() || 'Organizer').slice(
    0,
    POLL_CONSTRAINTS.NAME_MAX
  );

  const pollId = makePollId();
  const path = `groups/${groupId}/polls/${pollId}`;

  try {
    const payload: Record<string, unknown> = {
      question: cleanQuestion,
      options: cleanOptions,
      optionCounts: cleanOptions.map(() => 0),
      totalVotes: 0,
      status: PollStatus.OPEN,
      createdBy: uid,
      createdByName: cleanAuthorName,
      createdByRole: params.authorRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanDesc) {
      payload.description = cleanDesc;
    }

    await setDoc(doc(db, 'groups', groupId, 'polls', pollId), payload);
    return pollId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function castPollVote(
  groupId: string,
  pollId: string,
  params: {
    userId: string;
    displayName: string;
    optionIndex: number;
    isGuest: boolean;
  }
): Promise<void> {
  const actorId = requireActiveActorId();
  const userId = params.userId || actorId;
  const optionIndex = params.optionIndex;
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= POLL_CONSTRAINTS.MAX_OPTIONS) {
    throw new Error('Invalid poll option selected.');
  }

  const isGuestActor = params.isGuest || (!auth.currentUser && isGuestUid(userId));
  if (isGuestActor) {
    const existingLocal = readGuestPollVotes(userId, groupId);
    if (pollId in existingLocal) {
      throw new Error('You have already voted in this poll.');
    }
  }

  const cleanDisplayName = (params.displayName.trim() || 'Member').slice(
    0,
    POLL_CONSTRAINTS.NAME_MAX
  );

  const pollRef = doc(db, 'groups', groupId, 'polls', pollId);
  const ballotRef = doc(db, 'groups', groupId, 'polls', pollId, 'ballots', userId);
  const ballotPath = `groups/${groupId}/polls/${pollId}/ballots/${userId}`;

  try {
    await runTransaction(db, async (tx) => {
      const pollSnap = await tx.get(pollRef);
      if (!pollSnap.exists()) {
        throw new Error('Poll not found.');
      }

      const pollData = pollSnap.data();
      if (parsePollStatus(typeof pollData.status === 'string' ? pollData.status : null) !== PollStatus.OPEN) {
        throw new Error('This poll is closed.');
      }

      const options = Array.isArray(pollData.options) ? pollData.options : [];
      if (optionIndex >= options.length) {
        throw new Error('Selected option does not exist on this poll.');
      }

      if (!isGuestActor && auth.currentUser) {
        const existingBallot = await tx.get(ballotRef);
        if (existingBallot.exists()) {
          throw new Error('You have already voted in this poll.');
        }
      }

      const currentCounts = options.map((_, idx) => {
        const raw = Array.isArray(pollData.optionCounts) ? pollData.optionCounts[idx] : 0;
        return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      });
      const currentTotal =
        typeof pollData.totalVotes === 'number' && Number.isFinite(pollData.totalVotes)
          ? Math.max(0, Math.round(pollData.totalVotes))
          : currentCounts.reduce((acc, c) => acc + c, 0);

      const nextCounts = currentCounts.map((count, idx) =>
        idx === optionIndex ? count + 1 : count
      );

      tx.set(ballotRef, {
        userId,
        displayName: cleanDisplayName,
        optionIndex,
        createdAt: serverTimestamp(),
      });

      tx.update(pollRef, {
        optionCounts: nextCounts,
        totalVotes: currentTotal + 1,
        updatedAt: serverTimestamp(),
      });
    });

    if (isGuestActor) {
      writeGuestPollVote(userId, groupId, pollId, optionIndex);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already voted') ||
        error.message.includes('poll is closed') ||
        error.message.includes('Poll not found') ||
        error.message.includes('Selected option'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, ballotPath);
  }
}

export async function setPollStatus(
  groupId: string,
  pollId: string,
  status: PollStatus
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Sign in with Google to update poll status.');
  }
  const path = `groups/${groupId}/polls/${pollId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'polls', pollId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGroupPoll(
  groupId: string,
  pollId: string,
  isCreator: boolean
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Sign in with Google to delete polls.');
  }
  const path = `groups/${groupId}/polls/${pollId}`;
  try {
    // Only Creators have list permission on ballots; regular admins/authors delete the poll doc directly.
    if (isCreator) {
      try {
        const ballotsSnap = await getDocs(
          collection(db, 'groups', groupId, 'polls', pollId, 'ballots')
        );
        if (!ballotsSnap.empty) {
          await Promise.allSettled(ballotsSnap.docs.map((d) => deleteDoc(d.ref)));
        }
      } catch {
        // Proceed with deleting parent poll document
      }
    }
    await deleteDoc(doc(db, 'groups', groupId, 'polls', pollId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
