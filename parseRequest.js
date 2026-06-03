function parseRequest(raw) {
  // Split the raw request into individual lines
  const lines = raw.split("\r\n");

  // Line 0 is always the request line: "GET / HTTP/1.1"
  const [method, path, httpVersion] = lines[0].split(" ");

  // Now collect headers — they start at line 1
  // and end at the first empty line
  const headers = {};
  let i = 1;

  while (i < lines.length && lines[i] !== "") {
    const [key, ...valueParts] = lines[i].split(": ");
    // We use ...valueParts because some header values contain ': ' themselves
    headers[key.toLowerCase()] = valueParts.join(": ");
    i++;
  }

  // After the empty line, everything remaining is the body
  // i is currently pointing at the empty line, so body starts at i+1
  const body = lines.slice(i + 1).join("\r\n");

  return { method, path, httpVersion, headers, body };
}

module.exports = parseRequest;
