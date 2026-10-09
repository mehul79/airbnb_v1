"""Fixed vocabularies. The database CHECK constraints and the API validation both read these."""
from enum import StrEnum


class PropertyType(StrEnum):
    APARTMENT = "apartment"
    HOUSE = "house"
    VILLA = "villa"
    COTTAGE = "cottage"
    CABIN = "cabin"
    GUESTHOUSE = "guesthouse"
    FARMHOUSE = "farmhouse"
    HOUSEBOAT = "houseboat"


# One curated browse tag per listing (the strip under the search bar).
class Category(StrEnum):
    BEACHFRONT = "beachfront"
    POOLS = "pools"
    CABINS = "cabins"
    AMAZING_VIEWS = "amazing_views"
    COUNTRYSIDE = "countryside"
    LAKEFRONT = "lakefront"
    DESIGN = "design"
    MANSIONS = "mansions"
    TINY_HOMES = "tiny_homes"
    TRENDING = "trending"


class PhotoSource(StrEnum):
    UNSPLASH = "unsplash"
    CLOUDINARY = "cloudinary"
    URL = "url"


def sql_in(enum: type[StrEnum]) -> str:
    """'a', 'b', ... for use inside a CHECK (col IN (...)) constraint."""
    return ", ".join(f"'{m.value}'" for m in enum)
