# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `production` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]

### Added

- Allow Duration alerts to repeat. The duration timer is reset after a duration alert is triggered (CU-8678tmmew).

## [10.6.0] - 2024-01-23

### Added

- `number_of_alerts` integer column to the sessions table (CU-860r8k57h).
- Chatbot flow to reset a sensor if the `number_of_alerts` in a session meets or exceeds the threshold `SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST` (CU-860r8k57h).
- English and (temporary) Spanish translations of `alertAcceptResetRequest`, `clientMessageForRequestToReset`, `resetNoticeToRequester`, `resetNoticeToOtherResponders`, `resetRequestRejected` (CU-860r8k57h).

### Changed

- `index.js` handling of `/api/sensorEvent` into `particle.js` and `sensorEvent.js` files to match Buttons (CU-13kqjz8).

## [10.5.0] - 2024-01-08

### Removed

- OneSignal functionality (CU-86dqkmhza).
- OneSignal remnants Alert API Key and Responder Push ID from database and dashboard (CU-86dqkmhza).

## [10.4.0] - 2023-12-14

### Added

- PA route /pa/check-database-connection to check if database connection is working as expected (CU-86dqkw7ef).

## [10.3.0] - 2023-12-07

### Added

- Language field to the add new client page of dashboard (CU-3bnggtt).
- English and Spanish options to language field in new client page of dashboard (CU-3bnggtt).
- Feature that automatically populates the incident category field upon selection (CU-3bnggtt).
- The ability to switch the language of an existing client from English to Spanish directly from the edit client page (CU-2q39wtu).
- Incident categories are stored in English in the database for all clients, simplifying the reporting process for statistics (CU-8678zfmph).
- Dynamically translating incident categories to the client's chosen language, similar to the translation of messages from a predefined JSON file  (CU-8678zfmph).
- Integration tests for db.getActiveClients (CU-w9bcb5).

### Changed

- API route /api/message-clients to become the PA API route /pa/message-clients, now authenticating with Google (CU-w9bcb5).
- Unit tests for pa.handleMessageClients (CU-w9bcb5).

## [10.2.0] - 2023-11-30

### Added

- /pa/get-google-tokens route to the sensors server handled by getGoogleTokens in pa.js (CU-8679128c8).
- /pa/get-google-payload route to the sensors server handled by getGooglePayload in pa.js (CU-8679128c8).
- Unit tests for getGoogleTokens and getGooglePayload (CU-8679128c8).

### Changed

- PA API routes /pa/create-sensor-location, /pa/get-sensor-clients, /pa/sensor-twilio-number to use googleHelpers.paAuthorize instead of clickUpHelpers.clickUpChecker (CU-8679128c8).
- Unit tests for api.authorize function to follow conventions in other testing files.
- Upgraded `brave-alert-lib` to v10.3.1 (CU-8679128c8).
- Updated README Instructions (CU-8678yk217).

### Security

- Upgraded `axios` from 0.21.4 to 1.6.0.

### Removed

- DigitalOcean files from old infrastructure that are no longer used (CU-8678yk217).

## [10.1.1] - 2023-11-15

### Fixed

- BeginTransaction retry logic, added return keyword for recursion and split function into two (CU-8679376g6).

### Added

- Integration tests for beginTransaction functionality (CU-8679376g6).

## [10.1.0] - 2023-11-02

### Changed 

- Database function getMostRecentSensorsVitalWithLocation to take in entire location as parameter instead of just the locationid (CU-8678wudz8).

### Added

- Return value when beginTransaction function fails to start and error handling to try and prevent deadlocks (CU-8678wudz8).

### Removed 

- Locks on unnecessary tables in beginTransaction function (CU-8678wudz8).

### Fixed

- Specify 1 byte write into Door ID flash addresses, preventing erroneous overwrite of long stillness timer flash addresses (CU-8678xpmpu). 
- Test data object in handleHeartbeatTest to include "isINSZero" key-value (CU-8678y7w9y).
- Clang formatting error by removing extra space.

## [10.0.0] - 2023-10-12

### Added

- Timer in state0 that is reset when the door closes during which the sensor is allowed to detect for occupation (CU-8678t4ztg).
- Console function for the occupation detection timer as well as the timer count and timeout value in Debug Publishes (CU-8678t4ztg).
- API call /api/message-clients that sends a POSTed message to all clients with active sensors (CU-w9bcb5).

### Fixed

- Response object of /api/message-clients to match conventions described at the top of api.js.

## [9.10.0] - 2023-10-06

### Added

- Implemented internal alert functionality with Sentry alerts triggered when a sensor's INS value is less than or equal to zero (CU-8678v3y54).

### Changed

- README for AWS infrastructure changes (CU-860ra8f7q).

## [9.9.0] - 2023-10-03

### Added

- Cloud function to reset the current Stillness Timer (CU-860rbtg4k).

### Changed

- Reset Stillness Timer when a Responder responds (CU-860rbtg4k).

## [9.8.0] - 2023-09-29

### Security

- Upgrade Chai and brave-alert-lib (CU-8678wgn0p).

### Added

- Unit tests for API authorize function (CU-8678uuvjm).
- Added 'View Client' button to Internal Dashboard-Location page (CU-8678vn1r5).
- GitHub Actions to deploy to AWS infrastructure on Production (CU-860ra8f7q).

### Fixed

- API authorize function to work with PA API keys submitted in body of request (CU-8678uuvjm).
- Incorrect calls to clearTable in API integration tests.

## [9.7.0] - 2023-09-21

### Added

- CORS configuration to Express Proxy Middleware.
- "doorMissedFrequently" field to JSON data submitted by brave sensors that is sent to /api/heartbeat (CU-860rk8v2a).
- Sentry log in the case that doorMissedFrequently is true in posted data from brave sensor (CU-860rk8v2a).
- GitHub Actions to deploy to AWS infrastructure on Dev and Staging (CU-860ra8f7q).

### Fixed

- Wording in consoleFunctionTests.cpp when functions are called with 'e'.

### Removed

- Unused environment variable `RADAR_WINDOW_SIZE_SECONDS`.

## [9.6.0] - 2023-07-20

### Changed

- Updated README.

### Added

- Auto-shut off for debug publishes after 8 hours (CU-860r0z9zb).
- Vitals Alerts for when a door sensor's Tamper Flag turns on (CU-860pp0zfn).

### Fixed

- Vitals Alerts for when a door sensor's Low Battery Flag changes.

### Security

- Upgrade to Node.js 18.16.1 (CU-860pqat6u).

## [9.5.0] - 2023-06-02

### Fixed

- Initialization of Long Stillness Threshold (CU-860r11fng).

## [9.4.0] - 2023-05-23

### Changed

- `db.clearLocation` also makes sure to clear the relevant rows from `sensors_vitals_cache` and `sensors_vitals`.

### Added

- Add a second, "long" stillness threshold for each Sensor (CU-860q2an4r).
- Sentry logs when an unusually high number of stillness alerts occurs in set interval of time at each location (CU-2chw8y0).

### Removed

- `SUBSEQUENT_ALERT_MESSAGE_THRESHOLD` (CU-860q2an4r).

## [9.3.0] - 2023-04-27

### Added

- Particle fields to the Locations table in the DB (CU-2chw9e3).
- AWS Dockerfile.

### Changed

- DB setup script.
- Broke up the Client and Location `is_active` fields into the component parts: `is_displayed`, `is_sending_alerts`, and `is_sending_vitals` (CU-860ptt5rp).
- Only display Clients and Locations in the dashboard if their `is_displayed` is true (CU-860ptt5rp).
- Only send vitals messages if the relevant `is_sending_vitals` is true (CU-860ptt5rp).
- Only send Stillness/Duration alerts if the relevant `is_sending_vitals` is true (CU-860ptt5rp).
- Allow the Heartbeat Phone Numbers field to be empty when adding/editing Clients on the Dashboard (CU-2uad09a).

## [9.1.0] - 2023-03-13

### Changed

- Replaced bit.ly link in low battery message with a YouTube link (CU-2mddwpd).

### Security

- Upgrade dependencies (CU-860phzbq5).
- Add API Key to Particle webhooks (CU-yfdndf).

## [8.0.0] - 2022-01-30

### Changed

- Updated to Device OS 3.3.1 (CU-3aru0mb).
- Replaced locationid with client display name in Sensor disconnection initial and reminder messages (CU-2q39wpk).
- Sensor heartbeat API call body key changed from 'doorLastHeartbeat' to 'doorLastMessage' (CU-34atvnc).

### Added

- `GET /api/sensors` route to be used by new Dashboard in PA (CU-2chw9e3).
- `GET /api/sensors/:sensorId` route to be used by new Dashboard in PA (CU-2chw9e3).
- Include suggestion to check door sensor in Sensor disconnection message and reminder (CU-860pga04t).

### Security

- Upgrade dependencies according to Dependabot.

### Fixes

- When the sensor starts up, it no longer claims that it just saw the door sensor. The previous 'doorLastSeenAt' is used until a real new door message is received (CU-34atvnc).

## [7.1.0] - 2022-12-22

### Changed

- Sensor state machine to reset stillness timer and transition back to stillness state after receiving a stillness alert (CU-39w5av5).
- Sensor state machine to transition back to duration state after receiving a duration alert (CU-39w5av5).
- Sensor duration alerts to only occur at most once per door close (CU-3c6my58).
- Modified im21_door_id_set function to return the current door ID, converted to a decimal number (CU-3455bc0).

### Added

- New stage "firmware linting and formatting checks" to Travis CI, which lints and checks the formatting of firmware code, failing the build if errors are found (CU-1k10ejd).

## [7.0.0] - 2022-12-13

### Changed

- Travis CI to run new unit tests as a part of the build process.

### Added

- Mock header files allowing unit tests to be compiled (CU-2y84mrc).
- Unit tests for some IM door sensor functions.
- Unit tests for some INS3331 functions.
- Echo functionality for toggle debugging publishes cloud function (CU-3zybq3y).

### Removed

- XeThru + SSM smoke test (CU-m0we0t).

## [6.4.0] - 2022-11-08

### Changed

- Production deployment instructions in the README.
- Created string_convert namespace for string_convert.cpp functions.

### Added

- Ability to scan for and receive advertising data from IM24 door sensors (CU-3644bwf).

## [6.3.0] - 2022-08-22

### Changed

- Allow Twilio numbers to be shared across clients (CU-2fk3y8a).
- Updated disconnection message and reminder to be accurate for the Boron enclosures (CU-2kwa2zz).
- Improve Twilio number purchasing error messages.

### Removed

- Sentry logs when a heartbeat is received with an unknown Particle Core ID (CU-2ju4ky8).

## [6.2.0] - 2022-07-21

### Changed

- Request for incident category text message to imply that they don't need to respond immediately.
- Production deployment instructions in the README.

### Added

- Console function to enable developers to force reset and bypass DEVICE_RESET_THRESHOLD (CU-2e5adgd).
- The ability to use different language chatbot messages (CU-2dtutrx).
- Country, Country Subdivision, and Building Type columns to the CSV Export (CU-2c6crcn).

## [6.1.0] - 2022-06-27

### Changed

- Updated `sessions` table to better match the shared DB schema (CU-x1d6mq).
- Allow multiple Responder Phones per Client (CU-2dm6x2j).

### Added

- Boron Sensor heartbeat optimizations, to improve debugging and door connectivity (CU-24qak6k).
- More Door Sensor addresses to the BLE filter (CU-2f1x56y).
- Track the responsible Responder Phone for each session (CU-2dm6x2j).

## [6.0.0] - 2022-06-09

### Changed

- Email address to contact if the clients are having troubles reconnecting their sensor.
- Debug log flag now global (CU-2chv6je).
- Updated to Device OS 3.3.0 for improved BLE methods (CU-2bffw4q).

### Removed

- Transaction when handling incoming Boron heartbeat messages (CU-2atyr1z).
- Transaction when handling incoming Argon door messages (CU-2atyr1z).
- Brave Siren product (CU-289wcj9).

### Added

- Changed door sensor scanning to use filters (CU-2bffw4q).
- Delay for the OTA reset, so to not reset while in session (CU-1tdbg9r).
- If debug flag is on, logging of raw door sensor data (CU-2chv6je).

## [5.3.0] - 2022-05-17

### Added

- Link to the door sensor battery replacement video in the low battery alert (CU-25e7zqf).
- Sensors Vitals cache table of only the most recent heartbeat from each locationid (CU-2atyr1z).
- Ability to turn on/off DB debug logs (CU-2atyr1z).
- Links on the Vitals the Client Vitals page to the Client and Location pages.

### Changed

- Chatbot text messages no longer assume that the Sensor is installed in a bathroom (CU-271q62d).
- Sensors Vitals pages now show sensors which have never sent a heartbeat message.

### Removed

- Auto-refresh from Vitals Dashboard pages (CU-2atyr1z).

## [5.2.0] - 2022-05-09

### Added

- Indexes on `sessions.locationid` and `sensors_vitals.locationid` (CU-2atyr1z).

### Fixed

- Added `sensors_vitals` to the list of tables that is locked during a DB transaction (CU-2atyr1z).

## [5.1.0] - 2022-05-05

### Added

- Endpoints for use by PA (CU-21ghk0x).

## Changed

- Upgraded to Node 16 (CU-28na1cx).
- Changed antenna source on the Boron to use internal antenna instead of the external antenna (CU-28kqh3y).
- Increased BLE scan results to 25 from 10 previously (CU-28uxgq6).

### Security

- Updated dependencies.

## [5.0.0] - 2022-04-18

### Added

- Proxy endpoints to ClickUp's API (CU-21ghk0x).
- Client Vitals pages to the Dashboard (CU-mmzh6b).
- Vitals page to the Dashboard (CU-mmzh6b).
- Automatic text message when the Boron door sensor has been offline for more than the threshold (CU-1d42h1g).

### Changed

- Added missing rows to the `clients` table and started using them.

### Removed

- Unused device health endpoint (api/devicevitals).
- Unused INS radar data endpoint (api/innosent).
- `radar_type` column in `locations` table.

### Security

- Updated dependencies.

## [4.5.0] - 2022-01-14

### Added

- Innosent firmware state machine smoke test (CU-1tdbnjg).

### Changed

- Trim all values when adding or editing Clients and Locations (CU-1pdmvee).

## [4.4.0] 2021-12-21

### Added

- Reminder messages about disconnections (CU-121pbg9).

### Changed

- No longer use body-parser (CU-13kqxyt).

## [4.3.0] 2021-12-02

### Added

- Sound effects to push notifications (CU-10xfkhr).
- "Export CSV" button to the Dashboard (CU-1mek79g).
- `GET /alert/newNotificationsCount` endpoint (CU-hjwcwk).

### Changed

- Branching scheme (CU-mn5q4g).

## [4.2.0] 2021-10-14

### Added

- Added Particle cloud function call to start siren in case of alert (CU-18r17vf).
- `POST /api/sirenAddressed` to handle when a Brave Siren's button is pressed (CU-1dffcm4).
- `POST /api/sirenEscalated` to handled when a Brave Siren times out and it wants to escalate the alert to the Fallback phones (CU-1dffcm4).
- `responder_push_id` to the DB to store the Responder Device's Push Notification ID (CU-10xfkhr).
- `POST /alert/acknowledgeAlertSession` to acknowledge an alert session through the Alert App (CU-10xfkhr).
- `POST /alert/respondToAlertSession` to respond to an alert session through the Alert App (CU-10xfkhr).
- `POST /alert/setIncidentCategory` to set the incident category for an alert session through the Alert App (CU-10xfkhr).
- `GET /alert/activeAlerts` endpoint (CU-10xfkhr).
- Low battery checks in heartbeat api for firmware state machine (CU-4avrhp).
- Tracking of reset reason to reconnection alerts (CU-z9e1md).
- Heartbeat messages enriched, including state transition data (CU-1c1qd5u).
- `/firmware` folder with production code for devices (CU-un6ybt).
- Unit tests for Particle console functions (CU-vbep38).

### Fixed

- IM21 door sensor signal processing (CU-4avrue).

## [4.1.0] - 2021-08-30

### Added

- Alert Type to the Dashboard.
- Tracking of when sessions are first responded to (CU-hjwfx2).
- `GET /alert/historicAlerts` endpoint (CU-hjwfx2).
- Sentry log when the IM21 sends the tamper bit.

### Changed

- Use an enum for Alert Type in the DB and from Alert Lib instead of strings.
- Use the `from_phone_number` from the database for heartbeat and fallback messages (CU-qv3nj3).
- Updated dashboard to reflect the new structure of `Client` and `Location` (CU-qv3nj3).

### Removed

- INS smoke tests.

### Fixed

- Database and Redis error output.

## [4.0.0] - 2021-07-26

### Added

- Endpoint for firmware state machine alerts (CU-v9ae26).
- Storing and checking firmware state machine heartbeat messages (CU-v9ae26).
- Security audit to Travis (CU-121j22d).

### Changed

- Decoupled state machine from Sessions (CU-v9ae26).
- Refactored and merged radar state machines (CU-v9ae26).
- Querying for radar moving average with time instead of number of entries.
- For API calls from XeThru devices, use `coreid` instead of `location` to determine which Location it's from (CU-mt15y9)

### Fixed

- Fixed bug where stringifying error messages was resulting in empty strings instead of useful error information.

## [3.4.0] - 2021-06-21

### Added

- Storing and checking for door heartbeat messages (CU-wf97dy).
- Mocha debugging configuration.

### Changed

- logSentry calls appear as messages instead of exceptions (CU-px7k6e)

### Fixed

- Error log for /alert/sms now has the correct route name

## [3.3.0] - 2021-05-27

### Added

- Ability to send heartbeats to multiple recipients (CU-rx46w0)
- Tracking errors and outages with Sentry (CU-px7k6e)
- API Key for locations (CU-hjwazd)
- Concept of active/inactive locations (CU-rk8axg)

### Changed

- Improved some API error messages.
- Heartbeat text now contains troubleshooting instructions and contact email for follow-up. (CU-rx46w0)
- Do not change state or send alerts for inactive locations (CU-rk8axg)
- Always return 200 to Particle when it calls our APIs (CU-m0we6c)

### Fixed

- Helm chart RELEASE variable error when the image tag happened to be an integer
- Race condition in auto-reset (CU-vf7z0f)

## [3.2.0] - 2021-04-26

### Changed

- More consistent DB interactions (CU-kry5t5)

### Added

- Ability to have multiple fallback phone numbers (CU-pv8hd5)

### Changed

- More consistent DB interactions (CU-kry5t5)

### Fixed

- Sessions are no longer blocked after a fallback message is sent (CU-tnarab)

## [3.1.0] - 2021-04-12

### Added

- INS radar endpoint (CU-m0wdfn)
- INS radar state machine (CU-m0wdfn)
- Forms and routes for adding/updating locations in browser instead of having to go into the db (CU-m72ted)

### Changed

- Update landing page to display list of locations with how long ago most recent session was started (CU-mmzgy9)
- Update checkHeartbeat to check both XeThru and INS (CU-m0wdfn)
- Using https on backend (CU-mt3fah)
- Use helpers.logError (CU-jcuw85)

### Fixed

- Taking absolute value of INS radar readings before averaging (CU-qv7qqq)
- Renamed locations database columns for clarity, added unique primary key constraint on locationid (CU-gez8x0)

### Removed

- Unused database columns (CU-gez8x0)
- Timestamps from logs (CU-jcuw85)

### Security

- Add Twilio validation to make sure that post requests are coming from Twilio and relevant tests (CU-dgmfbv)

## [3.0.0] - 2021-03-18

### Added

- Script, endpoints, and instructions for smoke tests (CU-kcxndt)
- Update to use Brave-wide linting standard (CU-kcxpaw)
- Saving control field in door sensor requests (CU-n70k94)
- Automatic uploading of Docker containers to Digital Ocean using Travis (CU-mrxren)

### Changed

- checkHeartbeat to run every 15 seconds to fix lack of alerts when sensors go down (CU-p34wcw)

### Removed

- Smartapp integration, dependencies, and tests (CU-p980za)

### Security

- Updated to latest version of minimist (CU-kry4g7)

## [2.0.0] - 2021-03-08

### Added

- Express validations for endpoints (CU-hx0jjc)

### Changed

- Use Brave Alert Lib for Twilio communication with the Responder (CU-bar1zy)

## [1.2.0] - 2021-02-12

### Added

- New mustache frontend (CU-dwr2xb)
- Script which runs all database migrations
- Integration tests (CU-gcuxtz)
- Utility functions for test setup and teardown (CU-gcuxtz)
- Helpers for test environment variables (CU-gcuxtz)
- Changelog
- Build scripts for tagging and pushing containers
- Linting
- Device health endpoint (CU-h2y2nt)
- IM21 door sensor endpoint (CU-h2y2nt)
- Helm chart (CU-kcxn8q)

### Fixed

- Bug in calculating session duration (CU-gcuxtz)
- Session creation concurrency bug (CU-gcuxtz)
- Alert reason attribution bug (CU-gcuxtz)
- Session creation when there is no previous session for a location (CU-gcuxtz)
- Update location_human in fallback message to display_name to fix display issue (CU-mgz8vq)

### Security

- Removed all references to axios < v0.21.1 (CU-j6yuzk)

### Removed

- Old angular frontend (CU-dwr2xb)
- Unused PostgreSQL functions
- Unused PostgreSQL tables
- Sentry tracking of runtime errors
- Unused and deprecated load testing scripts

## [1.1] - 2020-10-07

### Added

- Sentry tracking of runtime errors
- Alert reason included in the initial chatbot message (stillness, duration)
- Fallback alert functionality added
- Fallback alerts sent with human readable bathroom text

## Fixed

- Heartbeat alert implementation
- Chatbot interference when a single responder phone is dealing with simultaneous sessions from multiple bathrooms

## [1.1-alpha] - 2020-09-23

### Added

- Sentry tracking of runtime errors
- Alert reason included in the initial chatbot message (stillness, duration)
- Fallback alert functionality added
- Fallback alerts sent with human readable bathroom text

### Fixed

- Heartbeat alert implementation

## [1.0] - 2020-08-28

### Added

- Dockerized ODetect application w/ Dockerfile
- Redis used as in-memory database for sensor data
- Kubernetes deployment of ODetect app, redis server
- Battery life monitoring for Door sensors
- Replay Data functionality to simulate historical data and test new state machine candidates

[unreleased]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.6.0...HEAD
[10.6.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.5.0...v10.6.0
[10.5.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.4.0...v10.5.0
[10.4.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.3.0...v10.4.0
[10.3.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.2.1...v10.3.0
[10.2.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.1.1...v10.2.0
[10.1.1]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.1.0...v10.1.1
[10.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v10.0.0...v10.1.0
[10.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.10.0...v10.0.0
[9.10.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.9.0...v9.10.0
[9.9.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.8.0...v9.9.0
[9.8.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.7.0...v9.8.0
[9.7.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.6.0...v9.7.0
[9.6.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.5.0...v9.6.0
[9.5.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.4.0...v9.5.0
[9.4.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.3.0...v9.4.0
[9.3.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v9.1.0...v9.3.0
[9.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v8.0.0...v9.1.0
[8.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v7.1.0...v8.0.0
[7.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v7.0.0...v7.1.0
[7.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v6.4.0...v7.0.0
[6.4.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v6.3.0...v6.4.0
[6.3.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v6.2.0...v6.3.0
[6.2.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v6.1.0...v6.2.0
[6.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v5.3.0...v6.0.0
[5.3.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v5.2.0...v5.3.0
[5.2.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v4.5.0...v5.0.0
[4.5.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v4.4.0...v4.5.0
[4.4.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v4.3.0...v4.4.0
[4.3.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v4.2.0...v4.3.0
[4.2.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v3.4.0...v4.0.0
[3.4.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/bravetechnologycoop/BraveSensor/compare/v1.1...v1.2.0
[1.1]: https://github.com/bravetechnologycoop/BraveSensor/compare/v1.1-alpha...v1.1
[1.1-alpha]: https://github.com/bravetechnologycoop/BraveSensor/compare/v1.0...v1.1-alpha
[1.0]: https://github.com/bravetechnologycoop/BraveSensor/releases/tag/v1.0
