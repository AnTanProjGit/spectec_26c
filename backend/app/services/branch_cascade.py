import re
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AnomalyAlert
from app.models.branch import Branch, BranchDocumentFlow, BranchFixedOverhead, BranchOverheadDetail
from app.models.crm import CRMDeal, ClientCommunication
from app.models.erp import Contract, RentalOrder
from app.models.forms import ClosingDocument, ShiftReport
from app.schemas.branches import (
    BranchDocumentFlowConfig,
    BranchFixedOverheadItem,
    BranchOverheadDetailRow,
    FleetBranchResponse,
)


def derive_act_services_prefix(act_prefix: str) -> str:
    if re.match(r"^(КС2-|КС-2-)", act_prefix or ""):
        return re.sub(r"^(КС2-|КС-2-)", "АКТ-", act_prefix)
    return "АКТ-"


def replace_prefix(value: Optional[str], old_prefix: str, new_prefix: str) -> Optional[str]:
    if not value or not old_prefix or old_prefix == new_prefix:
        return value
    if value.startswith(old_prefix):
        return new_prefix + value[len(old_prefix):]
    return value


def serialize_branch(branch: Branch) -> FleetBranchResponse:
    df = branch.document_flow
    flow_dto = BranchDocumentFlowConfig(
        isolated_streams=df.isolated_streams if df else True,
        isolate_crm_and_erp=df.isolate_crm_and_erp if df else True,
        order_prefix=df.order_prefix if df else f"RO-{branch.code}-",
        waybill_prefix=df.waybill_prefix if df else f"ПЛ-{branch.code}-",
        shift_prefix=df.shift_prefix if df else f"SH-{branch.code}-",
        act_prefix=df.act_prefix if df else f"КС2-{branch.code}-",
        oneCDepartmentCode=df.onec_department_code if df else "00-000001",
        default1CSubject=df.default_1c_subject.value if df else "ooo_specialtech",
    )
    overheads_dto: List[BranchFixedOverheadItem] = []
    total_rub = Decimal("0.00")
    for item in branch.fixed_overheads or []:
        details_dto = [
            BranchOverheadDetailRow(
                id=d.id,
                title=d.title,
                basis=d.basis,
                amount_rub=d.amount_rub,
            )
            for d in (item.details or [])
        ]
        amt = sum((d.amount_rub for d in details_dto), Decimal("0.00")) if details_dto else item.monthly_amount_rub
        if not item.hidden:
            total_rub += amt
        overheads_dto.append(
            BranchFixedOverheadItem(
                id=item.id,
                category=item.category.value,
                name=item.name,
                monthly_amount_rub=amt,
                note=item.note,
                hidden=item.hidden,
                details=details_dto or None,
            )
        )
    return FleetBranchResponse(
        id=branch.id,
        code=branch.code,
        name=branch.name,
        city=branch.city,
        is_headquarters=branch.is_headquarters,
        fleet_manager_name=branch.fleet_manager_name,
        fleet_manager_phone=branch.fleet_manager_phone,
        chief_mechanic_name=branch.chief_mechanic_name,
        chief_mechanic_phone=branch.chief_mechanic_phone,
        base_address=branch.base_address,
        regular_clients=list(branch.regular_clients or []),
        document_flow=flow_dto,
        fixed_overheads=overheads_dto,
        fixed_overheads_total_rub=total_rub,
    )


async def cascade_branch_prefixes(
    db: AsyncSession,
    branch_id: str,
    old_flow: BranchDocumentFlow,
    new_flow: BranchDocumentFlowConfig,
) -> None:
    """Cascades document prefix changes across all 7 branch-linked tables in one transaction."""
    old_order, new_order = old_flow.order_prefix, new_flow.order_prefix
    old_waybill, new_waybill = old_flow.waybill_prefix, new_flow.waybill_prefix
    old_shift, new_shift = old_flow.shift_prefix, new_flow.shift_prefix
    old_act, new_act = old_flow.act_prefix, new_flow.act_prefix
    old_act_srv = derive_act_services_prefix(old_act)
    new_act_srv = derive_act_services_prefix(new_act)

    pairs: List[tuple[str, str]] = [
        (old_order, new_order),
        (old_waybill, new_waybill),
        (old_shift, new_shift),
        (old_act, new_act),
        (old_act_srv, new_act_srv),
    ]
    active_pairs = [(o, n) for o, n in pairs if o and n and o != n]
    if not active_pairs:
        return

    def rewrite_text(text: Optional[str]) -> Optional[str]:
        if not text:
            return text
        res = text
        for o, n in active_pairs:
            res = res.replace(o, n)
        return res

    # 1. erp.rental_orders
    orders = (await db.execute(select(RentalOrder).where(RentalOrder.branch_id == branch_id))).scalars().all()
    for order in orders:
        order.order_number = replace_prefix(order.order_number, old_order, new_order) or order.order_number
        order.act_number = replace_prefix(order.act_number, old_act_srv, new_act_srv)
        order.ks2_number = replace_prefix(order.ks2_number, old_act, new_act)

    # 2. crm.deals
    deals = (await db.execute(select(CRMDeal).where(CRMDeal.branch_id == branch_id))).scalars().all()
    for deal in deals:
        deal.act_number = replace_prefix(deal.act_number, old_act_srv, new_act_srv)
        deal.ks2_number = replace_prefix(deal.ks2_number, old_act, new_act)

    # 3. forms.closing_documents
    cdocs = (await db.execute(select(ClosingDocument).where(ClosingDocument.branch_id == branch_id))).scalars().all()
    for cdoc in cdocs:
        if cdoc.kind.value == "act_services":
            cdoc.doc_number = replace_prefix(cdoc.doc_number, old_act_srv, new_act_srv) or cdoc.doc_number
        elif cdoc.kind.value == "ks2":
            cdoc.doc_number = replace_prefix(cdoc.doc_number, old_act, new_act) or cdoc.doc_number
        cdoc.order_or_deal_number = replace_prefix(cdoc.order_or_deal_number, old_order, new_order) or cdoc.order_or_deal_number
        cdoc.content_text = rewrite_text(cdoc.content_text) or cdoc.content_text

    # 4. erp.contracts
    contracts = (await db.execute(select(Contract).where(Contract.branch_id == branch_id))).scalars().all()
    cdoc_map: Dict[str, ClosingDocument] = {f"leg-{c.id}": c for c in cdocs}
    for contract in contracts:
        linked_cdoc = cdoc_map.get(contract.id)
        if linked_cdoc:
            contract.number = linked_cdoc.doc_number
            contract.linked_order_number = linked_cdoc.order_or_deal_number
            contract.content = linked_cdoc.content_text
            contract.title = rewrite_text(contract.title) or contract.title
        else:
            contract.number = rewrite_text(contract.number) or contract.number
            contract.linked_order_number = rewrite_text(contract.linked_order_number)
            contract.title = rewrite_text(contract.title) or contract.title
            contract.content = rewrite_text(contract.content) or contract.content
            contract.dispute_reason = rewrite_text(contract.dispute_reason)

    # 5. forms.shift_reports
    shifts = (await db.execute(select(ShiftReport).where(ShiftReport.branch_id == branch_id))).scalars().all()
    for sh in shifts:
        sh.shift_number = replace_prefix(sh.shift_number, old_shift, new_shift) or sh.shift_number
        sh.waybill_number = replace_prefix(sh.waybill_number, old_waybill, new_waybill)

    # 6. audit.anomaly_alerts
    alerts = (await db.execute(select(AnomalyAlert).where(AnomalyAlert.branch_id == branch_id))).scalars().all()
    for alert in alerts:
        alert.title = rewrite_text(alert.title) or alert.title
        alert.description = rewrite_text(alert.description) or alert.description

    # 7. crm.client_communications
    comms = (await db.execute(select(ClientCommunication).where(ClientCommunication.branch_id == branch_id))).scalars().all()
    for comm in comms:
        comm.message_text = rewrite_text(comm.message_text) or comm.message_text
        if comm.confirmation and isinstance(comm.confirmation, dict) and comm.confirmation.get("shiftNumber"):
            updated_conf = dict(comm.confirmation)
            updated_conf["shiftNumber"] = replace_prefix(updated_conf["shiftNumber"], old_shift, new_shift)
            comm.confirmation = updated_conf
