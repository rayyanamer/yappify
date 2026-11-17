# Yappify

A lightweight, anonymous, real-time group chat built with a single HTML page, Firebase Realtime Database, and ImgBB image hosting.

> **Yappify is a shared public lobby.** It does not require users to create accounts or choose usernames.

## Features

- **Live group chat** — messages appear for connected visitors in real time.
- **Anonymous posting** — each browser tab gets a temporary sender ID; it is not displayed as a username.
- **Image sharing** — upload JPG, PNG, WEBP, or GIF images through ImgBB and share the resulting image URL in chat.
- **Compact image previews** — images are displayed at a reduced size in message bubbles; clicking one opens the hosted image.
- **Online count** — a lightweight presence heartbeat estimates how many visitors are currently active.
- **Clickable links** — URLs in messages are rendered as links.
- **Message timestamps** — messages show relative time, clock time, and date.
- **Small quality-of-life features** — message copying, latest-message shortcut, upload preview, and a short send cooldown.

## Tech stack

- HTML, CSS, and vanilla JavaScript
- Tailwind CSS via CDN
- Firebase Realtime Database (JavaScript SDK v10.12.2)
- ImgBB API v1 for image hosting
- Google Fonts — JetBrains Mono

## Getting started

### 1. Get the project files

Download or clone this repository. The app is contained in `index.html`.

### 2. Configure Firebase

Create a Firebase project and enable **Realtime Database**.

In `index.html`, find the `FIREBASE_CONFIG` object and replace its values with your Firebase web app configuration:

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

The database URL must point to the Realtime Database instance you created.

### 3. Configure ImgBB

Create an API key in your ImgBB account. In `index.html`, set:

```js
const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY";
```

Image uploads will not work until a valid key is configured. Text messaging uses Firebase and does not require ImgBB.

**Security warning:** this is a client-side static website. Any API key placed in `index.html` can be viewed by visitors through browser developer tools or the downloaded source. A public ImgBB key can be copied and used by others. For a production deployment, move image uploads behind a server-side or serverless endpoint and keep the key there. Do not commit private credentials.

### 4. Set up Realtime Database access

Configure Firebase Realtime Database rules for your intended audience before publishing.

The app writes chat messages under:

```text
rooms/
  public-lobby/
    <message-id>/
      sender
      text
      ts
      imageUrl   (only when a message includes an image)
```

It writes visitor presence under:

```text
presence/
  public-lobby/
    <client-id>/
      lastSeen
```

The app needs permission to read the lobby and presence data, write messages, and update/remove its own presence record. Do not use unrestricted database rules as a production security solution. Add suitable validation, rate limits, and abuse protection on the server side if the chat is public.

### 5. Run the app

Because the page uses JavaScript modules and remote services, serve it through a local web server rather than opening it directly with a `file://` URL.

For example, with Python installed:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also deploy the static page to GitHub Pages or another static hosting provider after configuring Firebase and ImgBB.

## How it works

1. The browser connects to Firebase Realtime Database.
2. Messages are written to the `rooms/public-lobby` path and streamed to connected visitors.
3. When an image is selected, the browser uploads it to ImgBB.
4. ImgBB returns a hosted image URL.
5. Yappify saves that URL alongside the message in Firebase.
6. Other visitors load the image from the hosted URL.

Firebase stores the message text and image URL; ImgBB hosts the image file.

## Current limits and behavior

- One shared room: `public-lobby`.
- Message text is limited to 500 characters.
- A 2.5-second cooldown is applied between successful sends.
- Images are limited to 5 MB each.
- Accepted image formats: JPG/JPEG, PNG, WEBP, and GIF.
- The online count is an estimate based on periodic presence updates.
- Sender IDs are generated per browser tab and are not verified identities.
- The app does not currently provide accounts, private rooms, message moderation, or an in-app message deletion interface.

## Privacy and safety

- Messages in the public lobby may be visible to everyone who can read the Firebase database.
- Shared image URLs point to images hosted by ImgBB. Anyone with access to a URL may be able to view the image.
- Do not post passwords, personal contact details, private documents, or images you do not want shared.
- Anonymous posting does not guarantee that a visitor cannot be identified by their network, browser, hosting, or service-provider records.
- Add moderation, validation, and abuse controls before opening a public deployment to a large audience.

## Customization

The main settings are near the top of the JavaScript module in `index.html`:

```js
const ROOM_ID = "public-lobby";
const COOLDOWN_MS = 2500;
const PRESENCE_TTL_MS = 20000;
const PRESENCE_HEARTBEAT_MS = 7000;
```

Change `ROOM_ID` if you want the app to use a different room path. All visitors must use the same room ID to see the same chat.

## License

Add a license file if you want to specify how others may use, modify, or distribute this project. Without a license, normal copyright restrictions apply.
