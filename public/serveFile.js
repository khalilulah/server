const fs = require("fs");
const path = require("path");

// Map file extensions to Content-Type values
const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".txt": "text/plain",
};

function serveFile(socket, filePath, sendResponse, keepAlive = false) {
  // Get the file extension to determine Content-Type
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // File not found — send 404
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
      return;
    }

    // data is a Buffer — send it directly
    sendResponse(
      socket,
      200,
      "OK",
      {
        "Content-Type": contentType,
        "Content-Length": data.length,
      },
      data,
      keepAlive,
    );
  });
}

module.exports = serveFile;
