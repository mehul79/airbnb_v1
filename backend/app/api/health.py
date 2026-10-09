from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbDep

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: DbDep):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
