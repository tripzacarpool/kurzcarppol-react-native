# Tripza Matching Service

Python/FastAPI service for matching, route-time scoring, and fare split calculations.

Run locally:

```bash
cd backend/services/matching-service
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 7001
```

Validate from the repository root:

```bash
npm run matching:check
```

HTTP contract:

- `GET /health` returns service liveness.
- `POST /match` ranks available offers for a rider request.
- `POST /fare-split` calculates passenger-level fare shares.

Node API integration:

- Set `MATCHING_SERVICE_URL=http://localhost:7001`.
- The Node API adapter lives in `backend/src/services/matchingClientService.js`.
- If `MATCHING_SERVICE_URL` is empty, current in-process fare logic remains the fallback.

This service is intentionally separate from the current Node API so matching logic can grow into geospatial optimization, ML scoring, fraud/risk scoring, and route intelligence without bloating the core API.
