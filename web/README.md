# Web

This folder contains the Next.js web application for the Neighborhood Emergency Preparedness Hub MVP.

## Purpose

The web app is the main local UI for exercising the MVP flows against the backend API.

Current focus includes:

- signup and login
- email verification flow in the frontend
- profile-related screens
- help-request related screens

## Stack

- Next.js
- React
- TypeScript

## Run locally

From this folder:

```bash
npm install
npm run dev
```

## Local backend expectation

The local web app is intended to talk to the backend running at:

- `http://localhost:3000/api`

If you change your local API location, set:

- `NEXT_PUBLIC_API_BASE_URL`

## Important files

- `package.json` — scripts and dependencies
- `src/` — application source code
- `next.config.ts` — Next.js configuration

## Notes

- This module is part of the runnable local MVP.
- Run the backend and PostgreSQL first for a complete local flow.
