const net = require("net");
const path = require("path");
const parseRequest = require("./parseRequest");
const serveFile = require("./public/serveFile");

function sendResponse(socket, statusCode, statusMessage, headers, body) {
  let response = `HTTP/1.1 ${statusCode} ${statusMessage}\r\n`;

  for (const [key, value] of Object.entries(headers)) {
    response += `${key}: ${value}\r\n`;
  }

  response += "\r\n";

  // Write headers as text, then body as whatever it is (string or Buffer)
  socket.write(response);
  socket.write(body);
  socket.end();
}

function handleRequest(socket, request) {
  const { method, path: reqPath } = request;

  if (method === "GET" && reqPath === "/") {
    serveFile(
      socket,
      path.join(__dirname, "public", "index.html"),
      sendResponse,
    );
  } else if (method === "GET" && reqPath === "/style.css") {
    serveFile(
      socket,
      path.join(__dirname, "public", "style.css"),
      sendResponse,
    );
  } else if (method === "GET" && path === "/about") {
    const body = "This server was built from raw TCP sockets";
    sendResponse(
      socket,
      200,
      "OK",
      {
        "Content-Type": "text/plain",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    );
  } else if (method === "POST" && path === "/login") {
    const contentType = request.headers["content-type"] || "";
    let params = {};

    if (contentType.includes("application/json")) {
      // Body is a JSON string — parse it directly
      try {
        params = JSON.parse(request.body);
      } catch (e) {
        const body = "Invalid JSON";
        sendResponse(
          socket,
          400,
          "Bad Request",
          {
            "Content-Type": "text/plain",
            "Content-Length": Buffer.byteLength(body),
          },
          body,
        );
        return;
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      // Body is "username=khalil&password=1234"
      request.body.split("&").forEach((pair) => {
        const [key, value] = pair.split("=");
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      });
    }

    console.log("Login attempt:", params);

    const body = JSON.stringify({ message: `Welcome, ${params.username}` });
    sendResponse(
      socket,
      200,
      "OK",
      {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    );
  } else {
    const body = "Not Found";
    sendResponse(
      socket,
      404,
      "Not Found",
      {
        "Content-Type": "text/plain",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    );
  }
}

const server = net.createServer((socket) => {
  // Each socket gets its own buffer to accumulate incoming data
  let buffer = "";

  // Kill the connection if no complete request arrives within 5 seconds
  socket.setTimeout(5000);

  socket.on("timeout", () => {
    socket.end();
  });

  // Handle errors on this specific socket
  // WITHOUT this, a broken connection crashes the entire server
  socket.on("error", (err) => {
    // ECONNRESET means the client disconnected abruptly — completely normal
    if (err.code !== "ECONNRESET") {
      console.error("Socket error:", err.message);
    }
    socket.destroy();
  });

  socket.on("data", (chunk) => {
    buffer += chunk.toString();

    // Guard against a buffer that grows too large
    // This prevents a client sending infinite data from eating all memory
    if (buffer.length > 1e6) {
      const body = "Payload Too Large";
      sendResponse(
        socket,
        413,
        "Payload Too Large",
        {
          "Content-Type": "text/plain",
          "Content-Length": Buffer.byteLength(body),
        },
        body,
      );
      socket.destroy();
      return;
    }

    // Try to parse what we have so far
    const request = parseRequest(buffer);

    // If headers haven't fully arrived yet, keep waiting
    if (!request) return;

    // Malformed request line — method, path, or version is missing
    if (!request.method || !request.path || !request.httpVersion) {
      const body = "Bad Request";
      sendResponse(
        socket,
        400,
        "Bad Request",
        {
          "Content-Type": "text/plain",
          "Content-Length": Buffer.byteLength(body),
        },
        body,
      );
      socket.destroy();
      return;
    }

    // Check if we have the full body yet
    const contentLength = parseInt(
      request.headers["content-length"] || "0",
      10,
    );

    if (Buffer.byteLength(request.body) < contentLength) {
      // Body is still arriving, keep waiting for more chunks
      return;
    }

    // We have the complete request — handle it and reset the buffer
    buffer = "";

    // Wrap handleRequest in try/catch
    // If anything inside throws, we send a 500 instead of crashing
    try {
      handleRequest(socket, request);
    } catch (err) {
      console.error("Unhandled error:", err);
      const body = "Internal Server Error";

      try {
        sendResponse(
          socket,
          500,
          "Internal Server Error",
          {
            "Content-Type": "text/plain",
            "Content-Length": Buffer.byteLength(body),
          },
          body,
        );
      } catch (_) {
        // If even sending the 500 fails, just destroy the socket
        socket.destroy();
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
