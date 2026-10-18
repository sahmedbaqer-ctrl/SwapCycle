# Non-Functional Requirements

Written by Kareem, Amir and Yousef (Jira SCRUM-63).

## 1. Performance

- **1.1** The system shall display book search results within 2 seconds for at least 95% of searches under a workload of 100 concurrent users.
- **1.2** The system shall load a user's wishlist within 3 seconds for at least 95% of requests under normal operating conditions.
- **1.3** The system shall deliver in-app messages within 2 seconds for at least 95% of messages under normal network conditions.

## 2. Privacy & Security

- **2.1** The system shall prevent unauthorized users from accessing another user's private messages.
- **2.2** The system shall encrypt all communication between users and the server using HTTPS.
- **2.3** The system shall restrict access to user reports to authorized administrators.

## 3. Accessibility

- **3.1** The system shall allow users to navigate book listings, search, and filter books using only a keyboard.
- **3.2** The system shall display clear error messages when users enter incorrect information.
- **3.3** The system shall use consistent fonts, colors, and button styles across all pages.

## 4. Reliability

- **4.1** The system shall maintain at least 99.5% monthly availability, excluding scheduled maintenance.
- **4.2** The system shall preserve confirmed exchange records in the database after a user logs out or closes the application.
- **4.3** The system shall automatically recover from temporary server failures within 60 seconds.
