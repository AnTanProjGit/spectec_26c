from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai_analyst,
    analytics,
    auth,
    branches,
    chat,
    closing_docs,
    crm,
    customers,
    driver_bot,
    drivers,
    exchange_excel,
    fleet,
    integrations_1c,
    knowledge,
    legal,
    notifications,
    rentals,
    telemetry,
    timesheets,
    workspace,
)

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth.router)
api_v1_router.include_router(workspace.router)
api_v1_router.include_router(branches.router)
api_v1_router.include_router(fleet.router)
api_v1_router.include_router(analytics.router)
api_v1_router.include_router(crm.router)
api_v1_router.include_router(rentals.router)
api_v1_router.include_router(closing_docs.router)
api_v1_router.include_router(notifications.router)
api_v1_router.include_router(drivers.router)
api_v1_router.include_router(customers.router)
api_v1_router.include_router(timesheets.router)
api_v1_router.include_router(chat.router)
api_v1_router.include_router(legal.router)
api_v1_router.include_router(knowledge.router)
api_v1_router.include_router(integrations_1c.router)
api_v1_router.include_router(admin.router)
api_v1_router.include_router(telemetry.router)
api_v1_router.include_router(ai_analyst.router)
api_v1_router.include_router(exchange_excel.router)
api_v1_router.include_router(driver_bot.router)
