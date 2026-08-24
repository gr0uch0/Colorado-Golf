"""
ColoradoGolf shared API with admin-managed accounts and password login.

Run: uvicorn server.main:app --reload --port 8765
Auth: Authorization: Bearer <token>
"""

from __future__ import annotations

import os
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from server.auth import (
    generate_temporary_password,
    hash_password,
    new_session_token,
    normalize_email,
    session_expires_at,
    validate_password,
    validate_username,
    verify_password,
)
from server.email_send import EmailDeliveryError, send_password_reset_email
from server.handicap import parse_handicap
from server.handicap_service import handicap_payload_for_state, try_post_round_from_progress
from server.db import (
    bootstrap_admin_emails,
    count_approved_users,
    create_session,
    create_user,
    delete_progress_entry,
    delete_session,
    delete_sessions_for_user,
    get_user_by_email,
    get_user_by_username,
    init_db,
    is_user_admin,
    list_approved_users,
    list_pending_users,
    load_course_whs_ratings,
    update_user,
    load_custom_courses,
    load_course_hole_counts,
    load_course_hole_pars,
    load_course_hole_sss,
    load_course_hole_stroke_index,
    load_progress_by_user,
    load_users,
    replace_custom_courses,
    resolve_session,
    set_user_status,
    upsert_custom_course,
    upsert_course_hole_count,
    upsert_course_hole_pars,
    upsert_course_hole_sss,
    upsert_course_hole_stroke_index,
    upsert_course_whs_ratings,
    upsert_progress,
    user_public_dict,
)

MAX_USERS = int(os.environ.get("COLORADOGOLF_MAX_USERS", "20"))
API_KEY = os.environ.get("COLORADOGOLF_API_KEY", "").strip()
ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("COLORADOGOLF_ADMIN_EMAILS", "").split(",")
    if e.strip()
}

init_db()
bootstrap_admin_emails(ADMIN_EMAILS)

app = FastAPI(title="ColoradoGolf API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("COLORADOGOLF_CORS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_api_key(key: str | None) -> None:
    if API_KEY and (key or "") != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return authorization[7:].strip()


def _require_approved_user(username: str) -> Any:
    row = get_user_by_username(username)
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    status = str(row["status"] or "pending")
    if status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Account pending admin approval. You will be able to log in once approved.",
        )
    if status == "rejected":
        raise HTTPException(status_code=403, detail="Account access was not approved.")
    if status != "approved":
        raise HTTPException(status_code=403, detail="Account is not active.")
    return row


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_coloradogolf_api_key: Annotated[str | None, Header()] = None,
) -> str:
    _check_api_key(x_coloradogolf_api_key)
    token = _bearer_token(authorization)
    username = resolve_session(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    _require_approved_user(username)
    return username


def get_current_active_user(user: Annotated[str, Depends(get_current_user)]) -> str:
    row = get_user_by_username(user)
    if row and row["must_change_password"]:
        raise HTTPException(
            status_code=403,
            detail="You must change your password before continuing.",
        )
    return user


def get_current_admin(user: Annotated[str, Depends(get_current_active_user)]) -> str:
    if not is_user_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class CreateUserBody(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    email: EmailStr
    displayName: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    isAdmin: bool = False
    handicap: str | float | None = None


class UpdateUserBody(BaseModel):
    email: EmailStr
    displayName: str = Field(min_length=1, max_length=64)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    isAdmin: bool = False
    handicap: str | float | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordBody(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8, max_length=128)


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class CourseHoleCountBody(BaseModel):
    holeCount: int = Field(..., description="9, 18, or 27")


class CourseHoleSssBody(BaseModel):
    holeCount: int = Field(..., description="9, 18, or 27")
    holeSss: list[int] = Field(..., min_length=1, max_length=27)


class CourseHoleParsBody(BaseModel):
    holeCount: int = Field(..., description="9, 18, or 27")
    holePars: list[int] = Field(..., min_length=1, max_length=27)


class CourseHoleStrokeIndexBody(BaseModel):
    holeCount: int = Field(..., description="9, 18, or 27")
    holeStrokeIndex: list[int] = Field(..., min_length=1, max_length=27)


FORGOT_PASSWORD_MESSAGE = (
    "If an account exists for that email, we sent a temporary password. "
    "Check your inbox and log in — you will be asked to set a new password."
)

FORGOT_PASSWORD_DEV_MESSAGE = (
    "No email server is configured on this machine. "
    "Use the temporary password below to log in, then choose a new password."
)


class CourseWhsRatingsBody(BaseModel):
    holeCount: int = Field(..., description="9, 18, or 27")
    par: float | None = None
    courseRating: float | None = None
    slopeRating: int | None = None


class ProgressEntry(BaseModel):
    played: bool = False
    playedAt: str | None = None
    fieldOverrides: dict[str, Any] | None = None
    customName: str | None = None
    handicapIndex: float | None = None
    courseHandicap: int | None = None
    holeScores: list[int | None] | None = None


class ProgressPatch(BaseModel):
    courseId: str
    entry: ProgressEntry


class CustomCoursesBody(BaseModel):
    courses: list[dict[str, Any]] = Field(default_factory=list)


def _user_public(row: Any) -> dict[str, Any]:
    return user_public_dict(row)


def _issue_session(username: str) -> dict[str, Any]:
    token = new_session_token()
    create_session(token, username, session_expires_at())
    row = get_user_by_username(username)
    return {"token": token, "user": _user_public(row)}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _needs_first_admin_setup() -> bool:
    return count_approved_users() == 0


@app.get("/api/auth/setup-status")
def setup_status() -> dict[str, bool]:
    return {"needsSetup": _needs_first_admin_setup()}


@app.post("/api/auth/setup")
def setup_first_admin(body: CreateUserBody) -> dict[str, Any]:
    if not _needs_first_admin_setup():
        raise HTTPException(
            status_code=409,
            detail="Tour already has an account. Log in instead.",
        )
    body.isAdmin = True
    user = _create_approved_user(body, must_change_password=False)
    return _issue_session(str(user["username"]))


def _create_approved_user(
    body: CreateUserBody,
    *,
    must_change_password: bool = True,
) -> dict[str, Any]:
    try:
        username = validate_username(body.username)
        validate_password(body.password)
        email = normalize_email(str(body.email))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if get_user_by_username(username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    make_admin = body.isAdmin or email in ADMIN_EMAILS
    if count_approved_users() >= MAX_USERS:
        raise HTTPException(
            status_code=403,
            detail=f"Tour is full ({MAX_USERS} approved accounts).",
        )

    display = body.displayName.strip()
    try:
        handicap = parse_handicap(body.handicap)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    create_user(
        username,
        email,
        display,
        hash_password(body.password),
        status="approved",
        is_admin=make_admin,
        must_change_password=must_change_password,
        handicap=handicap,
    )
    row = get_user_by_username(username)
    return _user_public(row)


@app.post("/api/admin/users")
def admin_create_user(
    body: CreateUserBody,
    _admin: Annotated[str, Depends(get_current_admin)],
) -> dict[str, Any]:
    user = _create_approved_user(body)
    return {"ok": "true", "user": user}


@app.post("/api/auth/forgot-password")
def forgot_password(body: ForgotPasswordBody) -> dict[str, Any]:
    email = normalize_email(str(body.email))
    row = get_user_by_email(email)
    if (
        not row
        or not row["password_hash"]
        or str(row["status"] or "") != "approved"
    ):
        return {"ok": "true", "message": FORGOT_PASSWORD_MESSAGE, "delivery": "none"}

    username = str(row["username"])
    display = str(row["display_name"] or username)
    temp_password = generate_temporary_password()

    try:
        delivery = send_password_reset_email(email, display, temp_password)
    except EmailDeliveryError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    update_user(
        username,
        password_hash=hash_password(temp_password),
        must_change_password=True,
    )
    updated = get_user_by_username(username)
    if not updated or not verify_password(temp_password, str(updated["password_hash"])):
        raise HTTPException(
            status_code=500,
            detail="Password reset failed to save. Try again or contact your admin.",
        )
    delete_sessions_for_user(username)

    response: dict[str, Any] = {
        "ok": "true",
        "message": FORGOT_PASSWORD_MESSAGE,
        "delivery": delivery,
    }
    if delivery != "smtp":
        response["message"] = FORGOT_PASSWORD_DEV_MESSAGE
        response["temporaryPassword"] = temp_password
    return response


@app.post("/api/auth/login")
def login(body: LoginBody) -> dict[str, Any]:
    email = normalize_email(str(body.email))
    password = body.password.strip()
    row = get_user_by_email(email)
    if not row or not row["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(password, str(row["password_hash"])):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    status = str(row["status"] or "pending")
    if status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Account pending admin approval. Please wait until an admin grants access.",
        )
    if status == "rejected":
        raise HTTPException(status_code=403, detail="Account access was not approved.")
    if status != "approved":
        raise HTTPException(status_code=403, detail="Account is not active.")
    return _issue_session(str(row["username"]))


@app.post("/api/auth/logout")
def logout(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    try:
        token = _bearer_token(authorization)
        delete_session(token)
    except HTTPException:
        pass
    return {"ok": "true"}


@app.get("/api/auth/me")
def me(
    authorization: Annotated[str | None, Header()] = None,
    x_coloradogolf_api_key: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _check_api_key(x_coloradogolf_api_key)
    token = _bearer_token(authorization)
    username = resolve_session(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    row = get_user_by_username(username)
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return _user_public(row)


@app.post("/api/auth/change-password")
def change_password(
    body: ChangePasswordBody,
    user: Annotated[str, Depends(get_current_user)],
) -> dict[str, Any]:
    row = get_user_by_username(user)
    if not row or not row["password_hash"]:
        raise HTTPException(status_code=401, detail="User not found")
    if not verify_password(body.currentPassword.strip(), str(row["password_hash"])):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    new_password = body.newPassword.strip()
    if body.currentPassword.strip() == new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from your current password.",
        )
    try:
        validate_password(new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    update_user(
        user,
        password_hash=hash_password(new_password),
        must_change_password=False,
    )
    updated = get_user_by_username(user)
    return {"ok": "true", "user": _user_public(updated)}


@app.get("/api/admin/users/approved")
def admin_list_approved_users(
    _admin: Annotated[str, Depends(get_current_admin)],
) -> dict[str, Any]:
    return {"users": list_approved_users()}


@app.patch("/api/admin/users/{username}")
def admin_update_user(
    username: str,
    body: UpdateUserBody,
    _admin: Annotated[str, Depends(get_current_admin)],
) -> dict[str, Any]:
    row = get_user_by_username(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if str(row["status"]) != "approved":
        raise HTTPException(status_code=400, detail="Only approved players can be edited")

    try:
        email = normalize_email(str(body.email))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    other = get_user_by_email(email)
    if other and str(other["username"]) != username:
        raise HTTPException(status_code=409, detail="Email already registered")

    display = body.displayName.strip()
    if not display:
        raise HTTPException(status_code=400, detail="Display name is required")

    make_admin = body.isAdmin or (
        row["email"] and normalize_email(str(row["email"])) in ADMIN_EMAILS
    )
    password_hash = None
    if body.password:
        try:
            validate_password(body.password)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        password_hash = hash_password(body.password)

    try:
        handicap = parse_handicap(body.handicap)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    update_user(
        username,
        email=email,
        display_name=display,
        password_hash=password_hash,
        is_admin=make_admin,
        must_change_password=True if password_hash else None,
        handicap=handicap,
    )
    updated = get_user_by_username(username)
    return {"ok": "true", "user": _user_public(updated)}


@app.get("/api/admin/users/pending")
def admin_list_pending(
    _admin: Annotated[str, Depends(get_current_admin)],
) -> dict[str, Any]:
    return {"pending": list_pending_users()}


@app.post("/api/admin/users/{username}/approve")
def admin_approve_user(
    username: str,
    admin: Annotated[str, Depends(get_current_admin)],
) -> dict[str, str]:
    row = get_user_by_username(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if str(row["status"]) != "pending":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    if count_approved_users() >= MAX_USERS:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot approve: tour is full ({MAX_USERS} approved accounts).",
        )
    set_user_status(username, "approved")
    return {"ok": "true", "username": username, "approvedBy": admin}


@app.post("/api/admin/users/{username}/reject")
def admin_reject_user(
    username: str,
    admin: Annotated[str, Depends(get_current_admin)],
) -> dict[str, str]:
    row = get_user_by_username(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if str(row["status"]) != "pending":
        raise HTTPException(status_code=400, detail="User is not pending approval")
    set_user_status(username, "rejected")
    return {"ok": "true", "username": username, "rejectedBy": admin}


@app.get("/api/state")
def get_state(user: Annotated[str, Depends(get_current_active_user)]) -> dict[str, Any]:
    members = list_approved_users()
    payload: dict[str, Any] = {
        "users": load_users(),
        "members": members,
        "progressByUser": load_progress_by_user(),
        "customCourses": load_custom_courses(),
        "courseHoleCounts": load_course_hole_counts(),
        "courseHoleSss": load_course_hole_sss(),
        "courseHolePars": load_course_hole_pars(),
        "courseHoleStrokeIndex": load_course_hole_stroke_index(),
        "courseRatings": load_course_whs_ratings(),
        "handicapByUser": handicap_payload_for_state(),
    }
    if is_user_admin(user):
        payload["players"] = members
    return payload


@app.patch("/api/progress")
def patch_progress(
    body: ProgressPatch,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, str]:
    patch = body.entry.model_dump(exclude_none=True)
    existing = load_progress_by_user().get(user, {}).get(body.courseId, {})
    merged = {**existing, **patch}
    has_scores = bool(merged.get("holeScores"))
    if (
        not merged.get("played")
        and not merged.get("fieldOverrides")
        and not merged.get("customName")
        and not has_scores
    ):
        delete_progress_entry(user, body.courseId)
    else:
        upsert_progress(user, body.courseId, merged)
        if has_scores:
            try_post_round_from_progress(user, body.courseId, merged)
    return {"ok": "true", "user": user}


@app.patch("/api/courses/{course_id}/hole-count")
def patch_course_hole_count(
    course_id: str,
    body: CourseHoleCountBody,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, Any]:
    if body.holeCount not in (9, 18, 27):
        raise HTTPException(status_code=400, detail="holeCount must be 9, 18, or 27")
    try:
        upsert_course_hole_count(course_id, body.holeCount, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"ok": "true", "courseId": course_id, "holeCount": body.holeCount}


@app.patch("/api/courses/{course_id}/ratings")
def patch_course_whs_ratings(
    course_id: str,
    body: CourseWhsRatingsBody,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, Any]:
    if body.holeCount not in (9, 18, 27):
        raise HTTPException(status_code=400, detail="holeCount must be 9, 18, or 27")
    try:
        upsert_course_whs_ratings(
            course_id,
            body.holeCount,
            body.par,
            body.courseRating,
            body.slopeRating,
            user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": "true",
        "courseId": course_id,
        "par": body.par,
        "courseRating": body.courseRating,
        "slopeRating": body.slopeRating,
    }


@app.patch("/api/courses/{course_id}/hole-sss")
def patch_course_hole_sss(
    course_id: str,
    body: CourseHoleSssBody,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, Any]:
    if body.holeCount not in (9, 18, 27):
        raise HTTPException(status_code=400, detail="holeCount must be 9, 18, or 27")
    try:
        upsert_course_hole_sss(course_id, body.holeCount, body.holeSss, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": "true",
        "courseId": course_id,
        "holeCount": body.holeCount,
        "holeSss": body.holeSss,
    }


@app.patch("/api/courses/{course_id}/hole-pars")
def patch_course_hole_pars(
    course_id: str,
    body: CourseHoleParsBody,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, Any]:
    if body.holeCount not in (9, 18, 27):
        raise HTTPException(status_code=400, detail="holeCount must be 9, 18, or 27")
    try:
        upsert_course_hole_pars(course_id, body.holeCount, body.holePars, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": "true",
        "courseId": course_id,
        "holeCount": body.holeCount,
        "holePars": body.holePars,
    }


@app.patch("/api/courses/{course_id}/hole-stroke-index")
def patch_course_hole_stroke_index(
    course_id: str,
    body: CourseHoleStrokeIndexBody,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, Any]:
    if body.holeCount not in (9, 18, 27):
        raise HTTPException(status_code=400, detail="holeCount must be 9, 18, or 27")
    try:
        upsert_course_hole_stroke_index(
            course_id, body.holeCount, body.holeStrokeIndex, user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": "true",
        "courseId": course_id,
        "holeCount": body.holeCount,
        "holeStrokeIndex": body.holeStrokeIndex,
    }


@app.put("/api/custom-courses")
def put_custom_courses(
    body: CustomCoursesBody,
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, str]:
    replace_custom_courses(body.courses, user)
    return {"ok": "true"}


@app.post("/api/custom-courses")
def post_custom_course(
    course: dict[str, Any],
    user: Annotated[str, Depends(get_current_active_user)],
) -> dict[str, str]:
    if not course.get("id"):
        raise HTTPException(status_code=400, detail="course.id required")
    upsert_custom_course(course, user)
    return {"ok": "true", "id": str(course["id"])}
