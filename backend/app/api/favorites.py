from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.listings import FavoriteIds, ListingPage
from app.services import favorites as favorite_service

router = APIRouter(tags=["favorites"])


@router.get("/me/favorites/ids", response_model=FavoriteIds)
def favorite_ids(db: DbDep, user: CurrentUser):
    return {"ids": favorite_service.ids(db, user.id)}


@router.get("/me/favorites", response_model=ListingPage)
def favorites(
    db: DbDep,
    user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=48)] = 12,
):
    return favorite_service.page(db, user.id, page, page_size)


@router.put("/me/favorites/{listing_id}", status_code=204)
def save_favorite(listing_id: str, db: DbDep, user: CurrentUser):
    favorite_service.add(db, user.id, listing_id)


@router.delete("/me/favorites/{listing_id}", status_code=204)
def unsave_favorite(listing_id: str, db: DbDep, user: CurrentUser):
    favorite_service.remove(db, user.id, listing_id)
