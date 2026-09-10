import axios, { AxiosError } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Agent } from "node:https";
import { delay } from "./delay";

export class RequestHandler {
  static #instance: RequestHandler;
  tunnelTimeout = 30000; // 30 seconds
  api_key;
  agents: Agent[] = [];
  maxTries = 10;

  private constructor() {
    if (process.env.ENABLE_PROXY) {
      // Get the proxy URL from the environment variables.
      const proxyURLs = process.env.PROXY_ENDPOINT.split(",");

      for (let index in proxyURLs) {
        const proxyURL = proxyURLs[index];
        // Parse the proxy URL.
        const parsedUrl: URL = new URL(proxyURL);

        // Create an agent based on the proxy protocol.
        if (parsedUrl.protocol.startsWith("http")) {
          // Use HttpsProxyAgent for HTTP proxies.
          this.agents.push(new HttpsProxyAgent(proxyURL));
        } else if (parsedUrl.protocol.startsWith("socks")) {
          // Use SocksProxyAgent for SOCKS proxies.
          this.agents.push(new SocksProxyAgent(proxyURL));
        } else {
          // Throw an error if the proxy scheme is unsupported.
          throw new Error(`Unsupported proxy scheme: ${parsedUrl.protocol}`);
        }
      }
    }
  }

  public static get instance(): RequestHandler {
    if (!RequestHandler.#instance) {
      RequestHandler.#instance = new RequestHandler();
    }

    return RequestHandler.#instance;
  }

  /**
   * Retrieves the API key.
   *
   * @returns {Promise<string>} A promise that resolves with the API key.
   */
  async getApiKey(): Promise<string> {
    if (!this.api_key) {
      // Make a request to the API URL and extract the headers.
      const {
        changeHomestore: {
          storeLocator: {
            api: { headers },
          },
        },
      } = await this.proxiedRequest(process.env.API_URL, {}, {}, true);

      // Extract the API key from the headers.
      // Assumes the API key is in the first header and formatted as "key: value".
      this.api_key = headers[0].split(": ")[1];
    }
    return this.api_key;
  }

  /**
   * Sends a proxied request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {any} [headers={}] - The headers to include in the request.
   * @param {any} [params={}] - The query parameters to include in the request.
   * @param withoutApiKey
   * @returns {Promise<any>} A promise that resolves with the response data.
   * @throws {Error} If there is an error sending the request or if the proxy scheme is unsupported.
   */
  async proxiedRequest(
    url: string,
    headers: any = {},
    params: any = {},
    withoutApiKey = false,
  ): Promise<any> {
    if (!withoutApiKey) {
      headers["X-Cg-Apikey"] = await this.getApiKey();
    }

    headers["host"] =
      url === process.env.API_URL
        ? process.env.HOST_URL
        : process.env.API_HOST_URL; // Set the host URL in the request header.

    // Add anti-bot detection headers
    headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    headers["Accept"] = "application/json, text/plain, */*";
    headers["Accept-Language"] = "nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7";
    headers["Accept-Encoding"] = "gzip, deflate, br";
    headers["Connection"] = "keep-alive";
    headers["Referer"] = process.env.HOST_URL
      ? `https://${process.env.HOST_URL}`
      : "https://www.colruyt.be";
    headers["Origin"] = process.env.HOST_URL
      ? `https://${process.env.HOST_URL}`
      : "https://www.colruyt.be";
    headers["Sec-Fetch-Dest"] = "empty";
    headers["Sec-Fetch-Mode"] = "cors";
    headers["Sec-Fetch-Site"] = "same-site";

    let options: any = {
      timeout: this.tunnelTimeout, // Set the request timeout.
      headers, // Include the specified headers.
      params, // Include the specified query parameters.
    };

    let attempt = 0;
    const retryableStatusCodes = [405, 408, 429, 500, 502, 503, 504];

    while (true) {
      try {
        if (process.env.ENABLE_PROXY) {
          const agent =
            this.agents[Math.floor(Math.random() * this.agents.length)];

          options = {
            httpAgent: agent, // Use the created agent for HTTP requests.
            //httpsAgent: agent, // Use the created agent for HTTPS requests.
            ...options,
          };
        }
        // Send the request using axios.
        const response = await axios.get(url, options);
        // Return the response data.
        return response.data;
      } catch (error) {
        attempt++;
        const axiosError = error as AxiosError;

        // Log detailed debug information for errors
        console.error(`=== Request Error Debug Info ===`);
        console.error(`URL: ${url}`);
        console.error(`HTTP Method: GET`);
        console.error(`Attempt: ${attempt}/${this.maxTries}`);
        console.error(`Proxy Enabled: ${process.env.ENABLE_PROXY}`);
        console.error(`Error Status: ${axiosError.response?.status}`);
        console.error(`Error Code: ${axiosError.code}`);
        console.error(`Error Message: ${axiosError.message}`);

        // Log sanitized headers (hide sensitive data)
        const sanitizedHeaders = { ...headers };
        if (sanitizedHeaders["X-Cg-Apikey"]) {
          sanitizedHeaders["X-Cg-Apikey"] = "***HIDDEN***";
        }
        console.error(`Request Headers: ${JSON.stringify(sanitizedHeaders)}`);

        // Log request parameters
        console.error(`Request Params: ${JSON.stringify(params)}`);

        // Log response data if available
        if (axiosError.response?.data) {
          console.error(
            `Response Data: ${JSON.stringify(axiosError.response.data)}`,
          );
        }

        console.error(`=== End Debug Info ===`);

        if (attempt >= this.maxTries) {
          console.error(
            `Request failed after ${this.maxTries} attempts.`,
            error.message,
          );
          throw error;
        }

        const isRetryable =
          (axiosError.response &&
            retryableStatusCodes.includes(axiosError.response.status)) ||
          axiosError.code === "ECONNABORTED";

        if (isRetryable) {
          const delayTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
          console.warn(
            `Attempt ${attempt}: Request failed with ${
              axiosError.response?.status || axiosError.code
            }. Retrying in ${Math.round(delayTime / 1000)}s...`,
          );
          await delay(delayTime);
        } else {
          // Non-retryable error
          throw error;
        }
      }
    }
  }
}
