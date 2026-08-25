from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from server.handicap import displayed_handicap_index, format_handicap

_DEFAULT_DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR = Path(os.environ.get("COLORADOGOLF_DATA_DIR", _DEFAULT_DATA_DIR)).expanduser()
DB_PATH = DATA_DIR / "coloradogolf.db"

VALID_HOLE_COUNTS = frozenset({9, 18, 27})

_UNSET = object()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _migrate_users(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "email" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "display_name" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
    if "password_hash" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "status" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'")
    if "is_admin" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
    if "must_change_password" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
        )
    if "handicap" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN handicap REAL")
    if "computed_handicap_index" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN computed_handicap_index REAL")
    if "low_handicap_index" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN low_handicap_index REAL")
    if "handicap_soft_cap" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN handicap_soft_cap INTEGER NOT NULL DEFAULT 0"
        )
    if "handicap_hard_cap" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN handicap_hard_cap INTEGER NOT NULL DEFAULT 0"
        )
    if "handicap_exceptional" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN handicap_exceptional INTEGER NOT NULL DEFAULT 0"
        )
    if "home_course_id" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN home_course_id TEXT")
    if "home_course_handicap" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN home_course_handicap INTEGER")
    if "home_playing_handicap" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN home_playing_handicap INTEGER")
    if "handicap_trend" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN handicap_trend TEXT")
    conn.execute(
        "UPDATE users SET status = 'approved' "
        "WHERE password_hash IS NOT NULL AND (status IS NULL OR status = '')"
    )
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) "
        "WHERE email IS NOT NULL AND email != ''"
    )


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              username TEXT PRIMARY KEY,
              email TEXT,
              display_name TEXT,
              password_hash TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              username TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS course_progress (
              username TEXT NOT NULL,
              course_id TEXT NOT NULL,
              played INTEGER NOT NULL DEFAULT 0,
              played_at TEXT,
              field_overrides TEXT,
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (username, course_id),
              FOREIGN KEY (username) REFERENCES users(username)
            );
            CREATE TABLE IF NOT EXISTS custom_courses (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              added_by TEXT,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS course_metadata (
              course_id TEXT PRIMARY KEY,
              hole_count INTEGER NOT NULL CHECK (hole_count IN (9, 18, 27)),
              updated_by TEXT,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        _migrate_users(conn)
        _migrate_progress(conn)
        _migrate_course_metadata(conn)
        _migrate_rounds(conn)
        conn.commit()


def _migrate_course_metadata(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(course_metadata)").fetchall()}
    if "hole_sss" not in cols:
        conn.execute("ALTER TABLE course_metadata ADD COLUMN hole_sss TEXT")
    if "hole_pars" not in cols:
        conn.execute("ALTER TABLE course_metadata ADD COLUMN hole_pars TEXT")
    if "hole_stroke_index" not in cols:
        conn.execute("ALTER TABLE course_metadata ADD COLUMN hole_stroke_index TEXT")
    if "par" not in cols:
        conn.execute("ALTER TABLE course_metadata ADD COLUMN par REAL")
    if "course_rating" not in cols:
        conn.execute("ALTER TABLE course_metadata ADD COLUMN course_rating REAL")
    if "slope_rating" not in cols:
        conn.execute("ALTER TABLE course_metadata ADD COLUMN slope_rating INTEGER")


def _migrate_rounds(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS rounds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          course_id TEXT NOT NULL,
          played_at TEXT NOT NULL,
          holes INTEGER NOT NULL CHECK (holes IN (9, 18)),
          hole_scores TEXT NOT NULL,
          gross INTEGER NOT NULL,
          adjusted_gross INTEGER NOT NULL,
          course_rating REAL NOT NULL,
          slope_rating INTEGER NOT NULL,
          par INTEGER NOT NULL,
          pcc REAL NOT NULL DEFAULT 0,
          format TEXT NOT NULL DEFAULT 'stroke',
          handicap_allowance REAL NOT NULL DEFAULT 1.0,
          score_differential REAL NOT NULL,
          score_differential_raw REAL NOT NULL,
          ndb_applied INTEGER NOT NULL DEFAULT 0,
          handicap_index_at_play REAL,
          course_handicap_unrounded REAL,
          course_handicap INTEGER,
          playing_handicap INTEGER,
          esr_adjustment REAL NOT NULL DEFAULT 0,
          handicap_index_after REAL,
          counting INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_rounds_user_course
          ON rounds(username, course_id);
        CREATE INDEX IF NOT EXISTS idx_rounds_user_played
          ON rounds(username, played_at);
        """
    )


def _migrate_progress(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(course_progress)").fetchall()}
    if "handicap_index" not in cols:
        conn.execute("ALTER TABLE course_progress ADD COLUMN handicap_index REAL")
    if "course_handicap" not in cols:
        conn.execute("ALTER TABLE course_progress ADD COLUMN course_handicap INTEGER")
    if "hole_scores" not in cols:
        conn.execute("ALTER TABLE course_progress ADD COLUMN hole_scores TEXT")


def bootstrap_admin_emails(emails: set[str]) -> None:
    if not emails:
        return
    with connect() as conn:
        for email in emails:
            conn.execute(
                """
                UPDATE users
                SET is_admin = 1, status = 'approved'
                WHERE lower(email) = lower(?)
                """,
                (email,),
            )
        conn.commit()


def count_approved_users() -> int:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM users
            WHERE password_hash IS NOT NULL AND status = 'approved'
            """
        ).fetchone()
    return int(row["n"]) if row else 0


def user_public_dict(row: sqlite3.Row) -> dict[str, Any]:
    keys = set(row.keys())
    seed = float(row["handicap"]) if row["handicap"] is not None else None
    computed = None
    if "computed_handicap_index" in keys and row["computed_handicap_index"] is not None:
        computed = float(row["computed_handicap_index"])
    value, display, source = displayed_handicap_index(computed, seed)
    low = None
    if "low_handicap_index" in keys and row["low_handicap_index"] is not None:
        low = float(row["low_handicap_index"])
    trend: list[Any] = []
    if "handicap_trend" in keys and row["handicap_trend"]:
        try:
            parsed = json.loads(str(row["handicap_trend"]))
            if isinstance(parsed, list):
                trend = parsed
        except json.JSONDecodeError:
            trend = []
    return {
        "username": str(row["username"]),
        "email": str(row["email"] or ""),
        "displayName": str(row["display_name"] or row["username"]),
        "status": str(row["status"] or "approved"),
        "isAdmin": bool(row["is_admin"]),
        "mustChangePassword": bool(row["must_change_password"])
        if "must_change_password" in keys
        else False,
        "handicap": value,
        "handicapDisplay": display,
        "seedHandicap": seed,
        "computedHandicapIndex": computed,
        "handicapSource": source,
        "handicapEstablished": computed is not None,
        "lowHandicapIndex": low,
        "lowHandicapIndexDisplay": format_handicap(low),
        "softCapApplied": bool(row["handicap_soft_cap"])
        if "handicap_soft_cap" in keys
        else False,
        "hardCapApplied": bool(row["handicap_hard_cap"])
        if "handicap_hard_cap" in keys
        else False,
        "exceptionalScoreApplied": bool(row["handicap_exceptional"])
        if "handicap_exceptional" in keys
        else False,
        "homeCourseId": str(row["home_course_id"])
        if "home_course_id" in keys and row["home_course_id"]
        else None,
        "homeCourseHandicap": int(row["home_course_handicap"])
        if "home_course_handicap" in keys and row["home_course_handicap"] is not None
        else None,
        "homePlayingHandicap": int(row["home_playing_handicap"])
        if "home_playing_handicap" in keys and row["home_playing_handicap"] is not None
        else None,
        "handicapTrend": trend,
    }


def get_user_by_username(username: str) -> sqlite3.Row | None:
    with connect() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,),
        ).fetchone()


def get_user_by_email(email: str) -> sqlite3.Row | None:
    normalized = email.strip().lower()
    with connect() as conn:
        return conn.execute(
            """
            SELECT * FROM users
            WHERE lower(trim(email)) = ?
            """,
            (normalized,),
        ).fetchone()


def is_user_admin(username: str) -> bool:
    row = get_user_by_username(username)
    return bool(row and row["is_admin"])


def create_user(
    username: str,
    email: str,
    display_name: str,
    password_hash: str,
    *,
    status: str = "pending",
    is_admin: bool = False,
    must_change_password: bool = True,
    handicap: float | None = None,
) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (
              username, email, display_name, password_hash, status, is_admin,
              must_change_password, handicap
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                email,
                display_name,
                password_hash,
                status,
                1 if is_admin else 0,
                1 if must_change_password else 0,
                handicap,
            ),
        )
        conn.commit()


def set_user_status(username: str, status: str) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE users SET status = ? WHERE username = ?",
            (status, username),
        )
        conn.commit()
        return cur.rowcount > 0


def list_approved_users() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM users
            WHERE password_hash IS NOT NULL AND status = 'approved'
            ORDER BY display_name COLLATE NOCASE, username COLLATE NOCASE
            """
        ).fetchall()
    return [user_public_dict(r) for r in rows]


def update_user(
    username: str,
    *,
    email: str | None = None,
    display_name: str | None = None,
    password_hash: str | None = None,
    is_admin: bool | None = None,
    must_change_password: bool | None = None,
    handicap: float | None | object = _UNSET,
) -> bool:
    sets: list[str] = []
    params: list[Any] = []
    if email is not None:
        sets.append("email = ?")
        params.append(email)
    if display_name is not None:
        sets.append("display_name = ?")
        params.append(display_name)
    if password_hash is not None:
        sets.append("password_hash = ?")
        params.append(password_hash)
    if is_admin is not None:
        sets.append("is_admin = ?")
        params.append(1 if is_admin else 0)
    if must_change_password is not None:
        sets.append("must_change_password = ?")
        params.append(1 if must_change_password else 0)
    if handicap is not _UNSET:
        sets.append("handicap = ?")
        params.append(handicap)
    if not sets:
        return False
    params.append(username)
    with connect() as conn:
        cur = conn.execute(
            f"UPDATE users SET {', '.join(sets)} WHERE username = ?",
            params,
        )
        conn.commit()
        return cur.rowcount > 0


def list_pending_users() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT username, email, display_name, created_at
            FROM users
            WHERE status = 'pending' AND password_hash IS NOT NULL
            ORDER BY created_at
            """
        ).fetchall()
    return [
        {
            "username": str(r["username"]),
            "email": str(r["email"] or ""),
            "displayName": str(r["display_name"] or r["username"]),
            "createdAt": str(r["created_at"] or ""),
        }
        for r in rows
    ]


def create_session(token: str, username: str, expires_at: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)",
            (token, username, expires_at),
        )
        conn.commit()


def delete_session(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def delete_sessions_for_user(username: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE username = ?", (username,))
        conn.commit()


def resolve_session(token: str) -> str | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT username, expires_at FROM sessions WHERE token = ?",
            (token,),
        ).fetchone()
    if not row:
        return None
    exp = row["expires_at"]
    try:
        exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    if datetime.now(timezone.utc) >= exp_dt:
        delete_session(token)
        return None
    return str(row["username"])


def load_users() -> list[str]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT username FROM users
            WHERE password_hash IS NOT NULL AND status = 'approved'
            ORDER BY username COLLATE NOCASE
            """
        ).fetchall()
    return [str(r["username"]) for r in rows]


def load_progress_by_user() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT username, course_id, played, played_at, field_overrides,
                   handicap_index, course_handicap, hole_scores
            FROM course_progress
            """
        ).fetchall()
    for r in rows:
        user = str(r["username"])
        cid = str(r["course_id"])
        fo = r["field_overrides"]
        entry: dict[str, Any] = {
            "played": bool(r["played"]),
            "playedAt": r["played_at"],
        }
        if r["handicap_index"] is not None:
            entry["handicapIndex"] = float(r["handicap_index"])
        if r["course_handicap"] is not None:
            entry["courseHandicap"] = int(r["course_handicap"])
        if fo:
            try:
                entry["fieldOverrides"] = json.loads(fo)
            except json.JSONDecodeError:
                pass
        hs = r["hole_scores"]
        if hs:
            try:
                entry["holeScores"] = json.loads(hs)
            except json.JSONDecodeError:
                pass
        out.setdefault(user, {})[cid] = entry
    return out


def load_custom_courses() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT payload FROM custom_courses ORDER BY updated_at"
        ).fetchall()
    courses: list[dict[str, Any]] = []
    for r in rows:
        try:
            courses.append(json.loads(r["payload"]))
        except json.JSONDecodeError:
            continue
    return courses


def upsert_progress(username: str, course_id: str, entry: dict[str, Any]) -> None:
    played = 1 if entry.get("played") else 0
    played_at = entry.get("playedAt")
    fo = entry.get("fieldOverrides")
    fo_json = json.dumps(fo) if fo else None
    hi = entry.get("handicapIndex")
    ch = entry.get("courseHandicap")
    hs = entry.get("holeScores")
    hs_json = json.dumps(hs) if hs is not None else None
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO course_progress (
              username, course_id, played, played_at, field_overrides,
              handicap_index, course_handicap, hole_scores, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(username, course_id) DO UPDATE SET
              played = excluded.played,
              played_at = excluded.played_at,
              field_overrides = excluded.field_overrides,
              handicap_index = excluded.handicap_index,
              course_handicap = excluded.course_handicap,
              hole_scores = excluded.hole_scores,
              updated_at = datetime('now')
            """,
            (username, course_id, played, played_at, fo_json, hi, ch, hs_json),
        )
        conn.commit()


def delete_progress_entry(username: str, course_id: str) -> None:
    with connect() as conn:
        conn.execute(
            "DELETE FROM course_progress WHERE username = ? AND course_id = ?",
            (username, course_id),
        )
        conn.commit()


def replace_custom_courses(courses: list[dict[str, Any]], added_by: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM custom_courses")
        for c in courses:
            conn.execute(
                """
                INSERT INTO custom_courses (id, payload, added_by, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                """,
                (c["id"], json.dumps(c), added_by),
            )
        conn.commit()


def upsert_custom_course(course: dict[str, Any], added_by: str) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO custom_courses (id, payload, added_by, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              updated_at = datetime('now')
            """,
            (course["id"], json.dumps(course), added_by),
        )
        conn.commit()


def load_course_hole_counts() -> dict[str, int]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT course_id, hole_count FROM course_metadata"
        ).fetchall()
    return {str(r["course_id"]): int(r["hole_count"]) for r in rows}


def upsert_course_hole_count(course_id: str, hole_count: int, updated_by: str) -> None:
    if hole_count not in VALID_HOLE_COUNTS:
        raise ValueError("hole_count must be 9, 18, or 27")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO course_metadata (course_id, hole_count, updated_by, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(course_id) DO UPDATE SET
              hole_count = excluded.hole_count,
              updated_by = excluded.updated_by,
              updated_at = datetime('now')
            """,
            (course_id, hole_count, updated_by),
        )
        conn.commit()


def load_course_hole_sss() -> dict[str, list[int]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT course_id, hole_sss FROM course_metadata WHERE hole_sss IS NOT NULL"
        ).fetchall()
    out: dict[str, list[int]] = {}
    for row in rows:
        try:
            parsed = json.loads(str(row["hole_sss"]))
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(parsed, list) and all(isinstance(v, int) for v in parsed):
            out[str(row["course_id"])] = parsed
    return out


def _validate_hole_sss(hole_sss: list[int], hole_count: int) -> None:
    if hole_count not in VALID_HOLE_COUNTS:
        raise ValueError("hole_count must be 9, 18, or 27")
    if len(hole_sss) != hole_count:
        raise ValueError(f"holeSss must contain exactly {hole_count} values")
    for value in hole_sss:
        if not isinstance(value, int) or value < 1 or value > 10:
            raise ValueError("each hole SSS must be an integer from 1 to 10")


def upsert_course_hole_sss(
    course_id: str,
    hole_count: int,
    hole_sss: list[int],
    updated_by: str,
) -> None:
    _validate_hole_sss(hole_sss, hole_count)
    payload = json.dumps(hole_sss)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO course_metadata (course_id, hole_count, hole_sss, updated_by, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(course_id) DO UPDATE SET
              hole_count = excluded.hole_count,
              hole_sss = excluded.hole_sss,
              updated_by = excluded.updated_by,
              updated_at = datetime('now')
            """,
            (course_id, hole_count, payload, updated_by),
        )
        conn.commit()


def load_course_hole_pars() -> dict[str, list[int]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT course_id, hole_pars FROM course_metadata WHERE hole_pars IS NOT NULL"
        ).fetchall()
    out: dict[str, list[int]] = {}
    for row in rows:
        try:
            parsed = json.loads(str(row["hole_pars"]))
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(parsed, list) and all(isinstance(v, int) for v in parsed):
            out[str(row["course_id"])] = parsed
    return out


def _validate_hole_pars(hole_pars: list[int], hole_count: int) -> None:
    if hole_count not in VALID_HOLE_COUNTS:
        raise ValueError("hole_count must be 9, 18, or 27")
    if len(hole_pars) != hole_count:
        raise ValueError(f"holePars must contain exactly {hole_count} values")
    for value in hole_pars:
        if not isinstance(value, int) or value < 3 or value > 5:
            raise ValueError("each hole par must be an integer from 3 to 5")


def upsert_course_hole_pars(
    course_id: str,
    hole_count: int,
    hole_pars: list[int],
    updated_by: str,
) -> None:
    _validate_hole_pars(hole_pars, hole_count)
    payload = json.dumps(hole_pars)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO course_metadata (course_id, hole_count, hole_pars, updated_by, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(course_id) DO UPDATE SET
              hole_count = excluded.hole_count,
              hole_pars = excluded.hole_pars,
              updated_by = excluded.updated_by,
              updated_at = datetime('now')
            """,
            (course_id, hole_count, payload, updated_by),
        )
        conn.commit()


def load_course_hole_stroke_index() -> dict[str, list[int]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT course_id, hole_stroke_index FROM course_metadata "
            "WHERE hole_stroke_index IS NOT NULL"
        ).fetchall()
    out: dict[str, list[int]] = {}
    for row in rows:
        try:
            parsed = json.loads(str(row["hole_stroke_index"]))
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(parsed, list) and all(isinstance(v, int) for v in parsed):
            out[str(row["course_id"])] = parsed
    return out


def _validate_hole_stroke_index(hole_stroke_index: list[int], hole_count: int) -> None:
    if hole_count not in VALID_HOLE_COUNTS:
        raise ValueError("hole_count must be 9, 18, or 27")
    if len(hole_stroke_index) != hole_count:
        raise ValueError(f"holeStrokeIndex must contain exactly {hole_count} values")
    for value in hole_stroke_index:
        if not isinstance(value, int) or value < 1 or value > hole_count:
            raise ValueError(
                f"each stroke index must be an integer from 1 to {hole_count}"
            )


def upsert_course_hole_stroke_index(
    course_id: str,
    hole_count: int,
    hole_stroke_index: list[int],
    updated_by: str,
) -> None:
    _validate_hole_stroke_index(hole_stroke_index, hole_count)
    payload = json.dumps(hole_stroke_index)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO course_metadata (
              course_id, hole_count, hole_stroke_index, updated_by, updated_at
            )
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(course_id) DO UPDATE SET
              hole_count = excluded.hole_count,
              hole_stroke_index = excluded.hole_stroke_index,
              updated_by = excluded.updated_by,
              updated_at = datetime('now')
            """,
            (course_id, hole_count, payload, updated_by),
        )
        conn.commit()


def load_course_whs_ratings() -> dict[str, dict[str, Any]]:
    """Shared Course Rating / Slope / par. Missing values stay None (never invent 113/72)."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT course_id, hole_count, par, course_rating, slope_rating
            FROM course_metadata
            """
        ).fetchall()
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        par = row["par"]
        cr = row["course_rating"]
        slope = row["slope_rating"]
        out[str(row["course_id"])] = {
            "holeCount": int(row["hole_count"]),
            "par": float(par) if par is not None else None,
            "courseRating": float(cr) if cr is not None else None,
            "slopeRating": int(slope) if slope is not None else None,
            "hasWhsRatings": cr is not None and slope is not None,
        }
    return out


def upsert_course_whs_ratings(
    course_id: str,
    hole_count: int,
    par: float | None,
    course_rating: float | None,
    slope_rating: int | None,
    updated_by: str,
) -> None:
    if hole_count not in VALID_HOLE_COUNTS:
        raise ValueError("hole_count must be 9, 18, or 27")
    if course_rating is not None and (course_rating < 20 or course_rating > 90):
        raise ValueError("course rating must be between 20 and 90")
    if slope_rating is not None and (slope_rating < 55 or slope_rating > 155):
        raise ValueError("slope rating must be between 55 and 155")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO course_metadata (
              course_id, hole_count, par, course_rating, slope_rating,
              updated_by, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(course_id) DO UPDATE SET
              hole_count = excluded.hole_count,
              par = COALESCE(excluded.par, course_metadata.par),
              course_rating = COALESCE(excluded.course_rating, course_metadata.course_rating),
              slope_rating = COALESCE(excluded.slope_rating, course_metadata.slope_rating),
              updated_by = excluded.updated_by,
              updated_at = datetime('now')
            """,
            (course_id, hole_count, par, course_rating, slope_rating, updated_by),
        )
        conn.commit()


def list_rounds_for_user(username: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM rounds
            WHERE username = ?
            ORDER BY played_at, id
            """,
            (username,),
        ).fetchall()
    return [_round_dict(r) for r in rows]


def list_all_rounds() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM rounds ORDER BY username, played_at, id"
        ).fetchall()
    return [_round_dict(r) for r in rows]


def _round_dict(row: sqlite3.Row) -> dict[str, Any]:
    scores = []
    try:
        parsed = json.loads(str(row["hole_scores"]))
        if isinstance(parsed, list):
            scores = parsed
    except json.JSONDecodeError:
        scores = []
    return {
        "id": int(row["id"]),
        "username": str(row["username"]),
        "courseId": str(row["course_id"]),
        "playedAt": str(row["played_at"]),
        "holes": int(row["holes"]),
        "holeScores": scores,
        "gross": int(row["gross"]),
        "adjustedGross": int(row["adjusted_gross"]),
        "courseRating": float(row["course_rating"]),
        "slopeRating": int(row["slope_rating"]),
        "par": int(row["par"]),
        "pcc": float(row["pcc"]),
        "format": str(row["format"] or "stroke"),
        "handicapAllowance": float(row["handicap_allowance"]),
        "scoreDifferential": float(row["score_differential"]),
        "scoreDifferentialRaw": float(row["score_differential_raw"]),
        "ndbApplied": bool(row["ndb_applied"]),
        "handicapIndexAtPlay": float(row["handicap_index_at_play"])
        if row["handicap_index_at_play"] is not None
        else None,
        "courseHandicapUnrounded": float(row["course_handicap_unrounded"])
        if row["course_handicap_unrounded"] is not None
        else None,
        "courseHandicap": int(row["course_handicap"])
        if row["course_handicap"] is not None
        else None,
        "playingHandicap": int(row["playing_handicap"])
        if row["playing_handicap"] is not None
        else None,
        "esrAdjustment": float(row["esr_adjustment"] or 0),
        "handicapIndexAfter": float(row["handicap_index_after"])
        if row["handicap_index_after"] is not None
        else None,
        "counting": bool(row["counting"]),
    }


def upsert_round(payload: dict[str, Any]) -> int:
    """Insert or replace the posted round for (username, course_id). Returns round id."""
    scores_json = json.dumps(payload["hole_scores"])
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO rounds (
              username, course_id, played_at, holes, hole_scores, gross, adjusted_gross,
              course_rating, slope_rating, par, pcc, format, handicap_allowance,
              score_differential, score_differential_raw, ndb_applied,
              handicap_index_at_play, course_handicap_unrounded, course_handicap,
              playing_handicap, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(username, course_id) DO UPDATE SET
              played_at = excluded.played_at,
              holes = excluded.holes,
              hole_scores = excluded.hole_scores,
              gross = excluded.gross,
              adjusted_gross = excluded.adjusted_gross,
              course_rating = excluded.course_rating,
              slope_rating = excluded.slope_rating,
              par = excluded.par,
              pcc = excluded.pcc,
              format = excluded.format,
              handicap_allowance = excluded.handicap_allowance,
              score_differential = excluded.score_differential,
              score_differential_raw = excluded.score_differential_raw,
              ndb_applied = excluded.ndb_applied,
              handicap_index_at_play = excluded.handicap_index_at_play,
              course_handicap_unrounded = excluded.course_handicap_unrounded,
              course_handicap = excluded.course_handicap,
              playing_handicap = excluded.playing_handicap,
              updated_at = datetime('now')
            """,
            (
                payload["username"],
                payload["course_id"],
                payload["played_at"],
                payload["holes"],
                scores_json,
                payload["gross"],
                payload["adjusted_gross"],
                payload["course_rating"],
                payload["slope_rating"],
                payload["par"],
                payload["pcc"],
                payload.get("format", "stroke"),
                payload.get("handicap_allowance", 1.0),
                payload["score_differential"],
                payload["score_differential_raw"],
                1 if payload.get("ndb_applied") else 0,
                payload.get("handicap_index_at_play"),
                payload.get("course_handicap_unrounded"),
                payload.get("course_handicap"),
                payload.get("playing_handicap"),
            ),
        )
        row = conn.execute(
            "SELECT id FROM rounds WHERE username = ? AND course_id = ?",
            (payload["username"], payload["course_id"]),
        ).fetchone()
        conn.commit()
    return int(row["id"]) if row else 0


def update_round_handicap_fields(
    round_id: int,
    *,
    esr_adjustment: float,
    counting: bool,
    handicap_index_at_play: float | None,
    handicap_index_after: float | None,
) -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE rounds
            SET esr_adjustment = ?, counting = ?, handicap_index_at_play = ?,
                handicap_index_after = ?
            WHERE id = ?
            """,
            (
                esr_adjustment,
                1 if counting else 0,
                handicap_index_at_play,
                handicap_index_after,
                round_id,
            ),
        )
        conn.commit()


def save_user_handicap_state(
    username: str,
    *,
    computed_index: float | None,
    low_index: float | None,
    soft_cap: bool,
    hard_cap: bool,
    exceptional: bool,
    home_course_id: str | None,
    home_course_handicap: int | None,
    home_playing_handicap: int | None,
    trend: list[dict[str, Any]],
) -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE users SET
              computed_handicap_index = ?,
              low_handicap_index = ?,
              handicap_soft_cap = ?,
              handicap_hard_cap = ?,
              handicap_exceptional = ?,
              home_course_id = ?,
              home_course_handicap = ?,
              home_playing_handicap = ?,
              handicap_trend = ?
            WHERE username = ?
            """,
            (
                computed_index,
                low_index,
                1 if soft_cap else 0,
                1 if hard_cap else 0,
                1 if exceptional else 0,
                home_course_id,
                home_course_handicap,
                home_playing_handicap,
                json.dumps(trend),
                username,
            ),
        )
        conn.commit()
