# Design Patterns

| Pattern | Features | How it's applied | Why it helps |
| :--- | :--- | :--- | :--- |
| **Repository** | Book Listings (FR 6.1–6.4), Wishlists (FR 8.1–8.4), Direct Exchange (FR 3.4) | `BookRepository`, `WishlistRepository` and `ExchangeRepository` expose `findByTitle()`, `save()`, `findByStatus()`. Business modules never write SQL | Storage can change without touching business logic. Tests can use an in-memory repository |
| **Observer** | In-App Communication (FR 5.9–5.12), Direct Exchange (FR 3.12), Accounts (FR 1.12) | `Exchange` and `Meetup` notify `NotificationService` and `WebSocketPusher` when their status changes | The Exchange module doesn't need to know who reacts. A new channel, like email, is just another observer |
 
