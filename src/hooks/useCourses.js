import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import coursesGpx from '../data/courses.gpx?raw';
import { parseCoursesGpx } from '../utils/parseCoursesGpx';
import {
  fetchState,
  patchCourseHoleCount,
  patchCourseHolePars,
  patchCourseHoleStrokeIndex,
  patchCourseHoleSss,
  patchCourseRatings,
  patchProgress,
  postCustomCourse,
  putCustomCourses,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  calcCourseHandicap,
  defaultPar,
  formatCourseHandicap,
  resolveCourseRatingFields,
} from '../utils/courseHandicap';
import { handicapLabel } from '../utils/handicap';
import { normalizeHoleCount } from '../utils/holes';
import { defaultHolePars, normalizeHolePars, resolveHolePars, sumHolePars } from '../utils/holePars';
import { resolveHoleScores } from '../utils/holeScores';
import { defaultHoleSss, resolveHoleSss } from '../utils/holeSss';
import {
  defaultHoleStrokeIndex,
  normalizeHoleStrokeIndex,
  resolveHoleStrokeIndex,
} from '../utils/holeStrokeIndex';

const masterList = parseCoursesGpx(coursesGpx);

const POLL_MS = 4000;

function normalizeWebsiteInput(raw) {
  const t = raw?.trim() || '';
  if (!t) return null;
  try {
    const href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return new URL(href).href;
  } catch {
    return null;
  }
}

function mergeCourseRow(
  c,
  myProgress,
  progressByUser,
  membersByUser,
  currentUser,
  courseHoleCounts,
  courseHoleSss,
  courseHolePars,
  courseHoleStrokeIndex,
  courseRatings,
) {
  const p = myProgress[c.id];
  const o = p?.fieldOverrides;
  const legacyName = p?.customName?.trim();
  const name = o?.name ?? (legacyName || c.name);
  const city = o?.city ?? c.city;
  const address = o?.address ?? c.address;
  const type = o?.type ?? c.type;
  const holeCount =
    courseHoleCounts[c.id] ??
    (o?.holes !== undefined ? normalizeHoleCount(o.holes) : normalizeHoleCount(c.holes));
  const holes = holeCount;
  const lat = o?.lat !== undefined ? o.lat : c.lat;
  const lng = o?.lng !== undefined ? o.lng : c.lng;
  const website = o && 'website' in o ? o.website : (c.website ?? null);
  const storedRatings = courseRatings[c.id];
  const hasWhsRatings = Boolean(storedRatings?.hasWhsRatings);
  const basePar = storedRatings?.par ?? o?.par ?? c.par;
  const holePars = resolveHolePars(holeCount, courseHolePars[c.id], basePar);
  const hasStoredPars =
    Array.isArray(courseHolePars[c.id]) && courseHolePars[c.id].length === holeCount;
  const par = hasStoredPars ? sumHolePars(holePars) : (basePar ?? defaultPar(holeCount));
  const ratingFields = resolveCourseRatingFields({
    holes,
    par,
    slopeRating: storedRatings?.slopeRating ?? o?.slopeRating ?? c.slopeRating,
    courseRating: storedRatings?.courseRating ?? o?.courseRating ?? c.courseRating,
  });
  const holeSss = resolveHoleSss(holeCount, courseHoleSss[c.id], par);
  const holeStrokeIndex = resolveHoleStrokeIndex(
    holeCount,
    courseHoleStrokeIndex[c.id]
  );

  const playedBy = [];
  const playedByDetail = [];
  for (const [user, map] of Object.entries(progressByUser)) {
    if (!map?.[c.id]?.played) continue;
    const prog = map[c.id];
    const member = membersByUser[user];
    const idx = prog.handicapIndex ?? member?.handicap ?? null;
    const ch =
      prog.courseHandicap ??
      (hasWhsRatings
        ? calcCourseHandicap(
            idx,
            ratingFields.slopeRating,
            ratingFields.courseRating,
            ratingFields.par
          )
        : null);
    playedBy.push(user);
    playedByDetail.push({
      username: user,
      displayName: member?.displayName ?? user,
      handicapDisplay: handicapLabel(member?.handicap, member?.handicapDisplay),
      courseHandicap: ch,
      courseHandicapDisplay: formatCourseHandicap(ch),
      holeScores: resolveHoleScores(holeCount, prog.holeScores),
    });
  }
  playedBy.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  playedByDetail.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  );

  const me = currentUser ? membersByUser[currentUser] : null;
  const myIdx = p?.handicapIndex ?? me?.handicap ?? null;
  const myCourseHandicap = p?.played
    ? (p.courseHandicap ??
      (hasWhsRatings
        ? calcCourseHandicap(
            myIdx,
            ratingFields.slopeRating,
            ratingFields.courseRating,
            ratingFields.par
          )
        : null))
    : null;

  const myHoleScores = resolveHoleScores(holeCount, p?.holeScores);
  const playerScoresByUser = {};
  for (const [user, map] of Object.entries(progressByUser)) {
    if (!map?.[c.id]?.played) continue;
    playerScoresByUser[user] = resolveHoleScores(holeCount, map[c.id].holeScores);
  }

  return {
    ...c,
    sourceFields: {
      name: c.name,
      city: c.city,
      address: c.address,
      type: c.type,
      holes: c.holes,
      lat: c.lat,
      lng: c.lng,
      website: c.website ?? null,
    },
    isUserCourse: c.id.startsWith('user-'),
    hasSourceEdits: Boolean(legacyName || (o && Object.keys(o).length > 0)),
    originalName: c.name,
    name,
    city,
    address,
    type,
    holes,
    holeCount,
    holePars,
    holeSss,
    holeStrokeIndex,
    myHoleScores,
    playerScoresByUser,
    lat,
    lng,
    website,
    par: ratingFields.par,
    slopeRating: hasWhsRatings ? ratingFields.slopeRating : null,
    courseRating: hasWhsRatings ? ratingFields.courseRating : null,
    hasWhsRatings,
    played: p?.played ?? false,
    playedAt: p?.playedAt ?? null,
    handicapAtPlay: p?.handicapIndex ?? null,
    handicapAtPlayDisplay: handicapLabel(p?.handicapIndex, null),
    myCourseHandicap,
    myCourseHandicapDisplay: formatCourseHandicap(myCourseHandicap),
    playedBy,
    playedByDetail,
  };
}

export function useCourses() {
  const { user, canUseApp, setUsers: setRosterUsers } = useAuth();
  const currentUser = user?.username ?? null;
  const [progressByUser, setProgressByUser] = useState({});
  const [customCourses, setCustomCourses] = useState([]);
  const [courseHoleCounts, setCourseHoleCounts] = useState({});
  const [courseHoleSss, setCourseHoleSss] = useState({});
  const [courseHolePars, setCourseHolePars] = useState({});
  const [courseHoleStrokeIndex, setCourseHoleStrokeIndex] = useState({});
  const [courseRatings, setCourseRatings] = useState({});
  const [handicapByUser, setHandicapByUser] = useState({});
  const [apiUsers, setApiUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const progressByUserRef = useRef(progressByUser);
  progressByUserRef.current = progressByUser;

  const refresh = useCallback(async () => {
    try {
      const data = await fetchState();
      setProgressByUser(data.progressByUser || {});
      setCustomCourses(data.customCourses || []);
      setCourseHoleCounts(data.courseHoleCounts || {});
      setCourseHoleSss((prev) => ({ ...prev, ...(data.courseHoleSss || {}) }));
      setCourseHolePars((prev) => ({ ...prev, ...(data.courseHolePars || {}) }));
      setCourseHoleStrokeIndex((prev) => ({
        ...prev,
        ...(data.courseHoleStrokeIndex || {}),
      }));
      setCourseRatings(data.courseRatings || {});
      setHandicapByUser(data.handicapByUser || {});
      const usernames = data.users || [];
      setApiUsers(usernames);
      setRosterUsers(usernames);
      const roster =
        data.members?.length > 0
          ? data.members
          : usernames.map((username) => ({
              username,
              displayName: username,
              handicap: null,
              handicapDisplay: null,
            }));
      setMembers(roster);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setRosterUsers]);

  useEffect(() => {
    if (!canUseApp) return undefined;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh, canUseApp]);

  const myProgress = progressByUser[currentUser] || {};

  const membersByUser = useMemo(() => {
    const map = {};
    for (const m of members) map[m.username] = m;
    return map;
  }, [members]);

  const courses = useMemo(() => {
    const fromGpx = masterList.map((c) =>
      mergeCourseRow(
        c,
        myProgress,
        progressByUser,
        membersByUser,
        currentUser,
        courseHoleCounts,
        courseHoleSss,
        courseHolePars,
        courseHoleStrokeIndex,
        courseRatings,
      )
    );
    const fromUser = customCourses.map((c) =>
      mergeCourseRow(
        c,
        myProgress,
        progressByUser,
        membersByUser,
        currentUser,
        courseHoleCounts,
        courseHoleSss,
        courseHolePars,
        courseHoleStrokeIndex,
        courseRatings,
      )
    );
    const merged = [...fromGpx, ...fromUser];
    merged.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    return merged;
  }, [myProgress, progressByUser, customCourses, courseHoleCounts, courseHoleSss, courseHolePars, courseHoleStrokeIndex, courseRatings, membersByUser, currentUser]);

  const progressWithHandicap = useCallback(
    (cur, played, rating, idx) => {
      const entry = {
        played: played ?? cur.played ?? false,
        playedAt: cur.playedAt ?? null,
        fieldOverrides: cur.fieldOverrides,
        customName: cur.customName,
        handicapIndex: cur.handicapIndex ?? null,
        courseHandicap: cur.courseHandicap ?? null,
        holeScores: cur.holeScores,
      };
      if (
        entry.played &&
        idx != null &&
        Number.isFinite(Number(rating?.slopeRating)) &&
        Number.isFinite(Number(rating?.courseRating))
      ) {
        entry.handicapIndex = idx;
        entry.courseHandicap = calcCourseHandicap(
          idx,
          rating.slopeRating,
          rating.courseRating,
          rating.par
        );
      }
      return entry;
    },
    []
  );

  const applyProgressPatch = useCallback(
    async (courseId, entryOrBuilder, options = {}) => {
      const { silent = false } = options;
      if (!currentUser) return;
      if (!silent) setSyncing(true);

      // Build the payload outside setState — React may defer updaters, and the
      // API call must not send an undefined entry.
      const existing =
        progressByUserRef.current[currentUser]?.[courseId] || {};
      const entry =
        typeof entryOrBuilder === 'function'
          ? entryOrBuilder(existing)
          : entryOrBuilder;
      const payload = {
        played: Boolean(entry?.played),
        playedAt: entry?.playedAt ?? null,
        fieldOverrides: entry?.fieldOverrides ?? null,
        customName: entry?.customName ?? null,
        handicapIndex: entry?.handicapIndex ?? null,
        courseHandicap: entry?.courseHandicap ?? null,
        holeScores: Array.isArray(entry?.holeScores) ? entry.holeScores : null,
      };

      setProgressByUser((prev) => {
        const userMap = { ...(prev[currentUser] || {}) };
        if (
          !payload.played &&
          !payload.fieldOverrides &&
          !payload.customName &&
          payload.handicapIndex == null &&
          payload.courseHandicap == null &&
          !payload.holeScores
        ) {
          delete userMap[courseId];
        } else {
          userMap[courseId] = { ...(userMap[courseId] || {}), ...payload };
        }
        return { ...prev, [currentUser]: userMap };
      });
      try {
        await patchProgress(courseId, payload);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await refresh();
        throw e;
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [currentUser, refresh]
  );

  const setPlayed = useCallback(
    (id, played) => {
      const course = courses.find((c) => c.id === id);
      const rating = course?.hasWhsRatings ? resolveCourseRatingFields(course) : null;
      const idx = user?.handicap ?? null;
      const entry = {
        played,
        playedAt: played ? new Date().toISOString() : null,
        handicapIndex: null,
        courseHandicap: null,
      };
      if (played && idx != null && rating) {
        entry.handicapIndex = idx;
        entry.courseHandicap = calcCourseHandicap(
          idx,
          rating.slopeRating,
          rating.courseRating,
          rating.par
        );
      }
      applyProgressPatch(id, entry);
    },
    [applyProgressPatch, courses, user]
  );

  const savePlayerHoleScores = useCallback(
    async (courseId, holeScores) => {
      if (!currentUser) return;
      const normalized = holeScores.map((value) => {
        if (value == null || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? Math.round(n) : null;
      });
      const course = courses.find((c) => c.id === courseId);
      const rating = course?.hasWhsRatings
        ? resolveCourseRatingFields(course)
        : null;
      const idx = user?.handicap ?? null;
      await applyProgressPatch(
        courseId,
        (existing) => {
          const entry = {
            ...existing,
            played: true,
            playedAt: existing?.playedAt || new Date().toISOString(),
            holeScores: normalized,
          };
          if (entry.courseHandicap == null && idx != null && rating) {
            entry.handicapIndex = existing?.handicapIndex ?? idx;
            entry.courseHandicap = calcCourseHandicap(
              entry.handicapIndex,
              rating.slopeRating,
              rating.courseRating,
              rating.par
            );
          }
          return entry;
        },
        { silent: true }
      );
      await refresh();
    },
    [applyProgressPatch, courses, currentUser, refresh, user]
  );

  const persistCourseHoleCount = useCallback(async (courseId, holeCount) => {
    const normalized = normalizeHoleCount(holeCount);
    await patchCourseHoleCount(courseId, normalized);
    setCourseHoleCounts((prev) => ({ ...prev, [courseId]: normalized }));
  }, []);

  const persistCourseHolePars = useCallback(async (courseId, holeCount, holePars) => {
    const count = normalizeHoleCount(holeCount);
    await patchCourseHolePars(courseId, count, holePars);
    setCourseHolePars((prev) => ({ ...prev, [courseId]: holePars }));
  }, []);

  const saveCourseHoleSss = useCallback(async (courseId, holeCount, holeSss) => {
    const normalizedCount = normalizeHoleCount(holeCount);
    await patchCourseHoleSss(courseId, normalizedCount, holeSss);
    setCourseHoleSss((prev) => ({ ...prev, [courseId]: holeSss }));
  }, []);

  const persistCourseHoleStrokeIndex = useCallback(
    async (courseId, holeCount, holeStrokeIndex) => {
      const count = normalizeHoleCount(holeCount);
      await patchCourseHoleStrokeIndex(courseId, count, holeStrokeIndex);
      setCourseHoleStrokeIndex((prev) => ({ ...prev, [courseId]: holeStrokeIndex }));
    },
    []
  );

  const persistCourseRatings = useCallback(async (courseId, holeCount, fields) => {
    const count = normalizeHoleCount(holeCount);
    await patchCourseRatings(courseId, {
      holeCount: count,
      par: fields.par ?? null,
      courseRating: fields.courseRating ?? null,
      slopeRating: fields.slopeRating ?? null,
    });
    setCourseRatings((prev) => {
      const prevRow = prev[courseId] || {};
      const courseRating = fields.courseRating ?? prevRow.courseRating ?? null;
      const slopeRating = fields.slopeRating ?? prevRow.slopeRating ?? null;
      return {
        ...prev,
        [courseId]: {
          holeCount: count,
          par: fields.par ?? prevRow.par ?? null,
          courseRating,
          slopeRating,
          hasWhsRatings: courseRating != null && slopeRating != null,
        },
      };
    });
  }, []);

  const saveCourseHoleStrokeIndex = useCallback(
    async (courseId, holeCount, holeStrokeIndex, options = {}) => {
      const { silent = false } = options;
      const count = normalizeHoleCount(holeCount);
      const values = normalizeHoleStrokeIndex(count, holeStrokeIndex);
      if (values.length !== count) {
        throw new Error(`Expected ${count} stroke index values`);
      }
      if (!silent) setSyncing(true);
      try {
        await persistCourseHoleStrokeIndex(courseId, count, values);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [persistCourseHoleStrokeIndex]
  );

  const ensureCourseHoleStrokeIndex = useCallback(
    async (courseId, holeCount, existingStrokeIndex) => {
      const normalizedCount = normalizeHoleCount(holeCount);
      if (
        Array.isArray(existingStrokeIndex) &&
        existingStrokeIndex.length === normalizedCount
      ) {
        return;
      }
      await persistCourseHoleStrokeIndex(
        courseId,
        normalizedCount,
        defaultHoleStrokeIndex(normalizedCount)
      );
    },
    [persistCourseHoleStrokeIndex]
  );

  const saveCourseLayout = useCallback(
    async (courseId, holeCount, holePars, options = {}) => {
      const { silent = false } = options;
      const count = normalizeHoleCount(holeCount);
      const prevCount = courseHoleCounts[courseId];
      const countChanged = prevCount !== count;
      const pars = normalizeHolePars(holePars);
      if (pars.length !== count) {
        throw new Error(`Expected ${count} par values`);
      }
      if (!silent) setSyncing(true);
      try {
        await persistCourseHoleCount(courseId, count);
        await patchCourseHolePars(courseId, count, pars);
        setCourseHoleCounts((prev) => ({ ...prev, [courseId]: count }));
        setCourseHolePars((prev) => ({ ...prev, [courseId]: pars }));
        if (countChanged) {
          await ensureCourseHoleStrokeIndex(
            courseId,
            count,
            courseHoleStrokeIndex[courseId]
          );
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await refresh();
        throw e;
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [
      courseHoleCounts,
      courseHoleStrokeIndex,
      ensureCourseHoleStrokeIndex,
      persistCourseHoleCount,
      refresh,
    ]
  );

  const persistCourseHoleSss = useCallback(
    async (courseId, holeCount, holeSss) => {
      await saveCourseHoleSss(courseId, holeCount, holeSss);
    },
    [saveCourseHoleSss]
  );

  const ensureCourseHoleSss = useCallback(
    async (courseId, holeCount, totalPar, existingSss) => {
      const normalizedCount = normalizeHoleCount(holeCount);
      if (Array.isArray(existingSss) && existingSss.length === normalizedCount) return;
      await persistCourseHoleSss(
        courseId,
        normalizedCount,
        defaultHoleSss(normalizedCount, totalPar)
      );
    },
    [persistCourseHoleSss]
  );

  const ensureCourseHolePars = useCallback(
    async (courseId, holeCount, totalPar, existingPars) => {
      const normalizedCount = normalizeHoleCount(holeCount);
      if (Array.isArray(existingPars) && existingPars.length === normalizedCount) return;
      await persistCourseHolePars(
        courseId,
        normalizedCount,
        defaultHolePars(normalizedCount, totalPar)
      );
    },
    [persistCourseHolePars]
  );

  const saveCourseEdits = useCallback(
    async (id, fields, isUserCourse) => {
      const website = normalizeWebsiteInput(fields.website);
      const holeCount = normalizeHoleCount(fields.holeCount ?? fields.holes);
      const row = {
        name: fields.name.trim(),
        city: fields.city.trim() || '—',
        address: fields.address.trim() || 'Address not listed',
        type: fields.type.trim() || 'Public',
        holes: holeCount,
        lat: fields.lat,
        lng: fields.lng,
        website,
        par: fields.par,
        slopeRating: fields.slopeRating,
        courseRating: fields.courseRating,
      };

      if (isUserCourse) {
        const next = customCourses.map((c) => (c.id === id ? { ...c, ...row } : c));
        setSyncing(true);
        try {
          await putCustomCourses(next);
          setCustomCourses(next);
          await persistCourseHoleCount(id, holeCount);
          await persistCourseRatings(id, holeCount, {
            par: fields.par,
            slopeRating: Number.isFinite(fields.slopeRating) ? fields.slopeRating : null,
            courseRating: Number.isFinite(fields.courseRating) ? fields.courseRating : null,
          });
          await ensureCourseHoleSss(id, holeCount, row.par, courseHoleSss[id]);
          await ensureCourseHolePars(id, holeCount, row.par, courseHolePars[id]);
          await ensureCourseHoleStrokeIndex(
            id,
            holeCount,
            courseHoleStrokeIndex[id]
          );
          const cur = myProgress[id] || {};
          const rating =
            Number.isFinite(fields.slopeRating) && Number.isFinite(fields.courseRating)
              ? resolveCourseRatingFields({ ...row, holes: row.holes })
              : {};
          await applyProgressPatch(
            id,
            progressWithHandicap(cur, cur.played, rating, user?.handicap ?? null)
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          await refresh();
        } finally {
          setSyncing(false);
        }
        return;
      }

      setSyncing(true);
      try {
        await persistCourseHoleCount(id, holeCount);
        await persistCourseRatings(id, holeCount, {
          par: fields.par,
          slopeRating: Number.isFinite(fields.slopeRating) ? fields.slopeRating : null,
          courseRating: Number.isFinite(fields.courseRating) ? fields.courseRating : null,
        });
        await ensureCourseHoleSss(id, holeCount, row.par, courseHoleSss[id]);
        await ensureCourseHolePars(id, holeCount, row.par, courseHolePars[id]);
        await ensureCourseHoleStrokeIndex(
          id,
          holeCount,
          courseHoleStrokeIndex[id]
        );
        const cur = myProgress[id] || {};
        const rating =
          Number.isFinite(fields.slopeRating) && Number.isFinite(fields.courseRating)
            ? resolveCourseRatingFields({
                holes: row.holes,
                par: fields.par,
                slopeRating: fields.slopeRating,
                courseRating: fields.courseRating,
              })
            : {};
        await applyProgressPatch(id, {
          ...progressWithHandicap(cur, cur.played, rating, user?.handicap ?? null),
          fieldOverrides: {
            name: row.name,
            city: row.city,
            address: row.address,
            type: row.type,
            lat: row.lat,
            lng: row.lng,
            website: row.website,
            par: fields.par,
            slopeRating: fields.slopeRating,
            courseRating: fields.courseRating,
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await refresh();
      } finally {
        setSyncing(false);
      }
    },
    [
      applyProgressPatch,
      courseHolePars,
      courseHoleSss,
      courseHoleStrokeIndex,
      customCourses,
      ensureCourseHolePars,
      ensureCourseHoleSss,
      ensureCourseHoleStrokeIndex,
      myProgress,
      persistCourseHoleCount,
      persistCourseHoleSss,
      persistCourseRatings,
      progressWithHandicap,
      refresh,
      user,
    ]
  );

  const resetCourseEdits = useCallback(
    (id, isUserCourse) => {
      if (isUserCourse) return;
      const cur = myProgress[id];
      if (!cur) return;
      const { fieldOverrides, customName, ...rest } = cur;
      if (!rest.played && (rest.playedAt == null || rest.playedAt === '')) {
        applyProgressPatch(id, { played: false, playedAt: null });
      } else {
        applyProgressPatch(id, rest);
      }
    },
    [applyProgressPatch, myProgress]
  );

  const addCourse = useCallback(
    async (payload) => {
      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const holeCount = normalizeHoleCount(payload.holeCount ?? payload.holes);
      const row = {
        id,
        name: payload.name.trim(),
        city: payload.city?.trim() || '—',
        address: payload.address?.trim() || 'Address not listed',
        type: payload.type.trim() || 'Public',
        holes: holeCount,
        lat: payload.lat,
        lng: payload.lng,
        website: normalizeWebsiteInput(payload.website),
      };
      setSyncing(true);
      try {
        await postCustomCourse(row);
        await persistCourseHoleCount(id, holeCount);
        await persistCourseHolePars(id, holeCount, defaultHolePars(holeCount));
        await persistCourseHoleSss(id, holeCount, defaultHoleSss(holeCount));
        await persistCourseHoleStrokeIndex(
          id,
          holeCount,
          defaultHoleStrokeIndex(holeCount)
        );
        setCustomCourses((prev) => [...prev, row]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await refresh();
      } finally {
        setSyncing(false);
      }
      return id;
    },
    [persistCourseHoleCount, persistCourseHolePars, persistCourseHoleSss, persistCourseHoleStrokeIndex, refresh]
  );

  const stats = useMemo(() => {
    const total = courses.length;
    const played = courses.filter((c) => c.played).length;
    const remaining = total - played;
    const percent = total ? Math.round((played / total) * 100) : 0;
    return { total, played, remaining, percent };
  }, [courses]);

  const groupUsers = apiUsers;
  const groupMembers = members;

  return {
    courses,
    setPlayed,
    saveCourseEdits,
    resetCourseEdits,
    addCourse,
    saveCourseHoleSss,
    saveCourseLayout,
    saveCourseHoleStrokeIndex,
    savePlayerHoleScores,
    stats,
    progressByUser,
    handicapByUser,
    groupUsers,
    groupMembers,
    loading,
    error,
    syncing,
    isReady: canUseApp,
    refresh,
  };
}
