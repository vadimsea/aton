# ATEN Desktop Architecture

The desktop client is planned as a native Qt application, not a web wrapper.

## Boundaries

- Backend remains the existing ATEN API.
- Web files are not imported into the desktop executable.
- UI state, local session, and native OS integration live in this project.

## Modules

- `app`: startup composition, configuration, application lifetime.
- `net`: HTTP API access and later realtime transport.
- `session`: local token and account persistence.
- `ui`: native Qt widget tree, styling, and interaction.

## Realtime Transport

The backend currently uses Socket.IO. Qt has WebSocket support, but Socket.IO is a higher-level protocol. We should choose one of these paths before implementing live chat:

1. Add a backend native WebSocket endpoint for desktop clients.
2. Use a maintained Socket.IO C++ client library.
3. Start with polling and add realtime after the first auth/chat screen works.

The cleanest long-term path is a small native WebSocket endpoint on the backend while keeping Socket.IO for the web client.
