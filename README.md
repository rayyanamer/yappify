# yappify

A lightweight real time public chat web application built with vanilla HTML, CSS, JavaScript, and Firebase.

## Features

* **Real time messaging**: Instant message delivery and live online presence tracking powered by Firebase Realtime Database and Anonymous Authentication.
* **Subtle user differentiation**: Each anonymous sender receives a deterministic muted bubble tint and unique hex identifier derived from their session UID.
* **Replies and gestures**: Swipe right on any message bubble or use the details menu to quote and jump back to earlier messages.
* **Image sharing**: Upload JPG, PNG, WEBP, or GIF files up to 5 MB with inline previews.
* **Message inspection**: Tap any message bubble to view sender ID, user hex color, local and UTC timestamps, and payload size.
* **Themes**: Switch between Crimson, Lime, Cobalt, and Amber accents from the status dock.

## Project Structure

* `index.html`: Page layout, header status dock, message feed, and composer UI.
* `styles.css`: Responsive dark interface, theme variables, and animations.
* `app.js`: Firebase initialization, presence heartbeats, message rendering, image uploads, and profanity filtering.

## Running Locally

Because `app.js` uses ES modules, serve the directory with any static local server rather than opening `index.html` directly over the `file://` protocol.

```bash
npx serve .
```