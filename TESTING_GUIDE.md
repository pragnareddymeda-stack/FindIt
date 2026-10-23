# Browser testing guide

Use this after `npm run install:all`, `npm test` and `npm run build` have passed and `server/.env` is set. Start everything with `npm run dev`
and open http://localhost:5173. Tip: run `npm run seed` first for demo accounts (password `Demo@12345`), or register your own. Use two browsers
(or one normal and one private window) to play two people.

## 1. Accounts
1. Register "Asha" (any email, a password with a letter and a number). You land on the dashboard.
2. Refresh the page: you are still signed in. Log out, log in again.
3. Try registering the same email again: you see an error. Try a short password: you see a field error.
4. Open the browser dev tools > Application > Local Storage: there is **no token** stored. (Cookies show `findit_token` as HttpOnly.)

## 2. Reports, search and privacy
1. As Asha, **Report lost**: a black wallet, category Wallets and purses, a recent date, location "Central library".
2. In the second browser, register "Ravi" and **Report found**: a black leather wallet, same place, add two verification questions with expected answers and private details.
3. Browse reports **while logged out**. Both appear. Open Ravi's report: you must not see the private details, the questions' answers, or anything else private.
4. Try the filters (keyword `wallet`, type, category, location, dates) and pagination. Clear filters.
5. Edit one of your reports, then withdraw one. It disappears from Browse; it stays in **My reports** as Withdrawn.

## 3. Matching and claims
1. As Asha, open **My reports > Matches** on the lost wallet: Ravi's wallet appears with a percentage and a breakdown, and a notice that it is not proof of ownership.
2. Open Ravi's report as Asha and choose **Claim this item**. Write an explanation and answer every question. Submit.
3. As Ravi, check **Notifications** (a "New claim" item; the badge updates live) then **Incoming claims > Review claim**. You see Asha's answers next to your expected answers.
4. Approve. As Asha, the claim shows Approved and a notification arrives. Ravi cannot claim his own report, and Asha cannot claim twice.

## 4. Handover
1. On the approved claim choose **Start handover**. Set a meeting time and a public place.
2. As Ravi choose **I handed the item over**. As Asha, before that step the "I received my item" button must not be available; after it, confirm receipt.
3. The report is now Returned (Browse with status Returned). Try **Report a problem** on a fresh handover to see the dispute path.

## 5. Messaging
1. On a claim choose **Message the finder / claimant**. Send messages both ways; they should appear live. The page says whether live updates are on.
2. A third account must not be able to open that conversation (it gets "does not exist or you do not have access").
3. Reject or withdraw a claim: its conversation becomes read-only.

## 6. Admin
1. `cd server && ADMIN_EMAIL=you@example.com npm run create-admin`, then log in as that user. An **Admin** link appears.
2. Dashboard numbers match what you created. As Asha, use **Report this listing** on Ravi's report; as admin see it under Abuse reports and Reports > Flagged only.
3. Hide a report (reason required): it vanishes from Browse and the owner is notified. Restore it. Suspend a user: they are signed out on their next click. Reactivate.
4. Resolve a disputed handover. Open **Audit logs**: every action above is listed.
5. As a regular user, open http://localhost:5173/admin: you are redirected. Calling `/api/v1/admin/dashboard` while logged in as a regular user returns 403.

## 7. Photos (only if Cloudinary is configured)
Create a report with a JPEG, PNG or WebP under 3 MB: it appears on cards and the detail page. Try a PDF, a renamed text file and a 5 MB image: all are refused. Remove the photo from Edit.
Without Cloudinary the photo field is not shown.

## 8. Quick checks
Resize the window to phone width: pages stay usable. Tab through a form with the keyboard. Stop the server: pages show an error with a retry, not a blank screen.
