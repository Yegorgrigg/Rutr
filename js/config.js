// Единственное место с настройками «на будущее». Менять — только здесь.

export const STORAGE_KEY       = "ru-trainer-v2";   // ключ localStorage (не менять!)
export const BACKUP_KEY        = "ru-trainer-v2-backup";
export const BACKUP_TS_KEY     = "ru-trainer-v2-backup-ts";
export const THEME_KEY         = "ru-trainer-theme";

export const STATE_VERSION     = 3;                  // текущая версия state
export const LEGACY_VERSION    = 2;                  // поддерживаемая для миграции
export const MAX_LEVEL         = 5;

export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
export const DAY_MS             = 86400000;
export const ERROR_BASE_MS      = 30 * 1000;
export const ERROR_MAX_MS       = 10 * 60 * 1000;

export const SESSION_GAP_MS     = 30 * 60 * 1000;
export const BACKUP_INTERVAL_MS = 10 * 60 * 1000;
export const DEFAULT_DAILY_GOAL = 10;

export const $ = id => document.getElementById(id);