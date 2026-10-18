# Initial Design Documentation

Initial system design for SwapCycle, produced in Sprint 1.

## High-level architecture
Three-tier web application: a browser client, an application server with one module per feature, and a PostgreSQL database. Supporting services handle file storage, email, book metadata and notifications.

![Architecture](images/architecture.png)

## Wireframes (Figma)
Main screens, designed in Figma by Sayed Ahmed.

| Sign in | Home (book listings) | Account / profile | Wishlist |
|---|---|---|---|
| ![](images/wireframe-sign-in.png) | ![](images/wireframe-home.png) | ![](images/wireframe-account.png) | ![](images/wireframe-wishlist.png) |

## Use case view
By Sayed Ali and Sayed Ahmed (Jira SCRUM-64 to SCRUM-71).

![Use case diagram](images/use-case-diagram.png)

## Information view – class diagram
By Kareem and Amir (Jira SCRUM-72 to SCRUM-79).

![Class diagram](images/class-diagram.png)

## Behavior view – state diagrams
By Sayed Ahmed and Sayed Mohammed (Jira SCRUM-80 to SCRUM-87).

| Exchange request | User account |
|---|---|
| ![](images/behavior-diagram-exchange.png) | ![](images/behavior-diagram-user-account.png) |
