"""Management commands.

    python -m app.cli create-admin          create or promote an administrator
    python -m app.cli seed-demo             load fictional demo data
    python -m app.cli purge-demo            remove all demo data
    python -m app.cli cleanup               delete expired sessions / reset tokens
"""
import argparse
import getpass
import os
import secrets
import sys

from pydantic import TypeAdapter, EmailStr, ValidationError
from sqlalchemy import delete, select

from .core.db import SessionLocal
from .core.security import hash_password
from .models import PasswordResetToken, User, UserRole, UserSession, utcnow
from .services.audit import log_action


def create_admin(args) -> int:
    email = (args.email or input("E-Mail-Adresse: ")).strip().lower()
    try:
        TypeAdapter(EmailStr).validate_python(email)
    except ValidationError:
        print("Ungültige E-Mail-Adresse.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            # The password is never passed as a command line argument (shell history).
            password = os.environ.get("RS_ADMIN_PASSWORD")
            if not password:
                password = getpass.getpass("Passwort (mind. 12 Zeichen): ")
                if password != getpass.getpass("Passwort wiederholen: "):
                    print("Die Passwörter stimmen nicht überein.", file=sys.stderr)
                    return 1
            if len(password) < 12:
                print("Das Passwort muss mindestens 12 Zeichen lang sein.", file=sys.stderr)
                return 1
            user = User(email=email, password_hash=hash_password(password),
                        display_name=args.name or "Administration", roles=[UserRole(role="buyer")])
            db.add(user)
            db.flush()
            print(f"Konto {email} wurde angelegt.")
        if user.has_role("admin"):
            print(f"{email} ist bereits Administrator.")
            return 0
        user.roles.append(UserRole(role="admin"))
        user.is_active = True
        log_action(db, None, "user.grant_admin", "user", user.id, {"email": email, "via": "cli"})
        db.commit()
        print(f"{email} hat jetzt Administratorrechte.")
    return 0


def seed_demo(args) -> int:
    from .services.demo_seed import seed_demo as run

    password = os.environ.get("RS_DEMO_PASSWORD") or secrets.token_urlsafe(9) + "7a"
    with SessionLocal() as db:
        result = run(db, password)
    print(f"{result['boats']} fiktive Demo-Inserate und {result['users']} Demo-Konten wurden angelegt.")
    print("Demo-Konten (alle mit demselben Passwort):")
    for email in result["accounts"]:
        print(f"  {email}")
    print(f"Passwort: {password}")
    return 0


def purge_demo(args) -> int:
    from .services.demo_seed import purge_demo as run

    with SessionLocal() as db:
        print(f"{run(db)} Demo-Inserate samt Demo-Konten entfernt.")
    return 0


def cleanup(args) -> int:
    with SessionLocal() as db:
        a = db.execute(delete(UserSession).where(UserSession.expires_at < utcnow())).rowcount
        b = db.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at < utcnow())).rowcount
        db.commit()
    print(f"{a} abgelaufene Sitzungen und {b} Reset-Tokens entfernt.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="REFURBED SAIL Verwaltung")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-admin", help="Administrator anlegen oder bestehendes Konto befördern")
    p.add_argument("--email")
    p.add_argument("--name")
    p.set_defaults(func=create_admin)
    sub.add_parser("seed-demo", help="Fiktive Demodaten laden").set_defaults(func=seed_demo)
    sub.add_parser("purge-demo", help="Demodaten entfernen").set_defaults(func=purge_demo)
    sub.add_parser("cleanup", help="Abgelaufene Sitzungen entfernen").set_defaults(func=cleanup)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
