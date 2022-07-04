# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `production` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]

### Changed

- Request for incident category text message to imply that they don't need to respond immediately.
- Production deployment instructions in the README.

### Added

- Console function to enable developers to force reset and bypass DEVICE_RESET_THRESHOLD (CU-2e5adgd).
- The ability to use different language chatbot messages (CU-2dtutrx).

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

[unreleased]: https://github.com/bravetechnologycoop/BraveSensor/compare/v6.1.0...HEAD
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
