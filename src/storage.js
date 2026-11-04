import { BEST_KEY, PROFILE_KEY } from './config.js';

const PROFILE_VERSION = 1;

export function getRecordKey(courseId, courseVersion, physicsVersion) {
  return `${courseId}@${courseVersion}@${physicsVersion}`;
}

function clamp01(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

export function createEmptyProfile() {
  return {
    version: PROFILE_VERSION,
    settings: {
      muted: false,
      musicVolume: 0.75,
      effectsVolume: 0.85,
      bloom: 'low',
      flashing: 'reduced'
    },
    records: {}
  };
}

function normalizeSplits(splits) {
  if (!Array.isArray(splits)) return [];
  return splits.filter((value) => Number.isFinite(value) && value >= 0);
}

function normalizeRecord(record) {
  if (!record || !Number.isFinite(record.bestTime) || record.bestTime <= 0) {
    return null;
  }

  return {
    bestTime: record.bestTime,
    bestSplits: normalizeSplits(record.bestSplits),
    crashes: Number.isInteger(record.crashes) ? Math.max(0, record.crashes) : 0,
    misses: Number.isInteger(record.misses) ? Math.max(0, record.misses) : 0,
    medal: typeof record.medal === 'string' ? record.medal : null,
    migrated: record.migrated === true,
    updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0
  };
}

function normalizeProfile(value) {
  const profile = createEmptyProfile();
  if (!value || typeof value !== 'object') return profile;

  if (value.settings && typeof value.settings === 'object') {
    profile.settings.muted = value.settings.muted === true;
    profile.settings.musicVolume = clamp01(
      value.settings.musicVolume,
      profile.settings.musicVolume
    );
    profile.settings.effectsVolume = clamp01(
      value.settings.effectsVolume,
      profile.settings.effectsVolume
    );
    if (['low', 'medium', 'high'].includes(value.settings.bloom)) {
      profile.settings.bloom = value.settings.bloom;
    }
    if (['reduced', 'normal'].includes(value.settings.flashing)) {
      profile.settings.flashing = value.settings.flashing;
    }
  }

  if (value.records && typeof value.records === 'object') {
    Object.entries(value.records).forEach(([key, record]) => {
      const normalized = normalizeRecord(record);
      if (normalized) profile.records[key] = normalized;
    });
  }

  return profile;
}

function readValue(storage, key) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (error) {
    return null;
  }
}

export function loadProfile(storage, { recordKey, legacyKey = BEST_KEY } = {}) {
  const raw = readValue(storage, PROFILE_KEY);
  let parsed = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = null;
    }
  }

  const profile = normalizeProfile(parsed);

  if (recordKey && !profile.records[recordKey]) {
    const legacyBest = Number.parseFloat(readValue(storage, legacyKey));
    if (Number.isFinite(legacyBest) && legacyBest > 0) {
      profile.records[recordKey] = {
        bestTime: legacyBest,
        bestSplits: [],
        crashes: 0,
        misses: 0,
        medal: null,
        migrated: true,
        updatedAt: 0
      };
    }
  }

  return profile;
}

export function saveProfile(storage, profile) {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch (error) {
    return false;
  }
}

export function getRecord(profile, key) {
  return profile.records[key] || null;
}

export function setRecord(profile, key, record) {
  profile.records[key] = normalizeRecord(record);
  return profile.records[key];
}
