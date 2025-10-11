"""IntelHub backend service with DynamoDB persistence."""

from __future__ import annotations

import logging
import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterable, Protocol
from uuid import uuid4

from typing_extensions import Literal

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel, Field, HttpUrl, validator

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DYNAMODB_ENDPOINT = os.getenv("DYNAMODB_ENDPOINT")
TABLE_NAME = os.getenv("TABLE_NAME", "IntelHubCompetitors")
WISHLIST_TABLE_NAME = os.getenv("WISHLIST_TABLE_NAME", "IntelHubWishlist")
VENDORS_TABLE_NAME = os.getenv("VENDORS_TABLE_NAME", "IntelHubVendors")
MASTER_PRODUCTS_TABLE_NAME = os.getenv("MASTER_PRODUCTS_TABLE_NAME", "IntelHubMasterProducts")
TAGS_TABLE_NAME = os.getenv("TAGS_TABLE_NAME", "IntelHubTags")
TAG_INDEX_TABLE_NAME = os.getenv("TAG_INDEX_TABLE_NAME", "IntelHubTagIndex")


class Competitor(BaseModel):
    """Represents a tracked competitor and their social metrics."""

    business_name: str = Field(..., min_length=1)
    website_url: str | None = None
    country: str | None = None
    city: str | None = None
    categories: list[str] = Field(default_factory=list)
    price_range: str | None = None
    whatsapp_link: str | None = None
    instagram_handle: str | None = None
    instagram_url: str | None = None
    instagram_followers: int | None = Field(default=None, ge=0)
    facebook_url: str | None = None
    facebook_followers: int | None = Field(default=None, ge=0)
    youtube_url: str | None = None
    youtube_subscribers: int | None = Field(default=None, ge=0)
    tiktok_url: str | None = None
    tiktok_followers: int | None = Field(default=None, ge=0)
    twitter_url: str | None = None
    twitter_followers: int | None = Field(default=None, ge=0)
    email: str | None = None
    phone: str | None = None
    stores_count: int | None = Field(default=None, ge=0)
    marketplaces: list[str] = Field(default_factory=list)
    primary_platform: Literal["shopify", "woocommerce", "amazon", "etsy", "custom"] | None = None
    avg_delivery_time_days: int | None = Field(default=None, ge=0)
    return_policy_days: int | None = Field(default=None, ge=0)
    cod_available: bool | None = None
    gift_packaging: bool | None = None
    shipping_regions: list[str] = Field(default_factory=list)
    newsletter_url: str | None = None
    blog_url: str | None = None
    last_post_date_ig: date | None = None
    last_post_date_fb: date | None = None
    post_frequency_ig_per_week: int | None = Field(default=None, ge=0)
    top_hashtags: list[str] = Field(default_factory=list)
    brand_keywords: list[str] = Field(default_factory=list)
    domain_authority: int | None = Field(default=None, ge=0)
    monthly_visits_est: int | None = Field(default=None, ge=0)
    top_traffic_sources: list[str] = Field(default_factory=list)
    top_geo_markets: list[str] = Field(default_factory=list)
    flagship_product_name: str | None = None
    flagship_product_price: int | None = Field(default=None, ge=0)
    avg_basket_price_est: int | None = Field(default=None, ge=0)
    stack_cdn: str | None = None
    stack_analytics: list[str] = Field(default_factory=list)
    stack_marketing: list[str] = Field(default_factory=list)
    stack_chat: str | None = None
    founder_name: str | None = None
    support_email: str | None = None
    brand_notes: str | None = None
    intel_score: int | None = Field(default=None, ge=0, le=100)
    priority: Literal["low", "med", "high"] | None = None
    watchlist: bool = False
    tags: list[str] = Field(default_factory=list)


WishlistStatus = Literal["planned", "sourcing", "ordered", "procured", "abandoned"]
WishlistPriority = Literal["low", "medium", "high"]


class WishlistBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    reference_urls: list[HttpUrl] = Field(default_factory=list)
    images: list[HttpUrl] = Field(default_factory=list)
    source_platforms: list[str] = Field(default_factory=list)
    competitors: list[str] = Field(default_factory=list)
    vendor_id: str | None = None
    master_product_id: str | None = None
    status: WishlistStatus = "planned"
    price_target: float | None = Field(default=None, ge=0)
    price_actual: float | None = Field(default=None, ge=0)
    tags: list[str] = Field(default_factory=list)
    priority: WishlistPriority = "medium"
    notes: str | None = None


class WishlistCreate(WishlistBase):
    pass


class WishlistItem(WishlistBase):
    wish_id: str
    created_at: str
    updated_at: str


class MasterProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str | None = None
    product_type: str | None = None
    metal: str | None = None


class MasterProductCreate(MasterProductBase):
    pass


class MasterProduct(MasterProductBase):
    product_id: str
    created_at: str
    updated_at: str


class VendorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    website_url: HttpUrl | None = None
    whatsapp_link: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    country: str | None = None
    catalog_urls: list[str] = Field(default_factory=list)
    lead_time_days: int | None = Field(default=None, ge=0)
    moq_units: int | None = Field(default=None, ge=0)
    payment_terms: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None

    @validator("whatsapp_link", "phone")
    def validate_ten_digit_phone(cls, value):
        if value is None:
            return value
        digits = re.sub(r"\D", "", value)
        if len(digits) < 10:
            raise ValueError("must contain at least 10 digits")
        return digits[-10:]


class VendorCreate(VendorBase):
    pass


class Vendor(VendorBase):
    vendor_id: str
    created_at: str
    updated_at: str


TagCategory = Literal[
    "material",
    "motif",
    "style",
    "occasion",
    "color",
    "technique",
    "region",
    "trend",
    "price-band",
    "other",
]

TagStatus = Literal["active", "draft", "deprecated"]

EntityType = Literal["competitor", "wishlist", "vendor", "influencer", "master-product"]


class TagBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    category: TagCategory = "other"
    aliases: list[str] = Field(default_factory=list)
    parent_slug: str | None = None
    description: str | None = None


class Tag(TagBase):
    tag_slug: str = Field(..., min_length=1)
    status: TagStatus = "draft"
    created_at: str
    updated_at: str


class TagCreate(TagBase):
    status: TagStatus = "draft"


class TagUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=50)
    category: TagCategory | None = None
    parent_slug: str | None = Field(default=None)
    description: str | None = None


class TagStatusPatch(BaseModel):
    status: TagStatus


class TagAliasRequest(BaseModel):
    tag_slug: str
    alias: str


class TagResolveRequest(BaseModel):
    input: str


class TagMergeRequest(BaseModel):
    source_slug: str
    target_slug: str


class TagAssignmentRequest(BaseModel):
    entity_type: EntityType
    entity_id: str
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class TagSummary(Tag):
    usage_count: int = 0


class TagIndexRecord(BaseModel):
    tag_slug: str
    entity_type: EntityType
    entity_id: str
    created_at: str


class TagResolveResponse(BaseModel):
    tag: Tag
    created: bool


class TagMergeResult(BaseModel):
    target: Tag
    source: Tag
    updated_counts: dict[str, int]


class TagCount(BaseModel):
    tag: Tag
    count: int


class TagCategoryCount(BaseModel):
    category: TagCategory
    count: int


class WishlistStatusPatch(BaseModel):
    status: WishlistStatus
    price_actual: float | None = Field(default=None, ge=0)


class WishlistVendorPatch(BaseModel):
    vendor_id: str | None = None


class WishlistCompetitorPatch(BaseModel):
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class WishlistMasterProductPatch(BaseModel):
    master_product_id: str | None = None


DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:4173",
]


def _dedupe(sequence: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in sequence:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


_configured_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

ALLOWED_ORIGINS = _dedupe(_configured_origins or DEFAULT_ALLOWED_ORIGINS)

ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"https?://(localhost|127\.0\.0\.1)(:\\d+)?$",
)


app = FastAPI(title="IntelHub API", version="0.2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decimalify(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_decimalify(item) for item in value]
    if isinstance(value, dict):
        return {key: _decimalify(val) for key, val in value.items() if val is not None}
    return value


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    from decimal import Decimal as _Decimal

    def _convert(val: Any) -> Any:
        if isinstance(val, bool):
            return val
        if isinstance(val, _Decimal):
            return int(val) if val % 1 == 0 else float(val)
        if isinstance(val, list):
            return [_convert(elem) for elem in val]
        if isinstance(val, dict):
            return {k: _convert(v) for k, v in val.items()}
        return val

    data = {key: _convert(value) for key, value in item.items()}
    data.setdefault("tags", [])
    return data


def _normalize_wishlist_item(item: dict[str, Any]) -> dict[str, Any]:
    data = _normalize_item(item)
    for field in [
        "reference_urls",
        "images",
        "source_platforms",
        "competitors",
        "tags",
    ]:
        if field not in data or data[field] is None:
            data[field] = []
    data.setdefault("vendor_id", None)
    data.setdefault("master_product_id", None)
    data.setdefault("price_target", None)
    data.setdefault("price_actual", None)
    data.setdefault("notes", None)
    data.setdefault("priority", "medium")
    data.setdefault("status", "planned")
    return data


def _normalize_vendor_item(item: dict[str, Any]) -> dict[str, Any]:
    data = _normalize_item(item)
    for field in ["catalog_urls", "tags"]:
        if field not in data or data[field] is None:
            data[field] = []
    data.setdefault("notes", None)
    return data


def _normalize_master_product_item(item: dict[str, Any]) -> dict[str, Any]:
    data = _normalize_item(item)
    data.setdefault("description", None)
    data.setdefault("product_type", None)
    data.setdefault("metal", None)
    return data


def _serialize_competitor(model: Competitor) -> dict[str, Any]:
    raw = model.model_dump(exclude_none=True)
    list_fields = {
        "categories",
        "marketplaces",
        "shipping_regions",
        "top_hashtags",
        "brand_keywords",
        "top_traffic_sources",
        "top_geo_markets",
        "stack_analytics",
        "stack_marketing",
        "tags",
    }
    for field in list_fields:
        if field not in raw or raw[field] is None:
            raw[field] = []
    return {key: _decimalify(value) for key, value in raw.items() if value is not None}


def _serialize_wishlist(model: WishlistItem) -> dict[str, Any]:
    raw = model.model_dump()
    for field in [
        "reference_urls",
        "images",
        "source_platforms",
        "competitors",
        "tags",
    ]:
        raw.setdefault(field, [])
    raw.setdefault("master_product_id", None)
    return {key: _decimalify(value) for key, value in raw.items() if value is not None}


def _serialize_vendor(model: Vendor) -> dict[str, Any]:
    raw = model.model_dump()
    raw.setdefault("catalog_urls", [])
    raw.setdefault("tags", [])
    return {key: _decimalify(value) for key, value in raw.items() if value is not None}


def _serialize_master_product(model: MasterProduct) -> dict[str, Any]:
    raw = model.model_dump()
    return {key: _decimalify(value) for key, value in raw.items() if value is not None}


def _clone_competitor(model: Competitor) -> Competitor:
    return Competitor(**model.model_dump())


_SLUG_INVALID_RE = re.compile(r"[^a-z0-9]+")


def _slugify_tag(value: str) -> str:
    cleaned = (value or "").strip().lower()
    cleaned = _SLUG_INVALID_RE.sub("-", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned)
    cleaned = cleaned.strip("-")
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag slug cannot be empty")
    return cleaned


def _normalize_aliases(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    aliases: list[str] = []
    for value in values or []:
        cleaned = " ".join((value or "").strip().split())
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        aliases.append(cleaned)
    return aliases


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_tag_item(item: dict[str, Any]) -> dict[str, Any]:
    aliases = item.get("aliases") or []
    normalized = {
        "tag_slug": item.get("tag_slug"),
        "display_name": item.get("display_name"),
        "category": item.get("category", "other"),
        "aliases": _normalize_aliases(aliases),
        "status": item.get("status", "draft"),
        "parent_slug": item.get("parent_slug"),
        "description": item.get("description"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }
    return normalized


def _serialize_tag(model: Tag) -> dict[str, Any]:
    payload = model.model_dump()
    payload["aliases"] = _normalize_aliases(payload.get("aliases", []))
    return payload


def _ensure_tag_alias_uniqueness(
    alias: str,
    *,
    tag_repo: "TagRepository",
    exclude_slug: str | None = None,
) -> None:
    normalized_alias = alias.strip().lower()
    if not normalized_alias:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alias cannot be empty")
    for tag in tag_repo.list_tags():
        if exclude_slug and tag.tag_slug == exclude_slug:
            continue
        if normalized_alias in {existing.lower() for existing in tag.aliases}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Alias already mapped to tag '{tag.tag_slug}'",
            )


def _collect_entity_tags(
    *,
    entity_type: EntityType | None,
    competitor_repo: "CompetitorRepository",
    wishlist_repo: "WishlistRepository",
    vendor_repo: "VendorRepository",
) -> dict[str, list[str]]:
    """Return mapping of entity key -> tag list for requested entity type."""

    results: dict[str, list[str]] = {}

    if entity_type in (None, "competitor"):
        for competitor in competitor_repo.list_competitors():
            results[f"competitor#{competitor.business_name}"] = competitor.tags or []

    if entity_type in (None, "wishlist"):
        for wish in wishlist_repo.list_wishlist():
            results[f"wishlist#{wish.wish_id}"] = wish.tags or []

    if entity_type in (None, "vendor"):
        for vendor in vendor_repo.list_vendors():
            results[f"vendor#{vendor.vendor_id}"] = vendor.tags or []

    if entity_type == "influencer":
        # Influencer entities are not yet implemented in the backend.
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Influencer tagging is not yet supported")

    return results


def _make_entity_key(entity_type: EntityType, entity_id: str) -> str:
    return f"{entity_type}#{entity_id}"


def _parse_entity_key(key: str) -> tuple[EntityType, str]:
    if "#" not in key:
        raise ValueError("Invalid tag index key")
    entity_type, entity_id = key.split("#", 1)
    return entity_type, entity_id


def _resolve_or_create_tag(value: str, *, tag_repo: "TagRepository") -> tuple[Tag, bool]:
    candidate = (value or "").strip()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag value cannot be empty")

    slug = _slugify_tag(candidate)
    try:
        existing = tag_repo.get_tag(slug)
        return existing, False
    except HTTPException as exc:
        if exc.status_code != status.HTTP_404_NOT_FOUND:
            raise

    lowered_candidate = candidate.lower()
    for tag in tag_repo.list_tags():
        alias_matches = lowered_candidate in {alias.lower() for alias in tag.aliases}
        if alias_matches:
            return tag, False

    now = _now_iso()
    display_name = candidate.title()
    new_tag = Tag(
        tag_slug=slug,
        display_name=display_name,
        category="other",
        aliases=[],
        status="draft",
        parent_slug=None,
        description=None,
        created_at=now,
        updated_at=now,
    )
    created = tag_repo.create_tag(new_tag)
    return created, True


def _normalize_vendor_tags(payload: VendorBase, *, tag_repo: "TagRepository") -> VendorBase:
    normalized_slugs: list[str] = []
    for raw_value in payload.tags or []:
        candidate = (raw_value or "").strip()
        if not candidate:
            continue
        tag, _created = _resolve_or_create_tag(candidate, tag_repo=tag_repo)
        normalized_slugs.append(tag.tag_slug)

    if normalized_slugs == (payload.tags or []):
        return payload

    return payload.model_copy(update={"tags": normalized_slugs})


def _compute_tag_usage_counts(
    *,
    entity_type: EntityType | None,
    competitor_repo: "CompetitorRepository",
    wishlist_repo: "WishlistRepository",
    vendor_repo: "VendorRepository",
) -> Counter:
    usage = Counter()
    mapping = _collect_entity_tags(
        entity_type=entity_type,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )
    for tags in mapping.values():
        for tag in tags or []:
            usage[tag] += 1
    return usage


def _ensure_tags_exist(
    slugs: Iterable[str],
    *,
    tag_repo: "TagRepository",
    allowed_statuses: set[TagStatus] | None = None,
) -> list[Tag]:
    allowed = allowed_statuses or {"active", "draft"}
    resolved: list[Tag] = []
    for slug in slugs:
        try:
            tag = tag_repo.get_tag(slug)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown tag '{slug}'")
            raise
        if tag.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag '{slug}' is {tag.status} and cannot be assigned",
            )
        resolved.append(tag)
    return resolved


def _update_entity_tags(
    *,
    entity_type: EntityType,
    entity_id: str,
    tags: list[str],
    competitor_repo: "CompetitorRepository",
    wishlist_repo: "WishlistRepository",
    vendor_repo: "VendorRepository",
) -> Any:
    normalized_tags = _dedupe_preserve_order([tag for tag in tags if tag])
    if entity_type == "competitor":
        competitor = competitor_repo.get_competitor(entity_id)
        updated = competitor.copy(update={"tags": normalized_tags})
        return competitor_repo.update_competitor(entity_id, updated)
    if entity_type == "wishlist":
        wish = wishlist_repo.get_wishlist(entity_id)
        updated = wish.copy(update={"tags": normalized_tags, "updated_at": _now_iso()})
        return wishlist_repo.update_wishlist(updated)
    if entity_type == "vendor":
        vendor = vendor_repo.get_vendor(entity_id)
        updated = vendor.copy(update={"tags": normalized_tags, "updated_at": _now_iso()})
        return vendor_repo.update_vendor(updated)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Influencer tagging is not yet supported")


def _sync_tag_index(
    *,
    entity_type: EntityType,
    entity_id: str,
    previous_tags: Iterable[str],
    next_tags: Iterable[str],
    tag_index_repo: "TagIndexRepository",
) -> None:
    prev_set = {slug for slug in previous_tags if slug}
    next_set = {slug for slug in next_tags if slug}
    to_add = next_set - prev_set
    to_remove = prev_set - next_set

    if to_add:
        tag_index_repo.put_records(
            [
                TagIndexRecord(
                    tag_slug=slug,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    created_at=_now_iso(),
                )
                for slug in to_add
            ]
        )

    if to_remove:
        entity_key = _make_entity_key(entity_type, entity_id)
        for slug in to_remove:
            tag_index_repo.remove_records(slug, [entity_key])


def _dynamodb_resource():
    kwargs: dict[str, Any] = {"region_name": AWS_REGION}
    if DYNAMODB_ENDPOINT:
        kwargs["endpoint_url"] = DYNAMODB_ENDPOINT
    return boto3.resource("dynamodb", **kwargs)


def _scan_all(table) -> list[dict[str, Any]]:
    paginator_items: list[dict[str, Any]] = []
    scan_kwargs: dict[str, Any] = {}

    while True:
        response = table.scan(**scan_kwargs)
        paginator_items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return paginator_items


def _ensure_table(resource, table_name: str, key_name: str) -> Any:
    table = resource.Table(table_name)
    try:
        table.load()
        logger.info("Using DynamoDB table '%s'", table_name)
        return table
    except ClientError as exc:
        error_code = exc.response["Error"].get("Code")
        if error_code != "ResourceNotFoundException":
            raise

    if not DYNAMODB_ENDPOINT:
        raise RuntimeError(
            f"Table '{table_name}' does not exist and auto-creation is disabled without DYNAMODB_ENDPOINT"
        )

    logger.info("Creating DynamoDB table '%s' at %s", table_name, DYNAMODB_ENDPOINT)
    table = resource.create_table(
        TableName=table_name,
        AttributeDefinitions=[{"AttributeName": key_name, "AttributeType": "S"}],
        KeySchema=[{"AttributeName": key_name, "KeyType": "HASH"}],
        BillingMode="PAY_PER_REQUEST",
    )

    table.meta.client.get_waiter("table_exists").wait(TableName=table_name)
    logger.info("DynamoDB table '%s' ready", table_name)
    return table


def _ensure_table_with_sort(resource, table_name: str, hash_key: str, range_key: str) -> Any:
    table = resource.Table(table_name)
    try:
        table.load()
        logger.info("Using DynamoDB table '%s'", table_name)
        return table
    except ClientError as exc:
        error_code = exc.response["Error"].get("Code")
        if error_code != "ResourceNotFoundException":
            raise

    if not DYNAMODB_ENDPOINT:
        raise RuntimeError(
            f"Table '{table_name}' does not exist and auto-creation is disabled without DYNAMODB_ENDPOINT"
        )

    logger.info("Creating DynamoDB table '%s' at %s", table_name, DYNAMODB_ENDPOINT)
    table = resource.create_table(
        TableName=table_name,
        AttributeDefinitions=[
            {"AttributeName": hash_key, "AttributeType": "S"},
            {"AttributeName": range_key, "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": hash_key, "KeyType": "HASH"},
            {"AttributeName": range_key, "KeyType": "RANGE"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )

    table.meta.client.get_waiter("table_exists").wait(TableName=table_name)
    logger.info("DynamoDB table '%s' ready", table_name)
    return table


class TagRepository(Protocol):
    def list_tags(self) -> list[Tag]:
        ...

    def get_tag(self, tag_slug: str) -> Tag:
        ...

    def create_tag(self, payload: Tag) -> Tag:
        ...

    def update_tag(self, payload: Tag) -> Tag:
        ...


class TagIndexRepository(Protocol):
    def put_records(self, records: list[TagIndexRecord]) -> None:
        ...

    def remove_records(self, tag_slug: str, entity_keys: list[str]) -> None:
        ...

    def move_records(self, source_slug: str, target_slug: str) -> None:
        ...

    def list_entity_ids(self, tag_slug: str) -> list[str]:
        ...


class CompetitorRepository(Protocol):
    def list_competitors(self) -> list[Competitor]:
        ...

    def create_competitor(self, payload: Competitor) -> Competitor:
        ...

    def get_competitor(self, business_name: str) -> Competitor:
        ...

    def update_competitor(self, business_name: str, payload: Competitor) -> Competitor:
        ...

    def delete_competitor(self, business_name: str) -> None:
        ...


class WishlistRepository(Protocol):
    def list_wishlist(self) -> list[WishlistItem]:
        ...

    def get_wishlist(self, wish_id: str) -> WishlistItem:
        ...

    def create_wishlist(self, payload: WishlistItem) -> WishlistItem:
        ...

    def update_wishlist(self, payload: WishlistItem) -> WishlistItem:
        ...

    def delete_wishlist(self, wish_id: str) -> None:
        ...


class VendorRepository(Protocol):
    def list_vendors(self) -> list[Vendor]:
        ...

    def get_vendor(self, vendor_id: str) -> Vendor:
        ...

    def create_vendor(self, payload: Vendor) -> Vendor:
        ...

    def update_vendor(self, payload: Vendor) -> Vendor:
        ...

    def delete_vendor(self, vendor_id: str) -> None:
        ...


class MasterProductRepository(Protocol):
    def list_master_products(self) -> list[MasterProduct]:
        ...

    def get_master_product(self, product_id: str) -> MasterProduct:
        ...

    def create_master_product(self, payload: MasterProduct) -> MasterProduct:
        ...

    def update_master_product(self, payload: MasterProduct) -> MasterProduct:
        ...

    def delete_master_product(self, product_id: str) -> None:
        ...


class DynamoCompetitorRepository:
    def __init__(self, table):
        self._table = table

    def list_competitors(self) -> list[Competitor]:
        paginator_items: list[dict[str, Any]] = []
        scan_kwargs: dict[str, Any] = {}

        while True:
            response = self._table.scan(**scan_kwargs)
            paginator_items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key

        return [Competitor(**_normalize_item(item)) for item in paginator_items]

    def create_competitor(self, payload: Competitor) -> Competitor:
        item = _serialize_competitor(payload)
        try:
            self._table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(business_name)",
            )
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Competitor already exists")
            raise
        return Competitor(**_normalize_item(item))

    def get_competitor(self, business_name: str) -> Competitor:
        response = self._table.get_item(Key={"business_name": business_name})
        item = response.get("Item")
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
        return Competitor(**_normalize_item(item))

    def update_competitor(self, business_name: str, payload: Competitor) -> Competitor:
        if payload.business_name != business_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business name mismatch")

        item = _serialize_competitor(payload)
        try:
            self._table.put_item(
                Item=item,
                ConditionExpression="attribute_exists(business_name)",
            )
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
            raise
        return Competitor(**_normalize_item(item))

    def delete_competitor(self, business_name: str) -> None:
        try:
            self._table.delete_item(
                Key={"business_name": business_name},
                ConditionExpression="attribute_exists(business_name)",
            )
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
            raise


class InMemoryCompetitorRepository:
    def __init__(self):
        self._storage: dict[str, Competitor] = {}

    def list_competitors(self) -> list[Competitor]:
        return [_clone_competitor(model) for model in self._storage.values()]

    def create_competitor(self, payload: Competitor) -> Competitor:
        if payload.business_name in self._storage:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Competitor already exists")
        clone = _clone_competitor(payload)
        self._storage[payload.business_name] = clone
        return _clone_competitor(clone)

    def get_competitor(self, business_name: str) -> Competitor:
        competitor = self._storage.get(business_name)
        if not competitor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
        return _clone_competitor(competitor)

    def update_competitor(self, business_name: str, payload: Competitor) -> Competitor:
        if payload.business_name != business_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business name mismatch")
        if business_name not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
        clone = _clone_competitor(payload)
        self._storage[business_name] = clone
        return _clone_competitor(clone)

    def delete_competitor(self, business_name: str) -> None:
        if business_name not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competitor not found")
        self._storage.pop(business_name, None)


class DynamoTagRepository:
    def __init__(self, table):
        self._table = table

    def list_tags(self) -> list[Tag]:
        items = _scan_all(self._table)
        return [Tag(**_normalize_tag_item(item)) for item in items]

    def get_tag(self, tag_slug: str) -> Tag:
        response = self._table.get_item(Key={"tag_slug": tag_slug})
        item = response.get("Item")
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        return Tag(**_normalize_tag_item(item))

    def create_tag(self, payload: Tag) -> Tag:
        item = _serialize_tag(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_not_exists(tag_slug)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")
            raise
        return Tag(**_normalize_tag_item(item))

    def update_tag(self, payload: Tag) -> Tag:
        item = _serialize_tag(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_exists(tag_slug)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
            raise
        return Tag(**_normalize_tag_item(item))


class InMemoryTagRepository:
    def __init__(self):
        self._storage: dict[str, Tag] = {}

    def list_tags(self) -> list[Tag]:
        return [Tag(**item.model_dump()) for item in self._storage.values()]

    def get_tag(self, tag_slug: str) -> Tag:
        item = self._storage.get(tag_slug)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        return Tag(**item.model_dump())

    def create_tag(self, payload: Tag) -> Tag:
        if payload.tag_slug in self._storage:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")
        self._storage[payload.tag_slug] = payload
        return Tag(**payload.model_dump())

    def update_tag(self, payload: Tag) -> Tag:
        if payload.tag_slug not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
        self._storage[payload.tag_slug] = payload
        return Tag(**payload.model_dump())


class DynamoTagIndexRepository:
    def __init__(self, table):
        self._table = table

    def put_records(self, records: list[TagIndexRecord]) -> None:
        if not records:
            return
        with self._table.batch_writer() as batch:
            for record in records:
                entity_key = _make_entity_key(record.entity_type, record.entity_id)
                batch.put_item(
                    Item={
                        "tag_slug": record.tag_slug,
                        "entity_key": entity_key,
                        "entity_type": record.entity_type,
                        "entity_id": record.entity_id,
                        "created_at": record.created_at,
                    }
                )

    def remove_records(self, tag_slug: str, entity_keys: list[str]) -> None:
        if not entity_keys:
            return
        with self._table.batch_writer() as batch:
            for entity_key in entity_keys:
                batch.delete_item(Key={"tag_slug": tag_slug, "entity_key": entity_key})

    def move_records(self, source_slug: str, target_slug: str) -> None:
        if source_slug == target_slug:
            return
        records = self._table.query(KeyConditionExpression=Key("tag_slug").eq(source_slug))
        items = records.get("Items", [])
        if not items:
            return
        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"tag_slug": source_slug, "entity_key": item["entity_key"]})
                batch.put_item(
                    Item={
                        "tag_slug": target_slug,
                        "entity_key": item["entity_key"],
                        "entity_type": item.get("entity_type"),
                        "entity_id": item.get("entity_id"),
                        "created_at": item.get("created_at", _now_iso()),
                    }
                )

    def list_entity_ids(self, tag_slug: str) -> list[str]:
        response = self._table.query(KeyConditionExpression=Key("tag_slug").eq(tag_slug))
        return [item["entity_key"] for item in response.get("Items", [])]


class InMemoryTagIndexRepository:
    def __init__(self):
        self._storage: dict[str, dict[str, TagIndexRecord]] = defaultdict(dict)

    def put_records(self, records: list[TagIndexRecord]) -> None:
        for record in records:
            entity_key = _make_entity_key(record.entity_type, record.entity_id)
            if record.tag_slug not in self._storage:
                self._storage[record.tag_slug] = {}
            self._storage[record.tag_slug][entity_key] = record

    def remove_records(self, tag_slug: str, entity_keys: list[str]) -> None:
        bucket = self._storage.get(tag_slug)
        if not bucket:
            return
        for entity_key in entity_keys:
            bucket.pop(entity_key, None)

    def move_records(self, source_slug: str, target_slug: str) -> None:
        if source_slug == target_slug:
            return
        bucket = self._storage.get(source_slug, {})
        if not bucket:
            return
        target_bucket = self._storage.setdefault(target_slug, {})
        for entity_key, record in bucket.items():
            target_bucket[entity_key] = TagIndexRecord(
                tag_slug=target_slug,
                entity_type=record.entity_type,
                entity_id=record.entity_id,
                created_at=record.created_at,
            )
        self._storage[source_slug] = {}

    def list_entity_ids(self, tag_slug: str) -> list[str]:
        return list(self._storage.get(tag_slug, {}).keys())

class DynamoWishlistRepository:
    def __init__(self, table):
        self._table = table

    def list_wishlist(self) -> list[WishlistItem]:
        items = _scan_all(self._table)
        return [WishlistItem(**_normalize_wishlist_item(item)) for item in items]

    def get_wishlist(self, wish_id: str) -> WishlistItem:
        response = self._table.get_item(Key={"wish_id": wish_id})
        item = response.get("Item")
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
        return WishlistItem(**_normalize_wishlist_item(item))

    def create_wishlist(self, payload: WishlistItem) -> WishlistItem:
        item = _serialize_wishlist(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_not_exists(wish_id)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Wishlist item already exists")
            raise
        return WishlistItem(**_normalize_wishlist_item(item))

    def update_wishlist(self, payload: WishlistItem) -> WishlistItem:
        item = _serialize_wishlist(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_exists(wish_id)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
            raise
        return WishlistItem(**_normalize_wishlist_item(item))

    def delete_wishlist(self, wish_id: str) -> None:
        try:
            self._table.delete_item(
                Key={"wish_id": wish_id},
                ConditionExpression="attribute_exists(wish_id)",
            )
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
            raise


class DynamoVendorRepository:
    def __init__(self, table):
        self._table = table

    def list_vendors(self) -> list[Vendor]:
        items = _scan_all(self._table)
        return [Vendor(**_normalize_vendor_item(item)) for item in items]

    def get_vendor(self, vendor_id: str) -> Vendor:
        response = self._table.get_item(Key={"vendor_id": vendor_id})
        item = response.get("Item")
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
        return Vendor(**_normalize_vendor_item(item))

    def create_vendor(self, payload: Vendor) -> Vendor:
        item = _serialize_vendor(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_not_exists(vendor_id)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vendor already exists")
            raise
        return Vendor(**_normalize_vendor_item(item))

    def update_vendor(self, payload: Vendor) -> Vendor:
        item = _serialize_vendor(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_exists(vendor_id)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
            raise
        return Vendor(**_normalize_vendor_item(item))

    def delete_vendor(self, vendor_id: str) -> None:
        try:
            self._table.delete_item(
                Key={"vendor_id": vendor_id},
                ConditionExpression="attribute_exists(vendor_id)",
            )
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
            raise


class DynamoMasterProductRepository:
    def __init__(self, table):
        self._table = table

    def list_master_products(self) -> list[MasterProduct]:
        items = _scan_all(self._table)
        normalized = [MasterProduct(**_normalize_master_product_item(item)) for item in items]
        return sorted(normalized, key=lambda entry: entry.updated_at, reverse=True)

    def get_master_product(self, product_id: str) -> MasterProduct:
        response = self._table.get_item(Key={"product_id": product_id})
        item = response.get("Item")
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master product not found")
        return MasterProduct(**_normalize_master_product_item(item))

    def create_master_product(self, payload: MasterProduct) -> MasterProduct:
        item = _serialize_master_product(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_not_exists(product_id)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Master product already exists")
            raise
        return MasterProduct(**_normalize_master_product_item(item))

    def update_master_product(self, payload: MasterProduct) -> MasterProduct:
        item = _serialize_master_product(payload)
        try:
            self._table.put_item(Item=item, ConditionExpression="attribute_exists(product_id)")
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master product not found")
            raise
        return MasterProduct(**_normalize_master_product_item(item))

    def delete_master_product(self, product_id: str) -> None:
        try:
            self._table.delete_item(
                Key={"product_id": product_id},
                ConditionExpression="attribute_exists(product_id)",
            )
        except ClientError as exc:
            if exc.response["Error"].get("Code") == "ConditionalCheckFailedException":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master product not found")
            raise


class InMemoryWishlistRepository:
    def __init__(self):
        self._storage: dict[str, WishlistItem] = {}

    def list_wishlist(self) -> list[WishlistItem]:
        return [WishlistItem(**item.model_dump()) for item in self._storage.values()]

    def get_wishlist(self, wish_id: str) -> WishlistItem:
        item = self._storage.get(wish_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
        return WishlistItem(**item.model_dump())

    def create_wishlist(self, payload: WishlistItem) -> WishlistItem:
        if payload.wish_id in self._storage:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Wishlist item already exists")
        self._storage[payload.wish_id] = payload
        return WishlistItem(**payload.model_dump())

    def update_wishlist(self, payload: WishlistItem) -> WishlistItem:
        if payload.wish_id not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
        self._storage[payload.wish_id] = payload
        return WishlistItem(**payload.model_dump())

    def delete_wishlist(self, wish_id: str) -> None:
        if wish_id not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
        self._storage.pop(wish_id, None)


class InMemoryVendorRepository:
    def __init__(self):
        self._storage: dict[str, Vendor] = {}

    def list_vendors(self) -> list[Vendor]:
        return [Vendor(**item.model_dump()) for item in self._storage.values()]

    def get_vendor(self, vendor_id: str) -> Vendor:
        item = self._storage.get(vendor_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
        return Vendor(**item.model_dump())

    def create_vendor(self, payload: Vendor) -> Vendor:
        if payload.vendor_id in self._storage:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vendor already exists")
        self._storage[payload.vendor_id] = payload
        return Vendor(**payload.model_dump())

    def update_vendor(self, payload: Vendor) -> Vendor:
        if payload.vendor_id not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
        self._storage[payload.vendor_id] = payload
        return Vendor(**payload.model_dump())

    def delete_vendor(self, vendor_id: str) -> None:
        if vendor_id not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
        self._storage.pop(vendor_id, None)


class InMemoryMasterProductRepository:
    def __init__(self):
        self._storage: dict[str, MasterProduct] = {}

    def list_master_products(self) -> list[MasterProduct]:
        products = [MasterProduct(**item.model_dump()) for item in self._storage.values()]
        return sorted(products, key=lambda entry: entry.updated_at, reverse=True)

    def get_master_product(self, product_id: str) -> MasterProduct:
        item = self._storage.get(product_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master product not found")
        return MasterProduct(**item.model_dump())

    def create_master_product(self, payload: MasterProduct) -> MasterProduct:
        if payload.product_id in self._storage:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Master product already exists")
        self._storage[payload.product_id] = payload
        return MasterProduct(**payload.model_dump())

    def update_master_product(self, payload: MasterProduct) -> MasterProduct:
        if payload.product_id not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master product not found")
        self._storage[payload.product_id] = payload
        return MasterProduct(**payload.model_dump())

    def delete_master_product(self, product_id: str) -> None:
        if product_id not in self._storage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master product not found")
        self._storage.pop(product_id, None)


def get_repository(request: Request) -> CompetitorRepository:
    repository = getattr(request.app.state, "competitor_repository", None)
    if repository is None:
        repository = InMemoryCompetitorRepository()
        request.app.state.competitor_repository = repository
        logger.warning("Competitor repository not initialised on startup; defaulting to in-memory store")
    return repository


def get_wishlist_repository(request: Request) -> WishlistRepository:
    repository = getattr(request.app.state, "wishlist_repository", None)
    if repository is None:
        repository = InMemoryWishlistRepository()
        request.app.state.wishlist_repository = repository
        logger.warning("Wishlist repository not initialised on startup; defaulting to in-memory store")
    return repository


def get_vendor_repository(request: Request) -> VendorRepository:
    repository = getattr(request.app.state, "vendor_repository", None)
    if repository is None:
        repository = InMemoryVendorRepository()
        request.app.state.vendor_repository = repository
        logger.warning("Vendor repository not initialised on startup; defaulting to in-memory store")
    return repository


def get_master_product_repository(request: Request) -> MasterProductRepository:
    repository = getattr(request.app.state, "master_product_repository", None)
    if repository is None:
        repository = InMemoryMasterProductRepository()
        request.app.state.master_product_repository = repository
        logger.warning("Master product repository not initialised on startup; defaulting to in-memory store")
    return repository


def get_tag_repository(request: Request) -> TagRepository:
    repository = getattr(request.app.state, "tag_repository", None)
    if repository is None:
        repository = InMemoryTagRepository()
        request.app.state.tag_repository = repository
        logger.warning("Tag repository not initialised on startup; defaulting to in-memory store")
    return repository


def get_tag_index_repository(request: Request) -> TagIndexRepository:
    repository = getattr(request.app.state, "tag_index_repository", None)
    if repository is None:
        repository = InMemoryTagIndexRepository()
        request.app.state.tag_index_repository = repository
        logger.warning("Tag index repository not initialised on startup; defaulting to in-memory store")
    return repository


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _validate_competitor_links(competitors: list[str], repository: CompetitorRepository) -> None:
    if not competitors:
        return
    available = {item.business_name for item in repository.list_competitors()}
    missing = [name for name in competitors if name not in available]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown competitors: {', '.join(missing)}",
        )


def _ensure_vendor_present(vendor_id: str | None, repository: VendorRepository) -> None:
    if not vendor_id:
        return
    repository.get_vendor(vendor_id)


def _ensure_master_product_present(product_id: str | None, repository: MasterProductRepository) -> None:
    if not product_id:
        return
    repository.get_master_product(product_id)


def _build_wishlist_item(
    payload: WishlistBase,
    *,
    wish_id: str | None = None,
    created_at: str | None = None,
) -> WishlistItem:
    now_iso = datetime.now(timezone.utc).isoformat()
    wish_identifier = wish_id or str(uuid4())
    created_value = created_at or now_iso

    data = payload.model_dump()
    data["competitors"] = _dedupe_preserve_order(data.get("competitors", []))
    data["tags"] = _dedupe_preserve_order(data.get("tags", []))
    data["source_platforms"] = _dedupe_preserve_order(data.get("source_platforms", []))

    master_product_id = data.get("master_product_id") or None
    if isinstance(master_product_id, str):
        master_product_id = master_product_id.strip() or None
    data["master_product_id"] = master_product_id

    if data.get("status") != "procured":
        data["price_actual"] = None

    return WishlistItem(
        wish_id=wish_identifier,
        created_at=created_value,
        updated_at=now_iso,
        **data,
    )


def _build_vendor(
    payload: VendorBase,
    *,
    vendor_id: str | None = None,
    created_at: str | None = None,
) -> Vendor:
    now_iso = datetime.now(timezone.utc).isoformat()
    vendor_identifier = vendor_id or str(uuid4())
    created_value = created_at or now_iso

    data = payload.model_dump()
    data["tags"] = _dedupe_preserve_order(data.get("tags", []))
    data["catalog_urls"] = _dedupe_preserve_order(data.get("catalog_urls", []))

    return Vendor(
        vendor_id=vendor_identifier,
        created_at=created_value,
        updated_at=now_iso,
        **data,
    )


def _build_master_product(
    payload: MasterProductBase,
    *,
    product_id: str | None = None,
    created_at: str | None = None,
) -> MasterProduct:
    now_iso = datetime.now(timezone.utc).isoformat()
    identifier = product_id or str(uuid4())
    created_value = created_at or now_iso

    data = payload.model_dump()
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product name cannot be empty")
    if isinstance(data.get("description"), str):
        data["description"] = data["description"].strip() or None
    if isinstance(data.get("product_type"), str):
        data["product_type"] = data["product_type"].strip() or None
    if isinstance(data.get("metal"), str):
        data["metal"] = data["metal"].strip() or None

    return MasterProduct(
        product_id=identifier,
        created_at=created_value,
        updated_at=now_iso,
        **data,
    )


@app.on_event("startup")
def init_repository() -> None:
    try:
        resource = _dynamodb_resource()
        competitor_table = _ensure_table(resource, TABLE_NAME, "business_name")
        wishlist_table = _ensure_table(resource, WISHLIST_TABLE_NAME, "wish_id")
        vendor_table = _ensure_table(resource, VENDORS_TABLE_NAME, "vendor_id")
        master_product_table = _ensure_table(resource, MASTER_PRODUCTS_TABLE_NAME, "product_id")
        tag_table = _ensure_table(resource, TAGS_TABLE_NAME, "tag_slug")
        tag_index_table = _ensure_table_with_sort(resource, TAG_INDEX_TABLE_NAME, "tag_slug", "entity_key")

        app.state.dynamodb_resource = resource
        app.state.dynamodb_tables = {
            "competitors": competitor_table,
            "wishlist": wishlist_table,
            "vendors": vendor_table,
            "master_products": master_product_table,
            "tags": tag_table,
            "tag_index": tag_index_table,
        }

        competitor_repo: CompetitorRepository = DynamoCompetitorRepository(competitor_table)
        wishlist_repo: WishlistRepository = DynamoWishlistRepository(wishlist_table)
        vendor_repo: VendorRepository = DynamoVendorRepository(vendor_table)
        master_product_repo: MasterProductRepository = DynamoMasterProductRepository(master_product_table)
        tag_repo: TagRepository = DynamoTagRepository(tag_table)
        tag_index_repo: TagIndexRepository = DynamoTagIndexRepository(tag_index_table)

        app.state.competitor_repository = competitor_repo
        app.state.wishlist_repository = wishlist_repo
        app.state.vendor_repository = vendor_repo
        app.state.master_product_repository = master_product_repo
        app.state.tag_repository = tag_repo
        app.state.tag_index_repository = tag_index_repo

        logger.info(
            "DynamoDB repositories initialised (tables: %s, %s, %s, %s, %s, %s)",
            TABLE_NAME,
            WISHLIST_TABLE_NAME,
            VENDORS_TABLE_NAME,
            MASTER_PRODUCTS_TABLE_NAME,
            TAGS_TABLE_NAME,
            TAG_INDEX_TABLE_NAME,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "Falling back to in-memory repositories due to DynamoDB initialisation error",
            exc_info=exc,
        )
        app.state.competitor_repository = InMemoryCompetitorRepository()
        app.state.wishlist_repository = InMemoryWishlistRepository()
        app.state.vendor_repository = InMemoryVendorRepository()
        app.state.master_product_repository = InMemoryMasterProductRepository()
        app.state.tag_repository = InMemoryTagRepository()
        app.state.tag_index_repository = InMemoryTagIndexRepository()


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Simple health check endpoint for uptime probes."""
    return {"status": "ok", "service": "intelhub-backend"}


@app.get("/tags", response_model=list[TagSummary], tags=["tags"])
def list_tags_endpoint(
    query: str | None = None,
    category: TagCategory | None = None,
    status_filter: TagStatus | None = None,
    slugs: str | None = None,
    entity_type: EntityType | None = None,
    tag_repo: TagRepository = Depends(get_tag_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> list[TagSummary]:
    tags = tag_repo.list_tags()

    requested_slugs: set[str] | None = None
    if slugs:
        requested_slugs = {slug.strip() for slug in slugs.split(",") if slug.strip()}
        tags = [tag for tag in tags if tag.tag_slug in requested_slugs]

    if query:
        needle = query.strip().lower()
        tags = [
            tag
            for tag in tags
            if needle in tag.tag_slug
            or needle in tag.display_name.lower()
            or any(needle in alias.lower() for alias in tag.aliases)
            or (tag.description and needle in tag.description.lower())
        ]

    if category:
        tags = [tag for tag in tags if tag.category == category]

    if status_filter:
        tags = [tag for tag in tags if tag.status == status_filter]

    usage_counts = _compute_tag_usage_counts(
        entity_type=entity_type,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )

    summaries = [
        TagSummary(**tag.model_dump(), usage_count=int(usage_counts.get(tag.tag_slug, 0)))
        for tag in tags
    ]
    return sorted(
        summaries,
        key=lambda item: (
            0 if item.status == "active" else 1,
            item.display_name.lower(),
        ),
    )


@app.get("/tags/{tag_slug}", response_model=TagSummary, tags=["tags"])
def get_tag_endpoint(
    tag_slug: str,
    entity_type: EntityType | None = None,
    tag_repo: TagRepository = Depends(get_tag_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> TagSummary:
    tag = tag_repo.get_tag(tag_slug)
    usage_counts = _compute_tag_usage_counts(
        entity_type=entity_type,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )
    return TagSummary(**tag.model_dump(), usage_count=int(usage_counts.get(tag.tag_slug, 0)))


@app.post("/tags", response_model=Tag, status_code=status.HTTP_201_CREATED, tags=["tags"])
def create_tag_endpoint(
    payload: TagCreate,
    tag_repo: TagRepository = Depends(get_tag_repository),
) -> Tag:
    display_name = payload.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Display name is required")

    slug = _slugify_tag(display_name)
    try:
        existing = tag_repo.get_tag(slug)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")
    except HTTPException as exc:
        if exc.status_code != status.HTTP_404_NOT_FOUND:
            raise

    if payload.parent_slug:
        if payload.parent_slug == slug:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent cannot be the same as the tag")
        try:
            tag_repo.get_tag(payload.parent_slug)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent tag not found")
            raise

    aliases = _normalize_aliases(payload.aliases)
    for alias in aliases:
        _ensure_tag_alias_uniqueness(alias, tag_repo=tag_repo)

    now = _now_iso()
    model = Tag(
        tag_slug=slug,
        display_name=display_name,
        category=payload.category,
        aliases=aliases,
        status=payload.status,
        parent_slug=payload.parent_slug,
        description=payload.description,
        created_at=now,
        updated_at=now,
    )
    return tag_repo.create_tag(model)


@app.put("/tags/{tag_slug}", response_model=Tag, tags=["tags"])
def update_tag_endpoint(
    tag_slug: str,
    payload: TagUpdate,
    tag_repo: TagRepository = Depends(get_tag_repository),
) -> Tag:
    current = tag_repo.get_tag(tag_slug)

    updated_display_name = payload.display_name.strip() if payload.display_name is not None else current.display_name
    if not updated_display_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Display name cannot be empty")

    if payload.parent_slug:
        if payload.parent_slug == tag_slug:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent cannot match tag")
        try:
            tag_repo.get_tag(payload.parent_slug)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent tag not found")
            raise

    updated = current.copy(
        update={
            "display_name": updated_display_name,
            "category": payload.category or current.category,
            "parent_slug": payload.parent_slug if payload.parent_slug is not None else current.parent_slug,
            "description": payload.description if payload.description is not None else current.description,
            "updated_at": _now_iso(),
        }
    )
    return tag_repo.update_tag(updated)


@app.patch("/tags/{tag_slug}/status", response_model=Tag, tags=["tags"])
def patch_tag_status(
    tag_slug: str,
    payload: TagStatusPatch,
    tag_repo: TagRepository = Depends(get_tag_repository),
) -> Tag:
    current = tag_repo.get_tag(tag_slug)
    updated = current.copy(update={"status": payload.status, "updated_at": _now_iso()})
    return tag_repo.update_tag(updated)


@app.post("/tags/alias", response_model=Tag, tags=["tags"])
def add_tag_alias(
    payload: TagAliasRequest,
    tag_repo: TagRepository = Depends(get_tag_repository),
) -> Tag:
    tag = tag_repo.get_tag(payload.tag_slug)
    alias = payload.alias.strip()
    if not alias:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alias cannot be empty")
    _ensure_tag_alias_uniqueness(alias, tag_repo=tag_repo, exclude_slug=tag.tag_slug)
    aliases = _normalize_aliases([*tag.aliases, alias])
    updated = tag.copy(update={"aliases": aliases, "updated_at": _now_iso()})
    return tag_repo.update_tag(updated)


@app.post("/tags/resolve", response_model=TagResolveResponse, tags=["tags"])
def resolve_tag_endpoint(
    payload: TagResolveRequest,
    tag_repo: TagRepository = Depends(get_tag_repository),
) -> TagResolveResponse:
    tag, created = _resolve_or_create_tag(payload.input, tag_repo=tag_repo)
    return TagResolveResponse(tag=tag, created=created)


@app.post("/tags/merge", response_model=TagMergeResult, tags=["tags"])
def merge_tags_endpoint(
    payload: TagMergeRequest,
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> TagMergeResult:
    source_slug = payload.source_slug.strip()
    target_slug = payload.target_slug.strip()
    if source_slug == target_slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source and target cannot match")

    source_tag = tag_repo.get_tag(source_slug)
    target_tag = tag_repo.get_tag(target_slug)

    if target_tag.status == "deprecated":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot merge into a deprecated tag")

    merged_aliases = _normalize_aliases([*target_tag.aliases, source_tag.tag_slug, *source_tag.aliases])
    now = _now_iso()
    updated_target = target_tag.copy(update={"aliases": merged_aliases, "updated_at": now})
    deprecated_source = source_tag.copy(update={"status": "deprecated", "updated_at": now})

    tag_repo.update_tag(updated_target)
    tag_repo.update_tag(deprecated_source)

    counts = {"competitor": 0, "wishlist": 0, "vendor": 0}

    for competitor in competitor_repo.list_competitors():
        if source_slug in (competitor.tags or []):
            new_tags = [target_slug if tag == source_slug else tag for tag in competitor.tags or []]
            counts["competitor"] += 1
            competitor_repo.update_competitor(
                competitor.business_name,
                competitor.copy(update={"tags": _dedupe_preserve_order(new_tags)}),
            )

    for wish in wishlist_repo.list_wishlist():
        if source_slug in (wish.tags or []):
            new_tags = [target_slug if tag == source_slug else tag for tag in wish.tags or []]
            counts["wishlist"] += 1
            wishlist_repo.update_wishlist(
                wish.copy(update={"tags": _dedupe_preserve_order(new_tags), "updated_at": _now_iso()}),
            )

    for vendor in vendor_repo.list_vendors():
        if source_slug in (vendor.tags or []):
            new_tags = [target_slug if tag == source_slug else tag for tag in vendor.tags or []]
            counts["vendor"] += 1
            vendor_repo.update_vendor(
                vendor.copy(update={"tags": _dedupe_preserve_order(new_tags), "updated_at": _now_iso()}),
            )

    tag_index_repo.move_records(source_slug, target_slug)

    return TagMergeResult(target=updated_target, source=deprecated_source, updated_counts=counts)


@app.post("/tag-assignments", tags=["tags"])
def assign_tags_endpoint(
    payload: TagAssignmentRequest,
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> dict[str, Any]:
    entity_type = payload.entity_type
    entity_id = payload.entity_id.strip()
    if not entity_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entity ID is required")

    add_slugs = _dedupe_preserve_order(payload.add or [])
    remove_set = {slug for slug in payload.remove or []}

    _ensure_tags_exist(add_slugs, tag_repo=tag_repo)

    if entity_type == "competitor":
        entity = competitor_repo.get_competitor(entity_id)
    elif entity_type == "wishlist":
        entity = wishlist_repo.get_wishlist(entity_id)
    elif entity_type == "vendor":
        entity = vendor_repo.get_vendor(entity_id)
    else:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Influencer tagging is not yet supported")

    current_tags = entity.tags or []
    next_tags = [tag for tag in current_tags if tag not in remove_set]
    for slug in add_slugs:
        if slug not in next_tags:
            next_tags.append(slug)

    updated_entity = _update_entity_tags(
        entity_type=entity_type,
        entity_id=entity_id,
        tags=next_tags,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )

    _sync_tag_index(
        entity_type=entity_type,
        entity_id=entity_id,
        previous_tags=current_tags,
        next_tags=updated_entity.tags,
        tag_index_repo=tag_index_repo,
    )

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "tags": updated_entity.tags,
    }


@app.get("/tags/stats/top", response_model=list[TagCount], tags=["tags"])
def tag_stats_top(
    entity_type: EntityType | None = None,
    limit: int = 20,
    tag_repo: TagRepository = Depends(get_tag_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> list[TagCount]:
    if limit <= 0 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be between 1 and 100")

    usage = _compute_tag_usage_counts(
        entity_type=entity_type,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )
    tags_map = {tag.tag_slug: tag for tag in tag_repo.list_tags()}
    top_items = usage.most_common(limit)
    results: list[TagCount] = []
    for slug, count in top_items:
        tag = tags_map.get(slug)
        if not tag:
            continue
        results.append(TagCount(tag=tag, count=int(count)))
    return results


@app.get("/tags/stats/cooccurrence", response_model=list[TagCount], tags=["tags"])
def tag_stats_cooccurrence(
    tag: str,
    entity_type: EntityType | None = None,
    limit: int = 20,
    tag_repo: TagRepository = Depends(get_tag_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> list[TagCount]:
    if limit <= 0 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be between 1 and 100")

    canonical_slug = tag.strip()
    try:
        target_tag = tag_repo.get_tag(canonical_slug)
    except HTTPException as exc:
        if exc.status_code != status.HTTP_404_NOT_FOUND:
            raise
        # Attempt alias resolution without creating a new tag.
        target_tag = next(
            (candidate for candidate in tag_repo.list_tags() if canonical_slug.lower() in {alias.lower() for alias in candidate.aliases}),
            None,
        )
        if not target_tag:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    canonical_slug = target_tag.tag_slug

    mapping = _collect_entity_tags(
        entity_type=entity_type,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )

    counter: Counter = Counter()
    for tags in mapping.values():
        tag_set = set(tags or [])
        if canonical_slug not in tag_set:
            continue
        for other in tag_set:
            if other != canonical_slug:
                counter[other] += 1

    tags_map = {tag.tag_slug: tag for tag in tag_repo.list_tags()}
    results: list[TagCount] = []
    for slug, count in counter.most_common(limit):
        tag_obj = tags_map.get(slug)
        if not tag_obj:
            continue
        results.append(TagCount(tag=tag_obj, count=int(count)))
    return results


@app.get("/tags/stats/categories", response_model=list[TagCategoryCount], tags=["tags"])
def tag_stats_categories(
    entity_type: EntityType | None = None,
    tag_repo: TagRepository = Depends(get_tag_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> list[TagCategoryCount]:
    usage = _compute_tag_usage_counts(
        entity_type=entity_type,
        competitor_repo=competitor_repo,
        wishlist_repo=wishlist_repo,
        vendor_repo=vendor_repo,
    )
    tags_map = {tag.tag_slug: tag for tag in tag_repo.list_tags()}
    category_counts: dict[TagCategory, int] = defaultdict(int)
    for slug, count in usage.items():
        tag = tags_map.get(slug)
        if not tag:
            continue
        category_counts[tag.category] += int(count)

    results = [TagCategoryCount(category=category, count=count) for category, count in category_counts.items()]
    return sorted(results, key=lambda item: (-item.count, item.category))


@app.get("/competitors", response_model=list[Competitor], tags=["competitors"])
def list_competitors(repository: CompetitorRepository = Depends(get_repository)) -> list[Competitor]:
    return repository.list_competitors()


@app.post(
    "/competitors",
    response_model=Competitor,
    status_code=status.HTTP_201_CREATED,
    tags=["competitors"],
)
def create_competitor(
    payload: Competitor,
    repository: CompetitorRepository = Depends(get_repository),
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Competitor:
    normalized_tags = _dedupe_preserve_order(payload.tags or [])
    _ensure_tags_exist(normalized_tags, tag_repo=tag_repo)
    competitor_model = payload.copy(update={"tags": normalized_tags})
    created = repository.create_competitor(competitor_model)
    _sync_tag_index(
        entity_type="competitor",
        entity_id=created.business_name,
        previous_tags=[],
        next_tags=created.tags,
        tag_index_repo=tag_index_repo,
    )
    return created


@app.get(
    "/competitors/{business_name}",
    response_model=Competitor,
    tags=["competitors"],
)
def get_competitor(
    business_name: str,
    repository: CompetitorRepository = Depends(get_repository),
) -> Competitor:
    return repository.get_competitor(business_name)


@app.put(
    "/competitors/{business_name}",
    response_model=Competitor,
    tags=["competitors"],
)
def update_competitor(
    business_name: str,
    payload: Competitor,
    repository: CompetitorRepository = Depends(get_repository),
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Competitor:
    current = repository.get_competitor(business_name)
    normalized_tags = _dedupe_preserve_order(payload.tags or [])
    _ensure_tags_exist(normalized_tags, tag_repo=tag_repo)
    model = payload.copy(update={"tags": normalized_tags})
    updated = repository.update_competitor(business_name, model)
    _sync_tag_index(
        entity_type="competitor",
        entity_id=business_name,
        previous_tags=current.tags,
        next_tags=updated.tags,
        tag_index_repo=tag_index_repo,
    )
    return updated


@app.delete("/competitors/{business_name}", status_code=status.HTTP_204_NO_CONTENT, tags=["competitors"])
def delete_competitor(
    business_name: str,
    repository: CompetitorRepository = Depends(get_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Response:
    try:
        existing = repository.get_competitor(business_name)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            raise
        existing = None
    repository.delete_competitor(business_name)
    if existing:
        _sync_tag_index(
            entity_type="competitor",
            entity_id=business_name,
            previous_tags=existing.tags,
            next_tags=[],
            tag_index_repo=tag_index_repo,
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/wishlist", response_model=list[WishlistItem], tags=["wishlist"])
def list_wishlist(
    status: WishlistStatus | None = None,
    competitor: str | None = None,
    vendor_id: str | None = None,
    tag: str | None = None,
    master_product_id: str | None = None,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
) -> list[WishlistItem]:
    items = wishlist_repo.list_wishlist()

    def matches(item: WishlistItem) -> bool:
        if status and item.status != status:
            return False
        if vendor_id and (item.vendor_id or "") != vendor_id:
            return False
        if master_product_id and (item.master_product_id or "") != master_product_id:
            return False
        if competitor and competitor not in (item.competitors or []):
            return False
        if tag:
            tags_lower = {value.lower() for value in item.tags or []}
            if tag.lower() not in tags_lower:
                return False
        return True

    filtered = [item for item in items if matches(item)]
    return sorted(filtered, key=lambda entry: entry.updated_at, reverse=True)


@app.get("/wishlist/{wish_id}", response_model=WishlistItem, tags=["wishlist"])
def get_wishlist_item(
    wish_id: str,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
) -> WishlistItem:
    return wishlist_repo.get_wishlist(wish_id)


@app.post(
    "/wishlist",
    response_model=WishlistItem,
    status_code=status.HTTP_201_CREATED,
    tags=["wishlist"],
)
def create_wishlist_item(
    payload: WishlistCreate,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> WishlistItem:
    _validate_competitor_links(payload.competitors, competitor_repo)
    _ensure_vendor_present(payload.vendor_id, vendor_repo)
    _ensure_master_product_present(payload.master_product_id, master_repo)
    _ensure_tags_exist(payload.tags or [], tag_repo=tag_repo)
    item = _build_wishlist_item(payload)
    created = wishlist_repo.create_wishlist(item)
    _sync_tag_index(
        entity_type="wishlist",
        entity_id=created.wish_id,
        previous_tags=[],
        next_tags=created.tags,
        tag_index_repo=tag_index_repo,
    )
    return created


@app.put(
    "/wishlist/{wish_id}",
    response_model=WishlistItem,
    tags=["wishlist"],
)
def update_wishlist_item(
    wish_id: str,
    payload: WishlistCreate,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> WishlistItem:
    existing = wishlist_repo.get_wishlist(wish_id)
    _validate_competitor_links(payload.competitors, competitor_repo)
    _ensure_vendor_present(payload.vendor_id, vendor_repo)
    _ensure_master_product_present(payload.master_product_id, master_repo)
    _ensure_tags_exist(payload.tags or [], tag_repo=tag_repo)
    updated = _build_wishlist_item(payload, wish_id=wish_id, created_at=existing.created_at)
    stored = wishlist_repo.update_wishlist(updated)
    _sync_tag_index(
        entity_type="wishlist",
        entity_id=wish_id,
        previous_tags=existing.tags,
        next_tags=stored.tags,
        tag_index_repo=tag_index_repo,
    )
    return stored


@app.delete("/wishlist/{wish_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["wishlist"])
def delete_wishlist_item(
    wish_id: str,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Response:
    existing = wishlist_repo.get_wishlist(wish_id)
    wishlist_repo.delete_wishlist(wish_id)
    _sync_tag_index(
        entity_type="wishlist",
        entity_id=wish_id,
        previous_tags=existing.tags,
        next_tags=[],
        tag_index_repo=tag_index_repo,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch(
    "/wishlist/{wish_id}/status",
    response_model=WishlistItem,
    tags=["wishlist"],
)
def patch_wishlist_status(
    wish_id: str,
    payload: WishlistStatusPatch,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
) -> WishlistItem:
    item = wishlist_repo.get_wishlist(wish_id)
    if payload.status != "procured" and payload.price_actual is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="price_actual can only be set when status is 'procured'",
        )
    updated = item.copy(
        update={
            "status": payload.status,
            "price_actual": payload.price_actual if payload.status == "procured" else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return wishlist_repo.update_wishlist(updated)


@app.patch(
    "/wishlist/{wish_id}/vendor",
    response_model=WishlistItem,
    tags=["wishlist"],
)
def patch_wishlist_vendor(
    wish_id: str,
    payload: WishlistVendorPatch,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> WishlistItem:
    if payload.vendor_id:
        _ensure_vendor_present(payload.vendor_id, vendor_repo)
    item = wishlist_repo.get_wishlist(wish_id)
    updated = item.copy(
        update={
            "vendor_id": payload.vendor_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return wishlist_repo.update_wishlist(updated)


@app.patch(
    "/wishlist/{wish_id}/master-product",
    response_model=WishlistItem,
    tags=["wishlist"],
)
def patch_wishlist_master_product(
    wish_id: str,
    payload: WishlistMasterProductPatch,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
) -> WishlistItem:
    master_product_id = payload.master_product_id
    if isinstance(master_product_id, str):
        master_product_id = master_product_id.strip() or None
    if master_product_id:
        _ensure_master_product_present(master_product_id, master_repo)
    item = wishlist_repo.get_wishlist(wish_id)
    updated = item.copy(
        update={
            "master_product_id": master_product_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return wishlist_repo.update_wishlist(updated)


@app.patch(
    "/wishlist/{wish_id}/competitors",
    response_model=WishlistItem,
    tags=["wishlist"],
)
def patch_wishlist_competitors(
    wish_id: str,
    payload: WishlistCompetitorPatch,
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    competitor_repo: CompetitorRepository = Depends(get_repository),
) -> WishlistItem:
    add_list = _dedupe_preserve_order(payload.add or [])
    remove_set = {value for value in payload.remove or []}

    _validate_competitor_links(add_list, competitor_repo)

    item = wishlist_repo.get_wishlist(wish_id)
    current = [name for name in (item.competitors or []) if name not in remove_set]
    for name in add_list:
        if name not in current:
            current.append(name)

    updated = item.copy(
        update={
            "competitors": current,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return wishlist_repo.update_wishlist(updated)


@app.get("/master-products", response_model=list[MasterProduct], tags=["master-products"])
def list_master_products_endpoint(
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
) -> list[MasterProduct]:
    return master_repo.list_master_products()


@app.get("/master-products/{product_id}", response_model=MasterProduct, tags=["master-products"])
def get_master_product_endpoint(
    product_id: str,
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
) -> MasterProduct:
    return master_repo.get_master_product(product_id)


@app.post(
    "/master-products",
    response_model=MasterProduct,
    status_code=status.HTTP_201_CREATED,
    tags=["master-products"],
)
def create_master_product_endpoint(
    payload: MasterProductCreate,
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
) -> MasterProduct:
    product = _build_master_product(payload)
    return master_repo.create_master_product(product)


@app.put("/master-products/{product_id}", response_model=MasterProduct, tags=["master-products"])
def update_master_product_endpoint(
    product_id: str,
    payload: MasterProductCreate,
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
) -> MasterProduct:
    existing = master_repo.get_master_product(product_id)
    product = _build_master_product(payload, product_id=product_id, created_at=existing.created_at)
    return master_repo.update_master_product(product)


@app.delete(
    "/master-products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["master-products"],
)
def delete_master_product_endpoint(
    product_id: str,
    master_repo: MasterProductRepository = Depends(get_master_product_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
) -> Response:
    linked_wishes = [
        item.wish_id
        for item in wishlist_repo.list_wishlist()
        if (item.master_product_id or "") == product_id
    ]
    if linked_wishes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete master product while linked to wishlist items",
        )
    master_repo.delete_master_product(product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/vendors", response_model=list[Vendor], tags=["vendors"])
def list_vendors_endpoint(
    query: str | None = None,
    tag: str | None = None,
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> list[Vendor]:
    items = vendor_repo.list_vendors()

    def matches(vendor: Vendor) -> bool:
        if query:
            haystack = " ".join(filter(None, [vendor.name, vendor.city, vendor.country]))
            if query.lower() not in haystack.lower():
                return False
        if tag:
            if tag.lower() not in {value.lower() for value in vendor.tags or []}:
                return False
        return True

    filtered = [vendor for vendor in items if matches(vendor)]
    return sorted(filtered, key=lambda entry: entry.updated_at, reverse=True)


@app.get("/vendors/{vendor_id}", response_model=Vendor, tags=["vendors"])
def get_vendor_endpoint(
    vendor_id: str,
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
) -> Vendor:
    return vendor_repo.get_vendor(vendor_id)


@app.post(
    "/vendors",
    response_model=Vendor,
    status_code=status.HTTP_201_CREATED,
    tags=["vendors"],
)
def create_vendor_endpoint(
    payload: VendorCreate,
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Vendor:
    existing_names = {vendor.name.lower(): vendor.vendor_id for vendor in vendor_repo.list_vendors()}
    if payload.name.lower() in existing_names:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vendor name already exists")
    normalized_payload = _normalize_vendor_tags(payload, tag_repo=tag_repo)
    _ensure_tags_exist(normalized_payload.tags or [], tag_repo=tag_repo)
    vendor_model = _build_vendor(normalized_payload)
    created = vendor_repo.create_vendor(vendor_model)
    _sync_tag_index(
        entity_type="vendor",
        entity_id=created.vendor_id,
        previous_tags=[],
        next_tags=created.tags,
        tag_index_repo=tag_index_repo,
    )
    return created


@app.put("/vendors/{vendor_id}", response_model=Vendor, tags=["vendors"])
def update_vendor_endpoint(
    vendor_id: str,
    payload: VendorCreate,
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    tag_repo: TagRepository = Depends(get_tag_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Vendor:
    existing = vendor_repo.get_vendor(vendor_id)
    clash = next(
        (vendor for vendor in vendor_repo.list_vendors() if vendor.name.lower() == payload.name.lower()),
        None,
    )
    if clash and clash.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vendor name already exists")
    normalized_payload = _normalize_vendor_tags(payload, tag_repo=tag_repo)
    _ensure_tags_exist(normalized_payload.tags or [], tag_repo=tag_repo)
    vendor_model = _build_vendor(normalized_payload, vendor_id=vendor_id, created_at=existing.created_at)
    updated = vendor_repo.update_vendor(vendor_model)
    _sync_tag_index(
        entity_type="vendor",
        entity_id=vendor_id,
        previous_tags=existing.tags,
        next_tags=updated.tags,
        tag_index_repo=tag_index_repo,
    )
    return updated


@app.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["vendors"])
def delete_vendor_endpoint(
    vendor_id: str,
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    wishlist_repo: WishlistRepository = Depends(get_wishlist_repository),
    tag_index_repo: TagIndexRepository = Depends(get_tag_index_repository),
) -> Response:
    # Remove vendor from any wishlist items referencing it
    items = wishlist_repo.list_wishlist()
    affected = [item for item in items if item.vendor_id == vendor_id]
    for item in affected:
        cleared = item.copy(
            update={
                "vendor_id": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        wishlist_repo.update_wishlist(cleared)
    vendor = vendor_repo.get_vendor(vendor_id)
    vendor_repo.delete_vendor(vendor_id)
    _sync_tag_index(
        entity_type="vendor",
        entity_id=vendor_id,
        previous_tags=vendor.tags,
        next_tags=[],
        tag_index_repo=tag_index_repo,
    )
    for item in affected:
        _sync_tag_index(
            entity_type="wishlist",
            entity_id=item.wish_id,
            previous_tags=item.tags,
            next_tags=wishlist_repo.get_wishlist(item.wish_id).tags,
            tag_index_repo=tag_index_repo,
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
