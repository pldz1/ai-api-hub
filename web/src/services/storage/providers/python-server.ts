import axios from "axios";

export function shouldUseBrowserFallback(error) {
  if (!error?.response) return true;
  return [404, 405, 501, 502, 503, 504].includes(error.response.status);
}

export async function requestPythonServer({ method, endpoint, body, headers, timeout, hostUrl }) {
  const response = await axios({
    method,
    url: `${hostUrl + endpoint}`,
    data: body,
    headers,
    timeout,
    withCredentials: true,
  });

  return response.data;
}
