# Decision Matrix and Final Choice
Scores: 1 (poor) to 5 (excellent). Team fit 30%, security 25%, maintainability 25%, scalability 20%. 
| Style | Scalability (20%) | Security (25%) | Maintainability (25%) | Team fit (30%) | Total | 
|---|---|---|---|---|---| 
| **Layered** | 3 | 4 | 4 | 5 | **4.10** | 
| Microservices | 5 | 2 | 3 | 1 | 2.55 |
- Layered: (0.20 × 3) + (0.25 × 4) + (0.25 × 4) + (0.30 × 5) = 4.10
- Microservices: (0.20 × 5) + (0.25 × 2) + (0.25 × 3) + (0.30 × 1) = 2.55
- With equal weights Layered still wins (4.00 vs 2.75). 
## Final choice: Layered- **Access rules (SCRUM-45, 46):** one middleware blocks unverified users and keeps reports admin-only.
- **Search speed (SCRUM-38, 39; NFR 1.1):** one database, so a multi-filter search is one indexed query.- **Exchange consistency (SCRUM-49, 52, 53; FR 2.7):** completing a swap is one transaction.
- **Messages (SCRUM-36, 37; NFR 1.3):** the Communication module pushes messages over a WebSocket within 2 s.
- **Availability (NFR 4.1):** 99.5% of 720 h allows 3.6 h downtime a month. One server with auto-restart meets it.
- **Team:** one repo and one deployment fit six students in one semester.
