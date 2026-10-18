# Contributing to SwapCycle

How the SwapCycle team works together on this repository.

## Workflow
1. Pick a story or task from the Jira board (project SCRUM) and move it to **In Progress**.
2. Create a branch from `main`:
   - `feature/<short-name>` for new work, e.g. `feature/accounts-signup`
   - `fix/<short-name>` for bug fixes
   - `docs/<short-name>` for documentation
3. Commit small, focused changes (see commit messages below).
4. Push the branch and open a **pull request** into `main`.
5. At least **one teammate reviews** the pull request before it is merged. The reviewer checks the change against the story's acceptance criteria.
6. Merge, delete the branch, and move the Jira card to **Done**.

Do not push directly to `main` except for small documentation fixes agreed by the team.

## Commit messages
- Start with a verb in the present tense: *Add*, *Fix*, *Update*, *Remove*.
- Keep the first line under about 70 characters.
- Mention the Jira key when there is one, e.g. `Add sign-in form validation (SCRUM-45)`.

## Definition of Done
A story or task is **Done** when:
- its acceptance criteria are met;
- the work is committed and merged into `main` through a reviewed pull request;
- related documentation in `docs/` is updated;
- tests for new code pass (from Sprint 2 onwards);
- the Jira card is moved to Done.

## Where things live
| Folder | Contents |
|---|---|
| `docs/requirements/` | User stories, functional and non-functional requirements |
| `docs/design/` | Architecture, wireframes and UML diagrams |
| `docs/meetings/` | Sprint planning, stand-up and retrospective records |
| `docs/kanban/` | Board snapshots |
| `docs/sprint1/` | Burndown, velocity and impediment log |
| `src/` | Application source code |
| `tests/` | Automated tests |

## Meetings
- Two stand-ups per week: what I did, what I'll do next, any blockers.
- Sprint planning at the start of each sprint and a retrospective at the end.
- Minutes are added to `docs/meetings/` as Markdown, one file per meeting.
