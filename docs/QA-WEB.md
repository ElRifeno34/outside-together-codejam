# QA web — Montréal 24-hour demo

Use a desktop browser and a phone browser, three disposable accounts, a seeded board, and one completed activity. Record browser, revision, account, test ID and result. The local seed is synthetic. Use checked public places for the live demo.

| ID | Scenario | Expected result |
| --- | --- | --- |
| WEB-01 | Open a private browser window and view the board and an activity. Click Join. | The listings and counts load without an account. Joining prompts for sign-in. |
| WEB-02 | Ask for basketball on Friday afternoon. Repeat around Montréal midnight and with a slow or invalid AI response. | The supplied Montréal date resolves Friday correctly. Results use valid database rows and available places. On failure, keyword search or filters preserve browsing and joining. |
| WEB-03 | Sign in and join from an activity page. In a second window, refresh the board. | The member is registered and both views can read the updated count. |
| WEB-04 | Two accounts request the last place simultaneously. Repeat a Join request from the successful account. | At most one account gets the last place. A replay stays joined without increasing the count. An activity already underway is closed to joins. |
| WEB-05 | Search for a valid activity without a match. Cancel the draft, then repeat and publish. Attempt to publish at a non-public place. | Cancelling leaves the board unchanged. Explicit publication creates one listing with the creator registered. A non-public location is refused. |
| WEB-06 | Confirm before the activity ends, then confirm with one account after the end. Confirm with the second and retry both requests. | Early confirmation fails. One confirmation earns zero. Two confirmations earn 15 points each for basketball with niche value 1. Replays earn nothing more. |
| WEB-07 | Repeat with a photo walk at niche value 4. Try to write points directly as a normal account. | The photo walk earns 30 points per confirmed person. The direct write is denied. |
| WEB-08 | Let a session start without its minimum number of people. | It disappears from the public board and cannot earn attendance points. |

Use `supabase/qa/core.sql` for repeatable database checks. Browser checks for authentication, Edge Functions, the filter UI, and the fallback recording require the integrated demo. At H19, freeze features and run the selected demo path three times. Keep a recording of search, join, draft review and points in case the room network fails.
