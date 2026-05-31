from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(title="Tripza Matching Service", version="0.1.0")


class Location(BaseModel):
    latitude: float
    longitude: float
    city: str | None = None


class MatchCandidate(BaseModel):
    ride_id: str
    driver_id: str
    pickup: Location
    dropoff: Location
    available_seats: int = Field(ge=1)
    fare_per_seat: float = Field(ge=0)
    departure_time: datetime
    trust_score: float = Field(ge=0, le=100, default=50)


class MatchRequest(BaseModel):
    passenger_id: str
    pickup: Location
    dropoff: Location
    seats: int = Field(ge=1, le=6)
    earliest_departure: datetime | None = None
    latest_departure: datetime | None = None
    candidates: list[MatchCandidate] = Field(default_factory=list)


class MatchResult(BaseModel):
    ride_id: str
    driver_id: str
    score: float
    estimated_fare: float
    reason: str


class FareSplitRequest(BaseModel):
    total_fare: float = Field(ge=0)
    total_seats: int = Field(ge=1)
    participants: int = Field(ge=1)
    strategy: Literal["equal", "seat_weighted"] = "seat_weighted"


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "matching-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/match", response_model=list[MatchResult])
def match_rides(payload: MatchRequest) -> list[MatchResult]:
    results: list[MatchResult] = []

    for candidate in payload.candidates:
        if candidate.available_seats < payload.seats:
            continue

        time_score = 20
        if payload.earliest_departure and candidate.departure_time < payload.earliest_departure:
            time_score = 5
        if payload.latest_departure and candidate.departure_time > payload.latest_departure:
            time_score = 5

        seat_score = min(candidate.available_seats / payload.seats, 2) * 15
        trust_score = candidate.trust_score * 0.4
        price_score = max(0, 25 - candidate.fare_per_seat * 0.01)
        score = round(time_score + seat_score + trust_score + price_score, 2)

        results.append(
            MatchResult(
                ride_id=candidate.ride_id,
                driver_id=candidate.driver_id,
                score=score,
                estimated_fare=round(candidate.fare_per_seat * payload.seats, 2),
                reason="ranked_by_time_seats_trust_price",
            )
        )

    return sorted(results, key=lambda item: item.score, reverse=True)


@app.post("/fare-split")
def fare_split(payload: FareSplitRequest) -> dict[str, float | int | str]:
    if payload.strategy == "equal":
        per_participant = payload.total_fare / payload.participants
    else:
        per_participant = payload.total_fare / payload.total_seats

    return {
        "strategy": payload.strategy,
        "total_fare": round(payload.total_fare, 2),
        "per_participant_estimate": round(per_participant, 2),
    }
