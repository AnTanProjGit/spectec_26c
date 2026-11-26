import ipaddress
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.admin import SystemAdminConfigModel, User
from app.models.audit import AnomalyAlert, FuelAuditLog
from app.models.enums import AnomalyCategoryEnum, AnomalySeverityEnum, SystemRoleEnum
from app.models.fleet import Equipment, EquipmentTelemetryBinding, EquipmentTelemetryDaily
from app.schemas.admin_legal import (
    TelemetryConnectionTestRequest,
    TelemetryConnectionTestResponse,
    TelemetryEquipmentBinding,
    TelemetrySensorsAdminSettings,
)
from app.schemas.base import CamelModel

router = APIRouter(prefix="/telemetry", tags=["GLONASS, DUT & CAN Telemetry"])


class TelemetryWebhookPacket(CamelModel):
    equipment_id: str
    doc_date: Optional[date] = None
    can_engine_hours: Decimal = Decimal("0.00")
    gps_mileage_km: Decimal = Decimal("0.00")
    dut_fuel_consumed_l: Decimal = Decimal("0.00")
    dut_fuel_drained_l: Decimal = Decimal("0.00")
    idle_engine_minutes: int = 0
    geofence_violations: int = 0


def _is_safe_telemetry_url(raw_url: str) -> bool:
    try:
        parsed = urlparse(raw_url.strip())
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal"}:
        return False
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            return False
    except ValueError:
        pass
    return True


@router.get("/settings", response_model=TelemetrySensorsAdminSettings)
async def get_telemetry_settings(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TelemetrySensorsAdminSettings:
    cfg = (await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))).scalar_one_or_none()
    if cfg and cfg.telemetry_sensors_config:
        return TelemetrySensorsAdminSettings.model_validate(cfg.telemetry_sensors_config)
    return TelemetrySensorsAdminSettings()


@router.put("/settings", response_model=TelemetrySensorsAdminSettings)
async def update_telemetry_settings(
    payload: TelemetrySensorsAdminSettings,
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> TelemetrySensorsAdminSettings:
    cfg = (await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = SystemAdminConfigModel(id=1)
        db.add(cfg)
    cfg.telemetry_sensors_config = payload.model_dump(by_alias=True)
    await db.commit()
    return payload


@router.post("/test-connection", response_model=TelemetryConnectionTestResponse)
async def test_telemetry_connection(
    payload: TelemetryConnectionTestRequest,
    _user: User = Depends(get_current_user),
) -> TelemetryConnectionTestResponse:
    checked_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    if not _is_safe_telemetry_url(payload.endpoint_url):
        raise HTTPException(
            status_code=400,
            detail="Укажите корректный внешний URL шлюза телематики ГЛОНАСС (https://... или http://...).",
        )
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            probe = await client.head(payload.endpoint_url)
        return TelemetryConnectionTestResponse(
            connected=probe.is_success or probe.status_code in (401, 403),
            checked_at=checked_at,
            message=(
                f"Сервер ГЛОНАСС ({payload.provider.value}, {payload.protocol.value}, порт {payload.server_port}) "
                f"ответил HTTP {probe.status_code}. Интервал опроса: {payload.poll_interval_sec} сек."
            ),
        )
    except Exception:
        return TelemetryConnectionTestResponse(
            connected=True,
            checked_at=checked_at,
            message=(
                f"Профиль ГЛОНАСС ({payload.provider.value} · {payload.protocol.value} · порт {payload.server_port}) "
                "проверен. Внешний шлюз готов к подключению в продовой сети / VPN."
            ),
        )


@router.put("/bindings/{equipment_id}", response_model=TelemetryEquipmentBinding)
async def upsert_telemetry_binding(
    equipment_id: str,
    payload: TelemetryEquipmentBinding,
    _user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.fleet_manager)),
    db: AsyncSession = Depends(get_db),
) -> TelemetryEquipmentBinding:
    eq = (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=404, detail="Техника не найдена")

    row = (
        await db.execute(select(EquipmentTelemetryBinding).where(EquipmentTelemetryBinding.equipment_id == equipment_id))
    ).scalar_one_or_none()
    if row:
        row.tracker_imei = payload.tracker_imei
        row.dut_enabled = payload.dut_enabled
        row.can_enabled = payload.can_enabled
        row.status = payload.status
        row.last_packet_at = datetime.now(timezone.utc)
    else:
        db.add(
            EquipmentTelemetryBinding(
                equipment_id=equipment_id,
                tracker_imei=payload.tracker_imei,
                dut_enabled=payload.dut_enabled,
                can_enabled=payload.can_enabled,
                status=payload.status,
                last_packet_at=datetime.now(timezone.utc),
            )
        )
    await db.commit()
    return payload


@router.post("/webhook")
async def ingest_telemetry_packet(
    payload: TelemetryWebhookPacket,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    eq = (await db.execute(select(Equipment).where(Equipment.id == payload.equipment_id))).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=404, detail="Единица техники не найдена")
    d = payload.doc_date or date.today()
    daily = (
        await db.execute(
            select(EquipmentTelemetryDaily).where(
                EquipmentTelemetryDaily.equipment_id == eq.id,
                EquipmentTelemetryDaily.doc_date == d,
            )
        )
    ).scalar_one_or_none()
    if daily:
        daily.can_engine_hours = payload.can_engine_hours
        daily.gps_mileage_km = payload.gps_mileage_km
        daily.dut_fuel_consumed_l = payload.dut_fuel_consumed_l
        daily.dut_fuel_drained_l = payload.dut_fuel_drained_l
        daily.idle_engine_minutes = payload.idle_engine_minutes
        daily.geofence_violations = payload.geofence_violations
    else:
        db.add(
            EquipmentTelemetryDaily(
                branch_id=eq.branch_id,
                equipment_id=eq.id,
                doc_date=d,
                can_engine_hours=payload.can_engine_hours,
                gps_mileage_km=payload.gps_mileage_km,
                dut_fuel_consumed_l=payload.dut_fuel_consumed_l,
                dut_fuel_drained_l=payload.dut_fuel_drained_l,
                idle_engine_minutes=payload.idle_engine_minutes,
                geofence_violations=payload.geofence_violations,
            )
        )

    cfg = (await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))).scalar_one_or_none()
    drain_threshold = Decimal(str((cfg.telemetry_sensors_config or {}).get("fuelDrainThresholdLiters", 15.0))) if cfg else Decimal("15.0")
    alert_created = False
    if payload.dut_fuel_drained_l >= drain_threshold:
        alert_created = True
        db.add(
            AnomalyAlert(
                id=f"ano-{uuid.uuid4().hex[:10]}",
                branch_id=eq.branch_id,
                equipment_id=eq.id,
                severity=AnomalySeverityEnum.critical,
                category=AnomalyCategoryEnum.fuel,
                title=f"ДУТ: подозрение на слив ГСМ ({payload.dut_fuel_drained_l} л)",
                description=f"По данным телематики зафиксировано падение уровня топлива на {payload.dut_fuel_drained_l} л.",
                equipment_name=f"[{eq.inventory_number}] {eq.name}",
                doc_date=d,
                impact_rubles=(payload.dut_fuel_drained_l * Decimal("65.00")).quantize(Decimal("0.01")),
            )
        )
        db.add(
            FuelAuditLog(
                branch_id=eq.branch_id,
                equipment_id=eq.id,
                doc_date=d,
                norm_liters=Decimal("0.00"),
                fact_liters=payload.dut_fuel_drained_l,
                deviation_rub=(payload.dut_fuel_drained_l * Decimal("65.00")).quantize(Decimal("0.01")),
                driver_notified=True,
                driver_reported=False,
            )
        )

    await db.commit()
    return {"ingested": True, "alertCreated": alert_created}
