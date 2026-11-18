# yappify

A small real time chatroom made with HTML, CSS, JavaScript and Firebase.
The idea is pretty simple: open the page, join the public room and chat
with whoever is there.

It keeps the interface minimal while still including a few useful
details for people who like knowing what is happening behind the scenes.

## What it includes

-   **Live chat:** Messages appear in the room without needing to
    refresh the page.
-   **Online counter:** Shows the number of active sessions in the room,
    using Firebase presence updates.
-   **Replies:** Reply to a message and jump back to the original
    message by selecting its preview.
-   **Image sharing:** Attach JPG, PNG, WEBP or GIF images. The upload
    limit is 5 MB.
-   **Message details:** Select a message to see its technical
    information, including message ID, sender ID, local time, UTC time
    and Unix timestamp.
-   **Relative timestamps:** Messages use short labels such as
    `5min ago` and `2hrs ago`, while the full time stays available in
    the details.
-   **Themes:** Switch between the original crimson, lime, cobalt and
    amber themes.
-   **Small extras:** Copy message text, open shared links, swipe right
    to reply on touch screens and jump to the latest messages.

## Built with

-   HTML, CSS and JavaScript
-   Firebase Authentication for anonymous sign in
-   Firebase Realtime Database for messages and online presence
-   ImgBB for image uploads
-   JetBrains Mono for the interface font

## Running it

1.  Clone or download this repository.
2.  Make sure the Firebase project configuration is set up in the HTML
    file.
3.  Enable anonymous sign in in Firebase Authentication.
4.  Set up the Realtime Database rules so authenticated users can access
    the room and presence data.
5.  Open `index.html` through a local web server or host it as a static
    site.

The app uses Firebase, so simply opening the page without a working
Firebase setup will not connect the chat.

## A few notes

The room is currently set to `public-lobby`. The page loads the latest
250 messages, and message text is limited to 500 characters. Image
uploads are handled by ImgBB, while chat messages and presence records
are stored in Firebase.

This is a hobby project, so the setup is intentionally lightweight.
Before making a public deployment, review your Firebase security rules
and make sure any public API keys are restricted where the provider
supports it.

------------------------------------------------------------------------

Made by [Rayyan](https://rayyanamer.github.io/)
