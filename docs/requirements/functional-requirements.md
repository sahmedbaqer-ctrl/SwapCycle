# Functional Requirements

Written by Sayed Ali, Yousef and Sayed Mohammed (Jira SCRUM-55 to SCRUM-62). Each feature links to its Jira epic and user stories.

## 1. Accounts
Epic SCRUM-16 · Stories SCRUM-44, SCRUM-45, SCRUM-46 · Feature owner: Sayed Ahmed

- **1.1** The system shall register users with a unique email and a password of at least 8 characters, creating an unverified account and providing a verification link.
- **1.2** The system shall restrict unverified users from listing books or initiating exchanges.
- **1.3** The system shall reject verification of links older than 24 hours and allow users to request new links.
- **1.4** The system shall authenticate users and redirect them to the home page upon successful sign-in.
- **1.5** The system shall display "Incorrect email or password" for failed sign-ins without revealing whether the email exists.
- **1.6** The system shall lock accounts for 15 minutes after five consecutive failed sign-in attempts.
- **1.7** The system shall allow password resets through recovery links valid for 30 minutes and invalidate the previous password upon reset.
- **1.8** The system shall redirect unauthenticated users attempting to access restricted pages to the sign-in page.
- **1.9** The system shall allow users to update their name, photo, location, and bio, reflecting changes on their public profile.
- **1.10** The system shall accept only JPG/PNG profile images up to 5 MB and explain why invalid uploads are rejected.
- **1.11** The system shall display users' names, photos, locations, ratings, and book lists publicly while keeping personal details private.
- **1.12** The system shall allow account deletion after password confirmation, removing book listings, canceling exchanges, and notifying affected users.

## 2. Completion Confirmation
Epic SCRUM-20 · Stories SCRUM-52, SCRUM-53, SCRUM-54 · Feature owner: Sayed Mohammed

- **2.1** The system shall allow users to mark their part of an exchange as completed.
- **2.2** The system shall record the date and time when a user marks their part as completed.
- **2.3** The system shall update the user's exchange status to indicate that they have handed over their book.
- **2.4** The system shall display the completion status of each participant in the exchange.
- **2.5** The system shall allow users to confirm that they have received the exchanged book.
- **2.6** The system shall record the confirmation of book receipt for each user.
- **2.7** The system shall update the overall exchange status to completed once both users have confirmed handing over and receiving their books.
- **2.8** The system shall display the final exchange status to both users.
- **2.9** The system shall allow users to report a problem with an exchange.
- **2.10** The system shall allow users to select a reason for reporting a problem, such as receiving an incorrect book or not receiving a book.
- **2.11** The system shall allow users to provide additional details about the reported problem.
- **2.12** The system shall update the exchange status to indicate that a problem has been reported.

## 3. Direct Exchange
Epic SCRUM-18 · Stories SCRUM-49, SCRUM-50, SCRUM-51 · Feature owner: Sayed Mohammed

- **3.1** The system shall allow users to send direct exchange requests to book owners.
- **3.2** The system shall allow users to select a book they own to offer in exchange.
- **3.3** The system shall display the details of the books involved in the exchange request.
- **3.4** The system shall save exchange requests and track their status (pending, accepted, or rejected).
- **3.5** The system shall allow users to propose a date for the exchange.
- **3.6** The system shall allow users to propose a time for the exchange.
- **3.7** The system shall allow users to specify a meeting location for the exchange.
- **3.8** The system shall allow users to modify the proposed date, time, or location before the exchange is confirmed.
- **3.9** The system shall allow users to view received exchange offers.
- **3.10** The system shall display the details of each exchange offer, including the books involved, proposed date, time, and location.
- **3.11** The system shall allow users to accept or reject an exchange offer.
- **3.12** The system shall update the exchange offer status based on the user's response.

## 4. Feedback & User-Rating
Epic SCRUM-23 · Stories SCRUM-14, SCRUM-47, SCRUM-48 · Feature owner: Kareem

- **4.1** The system shall allow users to report other users.
- **4.2** The system shall allow users to select a reason for reporting another user.
- **4.3** The system shall allow users to provide additional details when submitting a report.
- **4.4** The system shall save submitted reports for administrator review.
- **4.5** The system shall allow users to write comments about their exchange experience.
- **4.6** The system shall allow users to submit comments along with their ratings.
- **4.7** The system shall allow users to edit or delete their own review comments.
- **4.8** The system shall display review comments to other users.
- **4.9** The system shall allow users to rate their exchange experience from 1 to 5 stars.
- **4.10** The system shall allow users to submit a rating after completing an exchange.
- **4.11** The system shall display ratings associated with each exchange on the reviewed user's profile.
- **4.12** The system shall calculate and display the average rating of each user based on their received ratings.

## 5. In-App Communication & Meeting Arrangement
Epic SCRUM-22 · Stories SCRUM-35, SCRUM-36, SCRUM-37 · Feature owner: Yousef

- **5.1** The system shall allow users to send meetup requests to other users.
- **5.2** The system shall allow users to select a date, time, and location for the meetup.
- **5.3** The system shall allow users to accept or reject meetup requests.
- **5.4** The system shall allow users to reschedule or cancel meetups.
- **5.5** The system shall allow users to send messages to other users.
- **5.6** The system shall allow users to receive messages from other users.
- **5.7** The system shall display conversation history between users.
- **5.8** The system shall allow users to view their existing conversations.
- **5.9** The system shall notify users when a meetup request is accepted or rejected.
- **5.10** The system shall notify users when a meetup is rescheduled.
- **5.11** The system shall notify users when a meetup is cancelled.
- **5.12** The system shall allow users to view their meetup notifications within the app.

## 6. Physical Book Listings
Epic SCRUM-15 · Stories SCRUM-24, SCRUM-25, SCRUM-26 · Feature owner: Sayed Ali

- **6.1** The system shall retrieve book listings from a connected library database.
- **6.2** The system shall display a list of physical books available in the database.
- **6.3** The system shall ensure that each displayed book is linked to a valid record in the library database.
- **6.4** The system shall update book listings when changes occur in the connected database.
- **6.5** The system shall display each book's title, author, and contributors.
- **6.6** The system shall display each book's publisher and publication date.
- **6.7** The system shall display each book's genre and ISBN.
- **6.8** The system shall display the number of available copies for each book.
- **6.9** The system shall allow users to select a book from the book listings.
- **6.10** The system shall allow users to mark a selected book as owned.
- **6.11** The system shall allow users to add a selected book to their wishlist.
- **6.12** The system shall allow users to view and update their owned books and wishlisted books.

## 7. Search & Filter
Epic SCRUM-21 · Stories SCRUM-38, SCRUM-39, SCRUM-40 · Feature owner: Yousef

- **7.1** The system shall allow users to search for books by title.
- **7.2** The system shall allow users to search for books by author.
- **7.3** The system shall allow users to search for books by genre.
- **7.4** The system shall display books that match the user's search query.
- **7.5** The system shall allow users to filter books by genre.
- **7.6** The system shall allow users to filter books by condition (e.g., new, good, or used).
- **7.7** The system shall allow users to filter books by availability.
- **7.8** The system shall allow users to apply multiple filters simultaneously.
- **7.9** The system shall allow users to sort search results by newest listings.
- **7.10** The system shall allow users to sort search results by popularity.
- **7.11** The system shall display search results according to the selected sorting option.
- **7.12** The system shall allow users to change the sorting option without restarting their search.

## 8. Wishlists
Epic SCRUM-17 · Stories SCRUM-19, SCRUM-41, SCRUM-43 · Feature owner: Amir

- **8.1** The system shall allow users to add books to their wishlist.
- **8.2** The system shall allow users to remove books from their wishlist.
- **8.3** The system shall prevent users from adding duplicate books to their wishlist.
- **8.4** The system shall save wishlist changes to the user's account.
- **8.5** The system shall allow users to search their wishlist by book title.
- **8.6** The system shall allow users to search their wishlist by author.
- **8.7** The system shall allow users to filter their wishlist by genre.
- **8.8** The system shall allow users to filter their wishlist by book availability.
- **8.9** The system shall create a wishlist for each registered user.
- **8.10** The system shall display all books saved in the user's wishlist.
- **8.11** The system shall display basic book details, including title, author, and genre.
- **8.12** The system shall allow users to select a book from their wishlist to view its full details.
