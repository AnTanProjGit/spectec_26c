import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.customer import Client
from app.models.enums import ClientTypeEnum
from app.schemas.drivers import CustomerCreate, CustomerResponse, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["Branch Customers Directory"])


def _serialize_client(c: Client) -> CustomerResponse:
    return CustomerResponse(
        id=str(c.id),
        primary_branch_id=c.primary_branch_id,
        client_type=c.client_type.value,
        name=c.name,
        full_name=c.full_name,
        opf=c.opf,
        inn=c.inn,
        kpp=c.kpp,
        ogrn=c.ogrn,
        legal_address=c.legal_address,
        director=c.director,
        bank_name=c.bank_name,
        bik=c.bik,
        checking_account=c.checking_account,
        corr_account=c.corr_account,
        email=c.email,
        phone=c.phone,
        is_regular_max=c.is_regular_max,
        credit_limit=c.credit_limit,
        current_debt=c.current_debt,
        reliability_score=c.reliability_score,
    )


@router.get("", response_model=List[CustomerResponse])
async def list_customers(
    branch_id: str = Query(...),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CustomerResponse]:
    if branch_id == "all":
        raise HTTPException(status_code=400, detail="Справочник заказчиков строго изолирован по конкретному branch_id")
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(Client).where(Client.primary_branch_id == scoped).order_by(Client.name)
    if search and search.strip():
        pat = f"%{search.strip()}%"
        stmt = stmt.where(or_(Client.name.ilike(pat), Client.full_name.ilike(pat), Client.inn.ilike(pat)))
    rows = (await db.execute(stmt)).scalars().all()
    return [_serialize_client(r) for r in rows]


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    enforce_branch_scope(current_user, payload.primary_branch_id)
    if payload.inn:
        dup = (
            await db.execute(
                select(Client).where(
                    Client.primary_branch_id == payload.primary_branch_id,
                    Client.inn == payload.inn,
                )
            )
        ).scalar_one_or_none()
        if dup:
            raise HTTPException(
                status_code=409,
                detail="Заказчик с таким ИНН уже заведён на этом участке",
            )
    client = Client(
        primary_branch_id=payload.primary_branch_id,
        client_type=ClientTypeEnum(payload.client_type.value),
        name=payload.name,
        full_name=payload.full_name,
        opf=payload.opf,
        inn=payload.inn,
        kpp=payload.kpp,
        ogrn=payload.ogrn,
        legal_address=payload.legal_address,
        director=payload.director,
        bank_name=payload.bank_name,
        bik=payload.bik,
        checking_account=payload.checking_account,
        corr_account=payload.corr_account,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        is_regular_max=payload.is_regular_max,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return _serialize_client(client)


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    try:
        cust_uuid = uuid.UUID(customer_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Некорректный UUID заказчика") from exc

    client = (await db.execute(select(Client).where(Client.id == cust_uuid))).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Заказчик не найден")
    enforce_branch_scope(current_user, client.primary_branch_id)

    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    for k, v in data.items():
        if hasattr(client, k):
            setattr(client, k, v)
    await db.commit()
    await db.refresh(client)
    return _serialize_client(client)
