from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db import models
from app.db.database import get_db
from app.schemas import StaffCreate, Token, UserCreate, UserOut, UserUpdate
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Public self-registration — always creates a 'patient' account."""
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="patient",
    )
    db.add(user)
    db.flush()

    profile = models.PatientProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "user_id": user.id, "role": user.role})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/create-staff", response_model=UserOut)
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_roles("admin")),
):
    """Admin-only: create doctor or admin accounts."""
    if payload.role not in ("doctor", "admin"):
        raise HTTPException(status_code=400, detail="role must be 'doctor' or 'admin'")

    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": user.email, "user_id": user.id, "role": user.role})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: models.User = Depends(require_roles("admin", "doctor", "patient"))):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)

    if "email" in updates and updates["email"] != user.email:
        existing = db.query(models.User).filter(models.User.email == updates["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="An account with this email already exists")

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
