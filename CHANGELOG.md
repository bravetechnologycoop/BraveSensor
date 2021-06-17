# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `master` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]

### Added

- Endpoint for firmware state machine alerts (CU-v9ae26).
- Storing and checking firmware state machine heartbeat messages (CU-v9ae26).

### Changed

- Decoupled state machine from Sessions (CU-v9ae26).
- Refactored and merged radar state machines (CU-v9ae26).


## [3.4.0] - 2021-06-21

### Added

- Storing and checking for door heartbeat messages (CU-wf97dy).
- Mocha debugging configuration.

### Changed

- logSentry calls appear as messages instead of exceptions (CU-px7k6e)
- For API calls from XeThru devices, use `coreid` instead of `location` to determine which Location it's from (CU-mt15y9)

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

[unreleased]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v3.4.0...HEAD
[3.4.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.1...v1.2.0
[1.1]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.1-alpha...v1.1
[1.1-alpha]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.0...v1.1-alpha
[1.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/releases/tag/v1.0
