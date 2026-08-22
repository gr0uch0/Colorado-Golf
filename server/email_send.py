from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger("coloradogolf.email")

APP_NAME = os.environ.get("COLORADOGOLF_APP_NAME", "The Colorado Golf Tour")


class EmailDeliveryError(Exception):
    pass


def smtp_configured() -> bool:
    return bool(os.environ.get("COLORADOGOLF_SMTP_HOST", "").strip())


def dev_log_enabled() -> bool:
    raw = os.environ.get("COLORADOGOLF_EMAIL_DEV_LOG", "").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    if raw in ("1", "true", "yes"):
        return True
    # Default: log to console when SMTP is not configured (local development).
    return not smtp_configured()


def _log_dev_password_reset(to_email: str, display_name: str, temporary_password: str) -> None:
    logger.warning(
        "[DEV] Password reset for %s (%s): %s",
        to_email,
        display_name,
        temporary_password,
    )
    print(
        f"[ColoradoGolf DEV] Password reset email for {to_email}\n"
        f"  Temporary password: {temporary_password}\n",
        flush=True,
    )


def send_password_reset_email(
    to_email: str,
    display_name: str,
    temporary_password: str,
) -> str:
    """Send reset email via SMTP, or log to console in dev. Returns delivery mode."""
    subject = f"{APP_NAME} — temporary password"
    greeting = display_name.strip() or "there"
    body = (
        f"Hi {greeting},\n\n"
        f"A temporary password was requested for your tour account.\n\n"
        f"Temporary password: {temporary_password}\n\n"
        "Log in with this password. You will be asked to choose a new password "
        "before you can use the app.\n\n"
        "If you did not request this, contact your tour admin.\n"
    )

    if smtp_configured():
        _send_smtp(to_email, subject, body)
        return "smtp"

    if dev_log_enabled():
        _log_dev_password_reset(to_email, display_name, temporary_password)
        return "dev_console"

    raise EmailDeliveryError(
        "Email is not configured on this server. Set COLORADOGOLF_SMTP_* variables "
        "or COLORADOGOLF_EMAIL_DEV_LOG=1 for local development."
    )


def _send_smtp(to_email: str, subject: str, body: str) -> None:
    host = os.environ["COLORADOGOLF_SMTP_HOST"].strip()
    port = int(os.environ.get("COLORADOGOLF_SMTP_PORT", "587"))
    user = os.environ.get("COLORADOGOLF_SMTP_USER", "").strip()
    password = os.environ.get("COLORADOGOLF_SMTP_PASSWORD", "")
    from_addr = os.environ.get("COLORADOGOLF_SMTP_FROM", user or "noreply@coloradogolf")
    use_tls = os.environ.get("COLORADOGOLF_SMTP_USE_TLS", "true").strip().lower() in (
        "1",
        "true",
        "yes",
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    try:
        if use_tls:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
    except OSError as e:
        logger.exception("SMTP delivery failed for %s", to_email)
        raise EmailDeliveryError("Could not send email. Try again later.") from e
