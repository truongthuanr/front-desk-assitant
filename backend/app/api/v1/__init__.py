from fastapi import APIRouter

from app.api.v1.tickets import router as tickets_router

api_router = APIRouter()
api_router.include_router(tickets_router)
