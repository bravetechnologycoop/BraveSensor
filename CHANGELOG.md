# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `master` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]

## [2.0.0]
### Added
- Express validations for endpoints (CU-hx0jjc)

### Changed
- checkHeartbeat to run every 15 seconds to fix lack of alerts when sensors go down (CU-p34wcw)
- Use Brave Alert Lib for Twilio communication with the Responder (CU-bar1zy)
- Update to use Brave-wide linting standard (CU-kcxpaw)

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
- Alert reason attribution bug  (CU-gcuxtz)
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


[Unreleased]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.1...v1.2.0
[1.1]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.1-alpha...v1.1
[1.1-alpha]: https://github.com/bravetechnologycoop/BraveSensor-Server/compare/v1.0...v1.1-alpha
[1.0]: https://github.com/bravetechnologycoop/BraveSensor-Server/releases/tag/v1.0
